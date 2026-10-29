import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { requireAuth } from "../../middleware/auth.js";
import { ah } from "../../utils/async-handler.js";
import { AppError } from "../../utils/errors.js";
import { accountForPayment, createCheckout, ensureSubscription, getOwnedBusiness, subscriptionForBusiness, subscriptionView, verifyWebhookAndApply } from "./service.js";
import { BillingPayment } from "./models.js";

const phoneSchema = z.string().trim().min(6, "Saisissez un numéro de téléphone valide").max(30);

export function billingRouter(env: Env) {
  const router = Router();

  router.get("/current", requireAuth, ah(async (req, res) => {
    const { business, isOwner } = await getOwnedBusiness(req.auth!.userId, req.get("x-business-id") ?? "");
    const subscription = await subscriptionForBusiness(business._id);
    const payments = await BillingPayment.find({ businessId: business._id, status: "paid" }).sort({ paidAt: -1 }).limit(12).select("reference amount currency paidAt");
    res.json({
      data: {
        ...subscriptionView(subscription),
        businessName: business.name,
        isOwner,
        paymentConfigured: !!env.FEDAPAY_SECRET_KEY,
        remindersConfigured: !!env.SMTP_URL,
        payments: payments.map((payment) => ({ reference: payment.reference, amount: payment.amount, currency: payment.currency, paidAt: payment.paidAt })),
      },
    });
  }));

  router.post("/checkout", requireAuth, ah(async (req, res) => {
    const { phone } = z.object({ phone: phoneSchema }).parse(req.body);
    const idempotencyKey = z.string().trim().min(8).max(128).parse(req.get("idempotency-key"));
    const { business } = await getOwnedBusiness(req.auth!.userId, req.get("x-business-id") ?? "", true);
    const user = await accountForPayment(req.auth!.userId);
    const subscription = await ensureSubscription(business._id, business.createdAt);
    const checkout = await createCheckout(env, {
      businessId: business._id,
      subscriptionId: subscription._id,
      businessName: business.name,
      fullName: user.fullName,
      email: user.email,
      phone,
      clientOrigin: env.CLIENT_ORIGIN,
      idempotencyKey,
    });
    res.status(201).json({ data: checkout });
  }));

  router.post("/webhook", ah(async (req, res) => {
    await verifyWebhookAndApply(env, req.body);
    res.status(204).end();
  }));

  router.post("/refresh", requireAuth, ah(async (req, res) => {
    const { business } = await getOwnedBusiness(req.auth!.userId, req.get("x-business-id") ?? "");
    if (!env.FEDAPAY_SECRET_KEY) throw new AppError(503, "PAYMENT_NOT_CONFIGURED", "Le paiement en ligne n'est pas encore configuré.");
    const { reference } = z.object({ reference: z.string().trim().min(8).max(100).optional() }).parse(req.body);
    const payment = reference
      ? await BillingPayment.findOne({ businessId: business._id, reference })
      : await BillingPayment.findOne({ businessId: business._id, status: "pending" }).sort({ createdAt: -1 });
    const paymentStatus = payment?.providerTransactionId
      ? await verifyWebhookAndApply(env, { entity: { id: payment.providerTransactionId } })
      : payment?.status ?? "unknown";
    const subscription = await subscriptionForBusiness(business._id);
    res.json({ data: { ...subscriptionView(subscription), paymentStatus } });
  }));

  return router;
}

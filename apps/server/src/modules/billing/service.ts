import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { runTx } from "../../db/tx.js";
import { Business, Membership } from "../businesses/models.js";
import { User } from "../auth/models.js";
import { Subscription, BillingPayment } from "./models.js";
import { AppError, forbidden, notFound } from "../../utils/errors.js";
import type { Env } from "../../config/env.js";

export const MONTHLY_PRICE = 7000;

export function phoneForFedaPay(value: string): { number: number; country: string } {
  const digits = value.replace(/\D/g, "");
  const countryPrefixes = [
    { prefix: "00229", country: "bj" },
    { prefix: "229", country: "bj" },
    { prefix: "00225", country: "ci" },
    { prefix: "225", country: "ci" },
    { prefix: "00228", country: "tg" },
    { prefix: "228", country: "tg" },
    { prefix: "00221", country: "sn" },
    { prefix: "221", country: "sn" },
    { prefix: "00226", country: "bf" },
    { prefix: "226", country: "bf" },
    { prefix: "00223", country: "ml" },
    { prefix: "223", country: "ml" },
    { prefix: "00227", country: "ne" },
    { prefix: "227", country: "ne" },
  ];
  for (const { prefix, country } of countryPrefixes) {
    if (digits.startsWith(prefix)) {
      const local = digits.slice(prefix.length);
      if (/^\d{8,10}$/.test(local)) {
        return { number: Number(local), country };
      }
    }
  }
  if (/^\d{8,10}$/.test(digits)) {
    return { number: Number(digits), country: "bj" };
  }
  throw new AppError(400, "INVALID_PHONE", "Saisissez un numéro de téléphone valide (8 à 10 chiffres, avec ou sans indicatif pays).");
}

export function addOneMonth(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function ensureSubscription(businessId: Types.ObjectId, createdAt: Date) {
  const trialStartedAt = new Date(createdAt);
  return Subscription.findOneAndUpdate(
    { businessId },
    { $setOnInsert: { businessId, trialStartedAt, trialEndsAt: addOneMonth(trialStartedAt) } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}

export function subscriptionView(subscription: NonNullable<Awaited<ReturnType<typeof ensureSubscription>>>, now = new Date()) {
  const paidUntil = subscription.currentPeriodEndsAt;
  const status = paidUntil && paidUntil > now ? "active" : subscription.trialEndsAt > now ? "trial" : "expired";
  const accessUntil = status === "active" ? paidUntil! : status === "trial" ? subscription.trialEndsAt : null;
  const daysRemaining = accessUntil ? Math.max(0, Math.ceil((accessUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  return {
    status,
    access: status !== "expired",
    trialStartedAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEndsAt: paidUntil ?? null,
    accessUntil,
    daysRemaining,
    monthlyPrice: MONTHLY_PRICE,
    currency: "XOF" as const,
  };
}

export async function getOwnedBusiness(userId: Types.ObjectId, rawBusinessId: string, ownerOnly = false) {
  if (!Types.ObjectId.isValid(rawBusinessId)) throw new AppError(400, "BUSINESS_REQUIRED", "Commerce actif manquant");
  const business = await Business.findById(rawBusinessId);
  if (!business) throw notFound("Commerce introuvable");
  const membership = await Membership.findOne({ businessId: business._id, userId, status: "active" });
  if (!membership) throw notFound("Commerce introuvable");
  const isOwner = business.ownerId.equals(userId) && membership.role === "owner";
  if (ownerOnly && !isOwner) throw forbidden("Seul le propriétaire peut gérer l'abonnement.");
  return { business, isOwner };
}

type ProviderResponse = { data?: Record<string, unknown>; v1?: Record<string, unknown>; [key: string]: unknown };
function providerRecord(body: ProviderResponse) {
  const data = body.v1 ?? body.data ?? body;
  return data as Record<string, unknown>;
}

async function fedapayRequest(env: Env, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  if (!env.FEDAPAY_SECRET_KEY) throw new AppError(503, "PAYMENT_NOT_CONFIGURED", "Le paiement en ligne n'est pas encore configuré.");
  const base = env.FEDAPAY_MODE === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${env.FEDAPAY_SECRET_KEY}`, Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AppError(502, "PAYMENT_PROVIDER_UNAVAILABLE", "FedaPay est temporairement indisponible. Réessayez dans quelques instants.");
  }
  const payload = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok) throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "FedaPay n'a pas pu démarrer le paiement. Vérifiez la configuration ou réessayez.");
  return providerRecord(payload);
}

export async function createCheckout(env: Env, input: {
  businessId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  clientOrigin: string;
}) {
  const reference = `KM-${randomUUID()}`;
  const payment = await BillingPayment.create({
    businessId: input.businessId, subscriptionId: input.subscriptionId, reference, amount: MONTHLY_PRICE, currency: "XOF",
  });
  const [firstName, ...lastName] = input.fullName.trim().split(/\s+/);
  try {
    const transaction = await fedapayRequest(env, "/transactions", {
      method: "POST",
      body: JSON.stringify({
        description: `Abonnement K-Manage ${input.businessName} (${reference})`,
        amount: MONTHLY_PRICE,
        currency: { iso: "XOF" },
        callback_url: `${input.clientOrigin.replace(/\/$/, "")}/billing?payment=${encodeURIComponent(reference)}`,
        customer: {
          firstname: firstName,
          lastname: lastName.join(" ") || firstName,
          email: input.email,
          phone_number: phoneForFedaPay(input.phone),
        },
        custom_metadata: { k_manage_reference: reference },
      }),
    });
    const transactionId = transaction.id;
    if (transactionId === undefined || transactionId === null) throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "FedaPay n'a pas retourné de référence de transaction.");
    const token = await fedapayRequest(env, `/transactions/${encodeURIComponent(String(transactionId))}/token`, { method: "POST", body: JSON.stringify({}) });
    const paymentUrl = token.url ?? token.payment_url ?? (token.token ? `https://checkout.fedapay.com/${String(token.token)}` : undefined);
    let checkoutHost = "";
    if (typeof paymentUrl === "string") {
      try { checkoutHost = new URL(paymentUrl).hostname; } catch { /* URL fournisseur invalide */ }
    }
    if (typeof paymentUrl !== "string" || !paymentUrl.startsWith("https://") || !(checkoutHost === "fedapay.com" || checkoutHost.endsWith(".fedapay.com"))) {
      throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "FedaPay n'a pas retourné de lien de paiement valide.");
    }
    payment.providerTransactionId = String(transactionId);
    await payment.save();
    return { paymentUrl, reference };
  } catch (error) {
    await BillingPayment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed" } });
    throw error;
  }
}

export async function verifyWebhookAndApply(env: Env, payload: unknown): Promise<"paid" | "pending" | "failed" | "unknown"> {
  if (!payload || typeof payload !== "object") throw new AppError(400, "INVALID_WEBHOOK", "Notification de paiement invalide.");
  const record = payload as Record<string, unknown>;
  const data = (record.entity ?? record.data ?? record) as Record<string, unknown>;
  const rawId = data && typeof data === "object" ? data.id : undefined;
  if (rawId === undefined || rawId === null) throw new AppError(400, "INVALID_WEBHOOK", "Référence de transaction absente.");
  const payment = await BillingPayment.findOne({ providerTransactionId: String(rawId) });
  if (!payment) return "unknown";
  if (payment.status === "paid") return "paid";
  if (payment.status === "failed") return "failed";

  const providerTransaction = await fedapayRequest(env, `/transactions/${encodeURIComponent(String(rawId))}`);
  const currencyValue = providerTransaction.currency as Record<string, unknown> | string | undefined;
  const currency = typeof currencyValue === "string" ? currencyValue : currencyValue?.iso;
  const status = String(providerTransaction.status).toLowerCase();
  if (status !== "approved" || Number(providerTransaction.amount) !== payment.amount || (currency !== undefined && currency !== payment.currency)) {
    if (["declined", "canceled", "cancelled", "refunded"].includes(status)) {
      await BillingPayment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed" } });
      return "failed";
    }
    return "pending";
  }

  const paidAt = new Date();
  const subscription = await Subscription.findById(payment.subscriptionId);
  if (!subscription) throw new AppError(500, "SUBSCRIPTION_MISSING", "Abonnement associé au paiement introuvable.");
  const nextEnd = addOneMonth(subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt > paidAt
    ? subscription.currentPeriodEndsAt
    : paidAt);
  await runTx(async (tx) => {
    const marked = await tx.update(BillingPayment, { _id: payment._id, status: "pending" }, { $set: { status: "paid", paidAt } }, { status: "pending", paidAt: undefined });
    if (!marked) return;
    const updated = await tx.update(
      Subscription,
      { _id: subscription._id },
      { $set: { currentPeriodEndsAt: nextEnd } },
      { currentPeriodEndsAt: subscription.currentPeriodEndsAt },
    );
    if (!updated) throw new AppError(500, "SUBSCRIPTION_UPDATE_FAILED", "Impossible de prolonger l'abonnement après le paiement.");
  });
  const confirmed = await BillingPayment.exists({ _id: payment._id, status: "paid" });
  return confirmed ? "paid" : "pending";
}

export async function subscriptionForBusiness(businessId: Types.ObjectId) {
  const business = await Business.findById(businessId);
  if (!business) throw notFound("Commerce introuvable");
  return ensureSubscription(business._id, business.createdAt);
}

export async function accountForPayment(userId: Types.ObjectId) {
  const user = await User.findById(userId);
  if (!user) throw notFound("Compte introuvable");
  return user;
}

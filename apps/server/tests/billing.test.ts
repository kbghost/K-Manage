import { describe, expect, it } from "vitest";
import { Subscription } from "../src/modules/billing/models.js";
import { addOneMonth, paidPeriodAfterPayment, subscriptionView } from "../src/modules/billing/service.js";

describe("billing calendar and access", () => {
  it("adds a calendar month and clamps dates at the end of shorter months", () => {
    expect(addOneMonth(new Date("2026-01-31T12:00:00.000Z")).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addOneMonth(new Date("2024-01-31T12:00:00.000Z")).toISOString()).toBe("2024-02-29T12:00:00.000Z");
  });

  it("grants access during the trial and after a confirmed payment period", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const trial = new Subscription({ trialStartedAt: new Date("2026-06-01"), trialEndsAt: new Date("2026-07-01") });
    expect(subscriptionView(trial, now)).toMatchObject({ status: "trial", access: true, monthlyPrice: 7000, currency: "XOF" });

    trial.currentPeriodEndsAt = new Date("2026-07-15");
    expect(subscriptionView(trial, now)).toMatchObject({ status: "active", access: true });
  });

  it("starts an early-paid period after the trial without consuming trial access", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const trialEndsAt = new Date("2026-07-01T00:00:00.000Z");
    const paidPeriod = paidPeriodAfterPayment(now, trialEndsAt);
    const subscription = new Subscription({
      trialStartedAt: new Date("2026-06-01T00:00:00.000Z"),
      trialEndsAt,
      currentPeriodStartsAt: paidPeriod.startsAt,
      currentPeriodEndsAt: paidPeriod.endsAt,
    });

    expect(paidPeriod.startsAt).toEqual(trialEndsAt);
    expect(paidPeriod.endsAt).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(subscriptionView(subscription, now)).toMatchObject({
      status: "trial",
      access: true,
      accessUntil: trialEndsAt,
    });
    expect(subscriptionView(subscription, trialEndsAt)).toMatchObject({
      status: "active",
      access: true,
      accessUntil: paidPeriod.endsAt,
    });
  });

  it("queues an early renewal after the already-paid period", () => {
    const paidAt = new Date("2026-07-15T00:00:00.000Z");
    const currentPeriodEndsAt = new Date("2026-08-01T00:00:00.000Z");

    expect(paidPeriodAfterPayment(paidAt, new Date("2026-07-01T00:00:00.000Z"), currentPeriodEndsAt)).toEqual({
      startsAt: currentPeriodEndsAt,
      endsAt: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("removes access after the trial and paid period have both expired", () => {
    const expired = new Subscription({
      trialStartedAt: new Date("2026-01-01"),
      trialEndsAt: new Date("2026-02-01"),
      currentPeriodEndsAt: new Date("2026-03-01"),
    });
    expect(subscriptionView(expired, new Date("2026-03-02"))).toMatchObject({ status: "expired", access: false, accessUntil: null });
  });
});

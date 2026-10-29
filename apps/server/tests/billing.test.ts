import { describe, expect, it } from "vitest";
import { Subscription } from "../src/modules/billing/models.js";
import { addOneMonth, subscriptionView } from "../src/modules/billing/service.js";

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

  it("removes access after the trial and paid period have both expired", () => {
    const expired = new Subscription({
      trialStartedAt: new Date("2026-01-01"),
      trialEndsAt: new Date("2026-02-01"),
      currentPeriodEndsAt: new Date("2026-03-01"),
    });
    expect(subscriptionView(expired, new Date("2026-03-02"))).toMatchObject({ status: "expired", access: false, accessUntil: null });
  });
});

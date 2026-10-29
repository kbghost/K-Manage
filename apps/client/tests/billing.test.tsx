import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import App from "../src/App";
import { loggedIn, mockApi, renderApp } from "./helpers";

describe("landing et abonnement", () => {
  it("présente la plateforme et le tarif aux visiteurs non connectés", async () => {
    mockApi({ "GET /auth/me": () => ({ status: 401, body: { error: { code: "UNAUTHORIZED" } } }) });
    renderApp(<App />, "/");
    expect(await screen.findByRole("heading", { name: "Tout votre commerce, au même endroit." })).toBeInTheDocument();
    expect(screen.getByText(/7 000/)).toBeInTheDocument();
    expect(screen.getByText(/1 mois d’essai gratuit/)).toBeInTheDocument();
  });

  it("affiche l'état de l'abonnement et le paiement FedaPay au propriétaire", async () => {
    mockApi({
      ...loggedIn,
      "GET /billing/current": () => ({ body: { data: {
        status: "expired", access: false, trialStartedAt: "2026-01-01", trialEndsAt: "2026-02-01",
        currentPeriodEndsAt: null, accessUntil: null, monthlyPrice: 7000, currency: "XOF",
        businessName: "Boutique Test", isOwner: true, paymentConfigured: true, payments: [],
      } } }),
    });
    renderApp(<App />, "/billing");
    expect(await screen.findByRole("heading", { name: "Abonnement" })).toBeInTheDocument();
    expect(screen.getByText("Accès suspendu")).toBeInTheDocument();
    expect(screen.getByLabelText("Téléphone pour le paiement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FedaPay/ })).toBeDisabled();
  });

  it("vérifie la référence exacte du paiement renvoyé par FedaPay", async () => {
    const calls = mockApi({
      ...loggedIn,
      "GET /billing/current": () => ({
        body: {
          data: {
            status: "trial",
            access: true,
            trialEndsAt: "2026-11-29T00:00:00.000Z",
            currentPeriodEndsAt: null,
            monthlyPrice: 7000,
            currency: "XOF",
            businessName: "Boutique Test",
            isOwner: true,
            paymentConfigured: true,
            remindersConfigured: false,
            payments: [],
          },
        },
      }),
      "POST /billing/refresh": () => ({
        body: {
          data: {
            status: "trial",
            access: true,
            paymentStatus: "pending",
          },
        },
      }),
    });

    renderApp(<App />, "/billing?payment=KM-test-reference");

    expect(await screen.findByText(/Le paiement n’est pas encore confirmé/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === "POST" && call.path === "/billing/refresh")?.body).toEqual({
      reference: "KM-test-reference",
    });
  });
});

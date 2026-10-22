import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { loggedIn, mockApi, PRODUCTS, renderApp } from "./helpers";

const notLogged = { "GET /auth/me": () => ({ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Connexion requise" } } }) };

describe("authentification et navigation", () => {
  it("redirige vers la connexion quand on n'est pas connecte", async () => {
    mockApi(notLogged); renderApp(<App />, "/products");
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
  });
  it("valide le formulaire de connexion avant tout appel reseau", async () => {
    const calls = mockApi(notLogged); renderApp(<App />, "/login");
    await userEvent.click(await screen.findByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Saisissez votre email")).toBeInTheDocument(); expect(screen.getByText("Saisissez votre mot de passe")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/auth/login")).toBe(false);
  });
  it("affiche l'erreur du serveur lisible en cas d'identifiants incorrects", async () => {
    mockApi({ ...notLogged, "POST /auth/login": () => ({ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" } } }) });
    renderApp(<App />, "/login");
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.bj"); await userEvent.type(screen.getByLabelText("Mot de passe"), "mauvais"); await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou mot de passe incorrect");
  });
  it("redirige immédiatement après connexion vers la création de boutique sans commerce", async () => {
    mockApi({
      ...notLogged,
      "POST /auth/login": () => ({ body: { data: { id: "u1", email: "a@b.bj", fullName: "Awa Test", csrfToken: "csrf" } } }),
      "GET /businesses": () => ({ body: { data: [] } }),
    });
    renderApp(<App />, "/login");
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.bj");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "motdepasse");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { name: "Bienvenue ! Enregistrez votre boutique" })).toBeInTheDocument();
  });
  it("redirige immédiatement après inscription vers la création de boutique", async () => {
    mockApi({
      ...notLogged,
      "POST /auth/register": () => ({ status: 201, body: { data: { id: "u1", email: "a@b.bj", fullName: "Awa Test", csrfToken: "csrf" } } }),
      "GET /businesses": () => ({ body: { data: [] } }),
    });
    renderApp(<App />, "/register");
    await userEvent.type(await screen.findByLabelText("Nom complet"), "Awa Test");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.bj");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "motdepasse123");
    await userEvent.type(screen.getByPlaceholderText("Confirmez votre mot de passe"), "motdepasse123");
    await userEvent.click(screen.getByRole("button", { name: "Creer mon compte" }));
    expect(await screen.findByRole("heading", { name: "Bienvenue ! Enregistrez votre boutique" })).toBeInTheDocument();
  });
  it("connecte puis affiche l'application avec la navigation filtree par permissions", async () => {
    mockApi({ ...loggedIn, "GET /reports/dashboard": () => ({ body: { data: { summary: { salesCount: 0, netSales: 0, collected: 0, grossMargin: null, expenses: null, receivables: 0, payables: 0, lowStockCount: 0, outOfStockCount: 0, refunds: 0 }, today: { revenue: 0, salesCount: 0 }, series: [], topProducts: [], recent: [] } } }) });
    renderApp(<App />, "/");
    expect(await screen.findByRole("heading", { name: "Tableau de bord" }, { timeout: 8000 })).toBeInTheDocument();
    const nav = screen.getAllByRole("navigation", { name: "Navigation principale" })[0]!;
    expect(within(nav).getByRole("link", { name: /Point de vente/ })).toBeInTheDocument(); expect(within(nav).queryByRole("link", { name: /Employes/ })).not.toBeInTheDocument();
    expect(await screen.findByText("Aucune vente sur cette période.", {}, { timeout: 5000 })).toBeInTheDocument();
  });
  it("affiche « acces non autorise » quand le role ne permet pas la page", async () => {
    mockApi(loggedIn); renderApp(<App />, "/members");
    expect(await screen.findByText("Acces non autorise")).toBeInTheDocument();
  });
  it("le menu mobile s'ouvre et se ferme", async () => {
    mockApi({ ...loggedIn, "GET /catalog/products": () => ({ body: { data: PRODUCTS, meta: { total: 2, page: 1, limit: 20, pages: 1 } } }), "GET /catalog/categories": () => ({ body: { data: [] } }) });
    renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" })); expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fermer le menu" })); await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument());
  });
});

describe("produits", () => {
  it("liste, recherche et valide le formulaire de creation", async () => {
    const calls = mockApi({ ...loggedIn, "GET /catalog/products": () => ({ body: { data: PRODUCTS, meta: { total: 2, page: 1, limit: 20, pages: 1 } } }), "GET /catalog/categories": () => ({ body: { data: [] } }) });
    renderApp(<App />, "/products");
    expect(await screen.findByText("Riz 5 kg")).toBeInTheDocument(); expect(screen.getByText("Epuise")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Nouveau produit/ })); const dlg = await screen.findByRole("dialog", { name: "Nouveau produit" });
    await userEvent.click(within(dlg).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dlg).findByText("Le nom est obligatoire")).toBeInTheDocument(); expect(calls.some((c) => c.method === "POST" && c.path === "/catalog/products")).toBe(false);
  });
  it("affiche l'etat d'erreur avec possibilite de reessayer", async () => {
    mockApi({ ...loggedIn, "GET /catalog/products": () => ({ status: 500, body: { error: { code: "INTERNAL", message: "Une erreur interne est survenue" } } }), "GET /catalog/categories": () => ({ body: { data: [] } }) });
    renderApp(<App />, "/products");
    expect(await screen.findByText("Une erreur interne est survenue")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Reessayer" })).toBeInTheDocument();
  });
});

describe("point de vente", () => {
  const pos = { ...loggedIn, "GET /catalog/products": () => ({ body: { data: PRODUCTS, meta: { total: 2, page: 1, limit: 24, pages: 1 } } }), "GET /parties/customers": () => ({ body: { data: [{ id: "c1", name: "Client A", balance: 0, status: "active" }], meta: { total: 1, page: 1, limit: 100, pages: 1 } } }), "GET /cash-sessions/current": () => ({ body: { data: null } }) };
  it("ajoute au panier, calcule le total et exige un client pour un credit", async () => {
    mockApi(pos); renderApp(<App />, "/pos");
    await userEvent.click(await screen.findByRole("button", { name: /^Riz 5 kgRIZ5/ })); await userEvent.click(screen.getByRole("button", { name: /^Riz 5 kgRIZ5/ }));
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/7[\s\u202f\u00a0]600/);
    expect(screen.getByText(/Aucune caisse ouverte/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Valider la vente/ })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez un client");
    await userEvent.click(screen.getByRole("button", { name: "Payer la totalite" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Valider la vente/ })).toBeEnabled());
  });
  it("envoie la vente avec une cle d'idempotence, sans aucun total calcule par le navigateur", async () => {
    let seen: Headers | undefined;
    const calls = mockApi({ ...pos, "POST /sales": (init) => { seen = new Headers(init?.headers); return { status: 201, body: { data: { id: "s1", number: "V-000001", lines: [{ productId: "p1", name: "Riz 5 kg", sku: "RIZ5", quantityMilli: 1000, unitPrice: 3800, discount: 0, total: 3800, netTotal: 3800, refundedQtyMilli: 0, refundedValue: 0 }], subtotal: 3800, discount: 0, total: 3800, paidAmount: 3800, refundedTotal: 0, remaining: 0, paymentStatus: "paid", status: "completed", createdAt: new Date().toISOString(), payments: [] } } }; } });
    renderApp(<App />, "/pos");
    await userEvent.click(await screen.findByRole("button", { name: /^Riz 5 kgRIZ5/ })); await userEvent.click(screen.getByRole("button", { name: "Payer la totalite" }));
    await userEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    expect(await screen.findByRole("dialog", { name: /Recu V-000001/ })).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST" && c.path === "/sales")!;
    expect(post.body).toEqual({ lines: [{ productId: "p1", quantity: 1 }], payments: [{ method: "cash", amount: 3800 }] });
    expect(seen?.get("Idempotency-Key")).toMatch(/[0-9a-f-]{36}/); expect(seen?.get("x-business-id")).toBe("b1");
  });
  it("refuse d'ajouter un produit epuise", async () => {
    mockApi(pos); renderApp(<App />, "/pos");
    expect(await screen.findByRole("button", { name: /^Sucre 1 kgSUCRE/ })).toBeDisabled();
  });
});

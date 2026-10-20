import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { buildInsights } from "../src/lib/insights";
import { bumpFrequent, computeStreak, getGoal, getRecents, greeting, pushRecent, setGoal, topFrequent } from "../src/lib/prefs";
import { loggedIn, mockApi, PRODUCTS, renderApp } from "./helpers";

const dash = (over: Partial<{ revenue: number; count: number }> = {}) => ({ "GET /reports/dashboard": () => ({ body: { data: {
  summary: { salesCount: 3, netSales: 9000, collected: 9000, grossMargin: 800, expenses: 0, receivables: 2500, payables: 0, lowStockCount: 1, outOfStockCount: 2, refunds: 0 },
  today: { revenue: over.revenue ?? 1500, salesCount: over.count ?? 1 }, series: [{ period: "2026-10-17", net: 3000, count: 1 }, { period: "2026-10-18", net: 6000, count: 2 }, { period: "2026-10-19", net: 0, count: 0 }], topProducts: [], recent: [] } } }) });
const prodRoutes = { "GET /catalog/products": () => ({ body: { data: PRODUCTS, meta: { total: 2, page: 1, limit: 20, pages: 1 } } }), "GET /catalog/categories": () => ({ body: { data: [] } }) };

describe("identite visuelle", () => {
  it("utilise la police Poppins (auto-hebergee) et des tailles de lecture confortables", () => {
    const css = readFileSync("src/index.css", "utf8"); const main = readFileSync("src/main.tsx", "utf8");
    expect(css).toContain('"Poppins"'); expect(main).toContain("@fontsource/poppins/latin-400.css"); expect(main).toContain("@fontsource/poppins/latin-600.css");
    expect(css).toMatch(/--text-sm:\s*0\.9375rem/); expect(css).toMatch(/html\s*\{\s*font-size:\s*16px/);
  });
  it("les icones sont bicolores (Phosphor Duotone : trait + ton secondaire)", async () => {
    mockApi({ ...loggedIn, ...prodRoutes }); renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    const svg = document.querySelector("svg.duo"); expect(svg).toBeTruthy(); expect(svg!.querySelector('[opacity="0.2"]')).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("lucide");
  });
});

describe("mode sombre", () => {
  it("bascule, memorise le choix et applique la classe dark", async () => {
    mockApi({ ...loggedIn, ...prodRoutes }); renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    await userEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark")); expect(localStorage.getItem("km_theme")).toBe("dark");
    await userEvent.click(await screen.findByRole("button", { name: "Passer en mode clair" })); await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
  });
});

describe("navigation rapide", () => {
  it("la palette Ctrl+K filtre les pages selon les droits et navigue avec Entree", async () => {
    mockApi({ ...loggedIn, ...prodRoutes }); renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    await userEvent.keyboard("{Control>}k{/Control}");
    const dlg = await screen.findByRole("dialog", { name: "Recherche rapide" });
    await userEvent.type(within(dlg).getByRole("combobox"), "stoc");
    expect(await within(dlg).findByRole("option", { name: /Stocks/ })).toBeInTheDocument(); expect(within(dlg).queryByRole("option", { name: /Employés/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Recherche rapide" })).not.toBeInTheDocument());
  });
  it("les raccourcis clavier fonctionnent : ? ouvre l'aide, t change le theme, et sont ignores dans un champ", async () => {
    mockApi({ ...loggedIn, ...prodRoutes }); renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    await userEvent.keyboard("?"); expect(await screen.findByRole("dialog", { name: "Raccourcis clavier" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}"); await waitFor(() => expect(screen.queryByRole("dialog", { name: "Raccourcis clavier" })).not.toBeInTheDocument());
    await userEvent.keyboard("t"); await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await userEvent.click(screen.getByRole("searchbox", { name: /Nom, SKU/ })); await userEvent.keyboard("?");
    expect(screen.queryByRole("dialog", { name: "Raccourcis clavier" })).not.toBeInTheDocument();
  });
  it("le menu lateral peut etre replie et l'etat est memorise", async () => {
    mockApi({ ...loggedIn, ...prodRoutes }); renderApp(<App />, "/products"); await screen.findByRole("heading", { name: "Produits" });
    await userEvent.click(screen.getByRole("button", { name: "Replier le menu" })); expect(localStorage.getItem("km_nav_collapsed")).toBe("1"); expect(await screen.findByRole("button", { name: "Déplier le menu" })).toBeInTheDocument();
  });
});

describe("engagement", () => {
  it("le tableau de bord salue l'utilisateur, anime l'objectif et felicite quand il est atteint", async () => {
    localStorage.setItem("km:b1:goal", "1000");
    mockApi({ ...loggedIn, ...dash({ revenue: 1500 }) }); renderApp(<App />, "/");
    expect(await screen.findByText(/Awa/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText("Objectif atteint !")).toBeInTheDocument(); expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100"); expect(screen.getByText("150%")).toBeInTheDocument();
    expect(localStorage.getItem("km:b1:celebrated")).toBeTruthy();
    expect(screen.getByText("Conseils du jour")).toBeInTheDocument(); expect(screen.getByText(/2 produit\(s\) épuisé\(s\)/)).toBeInTheDocument();
  });
  it("le point de vente propose les produits favoris appris des ventes precedentes", async () => {
    localStorage.setItem("km:b1:freq", JSON.stringify({ p1: { id: "p1", name: "Riz 5 kg", n: 9, last: Date.now() } }));
    mockApi({ ...loggedIn, "GET /catalog/products": () => ({ body: { data: PRODUCTS, meta: { total: 2, page: 1, limit: 24, pages: 1 } } }), "GET /parties/customers": () => ({ body: { data: [], meta: { total: 0, page: 1, limit: 100, pages: 1 } } }), "GET /cash-sessions/current": () => ({ body: { data: { id: "s", status: "open" } } }) });
    renderApp(<App />, "/pos");
    expect(await screen.findByLabelText("Vos favoris")).toHaveTextContent("Riz 5 kg");
  });
});

describe("logique d'engagement (pure)", () => {
  it("serie de jours consecutifs", () => {
    const s = [{ period: "2026-10-16", count: 2 }, { period: "2026-10-17", count: 1 }, { period: "2026-10-18", count: 3 }, { period: "2026-10-14", count: 1 }];
    expect(computeStreak(s, "2026-10-18")).toBe(3); expect(computeStreak(s, "2026-10-19")).toBe(3); expect(computeStreak(s, "2026-10-21")).toBe(0);
  });
  it("salutation selon l'heure", () => { expect([greeting(3), greeting(9), greeting(15), greeting(21)]).toEqual(["Bonne nuit", "Bonjour", "Bon apres-midi", "Bonsoir"]); });
  it("favoris, objectif et recents sont separes par commerce", () => {
    bumpFrequent("A", { id: "1", name: "Riz" }); bumpFrequent("A", { id: "1", name: "Riz" }); bumpFrequent("A", { id: "2", name: "Sucre" }); bumpFrequent("B", { id: "9", name: "Huile" });
    expect(topFrequent("A").map((f) => [f.name, f.n])).toEqual([["Riz", 2], ["Sucre", 1]]); expect(topFrequent("B")).toHaveLength(1);
    setGoal("A", 25000.4); expect(getGoal("A")).toBe(25000); expect(getGoal("B")).toBe(0);
    pushRecent("A", { to: "/pos", label: "Point de vente" }); pushRecent("A", { to: "/pos", label: "Point de vente" }); expect(getRecents("A")).toHaveLength(1);
  });
  it("les conseils reposent sur les vrais chiffres et sont priorises", () => {
    const d = { summary: { netSales: 10000, grossMargin: 1000, receivables: 5000, payables: 0, lowStockCount: 0, outOfStockCount: 2 }, today: { revenue: 0, salesCount: 0 }, series: [] };
    const ins = buildInsights(d, 0, "Africa/Porto-Novo"); expect(ins[0]!.tone).toBe("danger"); expect(ins.map((i) => i.id)).toEqual(expect.arrayContaining(["out", "recv", "margin-low", "no-sale"])); expect(ins.length).toBeLessThanOrEqual(4);
  });
});

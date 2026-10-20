import { expect, test } from "@playwright/test";

// Comptes de demonstration crees par `npm run seed` (mot de passe : voir README). Developpement local uniquement.
const PASSWORD = "Demo-K-Manage-2026";
async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("connexion invalide : message d'erreur lisible", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("inconnu@exemple.com");
  await page.getByLabel("Mot de passe").fill("mauvais");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});

test("le caissier vend un produit en especes et obtient un recu", async ({ page }) => {
  await login(page, "caissier@demo.k-manage.local");
  await page.goto("/pos");
  await page.getByRole("button", { name: /^Eau minerale/ }).click();
  await page.getByRole("button", { name: "Payer la totalite" }).click();
  await page.getByRole("button", { name: /Valider la vente/ }).click();
  await expect(page.getByRole("dialog", { name: /Recu V-/ })).toBeVisible();
});

test("le caissier n'a pas acces aux employes ni au journal", async ({ page }) => {
  await login(page, "caissier@demo.k-manage.local");
  await page.goto("/members");
  await expect(page.getByText("Acces non autorise")).toBeVisible();
});

test("la navigation reste utilisable sur petit ecran", async ({ page, isMobile }) => {
  test.skip(!isMobile, "scenario mobile uniquement");
  await login(page, "gerant@demo.k-manage.local");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("link", { name: "Produits" }).click();
  await expect(page.getByRole("heading", { name: "Produits" })).toBeVisible();
});

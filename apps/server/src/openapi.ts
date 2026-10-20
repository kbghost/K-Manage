type Op = [method: "get" | "post" | "patch" | "delete", path: string, summary: string, tag: string, permission?: string];

const OPS: Op[] = [
  ["get", "/health", "Etat de l'API", "Systeme"],
  ["post", "/auth/register", "Inscription", "Authentification"], ["post", "/auth/login", "Connexion", "Authentification"], ["post", "/auth/logout", "Deconnexion", "Authentification"],
  ["post", "/auth/forgot-password", "Demande de reinitialisation", "Authentification"], ["post", "/auth/reset-password", "Reinitialisation avec jeton", "Authentification"],
  ["get", "/auth/me", "Profil", "Authentification"], ["patch", "/auth/me", "Modifier le profil", "Authentification"], ["post", "/auth/change-password", "Changer le mot de passe", "Authentification"],
  ["get", "/auth/sessions", "Sessions actives", "Authentification"], ["delete", "/auth/sessions/{id}", "Revoquer une session", "Authentification"],
  ["get", "/businesses", "Mes commerces", "Commerces"], ["post", "/businesses", "Creer un commerce", "Commerces"], ["get", "/businesses/current", "Commerce actif", "Commerces"], ["patch", "/businesses/current", "Parametres du commerce", "Commerces", "settings.update"],
  ["get", "/members", "Membres", "Employes", "members.manage"], ["post", "/members", "Ajouter un membre", "Employes", "members.manage"], ["patch", "/members/{id}", "Role / statut", "Employes", "members.manage"], ["delete", "/members/{id}", "Revoquer", "Employes", "members.manage"], ["get", "/members/roles", "Roles et permissions", "Employes"],
  ["get", "/catalog/categories", "Categories", "Produits", "products.read"], ["post", "/catalog/categories", "Creer une categorie", "Produits", "products.create"],
  ["get", "/catalog/products", "Liste / export des produits", "Produits", "products.read"], ["post", "/catalog/products", "Creer un produit", "Produits", "products.create"], ["get", "/catalog/products/lookup", "Recherche par code-barres/SKU", "Produits", "products.read"],
  ["post", "/catalog/products/import", "Importer (dryRun possible)", "Produits", "products.create"], ["get", "/catalog/products/{id}", "Detail", "Produits", "products.read"], ["patch", "/catalog/products/{id}", "Modifier", "Produits", "products.update"], ["delete", "/catalog/products/{id}", "Archiver", "Produits", "products.update"], ["get", "/catalog/products/{id}/history", "Historique", "Produits", "products.read"],
  ["get", "/stock/movements", "Mouvements de stock", "Stock", "stock.read"], ["post", "/stock/movements", "Entree / sortie / ajustement", "Stock", "stock.adjust"], ["post", "/stock/inventory", "Inventaire physique", "Stock", "stock.adjust"], ["get", "/stock/alerts", "Alertes de stock", "Stock", "stock.read"],
  ["get", "/sales", "Historique des ventes", "Ventes", "sales.read"], ["post", "/sales", "Valider une vente (en-tete Idempotency-Key)", "Ventes", "sales.create"], ["get", "/sales/{id}", "Detail / recu", "Ventes", "sales.read"],
  ["post", "/sales/{id}/payments", "Encaisser un solde", "Ventes", "sales.create"], ["post", "/sales/{id}/refund", "Remboursement total/partiel", "Ventes", "sales.refund"], ["post", "/sales/{id}/cancel", "Annulation", "Ventes", "sales.cancel"],
  ["get", "/parties/customers", "Clients", "Clients", "customers.read"], ["post", "/parties/customers", "Creer un client", "Clients", "customers.manage"], ["get", "/parties/customers/receivables/list", "Creances", "Clients", "customers.read"], ["post", "/parties/customers/{id}/settlements", "Regler une dette", "Clients", "customers.manage"],
  ["get", "/parties/suppliers", "Fournisseurs", "Fournisseurs", "suppliers.read"], ["post", "/parties/suppliers", "Creer un fournisseur", "Fournisseurs", "suppliers.manage"],
  ["get", "/purchases", "Achats", "Achats", "purchases.read"], ["post", "/purchases", "Creer un achat", "Achats", "purchases.manage"], ["post", "/purchases/{id}/receive", "Receptionner", "Achats", "purchases.manage"], ["post", "/purchases/{id}/payments", "Payer le fournisseur", "Achats", "purchases.manage"], ["post", "/purchases/{id}/cancel", "Annuler", "Achats", "purchases.manage"],
  ["get", "/expenses", "Depenses", "Depenses", "expenses.read"], ["post", "/expenses", "Enregistrer une depense", "Depenses", "expenses.create"], ["patch", "/expenses/{id}", "Modifier (historise)", "Depenses", "expenses.update"], ["post", "/expenses/{id}/pay", "Payer une depense a credit", "Depenses", "expenses.create"],
  ["get", "/cash-sessions/current", "Caisse ouverte", "Caisse", "cash.manage"], ["post", "/cash-sessions", "Ouvrir la caisse", "Caisse", "cash.manage"], ["post", "/cash-sessions/current/entries", "Entree/sortie manuelle", "Caisse", "cash.manage"], ["post", "/cash-sessions/current/close", "Cloturer", "Caisse", "cash.manage"], ["post", "/cash-sessions/{id}/corrections", "Corriger une caisse cloturee", "Caisse", "cash.correct"],
  ["get", "/reports/dashboard", "Tableau de bord", "Rapports", "reports.read"], ["get", "/reports/{name}", "Rapport (json, csv, xlsx, pdf)", "Rapports", "reports.read"], ["get", "/reports/notifications", "Notifications", "Rapports"],
  ["get", "/audit-logs", "Journal d'audit", "Audit", "audit.read"], ["post", "/uploads", "Televerser un fichier (PNG/JPEG/WEBP/PDF, 2 Mo)", "Fichiers"], ["get", "/uploads/{id}", "Lire un fichier", "Fichiers"],
  ["get", "/admin/stats", "Statistiques de plateforme", "Administration"], ["get", "/admin/businesses", "Liste des commerces (sans donnees privees)", "Administration"],
];

export function buildOpenApi(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [method, path, summary, tag, permission] of OPS) {
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    const needsTenant = !["Authentification", "Systeme", "Administration", "Fichiers"].includes(tag) && !["/businesses"].includes(path);
    (paths[path] ??= {})[method] = {
      tags: [tag], summary: permission ? `${summary} [permission: ${permission}]` : summary,
      parameters: [...params, ...(needsTenant ? [{ name: "x-business-id", in: "header", required: true, schema: { type: "string" } }] : [])],
      responses: { "200": { description: "Succes ({ data, meta? })" }, "400": { description: "Validation" }, "401": { description: "Non connecte" }, "403": { description: "Permission insuffisante / CSRF" }, "404": { description: "Introuvable (ou commerce etranger)" }, "409": { description: "Conflit metier" } },
    };
  }
  return {
    openapi: "3.0.3",
    info: { title: "K-Manage API", version: "1.0.0", description: "Erreurs : { error: { code, message, details? } }. Ecritures : cookie de session + en-tete x-csrf-token. Commerce actif : en-tete x-business-id (valide cote serveur)." },
    servers: [{ url: `${origin}/api/v1` }],
    tags: [...new Set(OPS.map((o) => o[3]))].map((name) => ({ name })),
    paths,
  };
}

# API

Base : `/api/v1`. Documentation interactive : **`/api/docs`** (Swagger UI), spécification : `/api/v1/openapi.json`
(générée depuis `apps/server/src/openapi.ts`, qui liste chaque route avec sa permission).

## Conventions
- Réponses : `{ "data": ..., "meta": { total, page, limit, pages } }` ; erreurs : `{ "error": { "code", "message", "details?" } }` (codes stables : `VALIDATION_ERROR`, `INSUFFICIENT_STOCK`, `OVERPAYMENT`, `SALE_CHANGED`, `CSRF_INVALID`, …).
- Authentification : cookie `km_session` (HttpOnly). Écritures : en-tête `x-csrf-token` (valeur renvoyée par `/auth/login`, `/auth/register` et `/auth/me`).
- Routes de données : en-tête `x-business-id` (validé côté serveur).
- Idempotence : en-tête `Idempotency-Key` (8–100 car.) sur `POST /sales`, `/sales/:id/payments`, `/purchases/:id/payments`, `/parties/customers/:id/settlements`.
- Pagination : `?page=&limit=` (limite max 100) ; tri : `?sort=champ|-champ` (liste blanche) ; filtres validés (Zod). Aucune requête Mongo n'est construite à partir d'objets fournis par le client.
- Exports : `?format=csv|xlsx|pdf` sur les rapports, produits et dépenses (CSV : séparateur `;`, UTF-8 avec BOM, protection contre l'injection de formules).

## Groupes de routes
`/auth` · `/businesses` · `/members` · `/catalog` (catégories, produits, import, recherche code-barres) · `/stock` · `/sales` · `/parties` (clients, fournisseurs, créances, règlements) · `/purchases` · `/expenses` · `/cash-sessions` · `/reports` · `/audit-logs` · `/uploads` · `/admin` · `/health`.

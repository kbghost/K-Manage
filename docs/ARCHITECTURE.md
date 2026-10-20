# Architecture

## Vue d'ensemble
```
Navigateur (React) ──HTTP /api/v1 (cookie HttpOnly + x-csrf-token + x-business-id)──▶ API Express ──▶ MongoDB
        ▲                                                                         │
        └── proxy Vite en dev (même origine) · hébergement statique en prod ◀────┘ fichiers téléversés (disque)
```
| Dossier | Contenu |
|---|---|
| `packages/shared` | **Source unique des règles financières** et des permissions : montants entiers, quantités en millièmes, totaux de vente, répartition de remise, valeur de remboursement, marge, caisse, matrice rôles→permissions. Utilisé par l'API (vérité) et l'interface (simple aperçu). |
| `apps/server/src/config` | Variables d'environnement validées (Zod). |
| `apps/server/src/db` | `tx.ts` : unité de travail (transactions MongoDB, ou compensation en mode dev sans replica set). |
| `apps/server/src/middleware` | `auth.ts` (session, CSRF, résolution du commerce, permissions), gestion d'erreurs. |
| `apps/server/src/modules/<domaine>` | `models.ts` (Mongoose), `service.ts` (règles métier), `routes.ts` (HTTP + validation Zod). Domaines : auth, businesses, members, catalog, stock, parties (clients/fournisseurs), sales, purchases, expenses, cash, reports, audit, uploads, admin. |
| `apps/server/src/utils` | pagination/tri contrôlés, export CSV/Excel/PDF, sérialisation, temps (fuseaux), mail, erreurs. |
| `apps/client/src` | `lib` (api, auth, hooks, panier, csv, formats), `components` (kit UI, reçu, étiquettes, scanner), `layouts`, `pages`. |

## Flux de données : une vente
1. L'interface envoie `POST /sales` : `{ clientId?, lignes:[{produit, quantité, remise?}], remise?, paiements:[{moyen, montant}] }` + en-tête `Idempotency-Key`. **Aucun prix ni total n'est accepté.**
2. Middleware : session valide → CSRF → adhésion active au commerce → permission `sales.create` (+ `sales.discount` si remise).
3. `createSale` : rejoue la vente si la clé existe ; charge les produits **du commerce** ; recalcule lignes, remise, total avec `@k-manage/shared` ; contrôle le crédit (client requis), les moyens de paiement, le surpaiement.
4. Dans **une transaction** : création de la vente (snapshots nom/SKU/prix/coût) → décrément atomique du stock **conditionnel** + mouvement de stock par ligne → paiements (espèces rattachés à la caisse ouverte du caissier).
5. Réponse : vente avec reste à payer. L'interface affiche le reçu.

## Résolution du commerce (multi-tenant)
`x-business-id` est une *demande* : le serveur la valide contre une adhésion **active** de l'utilisateur ; sinon `404` (ne révèle pas l'existence d'un autre commerce). Toutes les requêtes de données filtrent par `businessId` issu de cette adhésion — jamais du corps de la requête.

## Cohérence et concurrence
- Stock : `findOneAndUpdate` avec condition `stockMilli >= quantité` (jamais lire-puis-écrire).
- Paiements/remboursements : verrou optimiste (le filtre inclut les valeurs lues de `paidAmount`/`refundedTotal`) → conflit `409` plutôt que double comptage.
- Idempotence : index unique `(businessId, idempotencyKey)` sur ventes et paiements ; rejouer renvoie le résultat initial.
- Contrôle de cohérence : `GET /sales/:id` renvoie `ledger.consistent` (paiements enregistrés = montant encaissé stocké).

# Modèle de données (MongoDB / Mongoose)

Tout document appartenant à un commerce porte `businessId` (obligatoire). Montants : **entiers** (FCFA, aucune décimale). Quantités et stocks : **entiers en millièmes d'unité** (`stockMilli`, `quantityMilli`).

| Collection | Rôle | Index notables |
|---|---|---|
| `users` | comptes (hachage Argon2id, `isPlatformAdmin`) | `email` unique |
| `sessions` | sessions opaques (hash SHA-256 du jeton, jeton CSRF, révocation) | `tokenHash` unique ; **TTL** sur `expiresAt` (créé au démarrage) |
| `passwordresets` | jetons de réinitialisation à usage unique (hachés, 1 h) | `tokenHash` unique ; TTL |
| `businesses` | commerce, paramètres, reçu, fuseau | — |
| `memberships` | utilisateur ↔ commerce, rôle, statut | `(businessId, userId)` unique |
| `categories` | catégories de produits | `(businessId, name)` unique |
| `products` | catalogue, prix, stock | `(businessId, sku)` unique ; `(businessId, barcode)` unique **partiel** (chaînes seulement, créé au démarrage) |
| `stockmovements` | journal de stock immuable (quantité signée, stock après, coût unitaire, référence, auteur) | `(businessId, productId, createdAt)` |
| `counters` | numérotation par commerce (V-000001, A-000001) | `(businessId, key)` unique |
| `customers`, `suppliers` | fiches tiers | `(businessId, name)` |
| `sales` | ventes avec **snapshots** des lignes ; `paidAmount`, `refundedTotal`, remboursements | `(businessId, number)` unique ; `(businessId, idempotencyKey)` unique |
| `payments` | paiements séparés des ventes (encaissement, remboursement, paiement fournisseur) | `(businessId, idempotencyKey)` unique |
| `purchases` | achats, réceptions partielles, paiements | `(businessId, number)` unique |
| `expenses` | dépenses payées / à payer, historique des modifications | `(businessId, date)` |
| `cashsessions`, `cashentries` | sessions de caisse, entrées/sorties manuelles et de dépenses | `(businessId, status, openedBy)` |
| `auditlogs` | actions sensibles (sans secrets) | `(businessId, createdAt)` |
| `uploads` | métadonnées des fichiers (nom aléatoire serveur) | — |

## Soldes : source de vérité
- `sales.paidAmount` / `refundedTotal` et `purchases.paidAmount` sont des **champs maintenus** modifiés *uniquement* par mises à jour conditionnelles atomiques dans la même transaction que l'écriture du paiement.
- Le **grand livre** (`payments`) est la référence : `reconcileSale` recalcule `Σ encaissements − Σ remboursements` et le compare au champ stocké.
- Soldes clients/fournisseurs et créances/dettes sont **recalculés** à partir des ventes/achats à chaque lecture (aucun champ `balance` stocké).

## Transactions
Utilisées (`runTx`) pour : création de vente, remboursement/annulation, paiement d'une vente, règlement de dette (FIFO), réception d'achat, paiement fournisseur, dépense en espèces, inventaire, création/import de produits avec stock initial. Nécessitent un replica set.

## Évolution du schéma
Ajouter des champs avec valeur par défaut ; les index avancés sont créés idempotemment au démarrage (`ensureTtlIndexes`, `ensureProductIndexes`). Toute migration destructive doit faire l'objet d'un script versionné dans `scripts/` exécuté après sauvegarde.

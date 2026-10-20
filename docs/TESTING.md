# Tests

| Niveau | Où | Comment | Base requise |
|---|---|---|---|
| Unitaires financiers/permissions | `packages/shared` | `npm run test -w @k-manage/shared` | non |
| Configuration serveur | `apps/server/tests/env.test.ts` | `npm run test -w @k-manage/server` | non |
| **Intégration API** (auth, isolation, permissions, ventes, stock, concurrence, idempotence, crédit, remboursement, achats, dépenses, caisse, rapports, exports, fichiers) | `apps/server/tests/api.integration.test.ts` | avec `TEST_MONGODB_URI` | **oui** (ignorés sinon) |
| Interface (connexion, navigation, droits, produits, POS, états de chargement/erreur/vide, menu mobile) | `apps/client/tests` | `npm run test -w @k-manage/client` | non (API simulée) |
| Bout en bout | `apps/client/e2e` | `npm run test:e2e` | MongoDB + seed + `npm run dev` |

## Préparer MongoDB pour les tests d'intégration
```powershell
# Base dédiée (elle est créée avec un nom unique et SUPPRIMÉE à la fin de chaque exécution)
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/kmtest"
npm test
# Pour tester le mode transactionnel (replica set rs0 initialisé) :
$env:TEST_USE_TRANSACTIONS = "true"; npm test
```
Chaque exécution crée sa propre base `kmtest_<horodatage>` puis la supprime : n'utilisez pas une base contenant des données réelles comme URI de test (seul le nom de base est remplacé, jamais d'autre base touchée).

## Playwright
```powershell
npx playwright install chromium
npm run seed
npm run test:e2e      # lance aussi `npm run dev` si besoin ; projets « desktop » et « mobile »
```
Les scénarios utilisent les comptes de démonstration (`docs` / README).

## Ce que les tests d'intégration prouvent
Isolation entre commerces (lecture, écriture, annulation, fichiers, administrateur de plateforme) ; permissions par rôle ; recalcul des totaux côté serveur ; idempotence (y compris requêtes parallèles) ; ventes concurrentes sur stock limité (jamais de stock négatif) ; paiements simultanés qui dépasseraient le solde ; cohérence paiements/solde ; remboursements partiels et annulation ; caisse (écart, correction réservée) ; chiffres du tableau de bord = rapports ; exports CSV/XLSX/PDF ; rejets de requêtes malformées.

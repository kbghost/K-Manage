# État du projet et vérifications

Version livrée : **1.1.0 (candidate à tester)** — v1.1 : refonte du design (Poppins, icônes bicolores, animations Motion) et fonctionnalités de navigation/fidélisation — noyau fonctionnel complet sur les 14 modules du cahier des charges, avec les réserves ci-dessous.

## Vérifications réellement exécutées (environnement Linux de développement)
| Vérification | Résultat |
|---|---|
| `npm run typecheck` (TypeScript 5.9.3 strict, 3 workspaces) | ✅ 0 erreur |
| `npm run lint` (ESLint) | ✅ 0 erreur |
| `npm run build` (API `tsup` + interface `vite build`) | ✅ |
| Tests `packages/shared` (calculs financiers, arrondis, répartition, remboursements, permissions) | ✅ 11 / 11 |
| Tests interface `apps/client` (connexion, droits, produits, POS, états chargement/erreur/vide, menu mobile, **police Poppins, icônes bicolores, mode sombre, recherche Ctrl+K, raccourcis clavier, objectif/série/conseils, favoris POS**) | ✅ 35 / 35 (API simulée, jsdom) |
| Tests serveur `apps/server` : configuration (3) + **intégration API (35)** | ✅ 38 / 38 — couverture ≈ 77 % des lignes de l'API |
| Démarrage de l'API **compilée** + parcours HTTP réel (inscription → commerce → produit → vente → rapport, CSRF, Swagger) | ✅ |
| Seed : création, ré-exécution idempotente, `--reset` ; contrôle du grand livre (14 ventes cohérentes, aucun stock négatif) | ✅ |
| `npm audit --omit=dev` | ✅ 0 vulnérabilité (override `uuid` pour `exceljs`) |
| Exports Excel et PDF générés et reconnus (signatures `PK` / `%PDF-`) | ✅ |

### ⚠️ Réserves importantes sur ces vérifications
1. **Pas de vrai MongoDB dans l'environnement de test.** Les 35 tests d'intégration et le seed ont tourné sur **FerretDB 1.24 (SQLite)**, un moteur compatible MongoDB, en mode `USE_TRANSACTIONS=false`.
   - Le **chemin transactionnel** (sessions MongoDB, `withTransaction`) n'a **pas** été exécuté. Il est écrit (`apps/server/src/db/tx.ts`) mais **non testé** : lancez la suite avec un replica set et `TEST_USE_TRANSACTIONS=true` (voir `docs/TESTING.md`) avant toute mise en production.
   - Les index **TTL** (sessions) et **unique partiel** (code-barres) ne sont pas implémentés par FerretDB : leur création n'a pas été vérifiée (commandes MongoDB standard, créées au démarrage ; avertissement hors production, échec bloquant en production). L'unicité des codes-barres et des SKU est aussi contrôlée par l'API.
2. **Tests Playwright écrits mais NON exécutés** (`apps/client/e2e`) : aucun navigateur disponible dans l'environnement.
3. **Aucune exécution sous Windows.** Les scripts npm sont multiplateformes (`concurrently`, `tsx`, `--env-file-if-exists`) et le verrou `package-lock.json` référence les binaires Windows (argon2, esbuild, rolldown, tailwind), mais le démarrage sur votre machine reste à confirmer (`npm install`, `npm run check:mongo`, `npm run dev`).
4. **Refonte visuelle (v1.1)** : rendu, contrastes du mode sombre, fluidité des animations et responsive non vérifiés visuellement dans un vrai navigateur (voir `docs/DESIGN.md`).
5. Non testés : envoi réel d'emails (SMTP), impression sur imprimante thermique, lecture caméra, interface sur vrais navigateurs/téléphones, montée en charge, déploiement.

## Fonctionnalités implémentées
Authentification complète (inscription, connexion, déconnexion, profil, changement et réinitialisation du mot de passe, sessions révocables, CSRF, limitation de débit) · multi-commerce avec isolation côté serveur · rôles et permissions serveur · employés (ajout, rôle, désactivation, révocation) · paramètres du commerce (devise XOF, fuseau, stock négatif, ventes anonymes, moyens de paiement, délai de crédit, reçu 80/58 mm/A4, logo) · produits, catégories, images, import CSV contrôlé (simulation puis import), exports CSV/Excel/PDF, historique produit, recherche code-barres, étiquettes imprimables · stock (entrées, sorties, ajustements, inventaire physique, alertes, journal immuable) · point de vente (douchette USB, caméra si supportée, remises par permission, paiements multiples/partiels, crédit, idempotence) · ventes (historique, détail, reçu, réimpression, remboursement partiel/total, annulation) · clients (crédits, retards, règlements FIFO, reçu de règlement) · fournisseurs, achats (réception partielle, paiements, dettes) · dépenses (payées / à payer, caisse, justificatif, historique) · caisse (ouverture, entrées/sorties, clôture, écart, correction autorisée) · rapports et tableau de bord à source de calcul unique · notifications calculées · journal d'audit · OpenAPI/Swagger · seed de démonstration · documentation.

## Fonctionnalités non implémentées ou limitées
- **Taxes (TVA)** : non gérées. **Une seule devise (XOF)**.
- **Permissions personnalisées par utilisateur** : les droits sont ceux de 4 rôles fixes (pas d'éditeur de permissions à la carte).
- **Administration de plateforme** : API seulement (`/admin/stats`, `/admin/businesses`, accessibles aux comptes promus par `npm run make-admin`) ; pas d'écran dédié.
- **Invitation d'employés** : par email d'un compte existant (pas d'email d'invitation ni de jeton d'activation).
- Notifications **calculées à la demande** (pas de centre de notifications persistant ni de push).
- Rapports calculés en mémoire côté API à partir des documents de la période : adaptés à une PME ; pour de très gros volumes (centaines de milliers de ventes par période), prévoir des agrégations MongoDB.
- Pas de mode hors-ligne, pas de 2FA, fichiers sur disque local.
- Les dépenses sont datées à minuit UTC ; avec un fuseau très éloigné de l'UTC, un décalage d'un jour est possible sur les filtres.

## Étapes restantes avant mise en production
Exécuter la suite d'intégration sur MongoDB réel avec replica set et transactions · lancer Playwright · valider sous Windows · configurer SMTP · tester la restauration des sauvegardes · revue de sécurité (voir `SECURITY.md`) · choisir et ajouter la licence réelle (`LICENSE` est un texte provisoire « tous droits réservés »).

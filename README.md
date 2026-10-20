# K-Manage — gestion commerciale (MERN + TypeScript)

Application web de gestion commerciale pour commerçants (Bénin, devise **FCFA/XOF**, interface en français) :
point de vente, produits et stocks, ventes et crédits clients, fournisseurs et achats, dépenses, caisse, employés
avec permissions, rapports (CSV / Excel / PDF), journal d'audit. Multi-commerce, sans Docker.

> Lisez d'abord [`docs/STATUS.md`](docs/STATUS.md) : il liste ce qui a été **réellement vérifié** et les limites connues.

## Design et confort d'utilisation
Police Poppins (auto-hébergée), icônes bicolores, animations fluides, mode sombre, **recherche rapide `Ctrl+K`**, raccourcis clavier (`?` pour l'aide), objectif du jour, conseils personnalisés, favoris au point de vente. Détails : [`docs/DESIGN.md`](docs/DESIGN.md).

## Architecture en bref
Monorepo npm : `packages/shared` (calculs financiers, permissions) · `apps/server` (Express + Mongoose + Zod) ·
`apps/client` (React + Vite + Tailwind + TanStack Query). Détails : `docs/ARCHITECTURE.md`.

## Prérequis (Windows 10/11 + VS Code)
1. **Node.js LTS ≥ 22.9** — https://nodejs.org (vérifier : `node -v`).
2. **MongoDB Community Server** (installation directe, **sans Docker**) — https://www.mongodb.com/try/download/community  
   Cocher « Install MongoDB as a Service » (service `MongoDB`, port 27017).
3. *(Recommandé)* **MongoDB Shell** `mongosh` — https://www.mongodb.com/try/download/shell

### Activer le replica set local (nécessaire aux transactions)
Les ventes, remboursements et réceptions modifient plusieurs documents ; MongoDB ne les rend atomiques que sur un
**replica set** (même à un seul nœud). Une seule fois :
1. Ouvrir `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg` (éditeur lancé en administrateur) et ajouter :
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Redémarrer le service : PowerShell admin → `Restart-Service MongoDB`.
3. Initialiser : `powershell -File scripts\init-replica-set.ps1` (ou dans `mongosh` : `rs.initiate()`).
4. Vérifier : `npm run check:mongo` doit afficher « Replica set rs0 actif ».

> Pas de replica set ? Vous pouvez **uniquement en développement** mettre `USE_TRANSACTIONS=false` dans `.env` :
> les écritures sont alors annulées « au mieux » en cas d'échec, sans garantie d'atomicité stricte. C'est refusé en production.

## Installation et démarrage
```powershell
copy .env.example .env      # puis relire les valeurs (MONGODB_URI, ports)
npm install
npm run check:env           # valide la configuration
npm run check:mongo         # valide la connexion MongoDB
npm run seed                # (facultatif) données de démonstration fictives
npm run dev                 # API (http://localhost:4000) + interface (http://localhost:5173)
```
Ouvrez **http://localhost:5173**. Documentation interactive de l'API : http://localhost:4000/api/docs.

### Premier compte
- Cliquez sur « Créer un compte », puis créez votre commerce : vous en êtes le **propriétaire**.
- Pour ajouter un employé : il crée d'abord son compte, puis vous l'ajoutez par email dans **Employés** (rôle gérant, caissier ou magasinier).

### Données de démonstration (développement local uniquement)
`npm run seed` crée « Boutique Demo K-Manage (données fictives) » : 4 rôles, 5 catégories, 12 produits, 4 clients,
2 fournisseurs, 14 ventes (dont crédits), 2 achats, 3 dépenses, une caisse clôturée. Mot de passe commun : `Demo-K-Manage-2026`.

| Rôle | Email |
|---|---|
| Propriétaire | proprietaire@demo.k-manage.local |
| Gérant | gerant@demo.k-manage.local |
| Caissier | caissier@demo.k-manage.local |
| Magasinier | magasinier@demo.k-manage.local |

Le seed standard refuse de s'exécuter en production. Le commerce de démo est idempotent (ne refait rien s'il existe) ; `npm run seed -- --reset`
ne supprime **que** le commerce de démonstration et ses 4 comptes, mais ne doit jamais être utilisé en production. Pour une démonstration ponctuelle en production, consultez [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) : le mode dédié exige un opt-in temporaire et un mot de passe secret.

## Commandes
| Commande | Rôle |
|---|---|
| `npm run dev` | API + interface en parallèle |
| `npm run build` | compile l'API (`apps/server/dist`) et l'interface (`apps/client/dist`) |
| `npm test` | tests unitaires et composants (+ intégration si `TEST_MONGODB_URI` est défini) |
| `npm run test:coverage` | idem avec couverture |
| `npm run test:e2e` | Playwright (voir `docs/TESTING.md`) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript strict |
| `npm run check:env` · `npm run check:mongo` | diagnostics de configuration |
| `npm run seed` | données de démonstration |
| `npm run make-admin -- email` | promeut un compte en administrateur de plateforme (sans accès aux données des commerces) |
| `npm run audit:deps` | audit des dépendances |

## Tests
Voir `docs/TESTING.md`. Les tests d'intégration (API + base) s'activent avec :
```powershell
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017/kmtest"; npm test
# avec replica set : ajouter $env:TEST_USE_TRANSACTIONS="true"
```

## Dépannage
| Symptôme | Cause / solution |
|---|---|
| `ECONNREFUSED 127.0.0.1:27017` | Service MongoDB arrêté : `Start-Service MongoDB` ; vérifier `npm run check:mongo`. |
| « Transaction numbers are only allowed on a replica set » | Replica set non initialisé (voir ci-dessus). |
| `Configuration invalide` | Corriger `.env` (voir `.env.example`) puis `npm run check:env`. |
| Page blanche / 401 en boucle | Ouvrir l'interface via `http://localhost:5173` (pas via le port 4000) pour que le proxy et les cookies fonctionnent. |
| Port déjà utilisé | Changer `PORT` dans `.env` (API) ; le port de l'interface se règle dans `apps/client/vite.config.ts`. |
| L'impression du reçu coupe le ticket | Dans la boîte d'impression : marges « aucune », échelle 100 %, papier 80 mm ; choisir le format dans Paramètres. |
| Lecture caméra indisponible | Dépend du navigateur (API `BarcodeDetector`, Chrome/Edge/Android). Une douchette USB fonctionne partout. |

## Déploiement
Voir `docs/DEPLOYMENT.md` (hébergement statique pour l'interface, serveur Node pour l'API, MongoDB séparé, HTTPS, sauvegardes).

## Sécurité
Voir `docs/SECURITY.md`. L'application n'est **pas** déclarée invulnérable : les opérations à faire avant un déploiement public y sont listées.

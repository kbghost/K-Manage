# Déploiement

Le déploiement est **facultatif** pour le développement local et n'a pas été effectué dans le cadre de cette livraison (aucun accès à un hébergeur).

## Architecture cible
- **Interface** : fichiers statiques (`apps/client/dist`) sur un hébergeur statique/CDN.
- **API** : serveur Node.js ≥ 22.9 (`npm run build` puis `npm run start`, derrière un gestionnaire de processus type systemd/PM2 et un proxy HTTPS).
- **MongoDB** : service managé ou serveur dédié, **replica set**, authentification, réseau privé.
- **Même site** : par ex. `app.exemple.com` (interface) et `api.exemple.com` (API) avec `COOKIE_DOMAIN=exemple.com` ; ou un seul domaine avec le proxy qui route `/api` vers l'API.

## Variables d'environnement (API)
| Variable | Production |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | port interne de l'API |
| `MONGODB_URI` | URI avec identifiants, `replicaSet=…`, TLS |
| `CLIENT_ORIGIN` | URL exacte de l'interface (CORS) |
| `USE_TRANSACTIONS` | `true` (obligatoire) |
| `TRUST_PROXY` | `true` derrière un proxy |
| `COOKIE_DOMAIN` | domaine parent si interface et API sont sur des sous-domaines |
| `SMTP_URL`, `MAIL_FROM` | requis pour la réinitialisation de mot de passe |
| `UPLOAD_DIR` | dossier **persistant** (volume) ou à remplacer par du stockage objet |
| `DEV_EXPOSE_RESET_TOKEN` | **ne pas définir** (l'API refuse de démarrer si actif) |
Interface : `VITE_API_URL` (par défaut `/api/v1`, à définir au *build* si l'API est sur un autre sous-domaine, ex. `https://api.exemple.com/api/v1`).

## Étapes
1. `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.
2. Publier `apps/client/dist` ; si l'interface utilise le routage côté client, configurer la **réécriture vers `index.html`**.
3. Démarrer l'API (`npm run start`) ; sonde de santé : `GET /api/v1/health`.
4. Au premier démarrage, les index (dont TTL et unicité partielle) sont créés ; **en production, un échec de création arrête le serveur**.
5. Créer le premier compte via l'interface. `npm run make-admin -- email` si un administrateur de plateforme est souhaité.
6. **Ne jamais lancer `npm run seed`** en production.

## HTTPS, journaux, surveillance
HTTPS terminé par le proxy/hébergeur (HSTS recommandé). Les logs applicatifs vont sur la sortie standard (collecter via systemd/PM2/hébergeur) et ne contiennent ni secrets ni mots de passe. Surveiller `/api/v1/health`, l'espace disque (`UPLOAD_DIR`) et les erreurs 5xx.

## Sauvegarde et restauration
```bash
mongodump --uri="$MONGODB_URI" --gzip --archive=k-manage-AAAA-MM-JJ.gz      # quotidienne, conservée hors serveur
mongorestore --uri="$MONGODB_URI" --gzip --archive=k-manage-AAAA-MM-JJ.gz --drop   # restauration (sur une base de test d'abord)
```
Sauvegarder aussi `UPLOAD_DIR`. **Tester régulièrement la restauration.** Avant toute évolution de schéma : sauvegarde, script de migration versionné, essai sur une copie.

## Mises à jour des dépendances
`npm run audit:deps` à chaque livraison ; mettre à jour par lots avec relance complète des tests.

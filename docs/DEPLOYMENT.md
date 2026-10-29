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
| `CLOUDINARY_CLOUD_NAME` | nom du cloud Cloudinary (requis pour les fichiers en production) |
| `CLOUDINARY_API_KEY` | clé API Cloudinary |
| `CLOUDINARY_API_SECRET` | secret API Cloudinary ; secret, ne jamais le committer |
| `FEDAPAY_MODE` | `sandbox` pour les essais, `live` après validation du compte marchand |
| `FEDAPAY_SECRET_KEY` | clé secrète FedaPay correspondante ; à stocker uniquement dans l'environnement serveur |
| `UPLOAD_DIR` | dossier local utilisé uniquement hors production quand Cloudinary n'est pas configuré |
| `DEV_EXPOSE_RESET_TOKEN` | **ne pas définir** (l'API refuse de démarrer si actif) |
Interface : `VITE_API_URL` (par défaut `/api/v1`, à définir au *build* si l'API est sur un autre sous-domaine, ex. `https://api.exemple.com/api/v1`).

### Stockage persistant des médias avec Cloudinary et Render
1. Créez un compte Cloudinary et récupérez `Cloud name`, `API Key` et `API Secret` depuis le tableau de bord.
2. Dans Render, ouvrez le service **API** → **Environment** et ajoutez `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET`. Ne publiez jamais l'API Secret et ne le mettez pas dans le dépôt.
3. Redéployez le service. En production, le serveur refuse de démarrer si l'une de ces trois variables manque ou est vide.
4. Vérifiez en téléversant une image produit et un justificatif, puis ouvrez-les depuis l'application. Les nouveaux médias sont stockés dans Cloudinary ; l'API conserve les métadonnées dans MongoDB et vérifie toujours l'appartenance au commerce avant de servir un fichier.

En développement, sans variables Cloudinary, les fichiers continuent d'être écrits dans `UPLOAD_DIR`. Les anciens médias déjà enregistrés sur le disque local ne sont pas migrés automatiquement ; importez-les à nouveau depuis l'application si le stockage éphémère les a supprimés.

### Paiements FedaPay et abonnements
Configurez d'abord `FEDAPAY_MODE=sandbox` et la clé secrète sandbox. Dans le tableau de bord FedaPay, déclarez l'URL publique HTTPS `https://<api>/api/v1/billing/webhook` pour recevoir les notifications de transactions. L'API récupère ensuite le statut réel de la transaction auprès de FedaPay et ne prolonge l'abonnement qu'après confirmation du montant exact en XOF. Testez le parcours complet (redirection, notification et retour sur `/billing`) avec une boutique de test avant d'utiliser `FEDAPAY_MODE=live` et une clé secrète live.

L'essai et les paiements sont associés à une boutique. Le renouvellement est manuel : K-Manage ne conserve pas de moyen de paiement et ne lance pas de prélèvement automatique. Les boutiques existantes sans abonnement reçoivent leur essai à leur première utilisation après l'activation de cette fonctionnalité.

## Étapes
1. `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.
2. Publier `apps/client/dist` ; si l'interface utilise le routage côté client, configurer la **réécriture vers `index.html`**.
3. Démarrer l'API (`npm run start`) ; sonde de santé : `GET /api/v1/health`.
4. Au premier démarrage, les index (dont TTL et unicité partielle) sont créés ; **en production, un échec de création arrête le serveur**.
5. Créer le premier compte via l'interface. `npm run make-admin -- email` si un administrateur de plateforme est souhaité.
6. Ne lancez jamais le seed standard en production. Si des donnees fictives sont indispensables pour une demonstration, sauvegardez d'abord Atlas, puis activez temporairement `ALLOW_DEMO_SEED_IN_PRODUCTION=true` et `DEMO_SEED_PASSWORD` dans l'environnement du service et lancez `npm run seed:production-demo -w @k-manage/server` une seule fois depuis le shell Render. Utilisez un mot de passe fort unique, ne le publiez pas et retirez les deux variables apres execution. Cette commande ajoute un commerce demo et quatre comptes demo dans la base partagee, sans reset; ne l'utilisez pas si vous ne voulez pas voir de donnees fictives dans les rapports ou les listes. Ne lancez jamais `--reset` en production. Avant d'executer, verifiez que les quatre adresses `@demo.k-manage.local` ne sont pas deja associees a de vrais utilisateurs : le script refuse alors de continuer.

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

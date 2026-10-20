# Sécurité

L'application applique les bonnes pratiques OWASP adaptées à son périmètre. **Elle n'est pas déclarée invulnérable** : voir « Limites connues » et « Avant un déploiement public ».

## Authentification et sessions
- Mots de passe : **Argon2id** (10 caractères minimum). Message d'erreur identique pour « email inconnu » et « mot de passe faux ».
- **Sessions opaques** : jeton aléatoire de 256 bits dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production (`COOKIE_DOMAIN` optionnel). Seul son **hash SHA-256** est stocké ; chaque session est révocable (déconnexion, changement de mot de passe, réinitialisation, liste des appareils). Aucun jeton n'est stocké dans `localStorage`.
- **CSRF** : jeton par session (double soumission) exigé en en-tête `x-csrf-token` sur toute écriture ; stocké côté navigateur en `sessionStorage` (ce n'est pas un identifiant de session).
- **Réinitialisation** : jeton à usage unique, haché, valable 1 h ; réponse identique que le compte existe ou non ; toutes les sessions sont révoquées après réinitialisation. **Aucun email n'est envoyé sans `SMTP_URL`.** En développement seulement, `DEV_EXPOSE_RESET_TOKEN=true` renvoie le jeton dans la réponse ; l'API **refuse de démarrer** si ce mode est actif en production.
- Limitation de débit : 20 tentatives / 15 min sur connexion, inscription, mot de passe ; 600 requêtes / min sur l'API.

## Autorisation et isolation multi-commerce
Chaque requête de données vérifie, côté serveur : (1) session valide, (2) adhésion **active** au commerce demandé, (3) permission du rôle, (4) appartenance de la ressource au commerce (filtre `businessId` issu de l'adhésion), (5) règles métier. Un commerce étranger répond `404`. Rôles : propriétaire, gérant, caissier, magasinier (matrice dans `packages/shared/src/permissions.ts`). L'**administrateur de plateforme** n'accède qu'aux statistiques de comptes (`/admin`) : aucune donnée commerciale. Le prix d'achat est masqué aux rôles sans droit produit/financier. Les corrections de caisse clôturée exigent `cash.correct` + motif + audit.

## Entrées et injections
Toutes les entrées sont validées par Zod (types, bornes, entiers pour les montants). Aucune requête Mongo n'est construite à partir d'objets client ; les recherches échappent les expressions régulières ; tri et filtres sont en liste blanche ; les identifiants sont validés. Exports CSV : neutralisation des formules (`=`, `+`, `-`, `@`).

## Fichiers téléversés
Types acceptés **par signature** (PNG, JPEG, WEBP, PDF) et non par extension/type déclaré, 2 Mo max, nom aléatoire généré par le serveur (pas de traversée de chemin), lecture réservée aux membres du commerce propriétaire, `X-Content-Type-Options: nosniff`.

## Transport, en-têtes, CORS
`helmet` (en-têtes sécurisés), CORS limité à `CLIENT_ORIGIN`, limite de taille JSON 1 Mo, `trust proxy` configurable. **HTTPS obligatoire en production** (terminé par l'hébergeur ou un proxy).

## Secrets, journaux, audit
Aucun secret dans le code ni dans `.env.example`. Les erreurs 500 ne révèlent aucun détail interne ; les journaux n'incluent ni mot de passe ni jeton. Le journal d'audit (`/audit-logs`) trace : changements de prix, remises, remboursements, annulations, ajustements/inventaires de stock, clôtures et corrections de caisse, membres, paramètres, imports, demandes de réinitialisation.

## Limites connues
- Pas d'authentification à deux facteurs, pas de verrouillage de compte par utilisateur (seulement limitation par IP).
- Pas de scan antivirus des fichiers ; stockage disque local (à remplacer par un stockage objet en cloud).
- Invitation d'employés : le compte doit déjà exister (pas d'email d'invitation).
- Aucun test d'intrusion n'a été réalisé ; l'audit de dépendances (`npm audit --omit=dev`) était à 0 vulnérabilité au moment de la livraison, à refaire régulièrement.
- Cookies `SameSite=Lax` : l'interface et l'API doivent partager le même site (même domaine parent).

## Avant un déploiement public
1. HTTPS partout, `NODE_ENV=production`, `TRUST_PROXY=true` derrière un proxy.
2. MongoDB avec authentification, réseau privé, replica set, sauvegardes testées (voir `DEPLOYMENT.md`).
3. Configurer `SMTP_URL` (réinitialisation de mot de passe) ; vérifier que `DEV_EXPOSE_RESET_TOKEN` est absent.
4. Le seed standard est interdit en production. Un seed de demonstration peut etre explicitement active pour une execution ponctuelle avec `ALLOW_DEMO_SEED_IN_PRODUCTION=true`, `DEMO_SEED_PASSWORD` et `npm run seed:production-demo -w @k-manage/server`. Il cree des comptes aux identifiants publics documentes : le mot de passe doit rester secret, les comptes doivent etre limites aux donnees demo, et les variables doivent etre retirees apres execution. La remise a zero est interdite en production.
5. Faire relire/tester la sécurité par un tiers si le logiciel manipule des données sensibles à grande échelle.

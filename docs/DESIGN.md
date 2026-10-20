# Design et expérience utilisateur

## Identité visuelle
- **Police : Poppins** (Google Fonts), **auto-hébergée** via `@fontsource/poppins` (graisses 400/500/600/700, sous-ensembles latin + latin-ext pour le français) : aucune requête vers Google au chargement, fonctionne hors ligne. Taille de base **16 px** ; `text-sm` = 15 px et `text-xs` = 13 px (redéfinis dans `index.css`) pour une lecture confortable.
- **Palette** : « encre » (menu latéral sombre `#0f1530`), indigo royal (`brand-*`), accent **ambre** `#f5a524`, neutres chauds (papier `#f7f6f2`). Tout passe par des variables CSS (`:root` / `.dark`) : changer la marque = modifier `apps/client/src/index.css`.
- **Surfaces** : cartes arrondies (rayon 16–22 px), ombres douces, fond pointillé discret, carte « héros » en dégradé sur le tableau de bord, panneau de marque animé sur la page de connexion.

## Icônes bicolores
`react-icons` → **Phosphor Duotone** (`react-icons/pi`). Chaque icône a un trait principal (couleur du texte courant) et un **ton secondaire** (ambre par défaut, variable CSS `--duo-2`). Tous les composants passent par `src/components/icons.tsx` (une seule table de correspondance nom → icône) : pour changer une icône ou passer à une autre famille (Font Awesome `react-icons/fa6`, Material `react-icons/md`…), modifiez uniquement ce fichier. Sur boutons pleins, le ton secondaire devient un blanc translucide (règles `.duo` dans `index.css`).

## Animations (bibliothèque `motion`, successeur de Framer Motion)
Transitions de pages, menu latéral à pastille glissante (`layoutId`), tiroir mobile, fenêtres modales et notifications à ressort, cascade d'apparition des cartes, compteurs qui s'animent, anneau de progression de l'objectif, confettis de célébration, panier et favoris animés du point de vente, squelettes de chargement. **Accessibilité** : `MotionConfig reducedMotion="user"` respecte le réglage « réduire les animations » du système (les confettis ne s'affichent alors pas).

## Fonctionnalités de navigation et de fidélisation
| Fonction | Détail |
|---|---|
| **Recherche rapide** (`Ctrl/⌘ + K` ou `/`) | Pages (selon vos droits), actions (nouvelle vente, nouveau produit, dépense, mouvement de stock…), et recherche en direct de produits, clients et ventes ; éléments récents. |
| **Raccourcis clavier** | `N` nouvelle vente · `G` puis `D/P/S/V/C/K/R` pour aller aux pages · `T` thème · `?` aide. Désactivés pendant la saisie. |
| **Mode clair / sombre / système** | Bouton dans la barre supérieure, choix mémorisé. |
| **Menu repliable** | Mode icônes seules, mémorisé. **Mobile** : barre de navigation en bas + bouton d'actions rapides (+). |
| **Accueil personnalisé** | Salutation selon l'heure, ventes du jour animées, **objectif de ventes du jour** (anneau de progression, félicitations à l'objectif), **série de jours d'activité**. |
| **Conseils du jour** | Calculés à partir de vos vrais chiffres (ruptures, créances, marge, meilleur jour…), avec lien d'action. |
| **Premiers pas** | Checklist guidée (premier produit, première vente, caisse, premier client) qui se coche toute seule ; célébration à la fin. |
| **Favoris au point de vente** | Les produits que vous vendez le plus apparaissent en raccourcis. |

## Données locales
Objectif du jour, favoris, éléments récents, thème et état du menu sont stockés **dans le navigateur de l'appareil** (`localStorage`, clés `km:<commerce>:…` et `km_*`) : aucune donnée sensible, rien n'est envoyé au serveur. Ils ne sont donc pas partagés entre appareils.

## Limites
Le rendu visuel (couleurs, contrastes du mode sombre, fluidité des animations, impression) n'a pas pu être vérifié dans un vrai navigateur dans l'environnement de développement : seuls les tests automatisés (jsdom), le typecheck et le build ont été exécutés. Une relecture visuelle sur vos écrans reste à faire.

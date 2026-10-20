# Règles métier et calculs financiers

## Représentation monétaire
Montants = **entiers FCFA** (le XOF n'a pas de sous-unité) ; `Number.isSafeInteger` imposé (schéma Mongoose, Zod, `assertMoney`). Quantités = **millièmes** d'unité (3 décimales max). Produits `quantité × prix` : `round_demi_haut(quantité_milli × prix / 1000)` (BigInt interne, pas de dérive flottante). Une seule devise (XOF) est supportée aujourd'hui.

## Ventes
- Ligne = quantité × prix unitaire − remise de ligne (jamais négative, remise ≤ montant).
- Total = Σ lignes − remise globale. La remise globale est **répartie** sur les lignes (méthode du plus fort reste, somme exacte) pour calculer les remboursements.
- Prix, noms, SKU et **coût d'achat** de chaque ligne sont figés (*snapshots*) dans la vente ; le serveur ignore tout total envoyé par le navigateur.
- Remises : permission `sales.discount` (propriétaire, gérant), tracées dans l'audit.
- Vente anonyme : autorisée par défaut (paramètre). Vente à crédit ou paiement partiel : client **obligatoire**.
- Paiement > total refusé (`OVERPAYMENT`). Reste à payer = total − retours − encaissé net.
- Numérotation `V-000001` par commerce (des trous sont possibles si une vente échoue ; jamais de doublon).

## Stock
- Toute modification passe par `applyStock` : mise à jour atomique conditionnelle + **mouvement obligatoire** (type, quantité signée, stock après, coût, motif, référence, auteur).
- Stock négatif refusé sauf si le commerce l'autorise. Sortie et ajustement exigent un motif. Ajustement = « stock réellement compté » avec garde optimiste (conflit si le stock a changé).
- Faible : `0 < stock ≤ seuil` ; épuisé : `stock ≤ 0`. Même calcul pour le tableau de bord, les rapports et les notifications.

## Paiements, crédits, créances
- Un paiement est un enregistrement séparé (encaissement, remboursement, paiement fournisseur) ; un crédit n'est **pas** un encaissement.
- Règlement d'une dette client : réparti sur les ventes ouvertes **les plus anciennes d'abord** (FIFO) ; dépassement de la dette refusé.
- Retard : crédit ouvert depuis plus de `creditDueDays` (30 par défaut).
- Double paiement : même `Idempotency-Key` → même résultat sans second enregistrement ; deux paiements simultanés dépassant le solde → un seul passe (verrou optimiste).

## Remboursements et annulations
- Remboursement partiel/total par ligne ; valeur = part du net de ligne (la dernière quantité solde exactement la ligne). Remise en stock optionnelle (mouvement `refund`).
- Argent rendu = `max(0, encaissé − (total − retours cumulés))`, enregistré comme paiement sortant ; sinon le remboursement réduit la dette du client.
- Annulation = remboursement de tout le reste + statut `cancelled` (motif obligatoire, permission `sales.cancel`). L'historique original (lignes, paiements, remboursements) est **conservé**.
- Ventes annulées exclues des ventes actives dans tous les rapports.

## Achats et fournisseurs
- Création ≠ réception. Réception partielle possible ; elle incrémente le stock (mouvement `purchase_receipt` avec coût) et met à jour le dernier prix d'achat du produit.
- Dette fournisseur = Σ (total − payé) des achats non annulés. Paiement > reste refusé ; idempotent. Annulation seulement si rien n'est reçu ni payé.

## Dépenses
Dépense **payée** (moyen obligatoire) ou **à payer** (crédit, sans sortie de caisse). Payée en **espèces** : sortie de caisse sur la caisse ouverte (obligatoire, solde suffisant). Modification historisée ; le montant d'une dépense liée à une caisse clôturée n'est pas modifiable.

## Caisse
Session par utilisateur (une ouverte à la fois). Solde théorique = fond + encaissements espèces − remboursements/paiements espèces + entrées manuelles − sorties manuelles − dépenses payées en caisse. Clôture : montant compté, écart = compté − théorique. Les paiements espèces sont rattachés à la caisse **ouverte de l'utilisateur** ; sans caisse ouverte, ils ne sont rattachés à aucune session (avertissement affiché au point de vente). Correction après clôture : `cash.correct` + motif + audit.

## Rapports (source unique `reports/service.ts`)
- Ventes brutes = Σ totaux des ventes non annulées de la période (date de vente, fuseau du commerce) ; ventes nettes = brutes − marchandises remboursées.
- Encaissements = Σ paiements entrants de ventes − Σ remboursements sortants de la période.
- **Marge brute estimée** = ventes nettes − coût des marchandises vendues (coût snapshot × quantité non remboursée). *Ce n'est pas un bénéfice comptable.*
- Valorisation du stock = stock × dernier prix d'achat. Créances/dettes : soldes courants. Dépenses : par date de dépense.
- Taxes (TVA) : **non gérées** dans cette version.

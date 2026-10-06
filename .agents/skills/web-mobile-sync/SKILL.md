---
name: web-mobile-sync
description: >-
  Assure et valide la parité stricte des fonctionnalités et de l'ergonomie entre les versions
  Web Desktop (>= 768px) et Mobile (< 768px) de FSAE Order Manager. À utiliser dès qu'une modification
  touche au frontend, aux formulaires, à la navigation ou aux vues pour garantir que la version mobile
  et la version web fonctionnent de manière identique et sans régression.
---

# Web & Mobile Parity Sentinel — FSAE Order Manager

Ce skill fournit les directives d'ingénierie, les patrons de conception réactifs et la suite d'outils de vérification automatisée pour garantir que chaque écran de l'application est **100% fonctionnel et cohérent aussi bien sur Desktop (atelier/bureau) que sur Mobile (téléphone en main)**.

---

## 1. Pourquoi ce Skill ?

Dans le cadre de l'équipe Formule SAE, l'application est utilisée dans deux contextes fondamentalement distincts :
1. **Sur Ordinateur de Bureau (Desktop) :** Saisie en masse, consultation de grands tableaux financiers, analyse multi-colonnes, navigation souris/clavier.
2. **Sur Smartphone en Atelier (Mobile) :** Membre debout devant la monoplace, téléphone dans une main, pointage des colis reçus, création rapide d'une requête de connecteur ou de visserie, consultation des alertes.

> **Principe Cardinal :** Aucune fonctionnalité ne doit être exclusive au Web Desktop. Toute capacité offerte sur Desktop doit avoir sa traduction tactile naturelle sur Mobile, et réciproquement.

---

## 2. Matrice de Parité par Composant

| Composant | Comportement Web Desktop (>= 768px) | Équivalent Tactile Mobile (< 768px) | Critère de Parité Strict |
| :--- | :--- | :--- | :--- |
| **Navigation** (`Navbar.jsx`) | Top header fixe complet avec onglets horizontaux, profil étendu, badges et déconnexion. | Top bar compacte (52px) + **Bottom Navigation Bar** fixe en bas avec icônes tactiles et safe area. | Même permissions (`canOrder`, `canViewBudget`, `canManageUsers`), mêmes onglets actifs. |
| **Requêtes de Pièces** (`MemberFunnelView.jsx`) | Table complète 9 colonnes avec pagination ou défilement vertical dense. | **Cartes Tactiles individuelles** avec badges, SKU, lien fournisseur, quantité et actions. | Mêmes données affichées, actions de suppression et filtrage identiques. |
| **Bouton d'Action** (`MemberFunnelView.jsx`) | Bouton « + Nouvelle Demande » dans l'en-tête de page. | **Floating Action Button (FAB)** flottant au-dessus de la barre de navigation basse. | Ouvre la même modale de création avec les mêmes validations. |
| **Hub Acheteur** (`PurchaserDashboard.jsx`) | Grille de regroupement par fournisseur, sélection de pièces, bouton en haut de liste. | Cartes compactes avec **Barre d'action collante** en bas (`🛒 Créer PO`) dès qu'une pièce est cochée. | Même regroupement par fournisseur, même calcul de montant cumulé. |
| **Statuts de Commandes** (`PurchaserDashboard.jsx`) | Boutons d'action horizontaux dans les lignes de PO. | Boutons d'action pleine largeur empilés adaptés aux doigts. | Mêmes transitions d'états (Commandé, Reçu, Annulé). |
| **Rapports de Coûts** (`CostReportView.jsx`) | 4 cartes KPI horizontales + Tableau budgétaire 8 colonnes. | Grille KPI 2x2 compacte + **Cartes de Sous-systèmes** avec jauge de progression visuelle. | Mêmes totaux (Alloué, Engagé, Réalisé, Restant), même droit d'édition pour les Lead/Admin. |
| **Gestion Équipe** (`AdminUsersView.jsx`) | Table 6 colonnes avec listes déroulantes de rôles et départements. | **Cartes Membres tactiles** avec sélecteurs de pôle et de rôle espacés pour éviter les clics accidentels. | Mêmes options de rôles, même protection anti-lockout Admin. |
| **Modales de Saisie** (`PartRequestModal.jsx`) | Fenêtre modale centrée avec champs en grille 2 colonnes. | **Bottom Sheet** glissant du bas, `maxHeight: 92dvh`, 1 colonne, boutons d'action fixes en bas. | Mêmes parseurs d'URL (DigiKey/Mouser), mêmes champs obligatoires, `inputMode` mobile. |

---

## 3. Checklist de Validation du Développeur / Agent

Avant de finaliser un commit ou une tâche :

- [ ] **Détection réactive propre :** Le composant utilise `useIsMobile(768)` ou des media queries CSS fluides sans casser les styles existants.
- [ ] **Anti-Zoom iOS :** Tous les champs `<input>`, `<select>` et `<textarea>` ont une taille de police `>= 16px` sur mobile.
- [ ] **Pas de débordement horizontal :** Aucune largeur fixe supérieure à `350px` sans `max-width: 100%`. La page ne doit jamais trembler ou défiler horizontalement sur un écran de 360px de large.
- [ ] **Safe Area Insets :** Les barres et boutons fixes respectent `--safe-bottom` (`env(safe-area-inset-bottom, 0px)`).
- [ ] **Accessibilité tactile :** Les zones de clic interactives mesurent au moins `44px x 44px`.
- [ ] **Parité des actions :** Si une action (bouton, filtre, modal) a été ajoutée sur le Desktop, elle a été testée et validée sur Mobile.

---

## 4. Outils et Commandes de Vérification

### Exécution du Test de Parité Automatisé (WSL Ubuntu)
```bash
wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && npm test"
```

### Exécution directe du validateur statique & structurel
```bash
wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && node scripts/verify-web-mobile-parity.js"
```

### Build de Production Vite
```bash
wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && npm run build"
```

# Directive Permanente : Parité Obligatoire Web & Mobile (« Sentinel Web-Mobile »)

> **Règle absolue pour tout agent ou développeur travaillant sur FSAE Order Manager :**
> Toute modification apportée à l'interface utilisateur, aux flux de données ou aux composants du frontend **DOIT OBLIGATOIREMENT préserver et valider la stricte parité fonctionnelle entre l'affichage Desktop (>= 768px) et l'affichage Mobile (< 768px)**.

---

## 1. Principes Fondamentaux de Parité

1. **Parité Fonctionnelle Totale (1:1) :**
   - Aucune action disponible sur le Web Desktop (création de demande, validation, génération de bon de commande, export CSV, téléversement de facture, édition de budget, gestion des membres) ne doit être absente ou inaccessible sur Mobile.
   - Les formulaires et actions doivent produire exactement les mêmes effets métiers et états réactifs sur les deux plateformes.

2. **Adaptation Ergonomique par Viewport :**
   - **Desktop (>= 768px) :** Tableaux denses, barres d'outils complètes, barre de navigation supérieure horizontale, raccourcis visuels pour écran large.
   - **Mobile (< 768px) :** Cartes tactiles condensées, barre de navigation basse (Bottom Nav) manipulable au pouce, boutons d'action flottants (FAB), défilement horizontal fluide des puces de filtres, modales en Bottom Sheet avec `maxHeight: 92dvh` et cibles tactiles minimales de 44x44px.

3. **Protection Tactile & Saisie Mobile :**
   - Tous les champs textuels et sélecteurs doivent avoir un `font-size: 16px` minimal sur mobile pour bannir le zoom automatique forcé d'iOS Safari.
   - Les champs numériques doivent spécifier `inputMode="decimal"` ou `inputMode="numeric"`.
   - Les listes déroulantes ne doivent pas être sujettes à des déclenchements accidentels lors du défilement au doigt.

---

## 2. Déclenchement & Validation Obligatoire

Avant de conclure toute modification touchant à `src/` :
1. **Lancer la validation de parité sous Ubuntu WSL :**
   ```bash
   wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && npm test"
   ```
2. **Vérifier le script de parité dédié :**
   ```bash
   wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && node scripts/verify-web-mobile-parity.js"
   ```
3. Tout commit ou modification brisant la vue mobile ou la vue desktop sera immédiatement rejeté par la suite de tests Tier 8.

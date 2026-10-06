---
name: web-mobile-parity
description: Règle automatique imposant la double validation et la parité fonctionnelle 1:1 entre Web Desktop et Mobile sur chaque modification frontend.
trigger: always_on
---

# Règle de Parité Fonctionnelle Web & Mobile

Tout agent intervenant sur le code du projet `FSAE_OrderManager` doit impérativement respecter les règles suivantes :

1. **Double Conception Système :**
   - Lorsqu'un composant de vue est modifié (`Navbar.jsx`, `MemberFunnelView.jsx`, `PurchaserDashboard.jsx`, `CostReportView.jsx`, `AdminUsersView.jsx`, `PartRequestModal.jsx`), l'agent doit explicitement s'assurer que le rendu et les interactions fonctionnent aussi bien en vue Desktop qu'en vue Mobile.
   - Ne jamais introduire une fonctionnalité ou un bouton sur desktop sans son pendant ergonomique mobile.

2. **Respect des Normes Mobiles :**
   - Utiliser `useIsMobile(768)` ou les media queries appropriées.
   - Préserver les zones sûres : `--safe-bottom` et `--safe-top`.
   - Éviter les overflow horizontaux involontaires (pas de largeurs fixes supérieures à 350px sans `max-width: 100%`).
   - Assurer que les modales restent scrollables sous clavier virtuel (`maxHeight: 92dvh` ou Bottom Sheet).

3. **Vérification Requise :**
   - Lancer systématiquement les tests de parité (`npm test` via Ubuntu WSL) avant de déclarer la tâche terminée.

---
name: fsae-order-manager
description: >-
  Guide et boîte à outils pour concevoir, développer, tester et déployer l'application
  de gestion de commandes et logistique FSAE (FSAE Order Manager) hébergée sur Raspberry Pi.
  À utiliser pour implémenter les modèles de données (PO, requêtes de pièces, factures),
  les parseurs de fournisseurs (DigiKey, Mouser, McMaster), les webhooks Discord et le déploiement Docker ARM.
---

# FSAE Order Manager — Development & Architecture Skill

Ce skill fournit les directives d'architecture, les spécifications de données, les schémas relationnels, les flux de travail et les scripts de validation pour le système de gestion des commandes de l'équipe FSAE Électrique.

## 1. Contexte & Architecture Cible

L'application est conçue pour être déployée localement sur un **Raspberry Pi (architecture ARM64 / ARMv7)** avec une empreinte mémoire et CPU minimale.

- **Frontend** : React 19 + Vite + Tailwind CSS (avec Lucide Icons), optimisé pour les interfaces mobiles et desktop de l'atelier.
- **Backend API** : Node.js (TypeScript ou ESM avec Express/Fastify), authentification JWT légère avec mots de passe hashés (`bcrypt`).
- **Base de données** : SQLite (avec WAL mode pour la rapidité et la légèreté sur SD/SSD) ou PostgreSQL conteneurisé.
- **Stockage de fichiers** : Volume local Docker pour les factures PDF associées aux Purchase Orders.
- **Intégration externe** : Notifications via Discord Webhooks avec payloads Rich Embed.
- **Conteneurisation** : Docker multi-stage & `docker-compose.yml` compatible ARM (`linux/arm64`, `linux/arm/v7`).

---

## 2. Modèle Relationnel (Schéma SQL)

```text
+---------------+       +------------------+       +-------------------+
|     Users     |       |    Subsystems    |       |   PurchaseOrders  |
+---------------+       +------------------+       +-------------------+
| id (PK)       |       | id (PK)          |       | id (PK)           |
| name          |       | name             |       | po_number         |
| email         |       | code (POW, SUS)  |       | supplier          |
| password_hash |       | budget_allocated |       | status            |
| role          |       +--------+---------+       | purchaser_id (FK) |
+-------+-------+                |                 | total_cost        |
        |                        |                 +---------+---------+
        |                        |                           |
        +------------+     +-----+                           |
                     |     |                                 |
              +------+-----+-------+                 +-------+--------+
              |    PartRequests    |                 |    Invoices    |
              +--------------------+                 +----------------+
              | id (PK)            |                 | id (PK)        |
              | requester_id (FK)  |                 | po_id (FK)     |
              | subsystem_id (FK)  |                 | file_name      |
              | po_id (FK, nullable)                 | file_path      |
              | supplier           |                 | upload_date    |
              | sku                |                 | amount         |
              | url                |                 +----------------+
              | quantity           |
              | unit_price_est     |
              | urgency_level      |  (Normal, Urgent, Critique)
              | status             |
              +--------------------+
```

### Rôles utilisateurs :
- `Member` : Soumet des requêtes de pièces, consulte ses demandes et les sous-systèmes.
- `Purchaser` : Regroupe les requêtes par fournisseur, génère les commandes (PO), uploade les factures et met à jour les statuts.
- `Admin` : Gestion complète des utilisateurs, des budgets et de la configuration Discord.

### Niveaux d'urgence (`urgency_level`) :
- `NORMAL` (délai standard de commande groupée)
- `URGENT` (nécessaire sous 1 à 2 semaines)
- `CRITICAL` (blocage immédiat de la voiture / compétition imminente)

---

## 3. Extracteurs Fournisseurs (Vendor Parsers)

Pour éviter les blocages IP dus aux protections anti-bots (Cloudflare, Akamai) sur DigiKey / Mouser :
- **Extraction par Regex / URL Structure** : Extraire en priorité le SKU / Part Number directement depuis les paramètres ou le path de l'URL :
  - *DigiKey* : Extraction du Part Number depuis `/en/products/detail/.../{SKU}` ou query params.
  - *Mouser* : Extraction du Mouser Part Number depuis `/ProductDetail/{Manufacturer}/{PartNumber}`.
  - *McMaster-Carr* : Détection de la référence produit (ex: `91290A115`).
- **Saisie assistée & Fallback gracieux** : Si le parsing direct de l'URL échoue, l'interface pré-remplit le domaine du fournisseur et invite le membre à confirmer le SKU manuellement sans bloquer la soumission.

---

## 4. Notifications Discord (Format Embed)

Format standardisé des payloads pour les Webhooks Discord :

```json
{
  "username": "FSAE Logistics Bot",
  "embeds": [
    {
      "title": "📦 Nouvelle Commande Fournisseur Créée",
      "color": 3066993,
      "fields": [
        { "name": "PO #", "value": "PO-2026-0042", "inline": true },
        { "name": "Fournisseur", "value": "DigiKey", "inline": true },
        { "name": "Acheteur", "value": "Alexandre (Purchaser)", "inline": true },
        { "name": "Urgence Max", "value": "🚨 CRITIQUE", "inline": true },
        { "name": "Sous-systèmes", "value": "Powertrain (3), Télémétrie (2)", "inline": false },
        { "name": "Statut", "value": "En attente de validation", "inline": true }
      ],
      "timestamp": "2026-08-25T21:55:00.000Z"
    }
  ]
}
```

---

## 5. Environnement & Commandes (WSL Ubuntu)

```bash
# Lancer les tests sous WSL Ubuntu
wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && npm test"

# Build et validation du conteneur Docker
wsl -d Ubuntu bash -c "cd /mnt/d/Project/AI_Project/FSAE_OrderManager && docker compose build"
```

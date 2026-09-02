# Original User Request

## Initial Request — 2026-08-26T01:56:40Z

Application web réactive et légère de gestion logistique et d'approvisionnement (pièces FSAE Électrique) pour Raspberry Pi (ARM), construite avec React 19, Vite, Tailwind CSS, une API Node.js robuste, une base relationnelle SQLite/PostgreSQL (avec mots de passe hashés bcrypt et niveaux d'urgence), des extracteurs d'URL fournisseurs résilients, la gestion de factures PDF et des alertes Discord Webhooks.

Working directory: d:/Project/AI_Project/FSAE_OrderManager
Integrity mode: development

## Requirements

### R1. Modèle de Données et Schéma Relationnel
Concevoir et implémenter le schéma de base de données relationnelle complet avec clés primaires, clés étrangères, index et contraintes d'intégrité pour :
- `Users` : `id`, `name`, `email` (unique), `password_hash` (mots de passe hashés avec `bcrypt`), `role` (`Member`, `Purchaser`, `Admin`), `created_at`.
- `Subsystems` : `id`, `name` (ex: Powertrain, Châssis, Suspension, Aérodynamique, Télémétrie, Électronique Basse Tension), `code` (ex: `POW`, `CHA`, `SUS`), `budget_allocated`.
- `PartRequests` : `id`, `requester_id` (FK `Users`), `subsystem_id` (FK `Subsystems`), `supplier`, `sku`, `url`, `description`, `quantity`, `unit_price_est`, `urgency_level` (`NORMAL`, `URGENT`, `CRITICAL`), `status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `ORDERED`, `RECEIVED`, `REJECTED`), `po_id` (FK optionnelle `PurchaseOrders`), `created_at`.
- `PurchaseOrders` : `id`, `po_number` (numéro unique ex: `PO-2026-0001`), `supplier`, `status` (`PENDING`, `ORDERED`, `PARTIALLY_RECEIVED`, `COMPLETED`, `CANCELLED`), `purchaser_id` (FK `Users`), `total_cost`, `created_at`, `updated_at`.
- `Invoices` : `id`, `po_id` (FK `PurchaseOrders`), `file_name`, `file_path`, `amount`, `upload_date`.

Fournir les migrations SQL et scripts de seed (avec utilisateurs de démo pour chaque rôle) prêts à l'emploi.

### R2. Backend API & Logique Métier (Node.js)
Développer le serveur backend Node.js (Express / Fastify) avec architecture propre et modulaire :
- **Authentification & Sessions** : Authentification légère par tokens JWT et mots de passe hashés (`bcrypt`), middleware de contrôle d'accès basé sur les rôles (`Member`, `Purchaser`, `Admin`).
- **Endpoints RESTful** :
  - Authentification (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`).
  - Gestion des requêtes de pièces (CRUD, filtrage par sous-système, par demandeur et par niveau d'urgence).
  - Gestion des commandes groupées (PO) : création par regroupement de demandes d'un même fournisseur, passage de commandes, réception partielle/complète.
  - Upload et téléchargement sécurisé des factures PDF (stockage sur volume persistant avec validation MIME type).
  - Consultation des sous-systèmes et suivi des dépenses vs budget alloué.
- **Extracteurs Fournisseurs (Vendor Parsers) Résilients** :
  - Extraction du SKU / Part Number directement depuis l'URL ou query string (Regex) pour DigiKey, Mouser et McMaster-Carr afin d'éviter les blocages IP anti-scraping (Cloudflare/Akamai).
  - Fallback gracieux vers une saisie assistée si l'URL est inhabituelle.

### R3. Service d'Intégration Discord (Webhooks)
Implémenter un service dédié et asynchrone d'alertes Discord :
- Envoi automatique d'un Rich Embed formaté lors des événements clés :
  - Création / Soumission d'une commande (PO) par un Acheteur (détails du fournisseur, nom de l'acheteur, sous-systèmes impactés, niveau d'urgence max, montant estimé).
  - Réception de pièces (notification du sous-système concerné pour que les ingénieurs sachent que leurs composants sont à l'atelier).
- Traitement d'erreur silencieux/résilient : l'indisponibilité de Discord ne bloque jamais les transactions métier de l'application.

### R4. Interface Web Frontend (React 19 + Vite + Tailwind CSS)
Développer une interface utilisateur responsive, claire et productive :
- **Stack** : React 19, Vite, Tailwind CSS et Lucide Icons.
- **Vues & Composants** :
  - Page de connexion / inscription.
  - Formulaire de demande de pièce avec détection automatique du fournisseur et extraction du SKU à la saisie de l'URL, avec sélecteur de sous-système et de niveau d'urgence (`NORMAL`, `URGENT`, `CRITICAL`).
  - Vue Membre : suivi de l'état de ses pièces (entonnoir : Soumis ➔ Commandé ➔ Reçu).
  - Dashboard Acheteur : vue d'entonnoir regroupant les demandes par fournisseur, génération de POs en un clic, upload/consultation de factures PDF, et mise à jour des statuts.
  - Vue Métriques / Cost Report : récapitulatif des dépenses par sous-système pour le rapport de coût FSAE.

### R5. Conteneurisation & Déploiement Raspberry Pi (ARM)
- `docker-compose.yml` complet orchestrant le frontend (Nginx / SPA), l'API Node.js et la base de données (SQLite avec volume persistant ou PostgreSQL léger).
- `Dockerfile` multi-stage optimisé pour architecture ARM (`linux/arm64`, `linux/arm/v7`) minimisant la consommation de mémoire RAM et de cycles CPU.

## Acceptance Criteria

### Base de Données & Sécurité
- [ ] Le schéma relationnel inclut `Users`, `Subsystems`, `PartRequests`, `PurchaseOrders`, `Invoices` avec contraintes et clés étrangères valides.
- [ ] Les mots de passe utilisateurs sont systématiquement hashés avec `bcrypt`.
- [ ] La colonne `urgency_level` est présente dans `PartRequests` et correctement typée.

### Backend & Parsers
- [ ] L'API implémente l'authentification JWT et restreint les opérations d'achat aux utilisateurs au rôle `Purchaser` ou `Admin`.
- [ ] Les extracteurs d'URL analysent avec succès la structure d'URLs types de DigiKey, Mouser et McMaster-Carr sans dépendre de scraping HTML bloquant.
- [ ] L'upload de fichier PDF de facture fonctionne et associe le document au PO correspondant.

### Discord Webhooks
- [ ] Un payload JSON Embed Discord valide et riche est émis lors d'un changement de statut de PO.
- [ ] L'échec d'envoi webhook n'interrompt pas la réponse HTTP de l'API.

### Frontend
- [ ] L'interface React 19 + Tailwind CSS permet de soumettre des demandes, regrouper des POs et visualiser les factures et états d'avancement.
- [ ] L'affichage met visuellement en évidence les demandes avec urgence `CRITICAL` ou `URGENT`.

### Déploiement Docker (ARM)
- [ ] `docker compose up -d` démarre l'application complète sur architecture ARM sans erreur.
- [ ] Les données de la base et les factures uploadées survivent au redémarrage des conteneurs grâce aux volumes persistants.

## Verification Resources
- Tests unitaires et d'intégration automatisés exécutables via `npm test` dans WSL Ubuntu.
- Script de simulation / test mock du Webhook Discord et des regex d'URL fournisseurs.

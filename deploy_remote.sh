#!/bin/bash
# ==============================================================================
# FSAE Order Manager — Remote Deployment to Raspberry Pi 5
# ==============================================================================
set -e

RPI_USER="loupid"
RPI_HOST="192.168.18.15"
RPI_DEST="~/FSAE_OrderManager"

echo "🏎️  [FSAE DEPLOY] Démarrage du déploiement vers ${RPI_USER}@${RPI_HOST}..."

# 1. Vérification de la connectivité SSH
echo "🔑 [1/5] Vérification de la clé SSH..."
ssh -o BatchMode=yes -o ConnectTimeout=5 "${RPI_USER}@${RPI_HOST}" "echo '   SSH Connecté avec succès sur Raspberry Pi 5 !'"

# 2. Création du répertoire distant et des volumes
echo "📁 [2/5] Préparation des répertoires sur le Raspberry Pi..."
ssh "${RPI_USER}@${RPI_HOST}" "mkdir -p ${RPI_DEST}/data ${RPI_DEST}/uploads/invoices"

# 3. Synchronisation des sources via rsync
echo "📦 [3/5] Synchronisation des fichiers sources..."
rsync -avz --delete \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="data" \
  --exclude="uploads" \
  --exclude="dist" \
  --exclude=".system_generated" \
  --exclude="*.log" \
  ./ "${RPI_USER}@${RPI_HOST}:${RPI_DEST}/"

# 4. Compilation et démarrage des conteneurs Docker sur le Pi
echo "🐳 [4/5] Build natif ARM64 & démarrage Docker Compose sur le Raspberry Pi..."
ssh "${RPI_USER}@${RPI_HOST}" "cd ${RPI_DEST} && docker compose --profile tunnel up -d --build"

# 5. Vérification du statut
echo "🏥 [5/5] Vérification de l'état des conteneurs..."
sleep 4
ssh "${RPI_USER}@${RPI_HOST}" "cd ${RPI_DEST} && docker compose ps"

echo ""
echo "=================================================================="
echo "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS SUR LE RASPBERRY PI 5 !"
echo "=================================================================="
echo "🌐 Accès réseau local :"
echo "   - http://${RPI_HOST}"
echo "   - http://${RPI_HOST}:3000"
echo "   - http://raspberrypi.local (si mDNS actif)"
echo "☁️  Cloudflare Tunnel : Activé en arrière-plan"
echo "=================================================================="

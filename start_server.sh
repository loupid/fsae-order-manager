#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$HOME/.profile" ] && \. "$HOME/.profile"
[ -s "$HOME/.bashrc" ] && \. "$HOME/.bashrc"

if ! command -v node &> /dev/null; then
    for p in /home/*/.nvm/versions/node/*/bin/node /usr/bin/node /usr/local/bin/node; do
        if [ -f "$p" ]; then
            export PATH="$(dirname "$p"):$PATH"
            break
        fi
    done
fi

cd /mnt/d/Project/AI_Project/FSAE_OrderManager

# Si le build production n'existe pas, compiler le frontend React
if [ ! -f "dist/index.html" ]; then
    echo "📦 Compilation du frontend React 19..."
    npm run build
fi

echo "🏎️  Lancement du serveur FSAE Order Manager sur le port 3000..."
node server/index.js

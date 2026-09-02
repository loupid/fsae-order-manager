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
node "$@"

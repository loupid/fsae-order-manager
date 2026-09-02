#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$HOME/.profile" ] && \. "$HOME/.profile"
[ -s "$HOME/.bashrc" ] && \. "$HOME/.bashrc"

cd /mnt/d/Project/AI_Project/FSAE_OrderManager

# Rebuild native addons for linux if needed
if [ ! -f "node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
    echo "Rebuilding better-sqlite3 for Linux..."
    npm rebuild better-sqlite3
fi

echo "Using Node at: $(which node) ($(node -v))"
echo "Running standard Tier 1 tests..."
npm test

echo -e "\nRunning Challenger 2 Adversarial Stress Tests..."
node server/tests/adversarial_challenger2.test.js

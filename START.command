#!/bin/bash
# Doppelklick startet die MAINGAU-Demo
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v npm >/dev/null 2>&1; then echo "Node.js fehlt – bitte von https://nodejs.org installieren."; read -n1; exit 1; fi
[ -x node_modules/.bin/vite ] || npm install
( sleep 6; open "http://localhost:8080" ) &
npm run dev

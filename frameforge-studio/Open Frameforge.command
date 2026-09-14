#!/bin/zsh
cd "${0:A:h}" || exit 1
if ! command -v node >/dev/null; then
  echo 'Node.js 24 or newer is required. Install it from https://nodejs.org/'
  read '?Press Enter to close.'
  exit 1
fi
if [ ! -d node_modules ]; then npm ci || exit 1; fi
if [ ! -f dist/server/index.js ]; then npm run build || exit 1; fi
(sleep 3; open http://localhost:3210) &
npm start
read '?Press Enter to close.'

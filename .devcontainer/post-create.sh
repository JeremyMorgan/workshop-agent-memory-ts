#!/usr/bin/env bash
# Runs once when the dev container is created: the README "5-minute setup", minus Docker (compose already started Neo4j).
set -euo pipefail


# Establish links for Neo4j browser
HOST="${CODESPACE_NAME}-7474.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
URL="https://${HOST}/browser/?connectURL=https%3A%2F%2Fneo4j%40${HOST}%3A443&db=neo4j"
LINK_FILE="$PWD/NEO4J_BROWSER_LINK.txt"

echo "Neo4j Browser (password: workshop-password):" > "$LINK_FILE"
echo "$URL" >> "$LINK_FILE"

for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
  grep -q NEO4J_BROWSER_LINK "$rc" 2>/dev/null || \
    echo "echo; cat \"$LINK_FILE\"; echo" >> "$rc"
done

# Install packages
npm install
[ -f .env ] || cp .env.example .env

echo "Waiting for Neo4j at ${NEO4J_URI:-bolt://localhost:7687}..."
until node -e "
const neo4j=require('neo4j-driver');
const d=neo4j.driver(process.env.NEO4J_URI,neo4j.auth.basic(process.env.NEO4J_USERNAME,process.env.NEO4J_PASSWORD));
d.getServerInfo().then(()=>d.close()).then(()=>process.exit(0)).catch(()=>process.exit(1));
" 2>/dev/null; do sleep 2; done

npm run reset        # restore the fake apps, clear the graph, apply the schema
npm run seed:check
npm test

if [ -z "${OPENAI_API_KEY:-}" ] && ! grep -qE '^OPENAI_API_KEY=.+' .env; then
  echo "NOTE: OPENAI_API_KEY is not set. Add it to .env (or export it on your host and rebuild) before 'npm run chat'."
fi
echo "Ready. Try: npm run chat"


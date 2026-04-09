#!/usr/bin/env bash
set -euo pipefail

REMOTE_SSH="${REMOTE_SSH:-root@67.205.138.129}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/zagreb.lol/bus-stop-shade}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying ${PROJECT_DIR} -> ${REMOTE_SSH}:${REMOTE_DIR}"

ssh -i "$SSH_KEY" "$REMOTE_SSH" "mkdir -p '$REMOTE_DIR'"

rsync -avz --delete --chmod=Fu=rw,Fgo=r,Du=rwx,Dgo=rx \
  --exclude ".git/" \
  --exclude ".DS_Store" \
  --exclude "*.md" \
  --exclude "AGENTS.md" \
  --exclude "deploy-to-server.sh" \
  -e "ssh -i $SSH_KEY" \
  "$PROJECT_DIR/" "$REMOTE_SSH:$REMOTE_DIR/"

# Cache-bust: inject ?v=<timestamp> on local asset references in index.html.
# index.html itself is not cached by Cloudflare (DYNAMIC), so new URLs take effect immediately.
VERSION="$(date +%s)"
ssh -i "$SSH_KEY" "$REMOTE_SSH" "sed -i \
  -e 's|href=\"style.css[^\"]*\"|href=\"style.css?v=${VERSION}\"|' \
  -e 's|src=\"script.js[^\"]*\"|src=\"script.js?v=${VERSION}\"|' \
  '${REMOTE_DIR}/index.html'"

echo "Deploy complete (cache-bust v=${VERSION})."

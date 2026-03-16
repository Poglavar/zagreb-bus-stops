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

echo "Deploy complete."

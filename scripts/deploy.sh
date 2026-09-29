#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-123.57.167.97}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/1panel/www/wwwroot/www.skandstudio.com}"
SSH_OPTS="${SSH_OPTS:--o StrictHostKeyChecking=accept-new}"

RSYNC_RSH="ssh ${SSH_OPTS}"
if [[ -n "${SKAND_DEPLOY_PASSWORD:-}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "SKAND_DEPLOY_PASSWORD is set, but sshpass is not installed." >&2
    exit 1
  fi
  # Use sshpass -e (read from $SSHPASS) instead of -p <password> on the
  # command line: the password is passed through the environment, so it
  # survives spaces/special characters and never shows up in `ps` output.
  export SSHPASS="${SKAND_DEPLOY_PASSWORD}"
  RSYNC_RSH="sshpass -e ssh ${SSH_OPTS}"
fi

rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.DS_Store' \
  --exclude='.workbuddy/' \
  --exclude='pdf_images/' \
  --exclude='README.md' \
  --exclude='download-fonts.py' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='test_ssh.exp' \
  --exclude='DEPLOYMENT.md' \
  -e "${RSYNC_RSH}" \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ROOT}/"

echo "Deployed to ${REMOTE_HOST}:${REMOTE_ROOT}"

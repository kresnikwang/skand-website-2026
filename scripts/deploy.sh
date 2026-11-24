#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-123.57.167.97}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/1panel/www/wwwroot/www.skandstudio.com}"
SSH_OPTS="${SSH_OPTS:--o StrictHostKeyChecking=accept-new}"

cd "$(dirname "$0")/.."

# 1) Rebuild /play/ from the VG World source so the deployed game is never stale.
./scripts/sync-play.sh
if ! git diff --quiet -- play/ 2>/dev/null || [[ -n "$(git status --porcelain -- play/ scripts/vgworld/ 2>/dev/null)" ]]; then
  echo "Note: play/ or scripts/vgworld/ has uncommitted changes. Deploying anyway; remember to commit + push." >&2
fi

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

# Transfer the complete asset catalog before publishing the HTML that uses it.
rsync -az --delete --delay-updates \
  --exclude='/index.html' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.DS_Store' \
  --exclude='.workbuddy/' \
  --exclude='pdf_images/' \
  --exclude='portfolio assets/' \
  --exclude='docs/' \
  --exclude='server/' \
  --exclude='tests/' \
  --exclude='scripts/share/build-covers.cjs' \
  --exclude='scripts/portfolio/catalog.json' \
  --exclude='scripts/portfolio/build.js' \
  --exclude='scripts/skand-brawler/' \
  --exclude='scripts/vgworld/' \
  --exclude='scripts/deploy.sh' \
  --exclude='scripts/sync-play.sh' \
  --exclude='README.md' \
  --exclude='download-fonts.py' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='test_ssh.exp' \
  --exclude='DEPLOYMENT.md' \
  -e "${RSYNC_RSH}" \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ROOT}/"

rsync -az -e "${RSYNC_RSH}" \
  index.html "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ROOT}/"

echo "Deployed to ${REMOTE_HOST}:${REMOTE_ROOT}"

# 2) Smoke test the live site.
SITE_URL="${SITE_URL:-https://skandstudio.com}"
fail=0
for path in / /play/ /play/vendor/three/three.module.min.js /play/vendor/three/three.core.js /play/vendor/fonts/noto-sc.css; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}${path}" || echo 000)
  echo "  ${code} ${SITE_URL}${path}"
  [[ "$code" == 200 ]] || fail=1
done
# Fetch fully first: with pipefail, `curl | grep -q` fails when grep exits early (SIGPIPE).
play_html=$(curl -s "${SITE_URL}/play/" || true)
if [[ "$play_html" != *"Starry Wanderer"* ]]; then
  echo "  /play/ does not look like VG World" >&2; fail=1
fi
if [[ $fail -ne 0 ]]; then echo "Smoke test FAILED" >&2; exit 1; fi
echo "Smoke test passed"

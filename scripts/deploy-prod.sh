#!/bin/bash
# =============================================================================
#  Deploy FinAgent → Producción
#  Ejecutar desde Craft Agent (terminal Bash):
#    bash scripts/deploy-prod.sh
#
#  Requiere: scripts/.env.deploy con DEPLOY_SECRET=xxx
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
WEBHOOK_URL="http://144.91.80.189:7410"
PROJECT="finagent-prod"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: No se encontró $ENV_FILE"
  echo "Crea el archivo con: DEPLOY_SECRET=<secret-del-vps-setup>"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$DEPLOY_SECRET" ]; then
  echo "ERROR: DEPLOY_SECRET no está definido en $ENV_FILE"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy FinAgent PRODUCCIÓN"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════"
echo ""
read -p "  ⚠ Esto afecta PRODUCCIÓN. Continuar? (y/N) " -n 1 -r
echo ""
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Cancelado." && exit 0

# Git push
echo ""
echo "▶ [1/3] Git push a GitHub..."
cd "$WORKSPACE_DIR"
git add -A
CHANGES=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$CHANGES" != "0" ]; then
  git commit -m "deploy: finagent-prod $(date '+%Y-%m-%d %H:%M')"
fi
git push origin main
echo "  ✓ Push OK"

# Health check
echo ""
echo "▶ [2/3] Verificando webhook..."
HEALTH=$(curl -sf "${WEBHOOK_URL}/health" 2>/dev/null || echo "ERROR")
echo "$HEALTH" | grep -q '"ok"' || { echo "  ERROR: Webhook no disponible"; exit 1; }
echo "  ✓ Webhook activo"

# Trigger deploy
echo ""
echo "▶ [3/3] Triggering deploy PROD en VPS..."
RESPONSE=$(curl -sf -X POST \
  "${WEBHOOK_URL}/deploy/${PROJECT}" \
  -H "Authorization: Bearer ${DEPLOY_SECRET}" \
  -H "Content-Type: application/json" 2>/dev/null)

if echo "$RESPONSE" | grep -q '"ok":true'; then
  DEPLOY_ID=$(echo "$RESPONSE" | grep -o '"deployId":[0-9]*' | cut -d: -f2)
  echo "  ✓ Deploy prod iniciado (id: ${DEPLOY_ID})"
  echo ""
  echo "  Logs: curl -H 'Authorization: Bearer \$DEPLOY_SECRET' ${WEBHOOK_URL}/logs/${DEPLOY_ID}"
  echo "  App:  https://finagent.cynapt.cl"
else
  echo "  ERROR: $RESPONSE"; exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy PROD completado ✓"
echo "═══════════════════════════════════════"
echo ""

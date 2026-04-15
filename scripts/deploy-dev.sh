#!/bin/bash
# =============================================================================
#  Deploy FinAgent → Ambiente DEV
#  Ejecutar desde Craft Agent (terminal Bash):
#    bash scripts/deploy-dev.sh
#
#  Requiere: scripts/.env.deploy con DEPLOY_SECRET=xxx
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
WEBHOOK_URL="http://144.91.80.189:7410"
PROJECT="finagent-dev"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cargar secret ────────────────────────────────────────────────────────────
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
echo "  Deploy FinAgent DEV"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════"

# ── Git push ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ [1/3] Git push a GitHub..."
cd "$WORKSPACE_DIR"

# Agregar todos los cambios (excluyendo lo que está en .gitignore)
git add -A
CHANGES=$(git status --porcelain | wc -l | tr -d ' ')

if [ "$CHANGES" = "0" ]; then
  echo "  ℹ No hay cambios nuevos para hacer commit"
else
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git commit -m "deploy: finagent-dev ${TIMESTAMP}" --allow-empty
  echo "  ✓ Commit creado"
fi

git push origin main
echo "  ✓ Push a GitHub OK"

# ── Health check del webhook ──────────────────────────────────────────────────
echo ""
echo "▶ [2/3] Verificando webhook en VPS..."
HEALTH=$(curl -sf "${WEBHOOK_URL}/health" 2>/dev/null || echo "ERROR")

if echo "$HEALTH" | grep -q '"ok"'; then
  echo "  ✓ Webhook activo"
else
  echo "  ERROR: No se puede alcanzar el webhook en ${WEBHOOK_URL}"
  echo "  Respuesta: $HEALTH"
  echo ""
  echo "  Verifica que el proceso deploy-webhook esté activo en el VPS:"
  echo "    pm2 status deploy-webhook"
  exit 1
fi

# ── Trigger deploy ────────────────────────────────────────────────────────────
echo ""
echo "▶ [3/3] Triggering deploy ${PROJECT} en VPS..."

RESPONSE=$(curl -sf -X POST \
  "${WEBHOOK_URL}/deploy/${PROJECT}" \
  -H "Authorization: Bearer ${DEPLOY_SECRET}" \
  -H "Content-Type: application/json" \
  2>/dev/null)

if echo "$RESPONSE" | grep -q '"ok":true'; then
  DEPLOY_ID=$(echo "$RESPONSE" | grep -o '"deployId":[0-9]*' | cut -d: -f2)
  echo "  ✓ Deploy iniciado (id: ${DEPLOY_ID})"
  echo ""
  echo "  Logs en VPS: /tmp/deploy-${PROJECT}-${DEPLOY_ID}.log"
  echo "  O via webhook: curl -H 'Authorization: Bearer \$DEPLOY_SECRET' ${WEBHOOK_URL}/logs/${DEPLOY_ID}"
  echo ""
  echo "  App DEV: http://144.91.80.189:4011"
else
  echo "  ERROR: deploy falló"
  echo "  Respuesta: $RESPONSE"
  exit 1
fi

echo "═══════════════════════════════════════"
echo "  Deploy DEV completado ✓"
echo "═══════════════════════════════════════"
echo ""

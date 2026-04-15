#!/bin/bash
# =============================================================================
#  Deploy FinAgent → Producción
#  Arquitectura: Docker container → build local → SSH+scp → VPS host
#
#  Ejecutar desde Craft Agent:
#    bash scripts/deploy-prod.sh
#
#  Flujo:
#    1. git push a GitHub (historial/backup)
#    2. bun run build — compila server (tsc) y client (vite) en el container
#    3. scp dist/ al host VPS (/var/www/finagent/)
#    4. pm2 restart finagent-api en el host
#
#  IMPORTANTE: El .env en /var/www/finagent/server/.env NUNCA se sobreescribe.
# =============================================================================
set -e

WORKSPACE_DIR="/home/craftagents/.craft-agent/workspaces/finagent"
HOST="root@172.17.0.1"
KEY="$HOME/.ssh/vps_cynapt"
SSH_CMD="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i $KEY"
SCP_CMD="scp -o StrictHostKeyChecking=no -i $KEY"
TARGET="/var/www/finagent"

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy FinAgent PRODUCCIÓN"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════"
echo ""
read -p "  ⚠ Esto afecta PRODUCCIÓN. Continuar? (y/N) " -n 1 -r
echo ""
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "  Cancelado." && exit 0

# ── Verificar conexión al host ────────────────────────────────────────────────
echo ""
echo "▶ [0/5] Verificando conexión al host..."
$SSH_CMD "$HOST" "echo ok" > /dev/null 2>&1 && echo "  ✓ Host accesible" || {
  echo "  ERROR: No se puede conectar al host VPS (172.17.0.1)"
  exit 1
}

# ── Git push ──────────────────────────────────────────────────────────────────
echo ""
echo "▶ [1/5] Git push a GitHub (historial)..."
cd "$WORKSPACE_DIR"
git add -A
if [ -n "$(git status --porcelain)" ]; then
  git commit -m "deploy: finagent-prod $(date '+%Y-%m-%d %H:%M')"
  echo "  ✓ Commit creado"
else
  echo "  ℹ Sin cambios nuevos para commitear"
fi
git push origin main
echo "  ✓ Push a GitHub OK"

# ── Build server ──────────────────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Build server (TypeScript → dist/)..."
cd "$WORKSPACE_DIR/server"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build
echo "  ✓ server/dist/ generado"

# ── Build client ──────────────────────────────────────────────────────────────
echo ""
echo "▶ [3/5] Build client (Vite → dist/)..."
cd "$WORKSPACE_DIR/client"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build
echo "  ✓ client/dist/ generado"

# ── Deploy al host ────────────────────────────────────────────────────────────
echo ""
echo "▶ [4/5] Copiando archivos al VPS..."
$SSH_CMD "$HOST" "mkdir -p $TARGET/server/dist $TARGET/client"
$SCP_CMD -r "$WORKSPACE_DIR/server/dist/." "$HOST:$TARGET/server/dist/"
$SCP_CMD -r "$WORKSPACE_DIR/client/dist/." "$HOST:$TARGET/client/"
echo "  ✓ server/dist/ copiado"
echo "  ✓ client/dist/ copiado"
echo "  ℹ .env del servidor NO se modificó (contiene secrets de producción)"

# ── Restart PM2 ───────────────────────────────────────────────────────────────
echo ""
echo "▶ [5/5] Reiniciando finagent-api (PM2)..."
$SSH_CMD "$HOST" "pm2 restart finagent-api"
echo "  ✓ finagent-api reiniciado"

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy PROD completado ✓"
echo "  App: https://finagent.cynapt.cl"
echo "═══════════════════════════════════════"
echo ""

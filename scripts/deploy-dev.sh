#!/bin/bash
# =============================================================================
#  Deploy FinAgent → Ambiente DEV
#  Arquitectura: Docker container → SSH directo → VPS host (172.17.0.1)
#
#  Ejecutar desde Craft Agent:
#    bash scripts/deploy-dev.sh
#
#  No requiere webhook, GitHub push, ni secrets.
#  Sincroniza src/ directamente al host. tsx watch auto-recarga el servidor.
# =============================================================================
set -e

WORKSPACE_DIR="/home/craftagents/.craft-agent/workspaces/finagent"
HOST="root@172.17.0.1"
KEY="$HOME/.ssh/vps_cynapt"
SSH_CMD="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i $KEY"
SCP_CMD="scp -o StrictHostKeyChecking=no -i $KEY"
TARGET="/var/www/finagent-dev"

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy FinAgent DEV"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════"

# ── Verificar conexión al host ────────────────────────────────────────────────
echo ""
echo "▶ [0/3] Verificando conexión al host..."
$SSH_CMD "$HOST" "echo ok" > /dev/null 2>&1 && echo "  ✓ Host accesible" || {
  echo "  ERROR: No se puede conectar al host VPS (172.17.0.1)"
  exit 1
}

# ── Sync server/src ───────────────────────────────────────────────────────────
echo ""
echo "▶ [1/3] Sincronizando server/src..."
$SSH_CMD "$HOST" "mkdir -p $TARGET/server/src"
$SCP_CMD -r "$WORKSPACE_DIR/server/src/." "$HOST:$TARGET/server/src/"
echo "  ✓ server/src sincronizado"

# ── Sync client/src ───────────────────────────────────────────────────────────
echo ""
echo "▶ [2/3] Sincronizando client/src..."
$SSH_CMD "$HOST" "mkdir -p $TARGET/client/src"
$SCP_CMD -r "$WORKSPACE_DIR/client/src/." "$HOST:$TARGET/client/src/"
$SCP_CMD "$WORKSPACE_DIR/client/index.html" "$HOST:$TARGET/client/"
echo "  ✓ client/src sincronizado"

# ── Restart PM2 dev ───────────────────────────────────────────────────────────
echo ""
echo "▶ [3/3] Reiniciando procesos DEV..."
$SSH_CMD "$HOST" "pm2 restart finagent-dev 2>/dev/null || echo 'WARN: finagent-dev no encontrado en PM2'"
echo "  ✓ PM2 finagent-dev reiniciado"

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy DEV completado ✓"
echo "  API:    http://144.91.80.189:5010"
echo "  UI Dev: http://144.91.80.189:4011"
echo "═══════════════════════════════════════"
echo ""

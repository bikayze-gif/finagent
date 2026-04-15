#!/bin/bash
# deploy-dev.sh — Actualizar ambiente de desarrollo FinAgent desde GitHub
# Ejecutar localmente: bash deploy-dev.sh
# O directamente en el VPS: ssh cynapt "bash /var/www/finagent-dev/deploy-dev.sh"

set -e

VPS_HOST="cynapt"
VPS_PATH="/var/www/finagent-dev"

echo "🚀 Deployando FinAgent (Kinetic Terminal) al ambiente de desarrollo..."

# Opción A: Si tienes SSH disponible, despliega directamente
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$VPS_HOST" "echo ok" 2>/dev/null; then
  echo "✅ SSH disponible. Ejecutando git pull en el VPS..."
  ssh "$VPS_HOST" << 'ENDSSH'
set -e
export NVM_DIR=/root/.nvm
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

cd /var/www/finagent-dev

echo "📥 Bajando cambios de GitHub..."
git pull origin main

# Si hay cambios en las dependencias del cliente
if git diff HEAD~1 --name-only | grep -q "client/package.json"; then
  echo "📦 Instalando dependencias del cliente..."
  cd client && npm install && cd ..
fi

# Si hay cambios en las dependencias del servidor
if git diff HEAD~1 --name-only | grep -q "server/package.json"; then
  echo "📦 Instalando dependencias del servidor..."
  cd server && npm install && cd ..
fi

echo "🔄 Reiniciando procesos PM2..."
pm2 restart finagent-dev || true
pm2 restart finagent-dev-ui || true

echo "✅ Deploy completado. Vite HMR debería estar activo en :4011"
pm2 list | grep finagent
ENDSSH

else
  echo "⚠️  SSH no disponible. El código ya fue pusheado a GitHub."
  echo ""
  echo "Cuando el VPS vuelva online, ejecuta en el servidor:"
  echo ""
  echo "  ssh cynapt"
  echo "  cd /var/www/finagent-dev"
  echo "  git pull origin main"
  echo "  pm2 restart finagent-dev finagent-dev-ui"
  echo ""
  echo "O simplemente corre este script de nuevo:"
  echo "  bash finagent/deploy-dev.sh"
fi

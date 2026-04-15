#!/bin/bash
# =============================================================================
#  VPS Deploy Infrastructure Setup
#  VPS: 144.91.80.189  |  Repos: bikayze-gif/cynapt, bikayze-gif/finagent
#
#  Ejecutar UNA SOLA VEZ desde tu terminal Windows:
#    ssh cynapt "bash -s" < scripts/vps-setup.sh
#
#  Instala:
#  1. SSH deploy keys (VPS → GitHub, read-only)
#  2. Deploy webhook HTTP server (puerto 7410) — Bun/PM2
#  3. Deploy scripts en /root/scripts/
#  4. Abre puerto 7410 en UFW si está activo
# =============================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo "============================================"
echo "  VPS Deploy Infrastructure Setup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# ─── 1. SSH Deploy Keys ────────────────────────────────────────────────────
echo -e "${CYAN}[1/6] Generando SSH deploy keys...${NC}"

mkdir -p /root/.ssh && chmod 700 /root/.ssh

[ ! -f /root/.ssh/deploy_cynapt ] && \
  ssh-keygen -t ed25519 -f /root/.ssh/deploy_cynapt -N "" -C "vps-deploy-cynapt" -q && \
  echo -e "  ${GREEN}✓ deploy_cynapt creada${NC}" || \
  echo "  ✓ deploy_cynapt ya existe"

[ ! -f /root/.ssh/deploy_finagent ] && \
  ssh-keygen -t ed25519 -f /root/.ssh/deploy_finagent -N "" -C "vps-deploy-finagent" -q && \
  echo -e "  ${GREEN}✓ deploy_finagent creada${NC}" || \
  echo "  ✓ deploy_finagent ya existe"

chmod 600 /root/.ssh/deploy_cynapt /root/.ssh/deploy_finagent 2>/dev/null || true

# ─── 2. SSH Config Aliases ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/6] Configurando SSH aliases para GitHub...${NC}"

touch /root/.ssh/config && chmod 600 /root/.ssh/config

# Eliminar entradas anteriores y agregar alias limpios
python3 - << 'PYEOF'
import re, os
cfg = open('/root/.ssh/config').read() if os.path.exists('/root/.ssh/config') else ''
# Remove existing github-cynapt and github-finagent blocks
cfg = re.sub(r'\nHost github-cynapt\b.*?(?=\nHost |\Z)', '', cfg, flags=re.DOTALL)
cfg = re.sub(r'\nHost github-finagent\b.*?(?=\nHost |\Z)', '', cfg, flags=re.DOTALL)
cfg = cfg.rstrip()
cfg += '''

Host github-cynapt
    HostName github.com
    User git
    IdentityFile /root/.ssh/deploy_cynapt
    StrictHostKeyChecking no

Host github-finagent
    HostName github.com
    User git
    IdentityFile /root/.ssh/deploy_finagent
    StrictHostKeyChecking no
'''
open('/root/.ssh/config', 'w').write(cfg)
PYEOF

echo -e "  ${GREEN}✓ /root/.ssh/config actualizado${NC}"

# ─── 3. Deploy Webhook Server ──────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/6] Instalando deploy webhook (puerto 7410)...${NC}"

mkdir -p /root/webhook

# Generar secret seguro (solo si no existe)
if [ ! -f /root/webhook/.env ]; then
  DEPLOY_SECRET=$(openssl rand -hex 24)
  echo "DEPLOY_SECRET=${DEPLOY_SECRET}" > /root/webhook/.env
  chmod 600 /root/webhook/.env
  echo -e "  ${GREEN}✓ Secret generado y guardado en /root/webhook/.env${NC}"
else
  DEPLOY_SECRET=$(grep DEPLOY_SECRET /root/webhook/.env | cut -d= -f2)
  echo "  ✓ Secret existente preservado"
fi

cat > /root/webhook/server.js << 'SERVEREOF'
// Deploy Webhook Server — puerto 7410
// Endpoints:
//   GET  /health               → estado (sin auth)
//   POST /deploy/:project      → trigger deploy (auth requerida)
//   GET  /logs/:deployId       → ver log del deploy (auth requerida)

const SECRET = process.env.DEPLOY_SECRET;
if (!SECRET) { console.error('DEPLOY_SECRET es requerido'); process.exit(1); }

const PORT = 7410;
const SCRIPTS = {
  'finagent-dev':  '/root/scripts/deploy-finagent-dev.sh',
  'finagent-prod': '/root/scripts/deploy-finagent-prod.sh',
  'cynapt':        '/root/scripts/deploy-cynapt.sh',
};

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    // Health check (sin auth)
    if (pathname === '/health' && req.method === 'GET') {
      return Response.json({ status: 'ok', ts: ts(), projects: Object.keys(SCRIPTS) });
    }

    // Auth
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${SECRET}`) {
      console.log(`[${ts()}] UNAUTHORIZED ${req.method} ${pathname}`);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // POST /deploy/:project
    const dm = pathname.match(/^\/deploy\/([a-z0-9-]+)$/);
    if (dm && req.method === 'POST') {
      const project = dm[1];
      const script = SCRIPTS[project];
      if (!script) return Response.json(
        { error: `Unknown project: ${project}. Valid: ${Object.keys(SCRIPTS).join(', ')}` },
        { status: 404 }
      );

      const id = Date.now();
      const logFile = `/tmp/deploy-${project}-${id}.log`;
      console.log(`[${ts()}] DEPLOY START project=${project} id=${id}`);

      const proc = Bun.spawn(['bash', script], {
        stdout: Bun.file(logFile), stderr: Bun.file(logFile),
        env: { ...process.env },
      });
      proc.exited.then(code =>
        console.log(`[${ts()}] DEPLOY END project=${project} id=${id} code=${code}`)
      );

      return Response.json({ ok: true, project, deployId: id, logsUrl: `/logs/${id}` });
    }

    // GET /logs/:id
    const lm = pathname.match(/^\/logs\/(\d+)$/);
    if (lm && req.method === 'GET') {
      for (const p of Object.keys(SCRIPTS)) {
        const f = `/tmp/deploy-${p}-${lm[1]}.log`;
        try {
          return new Response(await Bun.file(f).text(),
            { headers: { 'content-type': 'text/plain; charset=utf-8' } });
        } catch {}
      }
      return Response.json({ error: 'Log not found' }, { status: 404 });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(`[${ts()}] Deploy webhook on port ${PORT}`);
SERVEREOF

echo -e "  ${GREEN}✓ /root/webhook/server.js creado${NC}"

# ─── 4. Deploy Scripts ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/6] Creando deploy scripts en /root/scripts/...${NC}"

mkdir -p /root/scripts

# ── cynapt ────────────────────────────────────────────────────────────────
cat > /root/scripts/deploy-cynapt.sh << 'SCRIPT'
#!/bin/bash
set -e
TS() { date '+%H:%M:%S'; }
echo "[$(TS)] deploy-cynapt INICIO"

if [ -d /var/repos/cynapt/.git ]; then
  cd /var/repos/cynapt
  git fetch git@github-cynapt:bikayze-gif/cynapt.git main
  git reset --hard FETCH_HEAD
else
  git clone git@github-cynapt:bikayze-gif/cynapt.git /var/repos/cynapt
  cd /var/repos/cynapt
fi
echo "[$(TS)] git OK — $(git log -1 --oneline)"

mkdir -p /var/www/cynapt
if   [ -d dist ];   then rsync -a --delete dist/ /var/www/cynapt/
elif [ -d public ]; then rsync -a --delete public/ /var/www/cynapt/
else rsync -a --exclude '.git' --exclude 'node_modules' . /var/www/cynapt/; fi

echo "[$(TS)] deploy-cynapt LISTO"
SCRIPT

# ── finagent-dev ──────────────────────────────────────────────────────────
cat > /root/scripts/deploy-finagent-dev.sh << 'SCRIPT'
#!/bin/bash
set -e
TS() { date '+%H:%M:%S'; }
echo "[$(TS)] deploy-finagent-dev INICIO"

if [ -d /var/repos/finagent/.git ]; then
  cd /var/repos/finagent
  git fetch git@github-finagent:bikayze-gif/finagent.git main
  git reset --hard FETCH_HEAD
else
  git clone git@github-finagent:bikayze-gif/finagent.git /var/repos/finagent
  cd /var/repos/finagent
fi
echo "[$(TS)] git OK — $(git log -1 --oneline)"

# Sync client src (Vite HMR auto-recarga el browser)
mkdir -p /var/www/finagent-dev/client/src
rsync -a --delete /var/repos/finagent/client/src/ /var/www/finagent-dev/client/src/
rsync -a /var/repos/finagent/client/index.html /var/www/finagent-dev/client/

# Sync server src
mkdir -p /var/www/finagent-dev/server/src
rsync -a --delete /var/repos/finagent/server/src/ /var/www/finagent-dev/server/src/

# Restart dev API
pm2 restart finagent-dev 2>/dev/null && echo "[$(TS)] PM2 restarted" || \
  echo "[$(TS)] WARNING: PM2 'finagent-dev' no encontrado"

echo "[$(TS)] deploy-finagent-dev LISTO"
SCRIPT

# ── finagent-prod ─────────────────────────────────────────────────────────
cat > /root/scripts/deploy-finagent-prod.sh << 'SCRIPT'
#!/bin/bash
set -e
TS() { date '+%H:%M:%S'; }
echo "[$(TS)] deploy-finagent-prod INICIO"

if [ -d /var/repos/finagent/.git ]; then
  cd /var/repos/finagent
  git fetch git@github-finagent:bikayze-gif/finagent.git main
  git reset --hard FETCH_HEAD
else
  git clone git@github-finagent:bikayze-gif/finagent.git /var/repos/finagent
  cd /var/repos/finagent
fi
echo "[$(TS)] git OK — $(git log -1 --oneline)"

# Build client
cd /var/repos/finagent/client
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build
echo "[$(TS)] Client build OK"

# Deploy client
mkdir -p /var/www/finagent/client/dist
rsync -a --delete /var/repos/finagent/client/dist/ /var/www/finagent/client/dist/

# Deploy server
mkdir -p /var/www/finagent/server
rsync -a --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude '.env' \
  /var/repos/finagent/server/ /var/www/finagent/server/
cd /var/www/finagent/server && bun install --production 2>/dev/null || true

# Restart PM2
pm2 restart finagent-api
echo "[$(TS)] PM2 finagent-api restarted"
echo "[$(TS)] deploy-finagent-prod LISTO"
SCRIPT

chmod +x /root/scripts/deploy-cynapt.sh
chmod +x /root/scripts/deploy-finagent-dev.sh
chmod +x /root/scripts/deploy-finagent-prod.sh
echo -e "  ${GREEN}✓ 3 deploy scripts creados${NC}"

# ─── 5. Firewall ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[5/6] Configurando firewall...${NC}"

if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 7410/tcp comment "deploy-webhook" 2>/dev/null && \
    echo -e "  ${GREEN}✓ UFW: puerto 7410 abierto${NC}"
else
  echo "  (UFW inactivo — puerto 7410 disponible directamente)"
fi

# ─── 6. PM2 ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[6/6] Registrando deploy-webhook en PM2...${NC}"

pm2 stop deploy-webhook 2>/dev/null || true
pm2 delete deploy-webhook 2>/dev/null || true

pm2 start /root/webhook/server.js \
  --name deploy-webhook \
  --interpreter bun \
  --env-file /root/webhook/.env \
  --restart-delay 3000 \
  --max-restarts 10

pm2 save --force
echo -e "  ${GREEN}✓ deploy-webhook activo en PM2${NC}"

# ─── RESUMEN ───────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e "  ${GREEN}SETUP COMPLETO${NC}"
echo "============================================"
echo ""
echo -e "${YELLOW}► Guarda este DEPLOY_SECRET en tu workspace de Craft Agent:${NC}"
echo ""
echo "    DEPLOY_SECRET=${DEPLOY_SECRET}"
echo ""
echo "  Archivo: finagent/scripts/.env.deploy"
echo "  Línea:   DEPLOY_SECRET=${DEPLOY_SECRET}"
echo ""
echo "Test de webhook:"
echo "  curl http://144.91.80.189:7410/health"
echo ""
echo -e "${YELLOW}► Agrega estas DEPLOY KEYS en GitHub (read-only):${NC}"
echo ""
echo "  1. github.com/bikayze-gif/cynapt → Settings → Deploy keys"
echo "     Nombre: vps-deploy-cynapt"
cat /root/.ssh/deploy_cynapt.pub
echo ""
echo "  2. github.com/bikayze-gif/finagent → Settings → Deploy keys"
echo "     Nombre: vps-deploy-finagent"
cat /root/.ssh/deploy_finagent.pub
echo ""
echo -e "${YELLOW}► Después de agregar las keys, clona los repos:${NC}"
echo "  git clone git@github-cynapt:bikayze-gif/cynapt.git /var/repos/cynapt"
echo "  git clone git@github-finagent:bikayze-gif/finagent.git /var/repos/finagent"
echo ""

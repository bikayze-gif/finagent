# FinAgent — Guía de Deploy

## Arquitectura

```
VPS 144.91.80.189
├── Docker Container (Craft Agent)
│   └── Workspace: /home/craftagents/.craft-agent/workspaces/finagent/
│       ├── client/   ← fuente React + Vite
│       └── server/   ← fuente TypeScript API
│
└── Host VPS (172.17.0.1 desde el container)
    ├── PM2
    │   ├── finagent-api     → PROD API  (node dist/index.js)
    │   ├── finagent-dev     → DEV API   (tsx watch src/index.ts)
    │   └── finagent-dev-ui  → DEV UI    (Vite dev server)
    ├── /var/www/finagent/      ← PRODUCCIÓN
    │   ├── client/           (archivos estáticos compilados)
    │   ├── server/dist/      (TypeScript compilado a JS)
    │   └── server/.env       ← secrets de producción (NUNCA sobrescribir)
    └── /var/www/finagent-dev/  ← DESARROLLO
        ├── client/src/       (fuente viva — Vite HMR)
        └── server/src/       (fuente viva — tsx watch)
```

## Deploy rápido

### DEV (sync de fuentes, sin build)
```bash
bash scripts/deploy-dev.sh
```
Sincroniza `src/` al host. `tsx watch` y Vite HMR recargan automáticamente.

### PROD (build completo)
```bash
bash scripts/deploy-prod.sh
```
Compila server (tsc) y client (vite) en el container, luego copia `dist/` al host y reinicia PM2.

## Cómo funciona el deploy (sin webhook, sin secrets)

El container tiene acceso SSH directo al host VPS usando la key `~/.ssh/vps_cynapt`.

```
Container (172.17.0.2)
    │
    ├── scp -i ~/.ssh/vps_cynapt  →  root@172.17.0.1:/var/www/finagent/
    └── ssh -i ~/.ssh/vps_cynapt  →  pm2 restart finagent-api
```

No se necesita:
- Webhook server (el anterior `vps-setup.sh`)
- DEPLOY_SECRET
- Push a GitHub para que el VPS haga pull

El push a GitHub en `deploy-prod.sh` es **solo para historial/backup** — no es necesario para que el deploy funcione.

## URLs

| Ambiente | URL |
|----------|-----|
| Producción | https://finagent.cynapt.cl |
| DEV (API) | http://144.91.80.189:5010 |
| DEV (UI) | http://144.91.80.189:4011 |

## Infraestructura en el host

| Componente | Detalle |
|-----------|---------|
| **SSH key** | `~/.ssh/vps_cynapt` (ya configurada en el container) |
| **Host gateway** | `172.17.0.1` (Docker bridge — VPS host) |
| **PM2 prod** | `finagent-api` — cwd `/var/www/finagent` |
| **PM2 dev** | `finagent-dev` — tsx watch |
| **Nginx** | `finagent.conf` — sirve PROD en dominio |

## Secrets de producción

El archivo `/var/www/finagent/server/.env` en el host contiene las credenciales de producción (DB, JWT). **Los scripts de deploy nunca lo tocan.** Si necesitas actualizarlo:

```bash
ssh -i ~/.ssh/vps_cynapt root@172.17.0.1 "nano /var/www/finagent/server/.env"
```

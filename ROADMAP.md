# FinAgent — Roadmap de Implementación

> Última actualización: 2026-04-17 — QA Fase 6 completado

## Leyenda
- ✅ Completo
- 🔄 En progreso
- ⏳ Pendiente
- ❌ Bloqueado

---

## Fase 1 — Infraestructura VPS ✅
**Completado:** 2026-04 (sesión inicial)

- [x] VPS Hetzner 144.91.80.189, Ubuntu 24.04
- [x] MySQL 8.0 — `finagent_db` + `finagent_dev_db`
- [x] PM2 con auto-start en boot
- [x] Nginx reverse proxy
- [x] SSL (cynapt.cl via certbot)
- [x] Deploy pipeline: SSH directo container→host via `172.17.0.1`

**Procesos PM2 activos:**
| Proceso | Puerto | Ambiente |
|---------|--------|----------|
| `finagent-api` | 5010 | Producción |
| `finagent-dev` | 4010 | Desarrollo (tsx watch) |
| `finagent-dev-ui` | 4011 | Desarrollo (Vite HMR) |

---

## Fase 2 — Backend API ✅
**Completado:** 2026-04

Stack: Hono + TypeScript + Drizzle ORM + MySQL2 + Zod + JWT + bcrypt

### Módulos implementados (18 endpoints)
| Módulo | Endpoints |
|--------|-----------|
| Auth | `POST /register`, `POST /login`, `POST /refresh`, `GET /me` |
| Accounts | `GET /accounts`, `POST /accounts`, `PATCH /accounts/:id`, `DELETE /accounts/:id` |
| Transactions | `GET /transactions` (paginado+filtros), `POST`, `PATCH :id`, `DELETE :id` |
| Categories | `GET /categories`, `POST /categories` |
| Budgets | `GET /budgets` (con spent), `POST /budgets` |
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/calendar` |

### Schema DB (tablas)
`users`, `accounts`, `categories`, `transactions`, `tags`, `transaction_tags`, `budgets`, `financial_goals`

---

## Fase 3 — Frontend Base ✅
**Completado:** 2026-04

Stack: React 19 + Vite + Tailwind CSS v4 + React Router v7 + TanStack Query + Recharts

### Páginas implementadas
- [x] Login / Register (auth con JWT)
- [x] Dashboard (resumen, gráficos Recharts)
- [x] Transactions (lista paginada + filtros)
- [x] TransactionForm (crear/editar)
- [x] Budgets
- [x] Goals (metas financieras)
- [x] Accounts
- [x] Settings
- [x] Calendar

---

## Fase 4 — Design System: Kinetic Terminal ✅
**Completado:** 2026-04

Paleta: `#0b1326` navy · `#98da27` lime · `#5de6ff` cyan
Tipografía: Space Grotesk (headlines) + Inter (body)

- [x] `index.css` — `@theme` Tailwind v4, `.terminal-grid`, `.glass-panel`
- [x] `Layout.jsx` — sidebar Kinetic, header glassmorphic
- [x] `Button.jsx` — `rounded-full`, `uppercase tracking-widest`
- [x] `Card.jsx` — superficie `#131b2e`, borde `#2d3449`
- [x] `Input.jsx` / `Select.jsx` — lime focus ring
- [x] `Modal.jsx` — glass panel, título lime
- [x] Todas las páginas actualizadas con el tema

---

## Fase 5 — Deploy Pipeline ✅
**Completado:** 2026-04-15

- [x] SSH directo container→host via Docker gateway `172.17.0.1`
- [x] `scripts/deploy-dev.sh` — sync src/ + restart PM2 (sin build)
- [x] `scripts/deploy-prod.sh` — build local + scp dist/ + restart PM2
- [x] `DEPLOY.md` — documentación completa
- [x] `.gitignore` actualizado (node_modules, dist, .env)
- [x] Repos separados: `bikayze-gif/cynapt` + `bikayze-gif/finagent`

---

## Fase 6 — Feature: Activities ✅
**Completado:** 2026-04-17 | **QA:** APROBADO (13/13 TCs)

Módulo CRUD de actividades financieras recurrentes (pagos, compromisos periódicos).

### Implementación:
- [x] `server/src/routes/activities.ts` — CRUD completo (GET, POST, PATCH, DELETE)
- [x] `server/src/index.ts` — ruta registrada en `/api/activities`
- [x] DB: tabla `activities` (userId, name, frequency, cycleDay, amount, color, status, startDate)
- [x] `client/src/pages/Activities.jsx` — página con lista, modal crear/editar, confirmación delete
- [x] `client/src/App.jsx` — ruta `/activities` en router
- [x] `client/src/components/Layout.jsx` — enlace "ACTIVIDADES" con ícono CalendarClock en sidebar

### QA Results (2026-04-17):
- [x] TC-01: Navegación — sidebar ACTIVIDADES visible, `/activities` carga sin errores
- [x] TC-02: Estado vacío — mensaje "Sin actividades registradas" + botón crear
- [x] TC-03: Crear actividad — card creada con nombre, frecuencia "Mensual" y "↻ Día 5 de cada mes"
- [x] TC-04: Editar actividad — nombre actualizado correctamente
- [x] TC-05: Pausar/Reactivar — badge "Pausada" aparece/desaparece
- [x] TC-06: Eliminar — actividad desaparece de la lista tras confirmar
- [x] TC-07: Sin errores HTTP 4xx/5xx ni errores JS en consola

### Bugs:
- [x] **BUG-01** *(resuelto b7337ef)*: `description: null` retorna 422 → fix `.nullable().optional()` en createSchema

---

## Fase 7 — Testing & QA ⏳

- [ ] Tests unitarios backend (Bun test)
- [ ] Tests de integración API
- [ ] Tests E2E frontend (Playwright)
- [ ] Review de seguridad: inputs, auth, CORS

---

## Fase 8 — Producción ⏳

- [ ] DNS: `finagent.cynapt.cl → 144.91.80.189` (registro A)
- [ ] SSL certbot para `finagent.cynapt.cl`
- [ ] Nginx config finalizada para PROD
- [ ] Variables `.env` producción auditadas
- [ ] Monitoring (PM2 logs, alertas)
- [ ] Backup DB automatizado

---

## URLs de Referencia

| Ambiente | URL |
|----------|-----|
| DEV UI | http://144.91.80.189:4011 |
| DEV API | http://144.91.80.189:4010 |
| PROD | https://finagent.cynapt.cl *(pendiente DNS)* |
| GitHub | https://github.com/bikayze-gif/finagent |
| Landing | https://cynapt.cl |

# MoobFinance - Caixa & Metas

## Overview
A unified financial platform for rideshare drivers (Uber/99). Features cash-flow tracking per shift, earnings reporting, and a peer goal/lending system between driver partners. Built with React + Vite on the frontend, Express + TypeScript on the backend, MongoDB for persistence, Gemini AI for insights, and Mercado Pago for payments.

## How to run
The project supports three run modes, each with a matching workflow and npm script:

| Mode | Workflow | Command | Behavior |
|------|----------|---------|----------|
| Dev | `Start application` | `npm run dev` | Vite middleware + HMR ativo. Reload automático ao editar código; é o modo padrão usado no preview. |
| Produção sem build | `Start (Producao sem build)` | `npm run start:no-build` | Vite middleware servindo o código-fonte direto, mas com HMR **desligado** — sem full-reload ao perder o socket em segundo plano no celular/PWA. Não precisa buildar antes, então pega mudanças de código imediatamente ao reiniciar. |
| Produção (build) | `Start (Producao build)` | `npm run build && npm start` | Serve os arquivos já compilados em `dist/`. Mais rápido/estável para uso diário, mas exige rodar o build a cada mudança de código. |

Only one of the three can run at a time (all bind port 5000) — stop the current workflow before starting another.

## Running on Termux (comando `moob`)
`scripts/moob` é um script pronto para rodar o app pelo Termux com um único comando.

**Instalação (uma vez só) no Termux**, com o repositório clonado em `~/desenvolvimento/Moob-Metas-Emprestimos`:
```
cd ~/desenvolvimento/Moob-Metas-Emprestimos
chmod +x scripts/moob
ln -sf "$PWD/scripts/moob" "$PREFIX/bin/moob"
```

**Uso, de qualquer lugar do Termux:**
```
moob            # modo produção sem build (padrão — estável, sem precisar buildar)
moob dev        # modo dev (HMR ativo, para editar código)
moob build      # modo produção com build (roda "npm run build" e depois serve dist/)
```
O script entra na pasta do projeto, instala dependências se faltar `node_modules`, inicia o servidor na
porta 5000 e abre `http://localhost:5000/` automaticamente via `termux-open-url` (requer o app Termux:API
+ `pkg install termux-api`; sem isso, ele só imprime o endereço para abrir manualmente). Ctrl+C encerra o
servidor.

## Required secrets
| Secret | Purpose | Status |
|--------|---------|--------|
| `GEMINI_API_KEY` | Gemini AI features | Not set — AI insights features will fail until provided |
| `MERCADOPAGO_ACCESS_TOKEN` | Payment processing via Mercado Pago | Not set — payment routes will fail until provided |
| `MONGODB_URI` | Main database connection | Not set — app currently falls back to a hardcoded MongoDB Atlas URI baked into `src/server/config/database.ts`. Set this secret to point at your own database. |

`SESSION_SECRET` is already configured.

## Running for daily/personal use (e.g. self-hosted on Termux)
Use production mode, not `npm run dev`. Dev mode keeps a Vite HMR WebSocket open; many mobile
browsers and installed PWAs drop that socket when the tab is backgrounded, and Vite's client
treats the reconnect as "server restarted" and forces a full page reload — every time you
switch away and back. Production mode has no dev/HMR client at all, so this never happens.

```
npm run build
npm start
```

## Setup status (2026-07-14)
Project re-imported from GitHub; dependencies reinstalled and the `Start application` workflow (`npm run dev` on port 5000) recreated, running, and verified via screenshot — the app boots, connects to the fallback MongoDB, and renders the dashboard. Gemini and Mercado Pago secrets still not provided, so those features remain non-functional until set.

## Stack
- **Frontend**: React 19, Vite 6, Tailwind CSS 4, Recharts, Framer Motion
- **Backend**: Express 4, TypeScript, tsx (dev runner)
- **Database**: MongoDB via Mongoose
- **Payments**: Mercado Pago SDK
- **AI**: Google Gemini (`@google/genai`)
- **QR codes**: `qrcode` library

## API routes
All backend routes are mounted under `/moob-api/`:
- `/moob-api/goals` — goal/lending management
- `/moob-api/shifts` — driver shift/cash tracking
- `/moob-api/` — payment routes (Mercado Pago)
- `/moob-api/config/db-status` — database connection status
- `/moob-api/config/db-uri` — dynamic DB URI configuration

## User preferences

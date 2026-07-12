# MoobFinance - Caixa & Metas

## Overview
A unified financial platform for rideshare drivers (Uber/99). Features cash-flow tracking per shift, earnings reporting, and a peer goal/lending system between driver partners. Built with React + Vite on the frontend, Express + TypeScript on the backend, MongoDB for persistence, Gemini AI for insights, and Mercado Pago for payments.

## How to run
```
npm run dev
```
Starts the Express server (with Vite middleware in dev mode) on port 5000.

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

## Setup status (2026-07-12)
Dependencies installed and the `Start application` workflow (`npm run dev` on port 5000) is running and verified via screenshot — the app boots and connects to the fallback MongoDB successfully. Gemini and Mercado Pago secrets were not provided, so those features are not yet functional.

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

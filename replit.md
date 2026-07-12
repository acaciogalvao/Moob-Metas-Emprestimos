# MoobFinance - Caixa & Metas

## Overview
A unified financial platform for rideshare drivers (Uber/99). Features cash-flow tracking per shift, earnings reporting, and a peer goal/lending system between driver partners. Built with React + Vite on the frontend, Express + TypeScript on the backend, MongoDB for persistence, Gemini AI for insights, and Mercado Pago for payments.

## How to run
```
npm run dev
```
Starts the Express server (with Vite middleware in dev mode) on port 5000.

## Required secrets
| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | Gemini AI features |
| `MERCADOPAGO_ACCESS_TOKEN` | Payment processing via Mercado Pago |
| `MONGODB_URI` | Main database connection |

`SESSION_SECRET` is already configured.

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

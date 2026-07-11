# Moob Driver Finance

A React + Express web app for rideshare drivers (Uber/99) to track daily cash flow, goals, loans, and shift/caixa (cash register) sessions. Imported from GitHub.

## Stack
- Frontend: React 19 + Vite 6 + Tailwind CSS 4, served with Vite middleware in dev
- Backend: Express (`server.ts`) on the same process/port, with MongoDB (Mongoose) for persistence
- Optional integrations: Gemini AI (payment/receipt validation), Mercado Pago (PIX payments) — both have mock/fallback behavior when their API keys are absent

## Running
- Workflow "Start application" runs `npm run dev` (`node --import tsx server.ts`), serving on port 5000 (frontend + API combined).
- Production build: `npm run build` then `npm start` (bundles server to `dist/server.cjs`, serves static Vite build).

## Environment / Secrets
- `MONGODB_URI` — optional; a working fallback Atlas URI is hardcoded in `src/server/config/database.ts`, so the app runs out of the box. Set this secret to use your own database.
- `GEMINI_API_KEY` — optional; without it, payment/receipt approval falls back to a mock approval.
- `MERCADOPAGO_ACCESS_TOKEN` — optional; without it, real PIX charges are not created.
- None of these are required; the app works with defaults/mocks.

## API Routes
Backend API routes are served under `/moob-api/*`. The frontend fetches from this prefix.

## User preferences

None recorded yet.

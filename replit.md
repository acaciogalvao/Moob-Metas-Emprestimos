<<<<<<< HEAD
# Moob Driver Finance

A React + Express web app for rideshare drivers (Uber/99) to track daily cash flow, goals, loans, and shift/caixa (cash register) sessions. Imported from Google AI Studio.

## Stack
- Frontend: React 19 + Vite 6 + Tailwind CSS 4, served with Vite middleware in dev
- Backend: Express (server.ts) on the same process/port, with MongoDB (Mongoose) for persistence
- Optional integrations: Gemini AI (payment/receipt validation), Mercado Pago (PIX payments) — both have mock/fallback behavior when their API keys are absent

## Running
- Workflow "Start application" runs `npm run dev` (`node_modules/.bin/tsx server.ts`), serving on port 5000 (frontend + API combined).
- Production build: `npm run build` then `npm start` (bundles server to dist/server.cjs, serves static Vite build).

## Environment / Secrets
- `MONGODB_URI` — optional; a working fallback Atlas URI is hardcoded in `config.json`/`database.ts`, so the app runs out of the box. Set a real secret to use your own database.
- `GEMINI_API_KEY` — optional; without it, payment/receipt approval falls back to a mock approval.
- `MERCADOPAGO_ACCESS_TOKEN` — optional; without it, real PIX charges are not created.
- None of these are currently set as Replit secrets; the app works with defaults/mocks.

## Notes
- Changed the hardcoded port in `server.ts` from 3000 to `process.env.PORT || 5000` to match Replit's webview requirement (port 5000).
=======
# Project Overview

This is a pnpm monorepo hosting multiple independent artifacts.

## Artifacts

- **artifacts/caixa99** — "Caixa 99 - Uber & 99", a Portuguese-language finance tracker for
  Uber/99 rideshare drivers. Cloned from `acaciogalvao/Caixa-99-Uber-Metas-Emprestimos` and
  registered as a `react-vite`-kind artifact, but kept as a self-contained app with its own
  combined Express + Vite (middleware mode) server (`server.ts`) and a MongoDB/Mongoose
  backend, rather than being rewritten into the workspace's shared Postgres/Drizzle +
  api-server pattern.
  - Backend API routes are served under `/moob-api/*` (not `/api/*`), because `/api` is
    already claimed by the shared `artifacts/api-server` artifact's proxy routing. All
    frontend `fetch` calls and the Express route mounts use this prefix.
  - MongoDB connection has a public hardcoded fallback URI (in `config.json` and
    `src/server/config/database.ts`); Gemini API key and Mercado Pago token are optional,
    with mock fallbacks when unset. No secrets are required to run it.
  - **Known limitation:** the artifact's production config still serves the built app as
    static files only (`serve = "static"`), so the Express/MongoDB backend does not run in
    a published deployment — only in the dev workflow. If this app needs to work once
    published, its production packaging needs a persistent Node service (running
    `dist/server.cjs`) instead of static file serving.
- **artifacts/api-server** — shared API server artifact for other artifacts in this
  workspace (owns the `/api` path prefix).
- **artifacts/mockup-sandbox** — Canvas design/mockup preview server.

## User preferences

None recorded yet.
>>>>>>> 5b792da42638501535674c11f804d6179a18768b

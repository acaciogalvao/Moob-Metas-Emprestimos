---
name: Vite dev-mode HMR causes full reload on backgrounded mobile tabs/PWAs
description: Why a self-hosted app run via `npm run dev` reloads every time the tab/PWA regains focus on some mobile browsers but not others.
---

Running the app in Vite dev mode (server.ts uses `createViteServer` middleware when
`NODE_ENV !== "production"`) keeps an HMR WebSocket open in the browser. Mobile browsers
that aggressively suspend background tabs/PWAs (most Chromium-based browsers, installed
PWAs) drop that WebSocket while hidden. Vite's client treats a WebSocket reconnect as
"the dev server restarted" and forces `location.reload()`. Browsers/forks with looser
background throttling (e.g. Kiwi) don't drop the socket, so they don't see the reload.

**Why:** This surfaced when a user self-hosted the app via Termux (`npm run dev`) and used
it as a daily driver app — every backgrounding of the tab/PWA triggered a full reload
except in Kiwi browser.

**How to apply:** For any real/daily-use deployment (not active development), run the
production build instead of dev mode: `npm run build` then `npm start`
(`NODE_ENV=production node dist/server.cjs`). Production mode serves static built assets
with no Vite/HMR client at all, eliminating the reload regardless of browser. Only use
`npm run dev` while actively editing code.

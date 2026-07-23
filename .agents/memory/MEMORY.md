- [Artifact API path collisions](artifact-api-path-collision.md) — a self-contained cloned app with its own backend must not mount routes under `/api` if `artifacts/api-server` already owns that prefix.
- [Checkpoint recovery can lose recent uncommitted work](git-checkpoint-recovery-gaps.md) — after a destructive git action, verify the recovered HEAD actually contains recent feature code, not just that `.git` exists.
- [Arquitetura GPS do Turno (ShiftGPS)](shift-gps-architecture.md) — GPS auto-inicia com o caixa; single watcher via useShiftGPS; dados fluem App→ShiftControl→PainelBordo via props.
- [Vite dev-mode mobile reload](vite-dev-mode-mobile-reload.md) — dev-mode HMR websocket drop on backgrounded mobile tabs/PWAs forces a full reload; use production build for daily-use self-hosting.
- [MoobFinance fuel consumption model](moobfinance-fuel-consumption-model.md) — accounting (tank/km-L/cost) must use the stable calibrated consumption, never the live-GPS-speed variant.
- [Termux synchronization policy](termux-sync-policy.md) — origin/main is authoritative; local Termux differences are intentionally discarded before running the app.
</content>

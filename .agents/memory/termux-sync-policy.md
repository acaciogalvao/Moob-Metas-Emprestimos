---
name: Termux synchronization policy
description: The Replit GitHub remote is the canonical source for the Termux checkout.
---

The Termux checkout must mirror `origin/main` after changes are pushed from Replit. Local edits and
local-only commits are not intended to be preserved there; synchronization should fetch the remote
and reset the checkout to the remote branch before running the app.

**Why:** The user explicitly wants the Termux copy to always match the version developed and pushed
from Replit, avoiding pull conflicts caused by local dependency-file changes.

**How to apply:** Use the project's explicit sync command before launching Termux. Warn that it is
destructive to local tracked changes; ignored dependencies such as `node_modules` may remain.
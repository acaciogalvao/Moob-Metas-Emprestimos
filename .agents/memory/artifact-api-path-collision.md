---
name: Artifact API path collision with shared api-server
description: What to check before wiring a new artifact's own backend API routes when a shared artifacts/api-server already exists.
---

When importing/cloning a standalone app that ships its own backend server (Express, etc.)
into this workspace as a new artifact, do not assume `/api` is free. Check
`artifacts/api-server/.replit-artifact/artifact.toml` (or any other artifact's toml) for
`paths = [...]` entries first — the proxy routes by longest/most-specific path prefix
across all artifacts, so a second artifact mounting routes under an already-claimed prefix
will silently get proxied to the wrong service (502s or empty responses), not an error at
setup time.

**Why:** In this workspace, `artifacts/api-server` claims `/api` for the whole proxy.
Cloning an external self-contained app that hardcodes `fetch("/api/...")` and
`app.use("/api", ...)` looked fine until the dev preview showed API calls returning
502 through the proxy despite direct curl-to-port working.

**How to apply:** Before finalizing a new artifact's routes, grep for `paths = ` across all
`*/.replit-artifact/artifact.toml` files, and if the app's own prefix collides, rename its
API prefix (frontend fetch calls + backend route mounts) to something unclaimed, then add
that new prefix to the artifact's own `paths` array via `verifyAndReplaceArtifactToml`.

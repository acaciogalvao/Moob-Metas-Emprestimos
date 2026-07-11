---
name: Checkpoint recovery can lose recent uncommitted work
description: What to check after a destructive git action (e.g. rm -rf .git) is auto-recovered by Replit's checkpoint system.
---

Replit's checkpoint/versioning system can auto-recover a repo after a destructive action like `rm -rf .git`
(remotes, branches, and history reappear, and `git log`/`git status` look healthy). However, the recovered
HEAD is a snapshot from the last checkpoint — it does not guarantee that features implemented earlier in the
same session are present, especially if they were made shortly before the destructive action.

**Why:** In one incident, a live-updating fuel gauge feature (new component + cross-component prop wiring)
implemented earlier in a session was completely absent after a `rm -rf .git` + auto-recovery, even though
`git log` showed a plausible, intact-looking history with no obvious gaps.

**How to apply:** After any destructive git event followed by an automatic recovery, don't just confirm `.git`
exists and `git log` looks reasonable — grep the codebase for the specific identifiers/components from recent
feature work to confirm they actually survived. If they're missing, re-implement rather than assuming the
recovery was complete.
</content>

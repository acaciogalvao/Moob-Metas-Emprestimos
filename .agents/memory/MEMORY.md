- [Artifact API path collisions](artifact-api-path-collision.md) — a self-contained cloned app with its own backend must not mount routes under `/api` if `artifacts/api-server` already owns that prefix.
- [Checkpoint recovery can lose recent uncommitted work](git-checkpoint-recovery-gaps.md) — after a destructive git action, verify the recovered HEAD actually contains recent feature code, not just that `.git` exists.
- [Arquitetura GPS do Turno (ShiftGPS)](shift-gps-architecture.md) — GPS auto-inicia com o caixa; single watcher via useShiftGPS; dados fluem App→ShiftControl→PainelBordo via props.
</content>

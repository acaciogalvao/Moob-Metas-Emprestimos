/**
 * Migrations for the MoobFinance database.
 *
 * migrateGoalsCollection — moves documents from the legacy "goals" collection
 * into "metas" (Saving) or "emprestimos" (Loan) based on their `category` field,
 * then removes the original document from "goals".
 *
 * Dry-run mode: set MIGRATE_DRY_RUN=true (or pass { dryRun: true }) to log
 * what would happen without making any writes.
 */

import Goal from "../models/Goal.ts";
import Saving from "../models/Saving.ts";
import Loan from "../models/Loan.ts";

// ─── Types ────────────────────────────────────────────────────────

export interface MigrateOptions {
  /** When true, logs planned changes without writing to the database. */
  dryRun?: boolean;
}

export interface MigrateResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: Array<{ id: string; error: string }>;
}

// ─── migrateLegacyMetaToPrincipal ─────────────────────────────────
// Cross-database migration (meta → principal) is permanently disabled.
// Both connections now point at the same URI, so this is a no-op.

export async function migrateLegacyMetaToPrincipal(): Promise<void> {
  console.log(
    "[Cópia de Banco] Migração de banco legado desativada para usar apenas o banco principal."
  );
}

// ─── migrateGoalsCollection ───────────────────────────────────────

export async function migrateGoalsCollection(
  options: MigrateOptions = {}
): Promise<MigrateResult> {
  const dryRun =
    options.dryRun ?? process.env.MIGRATE_DRY_RUN === "true";

  const result: MigrateResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  let legacy: any[];
  try {
    legacy = await Goal.find({});
  } catch (err: any) {
    console.error("[migração] Falha ao consultar coleção legada 'goals':", err.message);
    return result;
  }

  if (legacy.length === 0) {
    // Nothing to do — log only in dry-run mode so normal boots stay quiet
    if (dryRun) {
      console.log("[migração] Nenhum documento encontrado em 'goals'. Nada a migrar.");
    }
    return result;
  }

  result.total = legacy.length;
  const tag = dryRun ? "[migração][DRY-RUN]" : "[migração]";
  console.log(
    `${tag} ${legacy.length} documento(s) em "goals". Iniciando migração${dryRun ? " simulada" : ""}...`
  );

  for (const doc of legacy) {
    const id = String(doc._id ?? doc.id ?? "?");
    let data: any;
    try {
      data = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
    } catch {
      data = { ...doc };
    }

    const isLoan = data.category === "loan";
    const Model = isLoan ? Loan : Saving;
    const targetCollection = isLoan ? "emprestimos" : "metas";

    try {
      // Check if already migrated
      const exists = await Model.findById(id);
      if (exists) {
        console.log(`${tag} "${id}" já existe em "${targetCollection}" — pulando.`);
        result.skipped++;
        if (!dryRun) {
          // Remove stale legacy entry even if destination exists
          await Goal.findByIdAndDelete(id);
        }
        continue;
      }

      console.log(
        `${tag} "${id}" (${data.category ?? "other"}) → "${targetCollection}"`
      );

      if (!dryRun) {
        // Write to destination first — safer than deleting source first
        await Model.create(data);
        await Goal.findByIdAndDelete(id);
      }

      result.migrated++;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`${tag} Falha ao migrar "${id}":`, msg);
      result.errors.push({ id, error: msg });
      result.failed++;
      // Continue with remaining documents — don't abort the entire migration
    }
  }

  const summary = dryRun
    ? `${tag} Simulação concluída — ${result.migrated} seriam migrados, ${result.skipped} pulados, ${result.failed} falhariam.`
    : `${tag} Concluída — ${result.migrated} migrados, ${result.skipped} pulados, ${result.failed} falharam.`;

  console.log(summary);
  if (result.errors.length > 0) {
    console.error(`${tag} Erros:`, result.errors);
  }

  return result;
}

import mongoose from "mongoose";
import { getMetaConnection } from "../../config/database.ts";
import { getMongooseConnected, getMetaMongooseConnected } from "./connectionState.ts";
import { getMongooseModel } from "./modelResolver.ts";
import { localData } from "./localFallback.ts";

/**
 * Syncs any items held in the in-memory local store to MongoDB Atlas.
 * In practice the local store is always empty (persistence is disabled),
 * but the function is kept for API compatibility with server.ts.
 */
export async function syncLocalToCloud(): Promise<{
  shiftsSynced: number;
  metasSynced: number;
  loansSynced: number;
  goalsSynced: number;
}> {
  // Ensure models are registered in Mongoose
  try {
    await Promise.all([
      import("../Shift.ts"),
      import("../Saving.ts"),
      import("../Loan.ts"),
      import("../Goal.ts"),
    ]);
  } catch (err) {
    console.warn("[Sync] Falha ao importar models dinamicamente:", err);
  }

  let shiftsSynced = 0;
  let metasSynced = 0;
  let loansSynced = 0;
  let goalsSynced = 0;

  // 1. Sync shifts → main Atlas connection
  if (getMongooseConnected()) {
    const ShiftM = mongoose.models.Shift;
    if (ShiftM && localData.shifts.length > 0) {
      console.log(
        `[Sync] Sincronizando ${localData.shifts.length} turnos locais...`
      );
      for (const item of localData.shifts) {
        if (item.id) {
          const { _id, ...clean } = item;
          await ShiftM.findOneAndUpdate({ id: item.id }, clean, {
            upsert: true,
            returnDocument: 'after',
          });
          shiftsSynced++;
        }
      }
    }
  }

  // 2. Sync metas/loans/goals → meta Atlas connection
  if (getMetaMongooseConnected()) {
    const metaConn = getMetaConnection();
    if (metaConn?.readyState === 1) {
      const syncCollection = async (
        items: any[],
        modelName: string,
        defaultModel: any,
        counterRef: { n: number }
      ) => {
        if (!items.length) return;
        const M = getMongooseModel(modelName, defaultModel);
        if (!M) return;
        console.log(`[Sync] Sincronizando ${items.length} ${modelName}...`);
        for (const item of items) {
          const id = item._id ?? item.id;
          if (id) {
            await M.findOneAndUpdate(
              { _id: id },
              { ...item, _id: id },
              { upsert: true, returnDocument: 'after' }
            );
            counterRef.n++;
          }
        }
      };

      const mc = { n: 0 };
      const lc = { n: 0 };
      const gc = { n: 0 };

      await syncCollection(
        localData.savings,
        "Saving",
        mongoose.models.Saving,
        mc
      );
      await syncCollection(
        localData.loans,
        "Loan",
        mongoose.models.Loan,
        lc
      );
      await syncCollection(
        localData.goals,
        "Goal",
        mongoose.models.Goal,
        gc
      );

      metasSynced = mc.n;
      loansSynced = lc.n;
      goalsSynced = gc.n;
    }
  }

  return { shiftsSynced, metasSynced, loansSynced, goalsSynced };
}

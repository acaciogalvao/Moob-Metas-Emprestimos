import { Request, Response } from "express";
import Saving from "../models/Saving.ts";
import Loan from "../models/Loan.ts";
import Goal from "../models/Goal.ts";

// ─── Helpers ──────────────────────────────────────────────────────

function getModel(category: string) {
  return category === "loan" ? Loan : Saving;
}

async function findByIdInBoth(id: string) {
  let doc = await Loan.findById(id);
  if (!doc) doc = await Saving.findById(id);
  if (!doc) doc = await Goal.findById(id);
  return doc;
}

/**
 * Recalculates savedP1/savedP2 from the payments array.
 * Prefers the schema method (Mongoose doc); falls back to manual loop
 * for MockDocument (offline fallback).
 */
function recalcSaved(doc: any): void {
  if (typeof doc.recalcSaved === "function") {
    doc.recalcSaved();
    return;
  }
  let p1 = 0;
  let p2 = 0;
  for (const p of doc.payments ?? []) {
    if (p.payerId === "P1") p1 += p.amount ?? 0;
    if (p.payerId === "P2") p2 += p.amount ?? 0;
  }
  doc.savedP1 = p1;
  doc.savedP2 = p2;
}

/** Fields that must never be updated directly by a client. */
const PROTECTED_UPDATE_FIELDS = new Set([
  "_id", "__v", "payments", "savedP1", "savedP2", "category",
]);

/**
 * Strips protected fields from an update payload and sanitizes strings.
 * `payments` and `savedP1/P2` are managed exclusively through the payment endpoints.
 */
function sanitizeGoalUpdate(raw: any): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (PROTECTED_UPDATE_FIELDS.has(key)) continue;
    if (typeof value === "string") {
      clean[key] = value.trim().slice(0, 500);
    } else if (typeof value === "number") {
      clean[key] = Number.isFinite(value) ? value : 0;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/** Basic sanitization for a new goal body. */
function sanitizeGoalCreate(raw: any): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "_id" || key === "__v") continue; // always generated server-side
    if (typeof value === "string") {
      clean[key] = value.trim().slice(0, 500);
    } else if (typeof value === "number") {
      clean[key] = Number.isFinite(value) ? value : 0;
    } else {
      clean[key] = value;
    }
  }
  // Payments must start empty on creation
  clean.payments = [];
  return clean;
}

// ─── Controllers ──────────────────────────────────────────────────

/** GET /goals?page=N&limit=N */
export const getGoals = async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? ""), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? ""), 10) || 0, 200);

    const [savings, loans, legacyGoals] = await Promise.all([
      Saving.find().sort({ _id: -1 }),
      Loan.find().sort({ _id: -1 }),
      Goal.find().sort({ _id: -1 }),
    ]);

    const all = [...loans, ...savings, ...legacyGoals];

    if (page > 0 && limit > 0) {
      const start = (page - 1) * limit;
      return res.json({
        goals: all.slice(start, start + limit),
        total: all.length,
        page,
        limit,
        pages: Math.ceil(all.length / limit),
      });
    }

    res.json(all);
  } catch (e: any) {
    console.error("[goalController] Erro ao buscar metas:", e);
    res.status(500).json({ error: e.message });
  }
};

/** GET /goals/:id */
export const getGoalById = async (req: Request, res: Response) => {
  try {
    const doc = await findByIdInBoth(req.params.id);
    if (!doc) return res.status(404).json({ error: "Meta/Empréstimo não encontrado" });
    res.json(doc);
  } catch (e: any) {
    console.error("[goalController] Erro ao buscar meta por ID:", e);
    res.status(500).json({ error: e.message });
  }
};

/** POST /goals */
export const createGoal = async (req: Request, res: Response) => {
  try {
    const category = (req.body.category ?? "saving").trim();
    const prefix = category === "loan" ? "loan" : "meta";
    const Model = getModel(category);

    const data = sanitizeGoalCreate(req.body);
    data.category = category; // ensure normalised value

    const newDoc = await Model.create({
      _id: `${prefix}_${Date.now()}`,
      ...data,
    });
    res.status(201).json(newDoc);
  } catch (e: any) {
    console.error("[goalController] Erro ao criar meta:", e);
    res.status(500).json({ error: e.message });
  }
};

/** PUT /goals/:id */
export const updateGoal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const update = sanitizeGoalUpdate(req.body);

    let updated = await Loan.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    if (!updated) updated = await Saving.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    if (!updated) updated = await Goal.findByIdAndUpdate(id, update, { returnDocument: 'after' });

    if (!updated) return res.status(404).json({ error: "Meta/Empréstimo não encontrado" });
    res.json(updated);
  } catch (e: any) {
    console.error("[goalController] Erro ao atualizar meta:", e);
    res.status(500).json({ error: e.message });
  }
};

/** DELETE /goals/:id */
export const deleteGoal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted =
      (await Loan.findByIdAndDelete(id)) ??
      (await Saving.findByIdAndDelete(id)) ??
      (await Goal.findByIdAndDelete(id));

    if (!deleted) {
      return res.status(404).json({ error: "Meta/Empréstimo não encontrado" });
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error("[goalController] Erro ao deletar meta:", e);
    res.status(500).json({ error: e.message });
  }
};

/** DELETE /goals/:id/payment/:paymentId */
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id, paymentId } = req.params;

    // Try pulling by _id first, then by the legacy paymentId field
    const pullById = { $pull: { payments: { _id: paymentId } } } as any;
    const pullByPaymentId = { $pull: { payments: { paymentId } } } as any;

    const tryUpdate = async (update: any) => {
      let doc = await Loan.findByIdAndUpdate(id, update, { returnDocument: 'after' });
      if (!doc) doc = await Saving.findByIdAndUpdate(id, update, { returnDocument: 'after' });
      if (!doc) doc = await Goal.findByIdAndUpdate(id, update, { returnDocument: 'after' });
      return doc;
    };

    let doc = await tryUpdate(pullById);

    // If the document was found but the payment still exists, try the legacy field
    if (doc) {
      const stillPresent = (doc.payments ?? []).some(
        (p: any) => p._id === paymentId || p.paymentId === paymentId
      );
      if (stillPresent) doc = await tryUpdate(pullByPaymentId);
    } else {
      doc = await tryUpdate(pullByPaymentId);
    }

    if (!doc) return res.status(404).json({ error: "Meta/Empréstimo não encontrado" });

    recalcSaved(doc);
    await doc.save();
    res.json(doc);
  } catch (e: any) {
    console.error("[goalController] Erro ao deletar pagamento:", e);
    res.status(500).json({ error: e.message });
  }
};

/** POST /goals/:id/clear-history */
export const clearPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const update = { $set: { payments: [], savedP1: 0, savedP2: 0 } };

    let doc = await Loan.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    if (!doc) doc = await Saving.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    if (!doc) doc = await Goal.findByIdAndUpdate(id, update, { returnDocument: 'after' });

    if (!doc) return res.status(404).json({ error: "Meta/Empréstimo não encontrado" });
    res.json(doc);
  } catch (e: any) {
    console.error("[goalController] Erro ao limpar histórico:", e);
    res.status(500).json({ error: e.message });
  }
};

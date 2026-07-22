import { Request, Response } from "express";
import ShiftModel from "../models/Shift.ts";

// ─── Helpers ──────────────────────────────────────────────────────

/** Fields that must never be written directly to the DB from the client. */
const IMMUTABLE_FIELDS = new Set(["_id", "__v"]);

/** Allowed transaction types and platforms — reject anything outside these. */
const VALID_TX_TYPES = new Set(["IN", "OUT"]);
const VALID_PLATFORMS = new Set(["UBER", "99", "PARTICULAR", "GERAL"]);
const VALID_PAYMENT_METHODS = new Set([
  "PIX", "DINHEIRO", "CARTAO", "APP", "pix", "dinheiro",
]);

/**
 * Strips internal fields and normalises types on a shift payload
 * received from the client before it's written to the database.
 */
function sanitizeShiftData(raw: any): any {
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (IMMUTABLE_FIELDS.has(key)) continue;
    clean[key] = value;
  }

  // Normalize numeric fields that might arrive as strings from localStorage
  for (const field of [
    "initialBalance", "initialPixBalance", "initialCashBalance",
    "initialUberBalance", "initial99Balance", "closingBalanceExpected",
    "closingBalanceReal", "difference", "closingPixReal", "differencePix",
    "initialOdometer", "finalOdometer", "totalLitersFueled",
    "initialFuelLiters", "finalFuelLiters", "monthlyGoal", "dailyKmGoal",
    "ajusteSaldoAnterior", "saldoAnterior",
  ]) {
    if (clean[field] !== undefined) {
      const n = Number(clean[field]);
      clean[field] = Number.isFinite(n) ? n : 0;
    }
  }

  // Sanitize and validate transactions
  if (Array.isArray(clean.transactions)) {
    clean.transactions = clean.transactions
      .filter((t: any) => t && typeof t === "object" && t.id)
      .map((t: any) => {
        const { _id, ...tx } = t;
        // Validate enum fields — reject invalid values
        if (!VALID_TX_TYPES.has(tx.type)) return null;
        if (!VALID_PLATFORMS.has(tx.platform)) tx.platform = "GERAL";
        if (!VALID_PAYMENT_METHODS.has(tx.paymentMethod)) return null;
        // Normalize numeric transaction fields
        for (const f of [
          "value", "km", "passengerValue", "appOfferValue", "passengerAppValue",
          "tipValue", "extraChargedValue", "keypadValue", "withdrawalFee",
          "liters", "pricePerLiter", "odometer",
        ]) {
          if (tx[f] !== undefined) {
            const n = Number(tx[f]);
            tx[f] = Number.isFinite(n) ? n : undefined;
          }
        }
        // Sanitize description string
        if (typeof tx.description === "string") {
          tx.description = tx.description.trim().slice(0, 500);
        }
        return tx;
      })
      .filter(Boolean);
  }

  return clean;
}

// ─── Controllers ──────────────────────────────────────────────────

/** GET /shifts?page=N&limit=N */
export const getShifts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? ""), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? ""), 10) || 0, 500);

    if (page > 0 && limit > 0) {
      const [shifts, total] = await Promise.all([
        ShiftModel.find()
          .sort({ openedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        ShiftModel.countDocuments(),
      ]);
      return res.json({
        shifts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    }

    const shifts = await ShiftModel.find().sort({ openedAt: -1 });
    res.json(shifts);
  } catch (err: any) {
    console.error("[shiftController] Erro ao buscar turnos:", err);
    res.status(500).json({ error: "Erro ao buscar turnos", details: err.message });
  }
};

/** POST /shifts — create or update a single shift */
export const upsertShift = async (req: Request, res: Response) => {
  try {
    const raw = req.body;
    if (!raw?.id || typeof raw.id !== "string") {
      return res.status(400).json({ error: "O campo 'id' do turno é obrigatório" });
    }

    const cleanShift = sanitizeShiftData(raw);

    const updatedShift = await ShiftModel.findOneAndUpdate(
      { id: cleanShift.id } as any,
      cleanShift,
      { returnDocument: 'after', upsert: true } as any
    );
    res.json(updatedShift);
  } catch (err: any) {
    console.error("[shiftController] Erro ao salvar turno:", err);
    res.status(500).json({ error: "Erro ao salvar turno", details: err.message });
  }
};

/** POST /shifts/sync — bulk offline sync */
export const syncShifts = async (req: Request, res: Response) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts)) {
      return res
        .status(400)
        .json({ error: "'shifts' deve ser um array" });
    }

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const s of shifts) {
      if (!s?.id || typeof s.id !== "string") {
        skipped++;
        continue;
      }
      try {
        const cleanShift = sanitizeShiftData(s);
        await ShiftModel.findOneAndUpdate(
          { id: cleanShift.id } as any,
          cleanShift,
          { upsert: true, returnDocument: 'after' } as any
        );
        synced++;
      } catch (err: any) {
        console.error(`[shiftController] Erro ao sincronizar turno ${s.id}:`, err.message);
        errors.push(`${s.id}: ${err.message}`);
        skipped++;
      }
    }

    const allShifts = await ShiftModel.find().sort({ openedAt: -1 });
    res.json({ shifts: allShifts, synced, skipped, errors });
  } catch (err: any) {
    console.error("[shiftController] Erro na sincronização:", err);
    res.status(500).json({ error: "Erro na sincronização", details: err.message });
  }
};

/** DELETE /shifts/:id */
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ShiftModel.findOneAndDelete({ id } as any);
    if (!deleted) {
      return res.status(404).json({ error: "Turno não encontrado" });
    }
    res.json({ success: true, message: "Turno deletado com sucesso" });
  } catch (err: any) {
    console.error("[shiftController] Erro ao deletar turno:", err);
    res.status(500).json({ error: "Erro ao deletar turno", details: err.message });
  }
};

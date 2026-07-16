import { Request, Response } from "express";
import Saving from "../models/Saving.ts";
import Loan from "../models/Loan.ts";
import Goal from "../models/Goal.ts";

/** Retorna o model correto com base na categoria */
function getModel(category: string) {
  return category === "loan" ? Loan : Saving;
}

/** Busca um documento por ID nas três coleções */
async function findByIdInBoth(id: string) {
  let doc = await Loan.findById(id);
  if (!doc) doc = await Saving.findById(id);
  if (!doc) doc = await Goal.findById(id);
  return doc;
}

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
      const sliced = all.slice(start, start + limit);
      return res.json({ goals: sliced, total: all.length, page, limit, pages: Math.ceil(all.length / limit) });
    }

    // Sem paginação — retorna tudo (comportamento original, compatível com frontend)
    res.json(all);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getGoalById = async (req: Request, res: Response) => {
  try {
    const doc = await findByIdInBoth(req.params.id);
    if (!doc) return res.status(404).json({ error: "Não encontrado" });
    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createGoal = async (req: Request, res: Response) => {
  try {
    const category = req.body.category || "saving";
    const prefix = category === "loan" ? "loan" : "meta";
    const Model = getModel(category);
    const newDoc = await Model.create({
      _id: `${prefix}_${Date.now()}`,
      ...req.body,
      payments: [],
    });
    res.json(newDoc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const updateGoal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Tenta atualizar em ambas as coleções ou na de legado
    let updated = await Loan.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      updated = await Saving.findByIdAndUpdate(id, req.body, { new: true });
    }
    if (!updated) {
      updated = await Goal.findByIdAndUpdate(id, req.body, { new: true });
    }
    if (!updated) return res.status(404).json({ error: "Não encontrado" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteGoal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const inLoan = await Loan.findByIdAndDelete(id);
    if (!inLoan) {
      const inSaving = await Saving.findByIdAndDelete(id);
      if (!inSaving) {
        await Goal.findByIdAndDelete(id);
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id, paymentId } = req.params;
    
    let updateStr = { $pull: { payments: { _id: paymentId } } } as any;
    // Tenta primeiro com "_id"
    let doc = await Loan.findByIdAndUpdate(id, updateStr, { new: true });
    if (!doc) doc = await Saving.findByIdAndUpdate(id, updateStr, { new: true });
    if (!doc) doc = await Goal.findByIdAndUpdate(id, updateStr, { new: true });
    
    // Fallback se o campo no banco for "paymentId"
    if (doc) {
      const hasPayment = doc.payments.some((p: any) => p._id === paymentId || p.paymentId === paymentId);
      if (hasPayment) {
        updateStr = { $pull: { payments: { paymentId: paymentId } } };
        doc = await Loan.findByIdAndUpdate(id, updateStr, { new: true });
        if (!doc) doc = await Saving.findByIdAndUpdate(id, updateStr, { new: true });
        if (!doc) doc = await Goal.findByIdAndUpdate(id, updateStr, { new: true });
      }
    } else {
      updateStr = { $pull: { payments: { paymentId: paymentId } } };
      doc = await Loan.findByIdAndUpdate(id, updateStr, { new: true });
      if (!doc) doc = await Saving.findByIdAndUpdate(id, updateStr, { new: true });
      if (!doc) doc = await Goal.findByIdAndUpdate(id, updateStr, { new: true });
    }

    if (!doc) return res.status(404).json({ error: "Não encontrado" });

    let sP1 = 0;
    let sP2 = 0;
    doc.payments.forEach((p: any) => {
      if (p.payerId === "P1") sP1 += p.amount;
      if (p.payerId === "P2") sP2 += p.amount;
    });
    doc.savedP1 = sP1;
    doc.savedP2 = sP2;
    
    await doc.save();

    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const clearPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const update = { 
      $set: { payments: [], savedP1: 0, savedP2: 0 }
    };

    let doc = await Loan.findByIdAndUpdate(id, update, { new: true });
    if (!doc) doc = await Saving.findByIdAndUpdate(id, update, { new: true });
    if (!doc) doc = await Goal.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ error: "Não encontrado" });

    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

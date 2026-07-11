import { Request, Response } from "express";
import ShiftModel from "../models/Shift";

// Busca todos os turnos
export const getShifts = async (req: Request, res: Response) => {
  try {
    const shifts = await ShiftModel.find().sort({ openedAt: -1 });
    res.json(shifts);
  } catch (err: any) {
    console.error("Erro ao buscar turnos:", err);
    res.status(500).json({ error: "Erro ao buscar turnos", details: err.message });
  }
};

// Cria ou atualiza um turno individual
export const upsertShift = async (req: Request, res: Response) => {
  try {
    const shiftData = req.body;
    if (!shiftData.id) {
      return res.status(400).json({ error: "O campo 'id' do turno é obrigatório" });
    }

    const { _id, ...cleanShift } = shiftData;

    const updatedShift = await ShiftModel.findOneAndUpdate(
      { id: shiftData.id } as any,
      cleanShift,
      { new: true, upsert: true } as any
    );
    res.json(updatedShift);
  } catch (err: any) {
    console.error("Erro ao salvar/atualizar turno:", err);
    res.status(500).json({ error: "Erro ao salvar turno", details: err.message });
  }
};

// Sincroniza em lote os turnos (offline-first)
export const syncShifts = async (req: Request, res: Response) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ error: "Corpo da requisição inválido. 'shifts' deve ser um array." });
    }

    // Salva ou atualiza cada turno enviado do localStorage do cliente
    for (const s of shifts) {
      if (s.id) {
        const { _id, ...cleanShift } = s;
        await ShiftModel.findOneAndUpdate(
          { id: s.id } as any,
          cleanShift,
          { upsert: true, new: true } as any
        );
      }
    }

    // Retorna todos os turnos atualizados do banco de dados ordenados por data
    const allShifts = await ShiftModel.find().sort({ openedAt: -1 });
    res.json(allShifts);
  } catch (err: any) {
    console.error("Erro na sincronização de turnos:", err);
    res.status(500).json({ error: "Erro na sincronização", details: err.message });
  }
};

// Deleta um turno pelo ID
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ShiftModel.findOneAndDelete({ id } as any);
    if (!deleted) {
      return res.status(404).json({ error: "Turno não encontrado" });
    }
    res.json({ success: true, message: "Turno deletado com sucesso" });
  } catch (err: any) {
    console.error("Erro ao deletar turno:", err);
    res.status(500).json({ error: "Erro ao deletar turno", details: err.message });
  }
};

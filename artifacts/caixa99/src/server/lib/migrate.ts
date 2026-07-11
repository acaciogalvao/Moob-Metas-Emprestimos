/**
 * Migração única: move documentos da coleção legada "goals"
 * para "metas" (savings) ou "emprestimos" (loans) conforme o campo category.
 * Após mover com sucesso, remove o documento de "goals".
 */
import mongoose from "mongoose";
import Goal from "../models/Goal";
import Saving from "../models/Saving";
import Loan from "../models/Loan";
import { goalSchema } from "../models/goalSchema";

export async function migrateLegacyMetaToPrincipal() {
  console.log("[Cópia de Banco] Migração de banco legado desativada para usar apenas o banco principal.");
  return;
}

export async function migrateGoalsCollection() {
  try {
    const legacy = await Goal.find({});
    if (legacy.length === 0) return;

    console.log(`[migração] ${legacy.length} documento(s) encontrado(s) em "goals". Iniciando migração...`);

    for (const doc of legacy) {
      const data = doc.toObject();
      const isLoan = data.category === "loan";
      const Model = isLoan ? Loan : Saving;
      const collectionName = isLoan ? "emprestimos" : "metas";

      const alreadyExists = await Model.findById(data._id);
      if (!alreadyExists) {
        await Model.create(data);
        console.log(`[migração] "${data._id}" → ${collectionName}`);
      } else {
        console.log(`[migração] "${data._id}" já existe em ${collectionName}, pulando.`);
      }

      await Goal.findByIdAndDelete(data._id);
    }

    console.log("[migração] Concluída com sucesso.");
  } catch (err: any) {
    console.error("[migração] Erro durante migração:", err.message);
  }
}

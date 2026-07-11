import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { getMetaConnection } from "../config/database.ts";

// Controla se a conexão do MongoDB Atlas está ativa para Caixa/Shifts
let isConnected = false;
// Controla se a conexão do MongoDB Atlas está ativa para Metas/Empréstimos
let isMetaConnected = false;

export async function syncLocalToCloud() {
  // Garante que os models estão importados e registrados no Mongoose
  try {
    await import("./Shift.ts");
    await import("./Saving.ts");
    await import("./Loan.ts");
    await import("./Goal.ts");
  } catch (err) {
    console.warn("[Sync] Falha ao importar models dinamicamente:", err);
  }

  const local = loadLocalData();
  let shiftsSynced = 0;
  let metasSynced = 0;
  let loansSynced = 0;
  let goalsSynced = 0;

  // 1. Sincroniza turnos para o MongoDB Atlas Principal
  if (isConnected) {
    const ShiftM = mongoose.models.Shift;
    if (ShiftM && local.shifts && local.shifts.length > 0) {
      console.log(`[Sync] Sincronizando ${local.shifts.length} turnos locais para o MongoDB Atlas...`);
      for (const item of local.shifts) {
        if (item.id) {
          // Remove _id temporário se existir para evitar colisão de ObjectIds se necessário
          const { _id, ...cleanItem } = item;
          await ShiftM.findOneAndUpdate({ id: item.id }, cleanItem, { upsert: true, new: true });
          shiftsSynced++;
        }
      }
    }
  }

  // 2. Sincroniza savings, loans e goals legados para o MongoDB Atlas de Metas/Empréstimos
  if (isMetaConnected) {
    const metaConn = getMetaConnection();
    if (metaConn && metaConn.readyState === 1) {
      // Sincroniza savings (metas)
      if (local.savings && local.savings.length > 0) {
        const SavingM = getMongooseModel("Saving", mongoose.models.Saving);
        if (SavingM) {
          console.log(`[Sync] Sincronizando ${local.savings.length} metas locais para o MongoDB de Metas...`);
          for (const item of local.savings) {
            const id = item._id || item.id;
            if (id) {
              const cleaned = { ...item, _id: id };
              await SavingM.findOneAndUpdate({ _id: id }, cleaned, { upsert: true, new: true });
              metasSynced++;
            }
          }
        }
      }

      // Sincroniza loans (empréstimos)
      if (local.loans && local.loans.length > 0) {
        const LoanM = getMongooseModel("Loan", mongoose.models.Loan);
        if (LoanM) {
          console.log(`[Sync] Sincronizando ${local.loans.length} empréstimos locais para o MongoDB de Empréstimos...`);
          for (const item of local.loans) {
            const id = item._id || item.id;
            if (id) {
              const cleaned = { ...item, _id: id };
              await LoanM.findOneAndUpdate({ _id: id }, cleaned, { upsert: true, new: true });
              loansSynced++;
            }
          }
        }
      }

      // Sincroniza goals (metas legadas)
      if (local.goals && local.goals.length > 0) {
        const GoalM = getMongooseModel("Goal", mongoose.models.Goal);
        if (GoalM) {
          console.log(`[Sync] Sincronizando ${local.goals.length} metas legadas locais para o MongoDB de Metas...`);
          for (const item of local.goals) {
            const id = item._id || item.id;
            if (id) {
              const cleaned = { ...item, _id: id };
              await GoalM.findOneAndUpdate({ _id: id }, cleaned, { upsert: true, new: true });
              goalsSynced++;
            }
          }
        }
      }
    }
  }

  return {
    shiftsSynced,
    metasSynced,
    loansSynced,
    goalsSynced,
  };
}

export function setMongooseConnected(status: boolean) {
  isConnected = status;
  console.log(`[DB-Wrapper] Modo de banco de dados atualizado. MongoDB Atlas Conectado: ${isConnected}`);
}

export function getMongooseConnected() {
  return isConnected;
}

export function setMetaMongooseConnected(status: boolean) {
  isMetaConnected = status;
  console.log(`[DB-Wrapper] Modo de banco de dados Meta/Empréstimo atualizado. Conectado: ${isMetaConnected}`);
}

export function getMetaMongooseConnected() {
  return isMetaConnected;
}

export function getModelConnected(modelName: string): boolean {
  if (modelName === "Goal" || modelName === "Saving" || modelName === "Loan") {
    return isMetaConnected;
  }
  return isConnected;
}

export function getMongooseModel(modelName: string, defaultModel: any): any {
  if (modelName === "Goal" || modelName === "Saving" || modelName === "Loan") {
    try {
      const metaConn = getMetaConnection();
      if (metaConn && metaConn.readyState === 1) {
        if (metaConn.models[modelName]) {
          return metaConn.models[modelName];
        }
        const schema = defaultModel.schema;
        const collectionName = modelName === "Saving" ? "metas" : modelName === "Loan" ? "emprestimos" : "goals";
        return metaConn.model(modelName, schema, collectionName);
      }
    } catch (err) {
      console.error("[DB-Wrapper] Erro ao obter modelo customizado do Meta:", err);
    }
  }
  return defaultModel;
}

const DB_FILE = path.join(process.cwd(), "db.json");

// Deleta banco local antigo se existir para garantir que nada fica guardado localmente
try {
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
    console.log("[DB-Wrapper] Banco local antigo (db.json) removido com sucesso.");
  }
} catch (err) {
  console.error("[DB-Wrapper] Erro ao tentar remover banco local antigo:", err);
}

// Desativa o carregamento de dados locais
function loadLocalData(): { savings: any[]; loans: any[]; goals: any[]; shifts: any[] } {
  return { savings: [], loans: [], goals: [], shifts: [] };
}

// Desativa a gravação de dados locais
function saveLocalData(data: { savings: any[]; loans: any[]; goals: any[]; shifts: any[] }) {
  // Operação local desativada. Tudo é salvo apenas no MongoDB Atlas Principal.
}

// Inicializa coleções locais vazias
const localData = loadLocalData();

function applyMongoUpdate(doc: any, update: any) {
  if (!update) return;

  // Handle $set
  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      doc[key] = val;
    }
  }

  // Handle $push
  if (update.$push) {
    for (const [key, val] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[key])) {
        doc[key] = [];
      }
      doc[key].push(val);
    }
  }

  // Handle $pull
  if (update.$pull) {
    for (const [key, query] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[key])) {
        const q = query as any;
        doc[key] = doc[key].filter((item: any) => {
          // Verifica se o item corresponde à query de remoção
          for (const [qKey, qVal] of Object.entries(q)) {
            if (item[qKey] === qVal) {
              return false; // remove
            }
          }
          return true; // mantém
        });
      }
    }
  }

  // Atualizações diretas
  for (const [key, val] of Object.entries(update)) {
    if (!key.startsWith("$")) {
      doc[key] = val;
    }
  }
}

function sanitizeUpdate(update: any) {
  if (!update || typeof update !== "object") return update;
  const clean = { ...update };
  if (clean._id !== undefined) {
    delete clean._id;
  }
  if (clean.$set && typeof clean.$set === "object") {
    clean.$set = { ...clean.$set };
    if (clean.$set._id !== undefined) {
      delete clean.$set._id;
    }
  }
  return clean;
}

class MockDocument {
  [key: string]: any;

  constructor(data: any, private onSave: () => void) {
    Object.assign(this, data);
  }

  toObject() {
    const copy = { ...this };
    delete copy.onSave;
    return copy;
  }

  async save() {
    this.onSave();
    return this;
  }
}

export function getModelWrapper(modelName: string, mongooseModel: any) {
  const collectionKey = modelName === "Saving" ? "savings" : modelName === "Loan" ? "loans" : modelName === "Shift" ? "shifts" : "goals";

  const getCollection = () => {
    if (!localData[collectionKey]) {
      localData[collectionKey] = [];
    }
    return localData[collectionKey];
  };

  const persist = () => {
    saveLocalData(localData);
  };

  const wrapDoc = (data: any) => {
    if (!data) return null;
    return new MockDocument(data, () => {
      const idx = getCollection().findIndex((x: any) => x._id === data._id);
      if (idx !== -1) {
        getCollection()[idx] = data;
        persist();
      }
    });
  };

  return {
    find: (filter: any = {}) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        return activeModel.find(filter);
      }

      const items = getCollection();
      const filtered = items.filter((x: any) => {
        for (const [k, v] of Object.entries(filter)) {
          if (x[k] !== v) return false;
        }
        return true;
      });

      const chain = {
        sort: (sortObj: any) => {
          const sorted = [...filtered];
          if (sortObj && sortObj.openedAt) {
            sorted.sort((a, b) => {
              const valA = a.openedAt || "";
              const valB = b.openedAt || "";
              return sortObj.openedAt === -1 ? valB.localeCompare(valA) : valA.localeCompare(valB);
            });
          } else {
            sorted.sort((a, b) => {
              const valA = a._id || a.id || "";
              const valB = b._id || b.id || "";
              return valB.localeCompare(valA);
            });
          }
          return Promise.resolve(sorted.map(wrapDoc));
        },
        then: (resolve: any) => {
          resolve(filtered.map(wrapDoc));
        }
      };

      return chain as any;
    },

    findById: async (id: string) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          let doc = await activeModel.findById(id);
          if (doc) return doc;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await activeModel.findById(new mongoose.Types.ObjectId(id));
            if (doc) return doc;
          }
        } catch (err) {
          console.warn(`[DB-Wrapper] Erro ao buscar no MongoDB Atlas, usando fallback local para ID ${id}`);
        }
      }

      const item = getCollection().find((x: any) => x._id === id);
      return wrapDoc(item);
    },

    create: async (data: any) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          return await activeModel.create(data);
        } catch (err) {
          console.warn("[DB-Wrapper] Erro ao criar no MongoDB Atlas, usando fallback local");
        }
      }

      const newDoc = { ...data };
      if (!newDoc._id) {
        newDoc._id = `${modelName === "Loan" ? "loan" : "meta"}_${Date.now()}`;
      }
      getCollection().push(newDoc);
      persist();
      return wrapDoc(newDoc);
    },

    findByIdAndUpdate: async (id: string, update: any, options?: any) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      const cleanUpdate = sanitizeUpdate(update);
      if (connected) {
        try {
          let doc = await activeModel.findByIdAndUpdate(id, cleanUpdate, options);
          if (doc) return doc;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await activeModel.findByIdAndUpdate(new mongoose.Types.ObjectId(id), cleanUpdate, options);
            if (doc) return doc;
          }
        } catch (err: any) {
          console.error(`[DB-Wrapper] Erro ao atualizar no MongoDB Atlas para ID ${id}:`, err);
        }
      }

      const item = getCollection().find((x: any) => x._id === id);
      if (!item) return null;

      applyMongoUpdate(item, update);
      persist();
      return wrapDoc(item);
    },

    findByIdAndDelete: async (id: string) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          let doc = await activeModel.findByIdAndDelete(id);
          if (doc) return doc;
          if (mongoose.Types.ObjectId.isValid(id)) {
            doc = await activeModel.findByIdAndDelete(new mongoose.Types.ObjectId(id));
            if (doc) return doc;
          }
        } catch (err) {
          console.warn(`[DB-Wrapper] Erro ao deletar no MongoDB Atlas, usando fallback local para ID ${id}`);
        }
      }

      const idx = getCollection().findIndex((x: any) => x._id === id);
      if (idx === -1) return null;

      const [removed] = getCollection().splice(idx, 1);
      persist();
      return wrapDoc(removed);
    },

    findOneAndUpdate: async (filter: any, update: any, options?: any) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      const cleanUpdate = sanitizeUpdate(update);
      if (connected) {
        try {
          let doc = await activeModel.findOneAndUpdate(filter, cleanUpdate, options);
          if (doc) return doc;
          if (filter && filter._id && typeof filter._id === "string" && mongoose.Types.ObjectId.isValid(filter._id)) {
            const altFilter = { ...filter, _id: new mongoose.Types.ObjectId(filter._id) };
            doc = await activeModel.findOneAndUpdate(altFilter, cleanUpdate, options);
            if (doc) return doc;
          }
        } catch (err) {
          console.warn(`[DB-Wrapper] Erro ao atualizar no MongoDB Atlas (findOneAndUpdate), usando fallback local`);
        }
      }

      const items = getCollection();
      let item = items.find((x: any) => {
        for (const [k, v] of Object.entries(filter)) {
          const itemVal = x[k];
          if (itemVal !== v) return false;
        }
        return true;
      });

      if (!item) {
        if (options && options.upsert) {
          const newDoc = { ...filter };
          applyMongoUpdate(newDoc, update);
          if (!newDoc._id) {
            newDoc._id = `${modelName === "Shift" ? "shift" : "meta"}_${Date.now()}`;
          }
          items.push(newDoc);
          persist();
          return wrapDoc(newDoc);
        }
        return null;
      }

      applyMongoUpdate(item, update);
      persist();
      return wrapDoc(item);
    },

    findOneAndDelete: async (filter: any) => {
      const connected = getModelConnected(modelName);
      const activeModel = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          let doc = await activeModel.findOneAndDelete(filter);
          if (doc) return doc;
          if (filter && filter._id && typeof filter._id === "string" && mongoose.Types.ObjectId.isValid(filter._id)) {
            const altFilter = { ...filter, _id: new mongoose.Types.ObjectId(filter._id) };
            doc = await activeModel.findOneAndDelete(altFilter);
            if (doc) return doc;
          }
        } catch (err) {
          console.warn(`[DB-Wrapper] Erro ao deletar no MongoDB Atlas (findOneAndDelete), usando fallback local`);
        }
      }

      const items = getCollection();
      const idx = items.findIndex((x: any) => {
        for (const [k, v] of Object.entries(filter)) {
          const itemVal = x[k];
          if (itemVal !== v) return false;
        }
        return true;
      });

      if (idx === -1) return null;

      const [removed] = items.splice(idx, 1);
      persist();
      return wrapDoc(removed);
    }
  } as any;
}

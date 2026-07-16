import fs from "fs";
import path from "path";

// ─── Local store (offline / no-DB fallback) ───────────────────────
// Persistence to disk is intentionally disabled — all data lives in
// MongoDB Atlas. This in-memory fallback only smooths over transient
// connection failures during a single server session.

const DB_FILE = path.join(process.cwd(), "db.json");

// Remove any stale db.json left from previous versions
try {
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
    console.log("[DB-Wrapper] Banco local antigo (db.json) removido.");
  }
} catch (err) {
  console.error("[DB-Wrapper] Erro ao remover banco local antigo:", err);
}

export interface LocalStore {
  savings: any[];
  loans: any[];
  goals: any[];
  shifts: any[];
}

/** Always returns empty collections — disk persistence is disabled. */
function loadLocalData(): LocalStore {
  return { savings: [], loans: [], goals: [], shifts: [] };
}

/** No-op — writes are disabled; data goes to MongoDB only. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function saveLocalData(_data: LocalStore): void {
  // intentionally empty
}

export const localData = loadLocalData();

type CollectionKey = "savings" | "loans" | "goals" | "shifts";

const MODEL_TO_COLLECTION: Record<string, CollectionKey> = {
  Saving: "savings",
  Loan: "loans",
  Shift: "shifts",
  Goal: "goals",
};

export function getCollectionKey(modelName: string): CollectionKey {
  return MODEL_TO_COLLECTION[modelName] ?? "goals";
}

export function getCollection(modelName: string): any[] {
  const key = getCollectionKey(modelName);
  if (!localData[key]) (localData as any)[key] = [];
  return (localData as any)[key];
}

export function persist(): void {
  saveLocalData(localData);
}

// ─── Mongo update helpers (applied to local objects) ─────────────

export function applyMongoUpdate(doc: any, update: any): void {
  if (!update) return;

  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) doc[k] = v;
  }

  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      (doc[k] as any[]).push(v);
    }
  }

  if (update.$pull) {
    for (const [k, query] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[k])) {
        const q = query as Record<string, unknown>;
        doc[k] = (doc[k] as any[]).filter((item) => {
          for (const [qk, qv] of Object.entries(q)) {
            if (item[qk] === qv) return false; // matches → remove
          }
          return true;
        });
      }
    }
  }

  // Direct field assignments (non-operator keys)
  for (const [k, v] of Object.entries(update)) {
    if (!k.startsWith("$")) doc[k] = v;
  }
}

export function sanitizeUpdate(update: any): any {
  if (!update || typeof update !== "object") return update;
  const clean = { ...update };
  if (clean._id !== undefined) delete clean._id;
  if (clean.$set && typeof clean.$set === "object") {
    clean.$set = { ...clean.$set };
    if (clean.$set._id !== undefined) delete clean.$set._id;
  }
  return clean;
}

// ─── MockDocument ─────────────────────────────────────────────────

export class MockDocument {
  [key: string]: any;

  constructor(data: any, private readonly _onSave: () => void) {
    Object.assign(this, data);
  }

  toObject() {
    const copy = { ...this };
    delete copy._onSave;
    return copy;
  }

  async save() {
    this._onSave();
    return this;
  }
}

export function wrapDoc(data: any, onSave: () => void): MockDocument | null {
  if (!data) return null;
  return new MockDocument(data, onSave);
}

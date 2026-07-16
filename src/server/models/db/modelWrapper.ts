import mongoose from "mongoose";
import { getModelConnected, getMongooseModel } from "./modelResolver.ts";
import {
  getCollection,
  persist,
  wrapDoc,
  applyMongoUpdate,
  sanitizeUpdate,
  MockDocument,
} from "./localFallback.ts";
import { cacheInvalidate, createCachingQuery } from "./cache.ts";

// ─── getModelWrapper ──────────────────────────────────────────────
// Returns a thin facade over a Mongoose model that:
//   • Delegates to MongoDB Atlas when connected
//   • Falls back to the in-memory local store when offline
//   • Caches full-collection `find()` calls (TTL 5 s) in connected mode
//   • Invalidates the cache on every write

export function getModelWrapper(modelName: string, mongooseModel: any): any {
  const col = () => getCollection(modelName);

  const makeDoc = (data: any): MockDocument | null =>
    wrapDoc(data, () => {
      const idx = col().findIndex((x: any) => x._id === data._id);
      if (idx !== -1) {
        col()[idx] = data;
        persist();
      }
    });

  return {
    // ── find ───────────────────────────────────────────────────────
    find: (filter: any = {}) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);

      if (connected) {
        const hasFilter = Object.keys(filter).length > 0;
        const baseQuery = active.find(filter);
        // Only cache unfiltered full-collection reads
        if (!hasFilter) return createCachingQuery(modelName, baseQuery);
        return baseQuery;
      }

      // ── Local fallback ──────────────────────────────────────────
      const items = col();
      const filtered = items.filter((x: any) =>
        Object.entries(filter).every(([k, v]) => x[k] === v)
      );

      const chain: any = {
        sort: (sortObj: any) => {
          const sorted = [...filtered];
          const [field, dir] =
            sortObj && Object.entries(sortObj)[0]
              ? (Object.entries(sortObj)[0] as [string, number])
              : ["_id", -1];
          sorted.sort((a, b) => {
            const va = a[field] ?? "";
            const vb = b[field] ?? "";
            return dir === -1
              ? String(vb).localeCompare(String(va))
              : String(va).localeCompare(String(vb));
          });
          const base = Promise.resolve(sorted.map(makeDoc));
          return Object.assign(base, {
            skip: (n: number) =>
              Object.assign(
                base.then((r) => r.slice(n)),
                {
                  limit: (l: number) =>
                    base.then((r) => r.slice(n, n + l)),
                }
              ),
            limit: (l: number) => base.then((r) => r.slice(0, l)),
          });
        },
        then: (res: any, rej: any) =>
          Promise.resolve(filtered.map(makeDoc)).then(res, rej),
      };

      return chain;
    },

    // ── countDocuments ─────────────────────────────────────────────
    countDocuments: (filter: any = {}) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      if (connected) return active.countDocuments(filter);
      const items = col();
      return Promise.resolve(
        items.filter((x: any) =>
          Object.entries(filter).every(([k, v]) => x[k] === v)
        ).length
      );
    },

    // ── findById ───────────────────────────────────────────────────
    findById: async (id: string) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          const doc = await active.findById(id);
          if (doc) return doc;
          if (mongoose.Types.ObjectId.isValid(id)) {
            const doc2 = await active.findById(
              new mongoose.Types.ObjectId(id)
            );
            if (doc2) return doc2;
          }
        } catch {
          console.warn(
            `[DB-Wrapper] findById fallback local para ID ${id}`
          );
        }
      }
      return makeDoc(col().find((x: any) => x._id === id));
    },

    // ── create ─────────────────────────────────────────────────────
    create: async (data: any) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          const doc = await active.create(data);
          cacheInvalidate(modelName);
          return doc;
        } catch {
          console.warn("[DB-Wrapper] Erro ao criar no Atlas, usando fallback local");
        }
      }
      const newDoc = { ...data };
      if (!newDoc._id)
        newDoc._id = `${modelName === "Loan" ? "loan" : "meta"}_${Date.now()}`;
      col().push(newDoc);
      persist();
      return makeDoc(newDoc);
    },

    // ── findByIdAndUpdate ──────────────────────────────────────────
    findByIdAndUpdate: async (id: string, update: any, options?: any) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      const clean = sanitizeUpdate(update);
      if (connected) {
        try {
          const doc =
            (await active.findByIdAndUpdate(id, clean, options)) ??
            (mongoose.Types.ObjectId.isValid(id)
              ? await active.findByIdAndUpdate(
                  new mongoose.Types.ObjectId(id),
                  clean,
                  options
                )
              : null);
          if (doc) { cacheInvalidate(modelName); return doc; }
        } catch (err: any) {
          console.error(
            `[DB-Wrapper] findByIdAndUpdate error for ${id}:`,
            err
          );
        }
      }
      const item = col().find((x: any) => x._id === id);
      if (!item) return null;
      applyMongoUpdate(item, update);
      persist();
      return makeDoc(item);
    },

    // ── findByIdAndDelete ──────────────────────────────────────────
    findByIdAndDelete: async (id: string) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          const doc =
            (await active.findByIdAndDelete(id)) ??
            (mongoose.Types.ObjectId.isValid(id)
              ? await active.findByIdAndDelete(new mongoose.Types.ObjectId(id))
              : null);
          if (doc) { cacheInvalidate(modelName); return doc; }
        } catch {
          console.warn(`[DB-Wrapper] findByIdAndDelete fallback local para ${id}`);
        }
      }
      const idx = col().findIndex((x: any) => x._id === id);
      if (idx === -1) return null;
      const [removed] = col().splice(idx, 1);
      persist();
      return makeDoc(removed);
    },

    // ── findOneAndUpdate ───────────────────────────────────────────
    findOneAndUpdate: async (filter: any, update: any, options?: any) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      const clean = sanitizeUpdate(update);
      if (connected) {
        try {
          let doc = await active.findOneAndUpdate(filter, clean, options);
          if (!doc && filter?._id && mongoose.Types.ObjectId.isValid(filter._id)) {
            doc = await active.findOneAndUpdate(
              { ...filter, _id: new mongoose.Types.ObjectId(filter._id) },
              clean,
              options
            );
          }
          if (doc) { cacheInvalidate(modelName); return doc; }
        } catch {
          console.warn("[DB-Wrapper] findOneAndUpdate fallback local");
        }
      }
      const items = col();
      let item = items.find((x: any) =>
        Object.entries(filter).every(([k, v]) => x[k] === v)
      );
      if (!item) {
        if (options?.upsert) {
          const newDoc = { ...filter };
          applyMongoUpdate(newDoc, update);
          if (!newDoc._id)
            newDoc._id = `${modelName === "Shift" ? "shift" : "meta"}_${Date.now()}`;
          items.push(newDoc);
          persist();
          return makeDoc(newDoc);
        }
        return null;
      }
      applyMongoUpdate(item, update);
      persist();
      return makeDoc(item);
    },

    // ── findOneAndDelete ───────────────────────────────────────────
    findOneAndDelete: async (filter: any) => {
      const connected = getModelConnected(modelName);
      const active = getMongooseModel(modelName, mongooseModel);
      if (connected) {
        try {
          let doc = await active.findOneAndDelete(filter);
          if (!doc && filter?._id && mongoose.Types.ObjectId.isValid(filter._id)) {
            doc = await active.findOneAndDelete({
              ...filter,
              _id: new mongoose.Types.ObjectId(filter._id),
            });
          }
          if (doc) { cacheInvalidate(modelName); return doc; }
        } catch {
          console.warn("[DB-Wrapper] findOneAndDelete fallback local");
        }
      }
      const items = col();
      const idx = items.findIndex((x: any) =>
        Object.entries(filter).every(([k, v]) => x[k] === v)
      );
      if (idx === -1) return null;
      const [removed] = items.splice(idx, 1);
      persist();
      return makeDoc(removed);
    },
  } as any;
}

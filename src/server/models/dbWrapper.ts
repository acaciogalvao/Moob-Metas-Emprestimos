// ─── dbWrapper — barrel re-export ────────────────────────────────
// All consumers import from this file as before; the implementation
// now lives in ./db/ sub-modules for clarity and testability.

export {
  setMongooseConnected,
  getMongooseConnected,
  setMetaMongooseConnected,
  getMetaMongooseConnected,
  getModelConnected,
} from "./db/connectionState.ts";

export { getMongooseModel } from "./db/modelResolver.ts";

export { syncLocalToCloud } from "./db/sync.ts";

export { getModelWrapper } from "./db/modelWrapper.ts";

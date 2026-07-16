import mongoose from "mongoose";
import { getMetaConnection } from "../../config/database.ts";
import { getModelConnected } from "./connectionState.ts";

export { getModelConnected };

// Collection names for meta models
const META_COLLECTIONS: Record<string, string> = {
  Saving: "metas",
  Loan: "emprestimos",
  Goal: "goals",
};

/**
 * Returns the correct Mongoose model for a given name.
 * For Goal/Saving/Loan, attempts to use the dedicated meta connection;
 * falls back to the default model if the connection is unavailable.
 */
export function getMongooseModel(modelName: string, defaultModel: any): any {
  if (modelName in META_COLLECTIONS) {
    try {
      const metaConn = getMetaConnection();
      if (metaConn && metaConn.readyState === 1) {
        if (metaConn.models[modelName]) return metaConn.models[modelName];
        return metaConn.model(
          modelName,
          defaultModel.schema,
          META_COLLECTIONS[modelName]
        );
      }
    } catch (err) {
      console.error(
        `[DB-Wrapper] Erro ao obter modelo do meta-connection (${modelName}):`,
        err
      );
    }
  }
  return defaultModel;
}

export { mongoose };

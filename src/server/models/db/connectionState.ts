// ─── Connection state flags ───────────────────────────────────────
// Caixa/Shifts use the default mongoose connection (isConnected).
// Metas/Empréstimos use the dedicated meta connection (isMetaConnected).

let isConnected = false;
let isMetaConnected = false;

export function setMongooseConnected(status: boolean): void {
  isConnected = status;
  console.log(
    `[DB-Wrapper] Modo de banco de dados atualizado. MongoDB Atlas Conectado: ${isConnected}`
  );
}

export function getMongooseConnected(): boolean {
  return isConnected;
}

export function setMetaMongooseConnected(status: boolean): void {
  isMetaConnected = status;
  console.log(
    `[DB-Wrapper] Modo de banco de dados Meta/Empréstimo atualizado. Conectado: ${isMetaConnected}`
  );
}

export function getMetaMongooseConnected(): boolean {
  return isMetaConnected;
}

/** Returns true when the given model has an active DB connection. */
export function getModelConnected(modelName: string): boolean {
  if (modelName === "Goal" || modelName === "Saving" || modelName === "Loan") {
    return isMetaConnected;
  }
  return isConnected;
}

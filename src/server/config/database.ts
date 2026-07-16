import mongoose, { Connection } from "mongoose";
import dotenv from "dotenv";
import {
  setMongooseConnected,
  setMetaMongooseConnected,
} from "../models/dbWrapper.ts";
import { getCustomMongoURI } from "./userConfig.ts";

dotenv.config();

// Fail fast — don't buffer commands while disconnected
mongoose.set("bufferCommands", false);

// ─── State ────────────────────────────────────────────────────────

let currentActiveURI = "";
let currentActiveMetaURI = "";
let metaConnection: Connection | null = null;
let healthInterval: ReturnType<typeof setInterval> | null = null;

export function getCurrentActiveURI(): string { return currentActiveURI; }
export function getCurrentActiveMetaURI(): string { return currentActiveMetaURI; }
export function getMetaConnection(): Connection | null { return metaConnection; }

// ─── Health status ────────────────────────────────────────────────

export type ConnectionStatus = "connected" | "disconnected" | "error";

export interface DbHealthStatus {
  main: ConnectionStatus;
  meta: ConnectionStatus;
  mainReadyState: number;
  metaReadyState: number;
  lastCheckedAt: string;
  uptime: number; // seconds since process start
}

let _health: DbHealthStatus = {
  main: "disconnected",
  meta: "disconnected",
  mainReadyState: 0,
  metaReadyState: 0,
  lastCheckedAt: new Date().toISOString(),
  uptime: 0,
};

export function getDbHealth(): DbHealthStatus {
  return { ..._health };
}

// ─── Ping helpers ─────────────────────────────────────────────────

async function pingMain(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) return false;
    await (mongoose.connection.db as any).admin().ping();
    return true;
  } catch {
    return false;
  }
}

async function pingMeta(): Promise<boolean> {
  try {
    if (!metaConnection || metaConnection.readyState !== 1) return false;
    await (metaConnection.db as any).admin().ping();
    return true;
  } catch {
    return false;
  }
}

// ─── Health check loop ────────────────────────────────────────────

/**
 * Starts a periodic health check that:
 *  - Pings both MongoDB connections every `intervalMs` milliseconds
 *  - Updates the status returned by `getDbHealth()`
 *  - Logs a warning and attempts to reconnect on failure
 *
 * Called automatically at the end of `connectDB()`. Safe to call
 * multiple times — existing intervals are cleared first.
 */
export function startHealthCheck(intervalMs = 30_000): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }

  healthInterval = setInterval(async () => {
    const [mainOk, metaOk] = await Promise.all([pingMain(), pingMeta()]);

    _health = {
      main: mainOk ? "connected" : "disconnected",
      meta: metaOk ? "connected" : "disconnected",
      mainReadyState: mongoose.connection.readyState,
      metaReadyState: metaConnection?.readyState ?? 0,
      lastCheckedAt: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };

    if (!mainOk || !metaOk) {
      console.warn(
        `[Health] Conexão perdida — principal:${mainOk ? "ok" : "ERRO"}, meta:${metaOk ? "ok" : "ERRO"}. Reconectando...`
      );
      setMongooseConnected(mainOk);
      setMetaMongooseConnected(metaOk);

      try {
        await connectDB();
      } catch (err: any) {
        console.error("[Health] Falha na reconexão automática:", err.message);
      }
    }
  }, intervalMs);

  healthInterval.unref?.(); // don't keep the process alive on its own
}

// ─── connectDB ────────────────────────────────────────────────────

const connectDB = async (
  overrideURI?: string,
  _overrideMetaURI?: string  // kept for API compatibility; always mirrors main URI
) => {
  // 1. Main connection (Shifts / Caixa)
  const customURI = getCustomMongoURI();
  const mongoURI =
    overrideURI ||
    customURI ||
    process.env.MONGODB_URI ||
    "mongodb+srv://MoobFinance:Moob1182@moob.ahimxo6.mongodb.net/moob?appName=Moob";

  currentActiveURI = mongoURI;

  if (mongoose.connection.readyState !== 0 && overrideURI) {
    try {
      console.log("[Database] Desconectando da base principal anterior...");
      await mongoose.disconnect();
    } catch (err) {
      console.error("[Database] Erro ao desconectar base principal:", err);
    }
  }

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
    });
    console.log("Conectado ao MongoDB Atlas (Principal) com sucesso!");
    setMongooseConnected(true);
    _health.main = "connected";
    _health.mainReadyState = 1;
  } catch (err) {
    console.error(
      "Erro ao conectar ao MongoDB Atlas Principal (fallback local ativo):",
      err
    );
    setMongooseConnected(false);
    _health.main = "error";
    _health.mainReadyState = 0;
  }

  // 2. Meta connection (Goals / Metas / Empréstimos)
  // Both connections intentionally share the same URI.
  const metaURI = mongoURI;
  currentActiveMetaURI = metaURI;

  if (metaConnection) {
    try {
      console.log("[Database] Fechando conexão meta anterior...");
      await metaConnection.close();
    } catch (err) {
      console.error("[Database] Erro ao fechar conexão meta anterior:", err);
    }
  }

  try {
    metaConnection = mongoose.createConnection(metaURI, {
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      const timeout = setTimeout(
        () => done(new Error("Timeout ao conectar ao banco Meta")),
        15_000
      );

      metaConnection!.once("connected", () => {
        clearTimeout(timeout);
        console.log("Conectado ao MongoDB Atlas (Meta/Empréstimos) com sucesso!");
        setMetaMongooseConnected(true);
        _health.meta = "connected";
        _health.metaReadyState = 1;
        done();
      });

      metaConnection!.once("error", (err) => {
        clearTimeout(timeout);
        done(err);
      });
    });
  } catch (err) {
    console.error(
      "Erro ao conectar ao MongoDB Atlas Meta (fallback local ativo):",
      err
    );
    setMetaMongooseConnected(false);
    _health.meta = "error";
    _health.metaReadyState = 0;
  }

  _health.lastCheckedAt = new Date().toISOString();

  // Start the health-check loop after the first successful connect.
  // Subsequent calls to connectDB (reconnect) restart the interval cleanly.
  startHealthCheck();
};

export default connectDB;

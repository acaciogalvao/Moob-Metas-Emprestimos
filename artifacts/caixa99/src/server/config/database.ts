import mongoose, { Connection } from "mongoose";
import dotenv from "dotenv";
import { setMongooseConnected, setMetaMongooseConnected } from "../models/dbWrapper";
import { getCustomMongoURI, getCustomMetaMongoURI } from "./userConfig";

dotenv.config();

// Configura o Mongoose para falhar rapidamente em vez de reter comandos indefinidamente
mongoose.set("bufferCommands", false);

// Armazena a URI atualmente ativa
let currentActiveURI = "";
let currentActiveMetaURI = "";
let metaConnection: Connection | null = null;

export function getCurrentActiveURI(): string {
  return currentActiveURI;
}

export function getCurrentActiveMetaURI(): string {
  return currentActiveMetaURI;
}

export function getMetaConnection(): Connection | null {
  return metaConnection;
}

const connectDB = async (overrideURI?: string, overrideMetaURI?: string) => {
  // --- 1. CONEXÃO GERAL (Shifts/Caixa) ---
  const customURI = getCustomMongoURI();
  const mongoURI = overrideURI || customURI || process.env.MONGODB_URI || "mongodb+srv://MoobFinance:Moob1182@moob.ahimxo6.mongodb.net/moob?appName=Moob";
  
  currentActiveURI = mongoURI;

  if (mongoose.connection.readyState !== 0 && overrideURI) {
    try {
      console.log("[Database] Desconectando da base de dados anterior para aplicar nova configuração...");
      await mongoose.disconnect();
    } catch (err) {
      console.error("[Database] Erro ao desconectar do banco principal:", err);
    }
  }

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    console.log("Conectado ao MongoDB Atlas (Principal) com sucesso!");
    setMongooseConnected(true);
  } catch (err) {
    console.error("Erro ao conectar ao MongoDB Atlas Principal (Usando banco de dados local fallback):", err);
    setMongooseConnected(false);
  }

  // --- 2. CONEXÃO META (Goals/Metas/Empréstimos) ---
  // Forçar o uso de uma única string de conexão (o banco principal de caixa)
  const metaURI = mongoURI;
  
  currentActiveMetaURI = metaURI;

  if (metaConnection) {
    try {
      console.log("[Database] Fechando conexão meta anterior para aplicar nova configuração...");
      await metaConnection.close();
    } catch (err) {
      console.error("[Database] Erro ao fechar conexão meta anterior:", err);
    }
  }

  try {
    metaConnection = mongoose.createConnection(metaURI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Timeout ao conectar ao banco Meta"));
        }
      }, 15000);

      metaConnection!.once("connected", () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          console.log("Conectado ao MongoDB Atlas (Meta/Empréstimos) com sucesso!");
          setMetaMongooseConnected(true);
          resolve();
        }
      });

      metaConnection!.once("error", (err) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    });
  } catch (err) {
    console.error("Erro ao conectar ao MongoDB Atlas Meta (Usando banco de dados local fallback):", err);
    setMetaMongooseConnected(false);
  }
};

export default connectDB;




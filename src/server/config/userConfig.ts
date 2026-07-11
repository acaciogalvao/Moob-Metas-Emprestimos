import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "config.json");

export interface AppConfig {
  MONGODB_URI?: string;
}

export function loadAppConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.error("[Config] Erro ao ler custom config:", err);
  }
  return {};
}

export function saveAppConfig(config: AppConfig) {
  try {
    const existing = loadAppConfig();
    const updated = { ...existing, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error("[Config] Erro ao salvar custom config:", err);
  }
}

export function getCustomMongoURI(): string {
  return loadAppConfig().MONGODB_URI || "";
}

export function saveCustomMongoURI(uri: string) {
  saveAppConfig({ MONGODB_URI: uri });
}

export function getCustomMetaMongoURI(): string {
  return getCustomMongoURI();
}

export function saveCustomMetaMongoURI(uri: string) {
  saveCustomMongoURI(uri);
}

export function maskMongoURI(uri: string): string {
  if (!uri) return "";
  try {
    // Mask password in mongodb URI
    // e.g., mongodb+srv://username:password@host/db
    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)$/);
    if (match) {
      return `${match[1]}******${match[3]}`;
    }
    // Simple mask if doesn't match standard format
    if (uri.length > 20) {
      return uri.substring(0, 15) + "..." + uri.substring(uri.length - 10);
    }
  } catch (e) {
    // ignore
  }
  return "URI configurada (oculta)";
}


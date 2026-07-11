import express from "express";
import cors from "cors";
import path from "path";
import connectDB from "./src/server/config/database";
import goalRoutes from "./src/server/routes/goalRoutes";
import paymentRoutes from "./src/server/routes/paymentRoutes";
import shiftRoutes from "./src/server/routes/shiftRoutes";
import { migrateGoalsCollection, migrateLegacyMetaToPrincipal } from "./src/server/lib/migrate";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Suporte para comprovantes em Base64
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rotas de metas (suporte singular e plural)
app.use("/moob-api/goals", goalRoutes);
app.use("/moob-api/goal", goalRoutes);

// Rotas de turnos/caixa do motorista
app.use("/moob-api/shifts", shiftRoutes);

// Rotas de pagamento
app.use("/moob-api", paymentRoutes);

// Rotas de configuração de banco de dados para o Termux / Customização
import { getMongooseConnected, getMetaMongooseConnected, syncLocalToCloud } from "./src/server/models/dbWrapper";
import { getCustomMongoURI, getCustomMetaMongoURI, saveCustomMongoURI, saveCustomMetaMongoURI, maskMongoURI } from "./src/server/config/userConfig";
import { getCurrentActiveURI, getCurrentActiveMetaURI } from "./src/server/config/database";

app.get("/moob-api/config/db-status", (_req, res) => {
  const connected = getMongooseConnected();
  const metaConnected = getMetaMongooseConnected();
  const customUri = getCustomMongoURI();
  const customMetaUri = getCustomMetaMongoURI();
  const activeUri = getCurrentActiveURI();
  const activeMetaUri = getCurrentActiveMetaURI();
  res.json({
    connected,
    metaConnected,
    customUri,
    customMetaUri,
    activeUriMasked: maskMongoURI(activeUri),
    activeMetaUriMasked: maskMongoURI(activeMetaUri),
    usingDefaultFallback: !customUri && !process.env.MONGODB_URI,
    usingDefaultMetaFallback: !customMetaUri && !process.env.META_MONGODB_URI
  });
});

app.post("/moob-api/config/db-sync", async (_req, res) => {
  try {
    const syncResult = await syncLocalToCloud();
    res.json({
      success: true,
      syncResult,
      message: "Sincronização dos bancos concluída com sucesso!"
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: "Falha ao sincronizar dados locais com a nuvem."
    });
  }
});

app.post("/moob-api/config/db-uri", async (req, res) => {
  const { uri, metaUri } = req.body;
  if (uri === undefined && metaUri === undefined) {
    return res.status(400).json({ error: "Nenhuma URI especificada" });
  }

  try {
    let finalUri = uri !== undefined ? uri.trim() : getCustomMongoURI();
    let finalMetaUri = finalUri;

    if (uri !== undefined) {
      if (finalUri.includes("******")) {
        finalUri = getCustomMongoURI(); // Ignore update, keep existing
        finalMetaUri = finalUri;
      } else {
        saveCustomMongoURI(finalUri);
      }
    }

    // Reconecta dinamicamente ambos
    await connectDB(finalUri, finalMetaUri);

    // Sincroniza dados locais para a nuvem automaticamente
    const syncResult = await syncLocalToCloud();
    console.log("[Sync] Sincronização pós-conexão concluída:", syncResult);

    const connected = getMongooseConnected();
    const metaConnected = getMetaMongooseConnected();

    res.json({
      success: true,
      connected,
      metaConnected,
      customUri: finalUri,
      customMetaUri: finalMetaUri,
      activeUriMasked: maskMongoURI(finalUri || getCurrentActiveURI()),
      activeMetaUriMasked: maskMongoURI(finalMetaUri || getCurrentActiveMetaURI()),
      syncResult,
      message: "Configuração salva e banco local sincronizado com a nuvem com sucesso!"
    });
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message,
      message: "Falha ao tentar estabelecer nova conexão."
    });
  }
});

async function start() {
  // Conecta ao MongoDB Atlas
  await connectDB();
  
  // Copia os dados do banco meta legado para o banco principal (caixa) se necessário
  await migrateLegacyMetaToPrincipal();
  
  // Realiza migrações da coleção se houver dados legados
  await migrateGoalsCollection();

  // Middleware do Vite para desenvolvimento local
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MoobFinance] Servidor rodando em http://localhost:${PORT}`);
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

start();

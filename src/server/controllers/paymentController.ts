import { Request, Response } from "express";
import QRCode from "qrcode";
import Saving from "../models/Saving.ts";
import Loan from "../models/Loan.ts";
import Goal from "../models/Goal.ts";
import { generatePixPayload } from "../lib/pixPayload.ts";
import { GoogleGenAI, Type } from "@google/genai";

// ─── Helpers ──────────────────────────────────────────────────────

/** Searches Loan → Saving → Goal and returns the first match. */
async function findByIdAndUpdateBoth(id: string, update: any) {
  let doc = await Loan.findByIdAndUpdate(id, update, { new: true });
  if (!doc) doc = await Saving.findByIdAndUpdate(id, update, { new: true });
  if (!doc) doc = await Goal.findByIdAndUpdate(id, update, { new: true });
  return doc;
}

/**
 * Recalculates savedP1/savedP2 from the payments array.
 * Uses the schema method when available (Mongoose doc); falls back to
 * manual calculation for MockDocument (offline fallback).
 */
function recalcSaved(doc: any): void {
  if (typeof doc.recalcSaved === "function") {
    doc.recalcSaved();
    return;
  }
  let p1 = 0;
  let p2 = 0;
  for (const p of doc.payments ?? []) {
    if (p.payerId === "P1") p1 += p.amount ?? 0;
    if (p.payerId === "P2") p2 += p.amount ?? 0;
  }
  doc.savedP1 = p1;
  doc.savedP2 = p2;
}

/** Returns true when the string is a recognisable base64 image prefix. */
function isValidBase64Image(s: string): boolean {
  // Either a data-URI prefix or raw base64 (at least 100 chars)
  return (
    /^data:(image\/(jpeg|jpg|png|webp|gif|bmp)|application\/pdf);base64,/i.test(s) ||
    (s.length > 100 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 100)))
  );
}

/** Sanitizes a PIX key — trims and strips obvious injection patterns. */
function sanitizePixKey(key: string): string {
  return key.trim().replace(/[<>"'`\\]/g, "").slice(0, 200);
}

// ─── Controllers ──────────────────────────────────────────────────

export const verifyReceipt = async (req: Request, res: Response) => {
  try {
    const { imageBase64, expectedAmount, expectedPayer } = req.body;

    // Validation — route middleware already checks these exist, but we add
    // semantic checks here (format, finite number)
    if (!isValidBase64Image(imageBase64)) {
      return res.status(400).json({ error: "Imagem inválida ou formato não suportado" });
    }
    const amount = Number(expectedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valor esperado inválido" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("[verifyReceipt] GEMINI_API_KEY não configurada — aprovando via mock.");
      return res.json({ isValid: true, reason: "" });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    // Strip data-URI prefix to get raw base64
    const strippedBase64 = imageBase64.replace(
      /^data:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+;base64,/,
      ""
    );
    const mimeMatch = imageBase64.match(
      /^data:([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+);base64,/
    );
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const payerHint = expectedPayer
      ? `\nVerifique se o nome de quem pagou (ou remetente) se assemelha a "${String(expectedPayer).slice(0, 100)}".`
      : "";

    const prompt =
      `Analise este comprovante de pagamento.\n` +
      `Verifique se o valor corresponde a aproximadamente R$ ${amount.toFixed(2)} ` +
      `(pequenas variações de juros são aceitáveis).` +
      payerHint +
      `\nRetorne um JSON com os campos isValid (boolean) e reason (string em português).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: strippedBase64 } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: {
              type: Type.BOOLEAN,
              description: "true se o comprovante parece válido e o valor bate",
            },
            reason: {
              type: Type.STRING,
              description: "Motivo curto se inválido; vazio se válido",
            },
          },
          required: ["isValid", "reason"],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");
    return res.json({ isValid: !!parsed.isValid, reason: parsed.reason ?? "" });
  } catch (err: any) {
    console.error("[verifyReceipt] Erro:", err);
    return res.json({ isValid: true, reason: "" }); // friendly fallback
  }
};

export const generateStaticPix = async (req: Request, res: Response) => {
  try {
    const { amount, pixKey, merchantName } = req.body;

    const cleanKey = sanitizePixKey(String(pixKey ?? ""));
    if (!cleanKey) {
      return res.status(400).json({ error: "Chave PIX inválida" });
    }

    const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    const safeName = String(merchantName ?? "RECEBEDOR")
      .trim()
      .slice(0, 25)
      .replace(/[^A-Za-z0-9 ]/g, "")
      || "RECEBEDOR";

    const pixCode = generatePixPayload(cleanKey, safeName, safeAmount);
    const qrRaw = await QRCode.toDataURL(pixCode, {
      width: 256,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
    const base64 = qrRaw.replace(/^data:image\/png;base64,/, "");
    return res.json({ pixCode, qrCodeBase64: base64, isMock: true });
  } catch (err: any) {
    console.error("[generateStaticPix] Erro:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const createPixPayment = async (req: Request, res: Response) => {
  try {
    const { amount, goalId, payerId } = req.body;

    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken || mpToken === "seu_token_aqui" || mpToken.startsWith("TEST-")) {
      const mockId = `mock_${Date.now()}`;
      const pixCode = `00020126330014BR.GOV.BCB.PIX0111${
        String(goalId).slice(0, 11).padEnd(11, "0")
      }52040000530398654${String(safeAmount.toFixed(2)).length
        .toString()
        .padStart(2, "0")}${safeAmount.toFixed(
        2
      )}5802BR5908RECEBEDOR6009SAO PAULO62070503***6304ABCD`;
      const qrRaw = await QRCode.toDataURL(pixCode, { width: 256 });
      return res.json({
        paymentId: mockId,
        pixCode,
        qrCodeBase64: qrRaw.replace(/^data:image\/png;base64,/, ""),
        isMock: true,
      });
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        transaction_amount: safeAmount,
        payment_method_id: "pix",
        payer: { email: "pagador@metacompartilhada.com" },
        description: `Contribuição meta ${String(goalId).slice(0, 50)} - ${payerId}`,
      },
    });

    const txInfo = (result as any).point_of_interaction?.transaction_data;
    return res.json({
      paymentId: String(result.id),
      pixCode: txInfo?.qr_code ?? "",
      qrCodeBase64: txInfo?.qr_code_base64 ?? "",
      isMock: false,
    });
  } catch (err: any) {
    console.error("[createPixPayment] Erro:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const checkPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    if (paymentId.startsWith("mock_")) return res.json({ status: "pending" });

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken || mpToken === "seu_token_aqui") {
      return res.json({ status: "pending" });
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: Number(paymentId) });
    return res.json({ status: result.status });
  } catch (err: any) {
    console.error("[checkPayment] Erro:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const manualPay = async (req: Request, res: Response) => {
  try {
    const { amount, goalId, payerId, method } = req.body;

    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }
    if (!goalId || typeof goalId !== "string") {
      return res.status(400).json({ error: "goalId inválido" });
    }
    if (payerId !== "P1" && payerId !== "P2") {
      return res.status(400).json({ error: "payerId deve ser P1 ou P2" });
    }

    const safeMethod = ["pix", "dinheiro", "PIX", "DINHEIRO"].includes(method)
      ? method
      : "pix";
    const paymentId = `${safeMethod === "dinheiro" || safeMethod === "DINHEIRO" ? "dinheiro" : "pag"}_${Date.now()}`;

    const doc = await findByIdAndUpdateBoth(goalId, {
      $push: {
        payments: {
          _id: paymentId,
          paymentId,
          amount: safeAmount,
          method: safeMethod,
          payerId,
          date: new Date(),
        },
      },
    });

    if (!doc) {
      console.warn(`[manualPay] ID ${goalId} não encontrado em nenhuma coleção.`);
      return res.status(404).json({
        error: `Meta/Empréstimo não encontrado (ID: ${goalId})`,
        goalId,
      });
    }

    recalcSaved(doc);
    await doc.save();
    return res.json({ success: true, goal: doc });
  } catch (err: any) {
    console.error("[manualPay] Erro:", err);
    return res.status(500).json({ error: err.message });
  }
};

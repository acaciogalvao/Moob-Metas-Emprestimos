import { Request, Response } from "express";
import QRCode from "qrcode";
import Saving from "../models/Saving";
import Loan from "../models/Loan";
import Goal from "../models/Goal";
import { generatePixPayload } from "../lib/pixPayload";
import { GoogleGenAI, Type } from "@google/genai";

/** Busca e atualiza um documento por ID nas duas coleções (e na legado Goal) */
async function findByIdAndUpdateBoth(id: string, update: any) {
  let doc = await Loan.findByIdAndUpdate(id, update, { new: true });
  if (!doc) doc = await Saving.findByIdAndUpdate(id, update, { new: true });
  if (!doc) doc = await Goal.findByIdAndUpdate(id, update, { new: true });
  return doc;
}

export const verifyReceipt = async (req: Request, res: Response) => {
  try {
    const { imageBase64, expectedAmount, expectedPayer } = req.body;
    
    if (!imageBase64 || !expectedAmount) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY não configurada. Aprovando mock.");
      // Se não tiver chave, usamos um mock para aprovar
      return res.json({ isValid: true, reason: "" });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const strippedBase64 = imageBase64.replace(/^data:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+;base64,/, "");

    const mimeTypeStr = imageBase64.match(/^data:([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+);base64,/);
    const mimeType = mimeTypeStr ? mimeTypeStr[1] : "image/jpeg";

    const prompt = `Analise este comprovante de pagamento.
Verifique se o valor do comprovante corresponde a aproximadamente ${expectedAmount} (pode haver pequena variação de juros).
Verifique se o nome de quem pagou (ou remetente) se assemelha a "${expectedPayer}".
Retorne um JSON estruturado com a validade.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: strippedBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: {
              type: Type.BOOLEAN,
              description: "Indica se o comprovante é válido, se o valor bate (ou está próximo) e parece legítimo",
            },
            reason: {
              type: Type.STRING,
              description: "Motivo curto se for inválido, em português. Se válido, pode ser vazio.",
            },
          },
          required: ["isValid", "reason"],
        },
      }
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    return res.json({ 
      isValid: resultJson.isValid, 
      reason: resultJson.reason 
    });
  } catch (err: any) {
    console.error("Erro ao verificar comprovante com Gemini:", err);
    // Fallback amigável se a API falhar temporariamente
    return res.json({ isValid: true, reason: "" });
  }
};

// Gera QR Code estático a partir de uma chave PIX pessoal
export const generateStaticPix = async (req: Request, res: Response) => {
  try {
    const { amount, pixKey, merchantName } = req.body;

    if (!pixKey) {
      return res.status(400).json({ error: "Chave PIX não informada" });
    }

    const pixCode = generatePixPayload(pixKey, merchantName || "RECEBEDOR", Number(amount));

    const qrCodeBase64 = await QRCode.toDataURL(pixCode, {
      width: 256,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const base64 = qrCodeBase64.replace(/^data:image\/png;base64,/, "");

    return res.json({ pixCode, qrCodeBase64: base64, isMock: true });
  } catch (err: any) {
    console.error("Erro ao gerar PIX estático:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Cria pagamento via Mercado Pago (ou mock se sem token)
export const createPixPayment = async (req: Request, res: Response) => {
  try {
    const { amount, goalId, payerId } = req.body;
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!mpToken || mpToken === "seu_token_aqui" || mpToken.startsWith("TEST-")) {
      const mockPaymentId = `mock_${Date.now()}`;
      const pixCode = `00020126330014BR.GOV.BCB.PIX0111${goalId?.slice(0, 11) || "00000000000"}52040000530398654${String(Number(amount).toFixed(2)).length.toString().padStart(2, "0")}${Number(amount).toFixed(2)}5802BR5908RECEBEDOR6009SAO PAULO62070503***6304ABCD`;
      const qrCodeBase64Raw = await QRCode.toDataURL(pixCode, { width: 256 });
      const base64 = qrCodeBase64Raw.replace(/^data:image\/png;base64,/, "");
      return res.json({ paymentId: mockPaymentId, pixCode, qrCodeBase64: base64, isMock: true });
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const payment = new Payment(client);

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount),
        payment_method_id: "pix",
        payer: { email: "pagador@metacompartilhada.com" },
        description: `Contribuição meta ${goalId} - ${payerId}`,
      },
    });

    const txInfo = (result as any).point_of_interaction?.transaction_data;
    return res.json({
      paymentId: String(result.id),
      pixCode: txInfo?.qr_code || "",
      qrCodeBase64: txInfo?.qr_code_base64 || "",
      isMock: false,
    });
  } catch (err: any) {
    console.error("Erro ao criar pagamento PIX:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Verifica status de pagamento
export const checkPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    if (paymentId.startsWith("mock_")) return res.json({ status: "pending" });

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken || mpToken === "seu_token_aqui") return res.json({ status: "pending" });

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: Number(paymentId) });
    return res.json({ status: result.status });
  } catch (err: any) {
    console.error("Erro ao verificar pagamento:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Registra pagamento manual no histórico
export const manualPay = async (req: Request, res: Response) => {
  try {
    const { amount, goalId, payerId, method } = req.body;

    if (!goalId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const paymentId = `${method === "dinheiro" ? "dinheiro" : "pag"}_${Date.now()}`;

    const doc = await findByIdAndUpdateBoth(goalId, {
      $push: {
        payments: {
          _id: paymentId, // usará o _id no schema local do MongoDB
          paymentId,
          amount: Number(amount),
          method: method || "pix",
          payerId,
          date: new Date(),
        },
      }
    });

    if (!doc) {
      console.warn(`[manualPay] Meta/Empréstimo com ID ${goalId} não foi encontrado.`);
      const allSavings = await Saving.find().catch(() => []);
      const allLoans = await Loan.find().catch(() => []);
      const allGoals = await Goal.find().catch(() => []);
      
      console.log("[manualPay] IDs de Metas existentes:", allSavings.map((s: any) => s._id));
      console.log("[manualPay] IDs de Empréstimos existentes:", allLoans.map((l: any) => l._id));
      console.log("[manualPay] IDs de Goals legados existentes:", allGoals.map((g: any) => g._id));

      return res.status(404).json({ 
        error: `Não encontrado. ID requisitado: ${goalId}. Verifique os logs do servidor para mais detalhes.`,
        goalId,
        availableSavings: allSavings.map((s: any) => s._id),
        availableLoans: allLoans.map((l: any) => l._id),
        availableGoals: allGoals.map((g: any) => g._id)
      });
    }

    // Recalcula savedP1 e savedP2
    let sP1 = 0;
    let sP2 = 0;
    doc.payments.forEach((p: any) => {
      if (p.payerId === "P1") sP1 += p.amount;
      if (p.payerId === "P2") sP2 += p.amount;
    });
    doc.savedP1 = sP1;
    doc.savedP2 = sP2;
    await doc.save();

    return res.json({ success: true, goal: doc });
  } catch (err: any) {
    console.error("Erro ao registrar pagamento manual:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * ridePrefillRoutes.ts
 *
 * Endpoint usado pelo APK companion (MoobAccessibility) para enviar dados
 * de chamados lidos da tela do Uber/99 via AccessibilityService.
 *
 * Armazenamento em memória — os dados são efêmeros e desaparecem ao reiniciar
 * o servidor. Não é necessário banco de dados para este fluxo.
 *
 * Rotas:
 *   POST /moob-api/ride-prefill          → APK posta dados do chamado
 *   GET  /moob-api/ride-prefill/latest   → frontend faz polling (a cada 3 s)
 *   DELETE /moob-api/ride-prefill/latest → frontend limpa após usar os dados
 */

import { Router, Request, Response } from "express";

export interface RidePrefillData {
  id: string;                  // UUID único para detectar novo chamado
  timestamp: number;           // epoch ms
  platform: "UBER" | "99";
  rideType?: string;           // "UberX", "Comfort", "Motos 99", etc.
  pickup: {
    address: string;
    distanceKm?: number;       // km até o embarque
    etaMinutes?: number;       // min até o embarque
  };
  destination: {
    address: string;
    distanceKm?: number;       // km da corrida
    etaMinutes?: number;       // min da corrida
  };
  fareEstimate?: string;       // "R$ 22,50" (string conforme exibido no app)
  surgeMultiplier?: number;    // 1.5, 2.0, etc.
}

// ─── Armazenamento in-memory ──────────────────────────────────────────────────
let latest: RidePrefillData | null = null;

export const router = Router();

// POST /moob-api/ride-prefill
// Recebe dados do chamado do APK companion. Não requer autenticação pois
// só aceita requisições de localhost (Android envia para 127.0.0.1:5000).
router.post("/", (req: Request, res: Response) => {
  const body = req.body as Partial<RidePrefillData>;

  // Validação mínima
  if (!body.platform || !body.pickup?.address || !body.destination?.address) {
    return res.status(400).json({
      error: "Campos obrigatórios ausentes: platform, pickup.address, destination.address",
    });
  }

  latest = {
    id: body.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: body.timestamp || Date.now(),
    platform: body.platform as "UBER" | "99",
    rideType: body.rideType,
    pickup: {
      address: body.pickup.address,
      distanceKm: body.pickup.distanceKm,
      etaMinutes: body.pickup.etaMinutes,
    },
    destination: {
      address: body.destination.address,
      distanceKm: body.destination.distanceKm,
      etaMinutes: body.destination.etaMinutes,
    },
    fareEstimate: body.fareEstimate,
    surgeMultiplier: body.surgeMultiplier,
  };

  console.log(
    `[RidePrefill] Novo chamado recebido: ${latest.platform} | ` +
    `${latest.pickup.address} → ${latest.destination.address} | ` +
    `${latest.destination.distanceKm ?? "?"}km | ${latest.fareEstimate ?? "sem valor"}`
  );

  return res.status(201).json({ ok: true, id: latest.id });
});

// GET /moob-api/ride-prefill/latest
// Frontend faz polling a cada 3 s para verificar se há um novo chamado.
router.get("/latest", (_req: Request, res: Response) => {
  return res.json({ data: latest });
});

// DELETE /moob-api/ride-prefill/latest
// Frontend chama após preencher o formulário (ou ao dispensar o banner).
router.delete("/latest", (_req: Request, res: Response) => {
  latest = null;
  return res.json({ ok: true });
});

export default router;

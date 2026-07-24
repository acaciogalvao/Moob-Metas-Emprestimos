/**
 * useRidePrefill.ts
 *
 * Faz polling no endpoint /moob-api/ride-prefill/latest a cada 3 segundos.
 * Quando um novo chamado chega (id diferente do anterior), dispara uma
 * vibração, toca um beep e expõe os dados para o QuickRegister preencher
 * o formulário automaticamente.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { playBeep } from "../utils/audio";

export interface RidePrefillData {
  id: string;
  timestamp: number;
  platform: "UBER" | "99";
  rideType?: string;
  pickup: {
    address: string;
    distanceKm?: number;
    etaMinutes?: number;
  };
  destination: {
    address: string;
    distanceKm?: number;
    etaMinutes?: number;
  };
  fareEstimate?: string;
  surgeMultiplier?: number;
}

export interface UseRidePrefillReturn {
  /** Dados do chamado pendente, ou null se não houver nenhum */
  prefill: RidePrefillData | null;
  /** Marca o chamado como usado e limpa o servidor */
  consume: () => void;
  /** Descarta o chamado sem preencher o formulário */
  dismiss: () => void;
}

const POLL_INTERVAL_MS = 3_000;

export function useRidePrefill(enabled: boolean): UseRidePrefillReturn {
  const [prefill, setPrefill] = useState<RidePrefillData | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearOnServer = useCallback(async () => {
    try {
      await fetch("/moob-api/ride-prefill/latest", { method: "DELETE" });
    } catch {
      // silencioso — servidor pode estar offline
    }
  }, []);

  const consume = useCallback(() => {
    setPrefill(null);
    lastIdRef.current = null;
    clearOnServer();
  }, [clearOnServer]);

  const dismiss = useCallback(() => {
    setPrefill(null);
    // Mantém o lastIdRef para não mostrar o mesmo chamado de novo
    clearOnServer();
  }, [clearOnServer]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch("/moob-api/ride-prefill/latest");
        if (!res.ok) return;
        const json = await res.json();
        const data: RidePrefillData | null = json.data;

        if (!data) return;

        // Novo chamado: id diferente do último visto
        if (data.id !== lastIdRef.current) {
          lastIdRef.current = data.id;
          setPrefill(data);

          // Vibração (3 pulsos) + beep para alertar o motorista
          try {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
          } catch {
            // sem vibração no dispositivo
          }
          try {
            playBeep();
          } catch {
            // sem áudio
          }

          console.log(
            `[RidePrefill] Novo chamado: ${data.platform} | ` +
            `${data.pickup.address} → ${data.destination.address}`
          );
        }
      } catch {
        // rede offline ou servidor reiniciando — ignora silenciosamente
      }
    };

    // Poll imediato + periódico
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return { prefill, consume, dismiss };
}

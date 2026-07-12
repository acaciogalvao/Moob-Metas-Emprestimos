/**
 * useShiftGPS.ts — Hook React que ativa o GPS automaticamente quando o caixa está aberto.
 *
 * Comportamento:
 *  - GPS inicia automaticamente ao abrir o caixa (isShiftOpen = true)
 *  - Se o caixa já estiver aberto ao montar o componente, o GPS começa imediatamente
 *  - GPS para automaticamente ao fechar o caixa
 *  - Usa gpsProcessor (Haversine + EMA α=0.3) para velocidade e odômetro
 *  - Exibe log em tempo real conforme regra 5 do spec
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  gpsProcessorInit,
  processGpsPoint,
  resetTripKm,
  type GpsProcessorState,
} from '../utils/gpsProcessor';

export interface ShiftGpsData {
  speedKmh: number;         // velocidade atual filtrada (km/h)
  shiftKm: number;          // km rodados no turno (resetável)
  totalKm: number;          // odômetro total da sessão GPS
  isActive: boolean;        // true = GPS rodando e recebendo sinal
  accuracy: number | null;  // precisão do sinal GPS em metros (null = sem sinal ainda)
  resetShiftKm: () => void; // reseta km do turno sem interromper o GPS
}

export function useShiftGPS(isShiftOpen: boolean): ShiftGpsData {
  const [speedKmh, setSpeedKmh]   = useState(0);
  const [shiftKm, setShiftKm]     = useState(0);
  const [totalKm, setTotalKm]     = useState(0);
  const [isActive, setIsActive]   = useState(false);
  const [accuracy, setAccuracy]   = useState<number | null>(null);

  const processorRef = useRef<GpsProcessorState>(gpsProcessorInit());
  const watchIdRef   = useRef<number | null>(null);

  // ── Para o GPS e limpa o watcher ────────────────────────────────────────
  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
    setIsActive(false);
    setSpeedKmh(0);
    console.log('[ShiftGPS] GPS encerrado — caixa fechado.');
  }, []);

  // ── Inicia o GPS com watchPosition ──────────────────────────────────────
  const startGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[ShiftGPS] Geolocalização não suportada neste dispositivo.');
      return;
    }
    if (watchIdRef.current !== null) return; // já está rodando

    // Reinicializa o processador para o novo turno
    processorRef.current = gpsProcessorInit();
    setShiftKm(0);
    setTotalKm(0);
    setSpeedKmh(0);
    setIsActive(false);

    console.log('[ShiftGPS] GPS ativado automaticamente — caixa aberto.');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy: acc } = pos.coords;
        const timestamp = pos.timestamp || Date.now();

        setAccuracy(acc);

        const result = processGpsPoint(processorRef.current, {
          timestamp,
          latitude,
          longitude,
          speed,
          accuracy: acc,
        });

        if (result.discarded) {
          // Regra 4a: ponto descartado por falha de GPS (salto > 500m em 1s)
          console.warn('[ShiftGPS] Ponto GPS descartado — salto impossível detectado (> 500m em 1s).');
          return;
        }

        processorRef.current = result.state;
        setSpeedKmh(result.speedKmh);
        setShiftKm(result.tripKm);
        setTotalKm(result.totalKm);
        setIsActive(true);

        // Regra 5: exibe saída em tempo real
        console.log(
          `[ShiftGPS] Velocidade: ${result.speedKmh} km/h | Distância total: ${result.tripKm.toFixed(3)} km`
        );
      },
      (err) => {
        console.warn('[ShiftGPS] Erro de geolocalização:', err.message);
        // Só zera em erros permanentes (permissão negada), não em timeouts simples
        if (err.code !== err.TIMEOUT) {
          setSpeedKmh(0);
          setIsActive(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 3000,   // 3 s antes de tentar novamente
        maximumAge: 0,   // sempre pede posição fresca
      }
    );
  }, []);

  // ── Liga/desliga o GPS com base no estado do caixa ───────────────────────
  useEffect(() => {
    if (isShiftOpen) {
      startGps();
    } else {
      stopGps();
    }

    // Cleanup ao desmontar ou quando o caixa fechar
    return () => {
      if (watchIdRef.current !== null) {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }
    };
  }, [isShiftOpen]); // reage apenas à mudança no estado do caixa

  // ── Reseta km do turno sem interromper o GPS ─────────────────────────────
  const resetShiftKm = useCallback(() => {
    processorRef.current = resetTripKm(processorRef.current);
    setShiftKm(0);
  }, []);

  return { speedKmh, shiftKm, totalKm, isActive, accuracy, resetShiftKm };
}

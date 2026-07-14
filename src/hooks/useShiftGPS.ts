/**
 * useShiftGPS.ts — Hook GPS do turno com suporte a segundo plano.
 *
 * Comportamento:
 *  - GPS inicia automaticamente ao abrir o caixa
 *  - Áudio silencioso + Wake Lock mantêm o GPS ativo com Uber/99 em foco
 *  - Se o GPS parou durante background (caso raro), estima km pelo tempo decorrido
 *  - GPS para automaticamente ao fechar o caixa
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  gpsProcessorInit,
  processGpsPoint,
  resetTripKm,
  type GpsProcessorState,
} from '../utils/gpsProcessor';
import { useBackgroundKeepAlive } from './useBackgroundKeepAlive';

export interface ShiftGpsData {
  speedKmh: number;
  shiftKm: number;
  totalKm: number;
  isActive: boolean;
  accuracy: number | null;
  isBackground: boolean;       // true = app está em segundo plano agora
  isAudioActive: boolean;      // true = keep-alive de áudio rodando
  resetShiftKm: () => void;
}

export function useShiftGPS(isShiftOpen: boolean): ShiftGpsData {
  const [speedKmh, setSpeedKmh] = useState(0);
  const [shiftKm, setShiftKm]   = useState(0);
  const [totalKm, setTotalKm]   = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const processorRef = useRef<GpsProcessorState>(gpsProcessorInit());
  const watchIdRef   = useRef<number | null>(null);

  // ── Keep-alive em segundo plano ───────────────────────────────────────────
  const { isBackground, backgroundSince, isAudioActive } =
    useBackgroundKeepAlive(isShiftOpen);

  // Refs para uso dentro dos callbacks do GPS (evita closures desatualizadas)
  const isBackgroundRef     = useRef(false);
  const backgroundSinceRef  = useRef<number | null>(null);
  const lastSpeedKmhRef     = useRef(0);
  const gpsUpdatesInBgRef   = useRef(0); // quantos updates GPS chegaram durante background

  // Sincroniza estado → refs
  useEffect(() => {
    isBackgroundRef.current    = isBackground;
    backgroundSinceRef.current = backgroundSince;
  }, [isBackground, backgroundSince]);

  // Quando volta ao primeiro plano: verifica se precisa estimar km
  useEffect(() => {
    if (!isBackground && backgroundSince !== null) {
      const elapsedHours = (Date.now() - backgroundSince) / 3_600_000;
      const speed = lastSpeedKmhRef.current;

      if (gpsUpdatesInBgRef.current === 0 && elapsedHours > 0.005 && speed > 3) {
        // GPS não disparou durante background — estima km com o último speed conhecido
        const estimatedKm = speed * elapsedHours;
        processorRef.current = {
          ...processorRef.current,
          tripKm:  processorRef.current.tripKm  + estimatedKm,
          totalKm: processorRef.current.totalKm + estimatedKm,
        };
        setShiftKm(processorRef.current.tripKm);
        setTotalKm(processorRef.current.totalKm);
        console.log(
          `[ShiftGPS] GPS pausou no background — estimativa: +${estimatedKm.toFixed(3)} km` +
          ` (${(elapsedHours * 60).toFixed(1)} min × ${speed.toFixed(0)} km/h)`
        );
      } else {
        console.log(
          `[ShiftGPS] GPS continuou em background — ${gpsUpdatesInBgRef.current} updates recebidos.`
        );
      }

      gpsUpdatesInBgRef.current = 0;
    }
  }, [isBackground, backgroundSince]);

  // ── Para o GPS ────────────────────────────────────────────────────────────
  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsActive(false);
    setSpeedKmh(0);
    console.log('[ShiftGPS] GPS encerrado — caixa fechado.');
  }, []);

  // ── Inicia o GPS com watchPosition ───────────────────────────────────────
  const startGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[ShiftGPS] Geolocalização não suportada neste dispositivo.');
      return;
    }
    if (watchIdRef.current !== null) return;

    processorRef.current  = gpsProcessorInit();
    lastSpeedKmhRef.current = 0;
    gpsUpdatesInBgRef.current = 0;
    setShiftKm(0);
    setTotalKm(0);
    setSpeedKmh(0);
    setIsActive(false);

    console.log('[ShiftGPS] GPS ativado — caixa aberto.');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy: acc } = pos.coords;
        const timestamp = pos.timestamp || Date.now();

        // Conta updates recebidos enquanto está em background
        if (isBackgroundRef.current) {
          gpsUpdatesInBgRef.current++;
        }

        setAccuracy(acc);

        const result = processGpsPoint(processorRef.current, {
          timestamp, latitude, longitude, speed, accuracy: acc ?? undefined,
        });

        if (result.discarded) {
          console.warn('[ShiftGPS] Ponto GPS descartado — salto > 500m em 1s.');
          return;
        }

        processorRef.current = result.state;
        lastSpeedKmhRef.current = result.speedKmh;

        setSpeedKmh(result.speedKmh);
        setShiftKm(result.tripKm);
        setTotalKm(result.totalKm);
        setIsActive(true);

        console.log(
          `[ShiftGPS] ${result.speedKmh} km/h | ${result.tripKm.toFixed(3)} km` +
          (isBackgroundRef.current ? ' [bg]' : '')
        );
      },
      (err) => {
        console.warn('[ShiftGPS] Erro GPS:', err.message);
        if (err.code !== err.TIMEOUT) {
          setSpeedKmh(0);
          setIsActive(false);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, []);

  // ── Liga/desliga com base no caixa ────────────────────────────────────────
  useEffect(() => {
    if (isShiftOpen) {
      startGps();
    } else {
      stopGps();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isShiftOpen, startGps, stopGps]);

  // ── Reseta km do turno sem interromper o GPS ──────────────────────────────
  const resetShiftKm = useCallback(() => {
    processorRef.current = resetTripKm(processorRef.current);
    setShiftKm(0);
  }, []);

  return { speedKmh, shiftKm, totalKm, isActive, accuracy, isBackground, isAudioActive, resetShiftKm };
}

/**
 * useShiftGPS.ts — Hodômetro GPS do turno. Nunca para durante o turno.
 *
 * Regras:
 *  - GPS inicia quando caixa abre, para quando fecha — nunca no meio do turno
 *  - Watchdog: se o watcher ficar 45s sem disparar, reinicia preservando os km já acumulados
 *  - Keep-alive (áudio silencioso + Wake Lock) mantém GPS ativo com outro app em foco
 *  - Se GPS parou durante background (raro), estima km pelo tempo × velocidade anterior
 *  - km acumulado = TODO deslocamento real do turno (corridas + sem corrida)
 *  - km do turno é PERSISTIDO no localStorage (chave por ID do turno) —
 *    sobrevive a reloads de página sem zerar o hodômetro
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  gpsProcessorInit,
  processGpsPoint,
  resetTripKm,
  type GpsProcessorState,
} from '../utils/gpsProcessor';
import { useBackgroundKeepAlive } from './useBackgroundKeepAlive';

const GPS_KM_PREFIX   = 'moob_gps_km_'; // + shiftId
const RATE_LIMIT_MS   = 200;            // 5 Hz máximo — economiza bateria/CPU

export interface ShiftGpsData {
  speedKmh: number;
  shiftKm: number;
  totalKm: number;
  isActive: boolean;        // true = GPS recebendo sinal
  isStarting: boolean;      // true = GPS iniciando, ainda sem sinal
  accuracy: number | null;
  isBackground: boolean;
  isAudioActive: boolean;
  resetShiftKm: () => void;
}

export function useShiftGPS(isShiftOpen: boolean, shiftId: string | null = null): ShiftGpsData {
  const [speedKmh, setSpeedKmh]   = useState(0);
  const [shiftKm, setShiftKm]     = useState(0);
  const [totalKm, setTotalKm]     = useState(0);
  const [isActive, setIsActive]   = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [accuracy, setAccuracy]   = useState<number | null>(null);

  const processorRef        = useRef<GpsProcessorState>(gpsProcessorInit());
  const watchIdRef          = useRef<number | null>(null);
  const lastGpsFireRef      = useRef<number>(0);
  const lastProcessedRef    = useRef<number>(0); // rate limiting 5 Hz
  const lastSpeedKmhRef     = useRef(0);
  // Janela deslizante para estimativa de velocidade média em background
  const speedWindowRef      = useRef<number[]>([]);
  const MAX_SPEED_WINDOW    = 5; // últimas 5 leituras válidas
  const gpsUpdatesInBgRef   = useRef(0);
  const isShiftOpenRef      = useRef(false);
  const shiftIdRef          = useRef<string | null>(null);

  useEffect(() => { isShiftOpenRef.current = isShiftOpen; }, [isShiftOpen]);
  useEffect(() => { shiftIdRef.current = shiftId; }, [shiftId]);

  // ── Helpers de persistência de km ────────────────────────────────────────
  const saveKmLocal = useCallback((km: number) => {
    const id = shiftIdRef.current;
    if (id) localStorage.setItem(GPS_KM_PREFIX + id, km.toString());
  }, []);

  const loadKmLocal = useCallback((id: string): number => {
    const raw = localStorage.getItem(GPS_KM_PREFIX + id);
    if (!raw) return 0;
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, []);

  const clearKmLocal = useCallback((id: string | null) => {
    if (id) localStorage.removeItem(GPS_KM_PREFIX + id);
  }, []);

  // ── Keep-alive em segundo plano ──────────────────────────────────────────
  const { isBackground, backgroundSince, isAudioActive } =
    useBackgroundKeepAlive(isShiftOpen);

  const isBackgroundRef    = useRef(false);
  const backgroundSinceRef = useRef<number | null>(null);

  useEffect(() => {
    isBackgroundRef.current    = isBackground;
    backgroundSinceRef.current = backgroundSince;
  }, [isBackground, backgroundSince]);

  // Quando volta ao primeiro plano: estima km se GPS parou no background
  useEffect(() => {
    if (!isBackground && backgroundSince !== null) {
      const elapsedHours = (Date.now() - backgroundSince) / 3_600_000;
      const speed = lastSpeedKmhRef.current;

      if (gpsUpdatesInBgRef.current === 0 && elapsedHours > 0.005 && speed > 3) {
        // Usa a velocidade média da janela deslizante em vez do último valor
        // e aplica fator de correção 0.70 (motorista pode ter parado/desacelerado)
        const win = speedWindowRef.current;
        const avgSpeed = win.length > 0
          ? win.reduce((a, b) => a + b, 0) / win.length
          : speed;
        const CORRECTION = 0.70;
        const estimatedKm = avgSpeed * elapsedHours * CORRECTION;
        processorRef.current = {
          ...processorRef.current,
          tripKm:  processorRef.current.tripKm  + estimatedKm,
          totalKm: processorRef.current.totalKm + estimatedKm,
        };
        setShiftKm(processorRef.current.tripKm);
        setTotalKm(processorRef.current.totalKm);
        saveKmLocal(processorRef.current.tripKm);
        console.log(
          `[ShiftGPS] Estimativa background: +${estimatedKm.toFixed(3)} km` +
          ` (${(elapsedHours * 60).toFixed(1)} min × ${avgSpeed.toFixed(0)} km/h avg × ${CORRECTION})`
        );
      } else {
        console.log(`[ShiftGPS] GPS OK em background — ${gpsUpdatesInBgRef.current} updates.`);
      }
      gpsUpdatesInBgRef.current = 0;
    }
  }, [isBackground, backgroundSince, saveKmLocal]);

  // ── Cria o watchPosition ─────────────────────────────────────────────────
  // preserveKm = true → mantém km já acumulados no processorRef (reload ou watchdog)
  // preserveKm = false → turno novo, zera km
  const attachWatcher = useCallback((preserveKm: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[ShiftGPS] Geolocalização não suportada.');
      return;
    }
    if (watchIdRef.current !== null) return; // já tem watcher

    if (!preserveKm) {
      processorRef.current    = gpsProcessorInit();
      lastSpeedKmhRef.current = 0;
      gpsUpdatesInBgRef.current = 0;
      setShiftKm(0);
      setTotalKm(0);
      setSpeedKmh(0);
      setIsActive(false);
    }

    setIsStarting(true);
    lastGpsFireRef.current = Date.now();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fireTs = pos.timestamp || Date.now();
        lastGpsFireRef.current = fireTs;

        // Rate limiting: 5 Hz máximo — descarta atualizações mais rápidas que 200 ms
        if (fireTs - lastProcessedRef.current < RATE_LIMIT_MS) return;
        lastProcessedRef.current = fireTs;

        const { latitude, longitude, speed, accuracy: acc } = pos.coords;
        const timestamp = fireTs;

        if (isBackgroundRef.current) gpsUpdatesInBgRef.current++;

        setAccuracy(acc);
        setIsStarting(false);

        const result = processGpsPoint(processorRef.current, {
          timestamp, latitude, longitude, speed, accuracy: acc ?? undefined,
        });

        if (result.discarded) return;

        processorRef.current    = result.state;
        lastSpeedKmhRef.current = result.speedKmh;

        // Mantém janela deslizante para estimativa de background
        if (result.speedKmh > 0) {
          const win = speedWindowRef.current;
          win.push(result.speedKmh);
          if (win.length > MAX_SPEED_WINDOW) win.shift();
        }

        setSpeedKmh(result.speedKmh);
        setShiftKm(result.tripKm);
        setTotalKm(result.totalKm);
        setIsActive(true);

        // Persiste km do turno — sobrevive a reloads de página
        saveKmLocal(result.tripKm);

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
          setIsStarting(false);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [saveKmLocal]);

  // ── Para o watcher (sem tocar nos km acumulados) ─────────────────────────
  const detachWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ── Para o GPS e reseta estado visual ───────────────────────────────────
  const stopGps = useCallback((id: string | null) => {
    detachWatcher();
    setIsActive(false);
    setIsStarting(false);
    setSpeedKmh(0);
    // Limpa km salvo — turno encerrado
    clearKmLocal(id);
    console.log('[ShiftGPS] GPS encerrado — caixa fechado.');
  }, [detachWatcher, clearKmLocal]);

  // ── Liga/desliga com base no caixa ───────────────────────────────────────
  useEffect(() => {
    if (isShiftOpen) {
      // Tenta restaurar km persistido de sessão anterior para este turno.
      // Se o ID do turno mudou (novo turno), loadKmLocal retornará 0
      // pois a chave será diferente.
      const savedKm = shiftId ? loadKmLocal(shiftId) : 0;

      if (savedKm > 0) {
        // Reload com turno já em andamento: restaura km acumulado
        processorRef.current = {
          ...gpsProcessorInit(),
          tripKm: savedKm,
          totalKm: savedKm,
        };
        setShiftKm(savedKm);
        setTotalKm(savedKm);
        console.log(`[ShiftGPS] km restaurado do localStorage: ${savedKm.toFixed(3)} km`);
        attachWatcher(true); // preserva o km restaurado
      } else {
        attachWatcher(false); // turno novo — zera km
      }
    } else {
      stopGps(shiftId);
    }
    return () => {
      detachWatcher();
    };
  }, [isShiftOpen, shiftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watchdog: reinicia watcher se ficar 45s sem disparar durante turno ──
  useEffect(() => {
    if (!isShiftOpen) return;

    const WATCHDOG_INTERVAL_MS = 20_000;
    const STALE_THRESHOLD_MS   = 45_000;

    const id = setInterval(() => {
      if (!isShiftOpenRef.current) return;
      const sinceLastFire = Date.now() - lastGpsFireRef.current;
      if (sinceLastFire > STALE_THRESHOLD_MS) {
        console.warn(
          `[ShiftGPS] Watchdog: GPS inativo há ${Math.round(sinceLastFire / 1000)}s — reiniciando.`
        );
        detachWatcher();
        setIsActive(false);
        setIsStarting(true);
        attachWatcher(true); // reinicia preservando km acumulados
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isShiftOpen, attachWatcher, detachWatcher]);

  // ── Reseta km do turno sem interromper o GPS ─────────────────────────────
  const resetShiftKm = useCallback(() => {
    processorRef.current = resetTripKm(processorRef.current);
    setShiftKm(0);
    clearKmLocal(shiftIdRef.current);
  }, [clearKmLocal]);

  return {
    speedKmh, shiftKm, totalKm,
    isActive, isStarting,
    accuracy, isBackground, isAudioActive,
    resetShiftKm,
  };
}

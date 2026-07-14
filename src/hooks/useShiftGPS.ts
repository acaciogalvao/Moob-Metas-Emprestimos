/**
 * useShiftGPS.ts — Hodômetro GPS do turno. Nunca para durante o turno.
 *
 * Regras:
 *  - GPS inicia quando caixa abre, para quando fecha — nunca no meio do turno
 *  - Watchdog: se o watcher ficar 45s sem disparar, reinicia preservando os km já acumulados
 *  - Keep-alive (áudio silencioso + Wake Lock) mantém GPS ativo com outro app em foco
 *  - Se GPS parou durante background (raro), estima km pelo tempo × velocidade anterior
 *  - km acumulado = TODO deslocamento real do turno (corridas + sem corrida)
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
  isActive: boolean;        // true = GPS recebendo sinal
  isStarting: boolean;      // true = GPS iniciando, ainda sem sinal
  accuracy: number | null;
  isBackground: boolean;
  isAudioActive: boolean;
  resetShiftKm: () => void;
}

export function useShiftGPS(isShiftOpen: boolean): ShiftGpsData {
  const [speedKmh, setSpeedKmh]   = useState(0);
  const [shiftKm, setShiftKm]     = useState(0);
  const [totalKm, setTotalKm]     = useState(0);
  const [isActive, setIsActive]   = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [accuracy, setAccuracy]   = useState<number | null>(null);

  const processorRef        = useRef<GpsProcessorState>(gpsProcessorInit());
  const watchIdRef          = useRef<number | null>(null);
  const lastGpsFireRef      = useRef<number>(0);       // epoch ms do último callback
  const lastSpeedKmhRef     = useRef(0);
  const gpsUpdatesInBgRef   = useRef(0);
  const isShiftOpenRef      = useRef(false);           // para uso dentro de callbacks

  useEffect(() => { isShiftOpenRef.current = isShiftOpen; }, [isShiftOpen]);

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
        const estimatedKm = speed * elapsedHours;
        processorRef.current = {
          ...processorRef.current,
          tripKm:  processorRef.current.tripKm  + estimatedKm,
          totalKm: processorRef.current.totalKm + estimatedKm,
        };
        setShiftKm(processorRef.current.tripKm);
        setTotalKm(processorRef.current.totalKm);
        console.log(
          `[ShiftGPS] Estimativa background: +${estimatedKm.toFixed(3)} km` +
          ` (${(elapsedHours * 60).toFixed(1)} min × ${speed.toFixed(0)} km/h)`
        );
      } else {
        console.log(`[ShiftGPS] GPS OK em background — ${gpsUpdatesInBgRef.current} updates.`);
      }
      gpsUpdatesInBgRef.current = 0;
    }
  }, [isBackground, backgroundSince]);

  // ── Cria o watchPosition (interno, chamado por startGps e watchdog) ──────
  // preserveKm = true → mantém km já acumulados (reinício do watchdog)
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
    lastGpsFireRef.current = Date.now(); // evita watchdog disparar antes do primeiro ponto

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // GPS ainda não parou — atualiza timestamp do watchdog
        lastGpsFireRef.current = Date.now();

        const { latitude, longitude, speed, accuracy: acc } = pos.coords;
        const timestamp = pos.timestamp || Date.now();

        if (isBackgroundRef.current) gpsUpdatesInBgRef.current++;

        setAccuracy(acc);
        setIsStarting(false);

        const result = processGpsPoint(processorRef.current, {
          timestamp, latitude, longitude, speed, accuracy: acc ?? undefined,
        });

        if (result.discarded) return;

        processorRef.current    = result.state;
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
          setIsStarting(false);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, []);

  // ── Para o watcher (sem tocar nos km acumulados) ─────────────────────────
  const detachWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ── Para o GPS e reseta estado visual ───────────────────────────────────
  const stopGps = useCallback(() => {
    detachWatcher();
    setIsActive(false);
    setIsStarting(false);
    setSpeedKmh(0);
    console.log('[ShiftGPS] GPS encerrado — caixa fechado.');
  }, [detachWatcher]);

  // ── Liga/desliga com base no caixa ───────────────────────────────────────
  useEffect(() => {
    if (isShiftOpen) {
      attachWatcher(false); // turno novo — zera km
    } else {
      stopGps();
    }
    return () => {
      detachWatcher();
    };
  }, [isShiftOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watchdog: reinicia watcher se ficar 45s sem disparar durante turno ──
  useEffect(() => {
    if (!isShiftOpen) return;

    const WATCHDOG_INTERVAL_MS = 20_000; // checa a cada 20s
    const STALE_THRESHOLD_MS   = 45_000; // considera morto após 45s sem sinal

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
  }, []);

  return {
    speedKmh, shiftKm, totalKm,
    isActive, isStarting,
    accuracy, isBackground, isAudioActive,
    resetShiftKm,
  };
}

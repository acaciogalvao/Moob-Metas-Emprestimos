/**
 * useBackgroundKeepAlive.ts
 *
 * Impede que o Android/Chrome suspenda a aba em segundo plano enquanto o
 * GPS estiver ativo. Usa três técnicas em camadas:
 *
 * 1. AudioContext silencioso (principal)
 *    Faz o Chrome tratar a aba como "aba de mídia ativa". O Android dá mais
 *    tempo de CPU para abas com áudio, o que mantém os callbacks de GPS
 *    disparando mesmo com Uber/99 em primeiro plano.
 *
 * 2. Wake Lock de tela (suporte)
 *    Solicita ao SO que não durma o processo. Ajuda em alguns dispositivos.
 *
 * 3. Ping no Service Worker (camada extra)
 *    A aba pinga o SW a cada 15s. O SW responde, criando um round-trip que
 *    sinaliza ao runtime que há trabalho pendente e evita que a aba seja
 *    congelada.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface KeepAliveState {
  isBackground: boolean;
  backgroundSince: number | null;
  isAudioActive: boolean;
}

export function useBackgroundKeepAlive(enabled: boolean): KeepAliveState {
  const [isBackground, setIsBackground]     = useState(false);
  const [backgroundSince, setBackgroundSince] = useState<number | null>(null);
  const [isAudioActive, setIsAudioActive]   = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const oscillatorRef  = useRef<OscillatorNode | null>(null);
  const gainRef        = useRef<GainNode | null>(null);
  const wakeLockRef    = useRef<WakeLockSentinel | null>(null);
  const swPingRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Áudio silencioso ──────────────────────────────────────────────────────
  const startSilentAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001; // quase zero — não silencia completamente para evitar otimização do browser
      osc.frequency.value = 1;  // 1 Hz — fora do range audível de testes
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioCtxRef.current   = ctx;
      oscillatorRef.current = osc;
      gainRef.current       = gain;
      setIsAudioActive(true);
      console.log('[KeepAlive] Áudio silencioso ativo — aba marcada como mídia.');
    } catch (e) {
      console.warn('[KeepAlive] AudioContext indisponível:', e);
    }
  }, []);

  const stopSilentAudio = useCallback(() => {
    try { oscillatorRef.current?.stop(); } catch (_) {}
    try { audioCtxRef.current?.close(); } catch (_) {}
    audioCtxRef.current   = null;
    oscillatorRef.current = null;
    gainRef.current       = null;
    setIsAudioActive(false);
  }, []);

  // Retoma contexto de áudio se o browser o suspendeu (ex: tab voltou ao foco)
  const resumeAudioIfSuspended = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }, []);

  // ── Wake Lock ─────────────────────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      console.log('[KeepAlive] Wake Lock concedido.');
    } catch (_) {
      console.warn('[KeepAlive] Wake Lock negado (normal em alguns dispositivos).');
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch (_) {}
    wakeLockRef.current = null;
  }, []);

  // ── Ping no Service Worker ────────────────────────────────────────────────
  const startSwPing = useCallback(() => {
    if (swPingRef.current) return;
    swPingRef.current = setInterval(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE_PING' });
      }
    }, 15_000);
  }, []);

  const stopSwPing = useCallback(() => {
    if (swPingRef.current) {
      clearInterval(swPingRef.current);
      swPingRef.current = null;
    }
  }, []);

  // ── Monitoramento de visibilidade ─────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsBackground(hidden);

      if (hidden) {
        setBackgroundSince(Date.now());
        console.log('[KeepAlive] App foi para segundo plano — GPS continua ativo.');
      } else {
        // Voltou ao primeiro plano
        setBackgroundSince(null);
        resumeAudioIfSuspended();
        if (enabled) requestWakeLock(); // reobter se o SO liberou durante background
        console.log('[KeepAlive] App voltou para primeiro plano.');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, requestWakeLock, resumeAudioIfSuspended]);

  // ── Liga/desliga tudo com base em `enabled` ───────────────────────────────
  useEffect(() => {
    if (enabled) {
      startSilentAudio();
      requestWakeLock();
      startSwPing();
    } else {
      stopSilentAudio();
      releaseWakeLock();
      stopSwPing();
      setIsBackground(false);
      setBackgroundSince(null);
    }
    return () => {
      stopSilentAudio();
      releaseWakeLock();
      stopSwPing();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isBackground, backgroundSince, isAudioActive };
}

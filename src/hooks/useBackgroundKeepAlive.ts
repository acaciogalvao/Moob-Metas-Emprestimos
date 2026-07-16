/**
 * useBackgroundKeepAlive.ts
 *
 * Impede que o Android/Chrome suspenda a aba em segundo plano enquanto o
 * GPS estiver ativo. Usa quatro técnicas em camadas:
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
 *    A aba pinga o SW a cada 15 s. O SW responde, criando um round-trip que
 *    sinaliza ao runtime que há trabalho pendente e evita que a aba seja
 *    congelada.
 *
 * 4. WebRTC loopback (fallback)
 *    Um par de RTCPeerConnections locais (sem servidor STUN) mantém um canal
 *    de dados ativo. O Chrome marca abas com RTC ativo como "relevantes",
 *    dando prioridade de CPU equivalente a uma chamada de vídeo em andamento.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface KeepAliveState {
  isBackground:   boolean;
  backgroundSince: number | null;
  isAudioActive:  boolean;
  webRtcActive:   boolean;
  /** Diagnóstico de cada camada — útil para debug/log */
  tierStatus: {
    audio:    boolean;
    wakeLock: boolean;
    swPing:   boolean;
    webRtc:   boolean;
  };
}

export function useBackgroundKeepAlive(enabled: boolean): KeepAliveState {
  const [isBackground, setIsBackground]       = useState(false);
  const [backgroundSince, setBackgroundSince] = useState<number | null>(null);
  const [isAudioActive, setIsAudioActive]     = useState(false);
  const [webRtcActive, setWebRtcActive]       = useState(false);
  const [tierWakeLock, setTierWakeLock]       = useState(false);
  const [tierSwPing, setTierSwPing]           = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const oscillatorRef  = useRef<OscillatorNode | null>(null);
  const gainRef        = useRef<GainNode | null>(null);
  const wakeLockRef    = useRef<WakeLockSentinel | null>(null);
  const swPingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtcPc1Ref      = useRef<RTCPeerConnection | null>(null);
  const rtcPc2Ref      = useRef<RTCPeerConnection | null>(null);

  // ── 1. Áudio silencioso ───────────────────────────────────────────────────
  const startSilentAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const Ctx = window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx  = new Ctx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value   = 0.001; // quase zero — não silencia para evitar otimização do browser
      osc.frequency.value = 1;   // 1 Hz — fora do range audível de testes
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioCtxRef.current   = ctx;
      oscillatorRef.current = osc;
      gainRef.current       = gain;
      setIsAudioActive(true);
      console.log('[KeepAlive] Camada 1: áudio silencioso ativo.');
    } catch (e) {
      console.warn('[KeepAlive] AudioContext indisponível:', e);
    }
  }, []);

  const stopSilentAudio = useCallback(() => {
    try { oscillatorRef.current?.stop(); } catch (_) {}
    try { audioCtxRef.current?.close();  } catch (_) {}
    audioCtxRef.current   = null;
    oscillatorRef.current = null;
    gainRef.current       = null;
    setIsAudioActive(false);
  }, []);

  const resumeAudioIfSuspended = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, []);

  // ── 2. Wake Lock ──────────────────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as Navigator & {
        wakeLock: { request(t: string): Promise<WakeLockSentinel> };
      }).wakeLock.request('screen');
      setTierWakeLock(true);
      console.log('[KeepAlive] Camada 2: Wake Lock concedido.');
    } catch (_) {
      setTierWakeLock(false);
      console.warn('[KeepAlive] Wake Lock negado (normal em alguns dispositivos).');
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch (_) {}
    wakeLockRef.current = null;
    setTierWakeLock(false);
  }, []);

  // ── 3. Ping no Service Worker ─────────────────────────────────────────────
  const startSwPing = useCallback(() => {
    if (swPingRef.current) return;
    swPingRef.current = setInterval(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE_PING' });
      }
    }, 15_000);
    setTierSwPing(true);
    console.log('[KeepAlive] Camada 3: SW ping ativo (15 s).');
  }, []);

  const stopSwPing = useCallback(() => {
    if (swPingRef.current) {
      clearInterval(swPingRef.current);
      swPingRef.current = null;
    }
    setTierSwPing(false);
  }, []);

  // ── 4. WebRTC loopback ────────────────────────────────────────────────────
  const startWebRtc = useCallback(async () => {
    if (rtcPc1Ref.current) return;
    try {
      const pc1 = new RTCPeerConnection();
      const pc2 = new RTCPeerConnection();

      // Troca de ICE candidates entre os dois peers locais
      pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
      pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };

      // Canal de dados — basta existir para manter a conexão ativa
      pc1.createDataChannel('moob-keepalive');

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      rtcPc1Ref.current = pc1;
      rtcPc2Ref.current = pc2;
      setWebRtcActive(true);
      console.log('[KeepAlive] Camada 4: WebRTC loopback ativo.');
    } catch (e) {
      console.warn('[KeepAlive] WebRTC loopback falhou (sem suporte?):', e);
    }
  }, []);

  const stopWebRtc = useCallback(() => {
    try { rtcPc1Ref.current?.close(); } catch (_) {}
    try { rtcPc2Ref.current?.close(); } catch (_) {}
    rtcPc1Ref.current = null;
    rtcPc2Ref.current = null;
    setWebRtcActive(false);
  }, []);

  // ── Monitoramento de visibilidade ─────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsBackground(hidden);

      if (hidden) {
        setBackgroundSince(Date.now());
        console.log('[KeepAlive] App em segundo plano — todas as camadas ativas.');
      } else {
        setBackgroundSince(null);
        resumeAudioIfSuspended();
        if (enabled) requestWakeLock();
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
      startWebRtc();
    } else {
      stopSilentAudio();
      releaseWakeLock();
      stopSwPing();
      stopWebRtc();
      setIsBackground(false);
      setBackgroundSince(null);
    }
    return () => {
      stopSilentAudio();
      releaseWakeLock();
      stopSwPing();
      stopWebRtc();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isBackground,
    backgroundSince,
    isAudioActive,
    webRtcActive,
    tierStatus: {
      audio:    isAudioActive,
      wakeLock: tierWakeLock,
      swPing:   tierSwPing,
      webRtc:   webRtcActive,
    },
  };
}

/**
 * useWakeLock.ts — Hook for Screen Wake Lock management.
 *
 * Melhorias:
 *  - Auto-release após 5 min em segundo plano (poupa bateria)
 *  - Re-aquire automático ao voltar ao primeiro plano
 */

import { useState, useEffect, useRef } from 'react';

const BG_AUTO_RELEASE_MS = 5 * 60 * 1000; // 5 minutos

export function useWakeLock() {
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [wakeLockEnabled, setWakeLockEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('moob_wake_lock_enabled') === 'true';
    }
    return false;
  });

  const wakeLockRef        = useRef<WakeLockSentinel | null>(null);
  const wakeLockEnabledRef = useRef<boolean>(false);
  const bgTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    wakeLockEnabledRef.current = wakeLockEnabled;
  }, [wakeLockEnabled]);

  const requestWakeLock = async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!wakeLockRef.current) {
        wakeLockRef.current = await (navigator as Navigator & {
          wakeLock: { request(t: string): Promise<WakeLockSentinel> };
        }).wakeLock.request('screen');
        setIsWakeLockActive(true);
        console.log('[WakeLock] Adquirido com sucesso.');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] Liberado pelo sistema operacional.');
          wakeLockRef.current = null;
          setIsWakeLockActive(false);
        });
      }
    } catch (err) {
      console.warn('[WakeLock] Falha ao adquirir:', err);
      setIsWakeLockActive(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        console.log('[WakeLock] Liberado manualmente.');
      } catch (err) {
        console.error('[WakeLock] Erro ao liberar:', err);
      }
    }
  };

  // ── Auto-release em background + reaquire ao voltar ─────────────────────
  useEffect(() => {
    const clearBgTimer = () => {
      if (bgTimerRef.current !== null) {
        clearTimeout(bgTimerRef.current);
        bgTimerRef.current = null;
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Iniciar contagem: libera lock após 5 min de background
        if (wakeLockEnabledRef.current && wakeLockRef.current) {
          bgTimerRef.current = setTimeout(async () => {
            await releaseWakeLock();
            console.log('[WakeLock] Auto-release após 5 min em background.');
          }, BG_AUTO_RELEASE_MS);
        }
      } else {
        // Voltou ao primeiro plano: cancela timer e reaquire se habilitado
        clearBgTimer();
        if (wakeLockEnabledRef.current) {
          await requestWakeLock();
        }
      }
    };

    const handleInteraction = async () => {
      if (wakeLockEnabledRef.current && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    if (wakeLockEnabled) {
      requestWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click',       handleInteraction, { passive: true });
    window.addEventListener('touchstart',  handleInteraction, { passive: true });

    return () => {
      clearBgTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click',      handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isWakeLockActive,
    wakeLockEnabled,
    setWakeLockEnabled,
    requestWakeLock,
    releaseWakeLock,
  };
}

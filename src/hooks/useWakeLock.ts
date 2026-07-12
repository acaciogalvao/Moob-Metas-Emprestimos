/**
 * useWakeLock.ts — Hook for Screen Wake Lock management.
 */

import { useState, useEffect, useRef } from 'react';

export function useWakeLock() {
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [wakeLockEnabled, setWakeLockEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('moob_wake_lock_enabled') === 'true';
    }
    return false;
  });
  const wakeLockRef = useRef<any>(null);
  const wakeLockEnabledRef = useRef<boolean>(false);

  // Sync ref
  useEffect(() => {
    wakeLockEnabledRef.current = wakeLockEnabled;
  }, [wakeLockEnabled]);

  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setIsWakeLockActive(true);
          console.log('[WakeLock] Screen Wake Lock acquired successfully');
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[WakeLock] Screen Wake Lock was released by the browser');
            wakeLockRef.current = null;
            setIsWakeLockActive(false);
          });
        }
      } catch (err) {
        console.warn('[WakeLock] Wake Lock request failed:', err);
        setIsWakeLockActive(false);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        console.log('[WakeLock] Screen Wake Lock released manually');
      } catch (err) {
        console.error('[WakeLock] Wake Lock release error:', err);
      }
    }
  };

  // Attempt to lock screen on mount, touch, and visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockEnabledRef.current) {
        await requestWakeLock();
      }
    };

    const handleInteraction = async () => {
      if (wakeLockEnabledRef.current && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    // If enabled initially, request lock
    if (wakeLockEnabled) {
      requestWakeLock();
    }

    // Event listeners to handle user interaction and visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      releaseWakeLock();
    };
  }, []);

  return {
    isWakeLockActive,
    wakeLockEnabled,
    setWakeLockEnabled,
    requestWakeLock,
    releaseWakeLock,
  };
}

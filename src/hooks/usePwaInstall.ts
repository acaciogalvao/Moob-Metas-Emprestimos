/**
 * usePwaInstall.ts — Hook for PWA install prompt management.
 */

import { useState, useEffect } from 'react';

export function usePwaInstall() {
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
      console.log('[PWA] Evento beforeinstallprompt capturado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] Usuário aceitou instalar o aplicativo.');
          setPwaPrompt(null);
        } else {
          console.log('[PWA] Usuário cancelou a instalação.');
        }
      });
    }
  };

  return { pwaPrompt, handleInstallPWA };
}

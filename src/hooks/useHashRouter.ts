/**
 * useHashRouter.ts
 * Sincroniza a aba ativa do sistema com o hash da URL (#caixa, #historico, etc.)
 * para que o botão "voltar" do navegador/PWA funcione corretamente e os links
 * possam apontar para seções específicas do app.
 */

import { useEffect } from 'react';

type SystemTab = 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina';

const VALID_TABS: SystemTab[] = ['caixa', 'historico', 'viagem', 'metas', 'oficina'];

function parseHash(): SystemTab | null {
  const hash = window.location.hash.replace('#', '') as SystemTab;
  return VALID_TABS.includes(hash) ? hash : null;
}

export function useHashRouter(
  systemTab: SystemTab,
  setSystemTab: (tab: SystemTab) => void,
) {
  // Na montagem: lê o hash inicial e define a aba correspondente
  useEffect(() => {
    const tab = parseHash();
    if (tab && tab !== systemTab) {
      setSystemTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando a aba muda: atualiza o hash sem criar entrada no histórico
  useEffect(() => {
    const current = window.location.hash.replace('#', '');
    if (current !== systemTab) {
      window.history.replaceState(null, '', `#${systemTab}`);
    }
  }, [systemTab]);

  // Escuta o evento hashchange (botão voltar/avançar)
  useEffect(() => {
    const handler = () => {
      const tab = parseHash();
      if (tab) setSystemTab(tab);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [setSystemTab]);
}

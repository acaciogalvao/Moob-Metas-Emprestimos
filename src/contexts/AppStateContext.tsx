/**
 * AppStateContext.tsx
 * Expõe o estado global do app via Context API.
 *
 * Por que Context e não prop drilling?
 * AppShell passava 15+ props para ShiftControl, QuickRegister, etc.
 * Com o Context, qualquer componente filho pode consumir o estado diretamente
 * via `useAppStateContext()` sem precisar receber cada prop individualmente.
 *
 * Como usar:
 *   import { useAppStateContext } from '../contexts/AppStateContext';
 *   const { activeShift, handleAddTransaction } = useAppStateContext();
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAppState } from '../hooks/useAppState';

type AppStateValue = ReturnType<typeof useAppState>;

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  return (
    <AppStateContext.Provider value={state}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Hook para consumir o estado global. Deve ser usado dentro de AppStateProvider.
 */
export function useAppStateContext(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppStateContext deve ser usado dentro de <AppStateProvider>.');
  }
  return ctx;
}

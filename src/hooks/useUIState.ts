/**
 * useUIState.ts — Estado puro de UI extraído de useAppState.
 * Sem dependências de outros hooks — apenas estado local + localStorage.
 */

import { useState, useEffect } from 'react';
import { Shift, PeriodFilter } from '../types';

export type SystemTab = 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina';
export type ActiveTab  = 'REGISTER' | 'ANALYTICS';

export function useUIState() {
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<Shift | null>(null);
  const [periodFilter, setPeriodFilter]   = useState<PeriodFilter>('TOTAL');

  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    (localStorage.getItem('moob_active_tab') as ActiveTab) || 'REGISTER'
  );

  const [systemTab, setSystemTab] = useState<SystemTab>(() =>
    (localStorage.getItem('moob_system_tab') as SystemTab) || 'caixa'
  );

  const [excludeSundays, setExcludeSundays] = useState<boolean>(
    () => localStorage.getItem('moob_caixa_exclude_sundays') === 'true'
  );

  const [draftFuelLiters, setDraftFuelLiters] = useState<number>(0);
  const [liveFuelLevel, setLiveFuelLevel]     = useState<number | null>(null);

  // Persiste tabs
  useEffect(() => { localStorage.setItem('moob_active_tab',  activeTab);  }, [activeTab]);
  useEffect(() => { localStorage.setItem('moob_system_tab',  systemTab);  }, [systemTab]);

  const handleToggleExcludeSundays = () => {
    setExcludeSundays(prev => {
      const next = !prev;
      localStorage.setItem('moob_caixa_exclude_sundays', String(next));
      return next;
    });
  };

  return {
    selectedShiftForReport, setSelectedShiftForReport,
    periodFilter,           setPeriodFilter,
    activeTab,              setActiveTab,
    systemTab,              setSystemTab,
    excludeSundays,         handleToggleExcludeSundays,
    draftFuelLiters,        setDraftFuelLiters,
    liveFuelLevel,          setLiveFuelLevel,
  };
}

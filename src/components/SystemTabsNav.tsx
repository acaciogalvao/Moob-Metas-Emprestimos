/**
 * SystemTabsNav.tsx — System tab switcher (Caixa / Histórico / Metas / Oficina).
 */

import React from 'react';
import { Coins, FolderArchive, Target, Wrench } from 'lucide-react';
import { playBeep } from '../utils/audio';

interface SystemTabsNavProps {
  systemTab: 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina';
  onSetSystemTab: (tab: 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina') => void;
}

const TABS = [
  { id: 'caixa',    label: 'Caixa',     Icon: Coins,          activeColor: 'amber' },
  { id: 'historico',label: 'Histórico', Icon: FolderArchive,  activeColor: 'amber' },
  { id: 'metas',    label: 'Metas',     Icon: Target,         activeColor: 'amber' },
  { id: 'oficina',  label: 'Oficina',   Icon: Wrench,         activeColor: 'orange' },
] as const;

export function SystemTabsNav({ systemTab, onSetSystemTab }: SystemTabsNavProps) {
  return (
    <nav aria-label="Navegação principal">
      <div
        role="tablist"
        className="flex p-1 rounded-2xl gap-1 border border-slate-800/60"
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.90) 0%, rgba(10,12,20,0.95) 100%)' }}
      >
        {TABS.map(({ id, label, Icon, activeColor }) => {
          const isActive = systemTab === id;
          const isOfficina = id === 'oficina';
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => { playBeep(); onSetSystemTab(id); }}
              className={`relative flex-1 py-2.5 px-1.5 text-[11px] font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive
                  ? isOfficina
                    ? 'text-slate-950 shadow-md'
                    : 'text-slate-950 shadow-md'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={isActive ? {
                background: isOfficina
                  ? 'linear-gradient(135deg, #f97316, #ea580c)'
                  : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                boxShadow: isOfficina
                  ? '0 2px 12px rgba(249,115,22,0.35), 0 1px 3px rgba(0,0,0,0.3)'
                  : '0 2px 12px rgba(251,191,36,0.35), 0 1px 3px rgba(0,0,0,0.3)',
              } : undefined}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-black tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

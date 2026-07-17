/**
 * CaixaSubTabNav.tsx
 * Sub-navegação da aba Caixa: alterna entre "Caixa" e "Demonstrativos".
 */

import React from 'react';
import { LayoutGrid, BarChart2 } from 'lucide-react';
import { playBeep } from '../utils/audio';

type ActiveTab = 'REGISTER' | 'ANALYTICS';

interface CaixaSubTabNavProps {
  activeTab: ActiveTab;
  onSetActiveTab: (tab: ActiveTab) => void;
}

export function CaixaSubTabNav({ activeTab, onSetActiveTab }: CaixaSubTabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Visualização do Caixa"
      className="flex mt-1 rounded-xl p-1 gap-1 border border-slate-800/60"
      style={{ background: 'rgba(15,23,42,0.70)' }}
    >
      {([
        { id: 'REGISTER',  label: 'Caixa',          Icon: LayoutGrid },
        { id: 'ANALYTICS', label: 'Demonstrativos',  Icon: BarChart2  },
      ] as const).map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${id.toLowerCase()}`}
            id={`tab-${id.toLowerCase()}`}
            onClick={() => { playBeep(); onSetActiveTab(id); }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer ${
              isActive
                ? 'text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={isActive ? {
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              boxShadow: '0 2px 10px rgba(251,191,36,0.30)',
            } : undefined}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-black tracking-wider uppercase text-[10px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

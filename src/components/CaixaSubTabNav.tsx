/**
 * CaixaSubTabNav.tsx
 * Sub-navegação da aba Caixa: alterna entre "Caixa" e "Demonstrativos".
 * Extraído de AppShell para manter o componente principal focado em layout.
 */

import React from 'react';
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
      className="flex mt-3 bg-slate-900 rounded-xl p-1 gap-1 border border-slate-800/80"
    >
      <button
        role="tab"
        aria-selected={activeTab === 'REGISTER'}
        aria-controls="panel-register"
        id="tab-register"
        onClick={() => { playBeep(); onSetActiveTab('REGISTER'); }}
        className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
          activeTab === 'REGISTER'
            ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        📟 Caixa
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'ANALYTICS'}
        aria-controls="panel-analytics"
        id="tab-analytics"
        onClick={() => { playBeep(); onSetActiveTab('ANALYTICS'); }}
        className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
          activeTab === 'ANALYTICS'
            ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        📊 Demonstrativos
      </button>
    </div>
  );
}

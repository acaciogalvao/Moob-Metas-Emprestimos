/**
 * SystemTabsNav.tsx — System tab switcher (Caixa / Histórico / Metas / Viagem).
 */

import React from 'react';
import { Coins, FolderArchive, Target, Wrench } from 'lucide-react';
import { playBeep } from '../utils/audio';

interface SystemTabsNavProps {
  systemTab: 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina';
  onSetSystemTab: (tab: 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina') => void;
}

export function SystemTabsNav({ systemTab, onSetSystemTab }: SystemTabsNavProps) {
  return (
    <nav aria-label="Navegação principal">
      <div
        role="tablist"
        className="flex bg-slate-900/60 backdrop-blur-md p-1 border border-slate-800/80 rounded-xl w-full items-center justify-between shadow-lg gap-1"
      >
        <button
          role="tab"
          aria-selected={systemTab === 'caixa'}
          aria-label="Caixa"
          onClick={() => { playBeep(); onSetSystemTab('caixa'); }}
          className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            systemTab === 'caixa'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" aria-hidden="true" />
          Caixa
        </button>
        <button
          role="tab"
          aria-selected={systemTab === 'historico'}
          aria-label="Histórico"
          onClick={() => { playBeep(); onSetSystemTab('historico'); }}
          className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            systemTab === 'historico'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" aria-hidden="true" />
          Histórico
        </button>
        <button
          role="tab"
          aria-selected={systemTab === 'metas'}
          aria-label="Metas e Empréstimos"
          onClick={() => { playBeep(); onSetSystemTab('metas'); }}
          className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            systemTab === 'metas'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" aria-hidden="true" />
          Metas
        </button>
        <button
          role="tab"
          aria-selected={systemTab === 'oficina'}
          aria-label="Oficina"
          onClick={() => { playBeep(); onSetSystemTab('oficina'); }}
          className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            systemTab === 'oficina'
              ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/10 font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
          Oficina
        </button>
      </div>
    </nav>
  );
}

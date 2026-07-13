/**
 * CaixaDashboardHeader.tsx — Welcome/tip message card for the Caixa dashboard.
 */

import React from 'react';
import { motion } from 'motion/react';
import { Info, RotateCcw } from 'lucide-react';

interface CaixaDashboardHeaderProps {
  showWelcomeMsg: boolean;
  onShowWelcomeMsg: (show: boolean) => void;
  onFactoryReset: () => void;
}

export function CaixaDashboardHeader({
  showWelcomeMsg,
  onShowWelcomeMsg,
  onFactoryReset,
}: CaixaDashboardHeaderProps) {
  if (showWelcomeMsg) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md"
      >
        <div className="flex gap-2.5">
          <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg mt-0.5 shrink-0">
            <Info className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide">
              Controle de Caixa Profissional Uber & 99 (Alta Densidade)
            </h4>
            <p className="text-[14.5px] text-slate-400 mt-0.5 max-w-4xl leading-relaxed">
              Fluxo financeiro rápido de faturamento integrado para motoristas de aplicativo. Compare faturamento diário,
              gerencie despesas por categoria, audite quebras de dinheiro físico no bolso e emita recibos térmicos em PDF de forma prática.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={onFactoryReset}
            title="Limpar todos os dados do turno atual para reiniciar do zero"
            className="text-[14px] flex items-center gap-1 font-mono text-slate-400 hover:text-white py-1 px-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all bg-slate-950/40 font-bold"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar
          </button>
          <button
            onClick={() => onShowWelcomeMsg(false)}
            className="text-[14px] text-slate-350 hover:text-white font-bold bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-all"
          >
            Dispensar
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex justify-end -mt-1.5 -mb-1">
      <button
        onClick={() => onShowWelcomeMsg(true)}
        className="text-[14px] text-amber-500 hover:text-amber-400 font-bold bg-slate-900 border border-slate-800 hover:border-slate-750 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm"
      >
        <Info className="w-3.5 h-3.5" />
        Abrir Painel de Instruções
      </button>
    </div>
  );
}

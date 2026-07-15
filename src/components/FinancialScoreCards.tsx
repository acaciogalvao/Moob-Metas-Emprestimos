/**
 * FinancialScoreCards.tsx — Financial score cards grid for the Caixa dashboard.
 */

import React from 'react';
import { Shift } from '../types';
import { formatBRL, formatDecimalBRL } from '../utils/format';
import { computeFinancialTotals, computeMonthlyGoalMath } from '../utils/financialCalculations';

interface FinancialScoreCardsProps {
  financialTotals: ReturnType<typeof computeFinancialTotals>;
  monthlyGoalMath: ReturnType<typeof computeMonthlyGoalMath>;
  faturamentoPosDespesas: number;
  activeShift: Shift | null;
  excludeSundays: boolean;
  onToggleExcludeSundays: (next: boolean) => void;
}

export function FinancialScoreCards({
  financialTotals,
  monthlyGoalMath,
  faturamentoPosDespesas,
  activeShift,
  excludeSundays,
  onToggleExcludeSundays,
}: FinancialScoreCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2" id="dashboard-general-scores">
      {/* Score 1: Faturamento Bruto Real */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-emerald-400 font-bold uppercase tracking-wider block" title="Valores ofertados pelo App">Faturamento Bruto Real</span>
        <div className="mt-1 text-lg font-black font-mono text-emerald-400 tracking-tight leading-normal">
          {formatBRL(financialTotals.totalValoresOfertados)}
        </div>
        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-250 inline-block" />
              Uber:
            </span>
            <strong className="text-white font-bold">{financialTotals.uberRidesCount} corr.</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              99 App:
            </span>
            <strong className="text-amber-400 font-bold">{financialTotals.ninetyNineRidesCount} corr.</strong>
          </div>
          {financialTotals.particularRidesCount > 0 && (
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Particular:
              </span>
              <strong className="text-emerald-400 font-bold">{financialTotals.particularRidesCount} corr.</strong>
            </div>
          )}
          <div className="text-[11px] text-slate-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
            Valor bruto total entrado no turno (Uber, 99 e particulares em Pix/Dinheiro)
          </div>
        </div>
      </div>

      {/* Score 2: Faturamento Real Pós Despesas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-cyan-400 font-bold uppercase tracking-wider block" title="Valor pago pelo passageiro + Extra - Despesas do turno">Faturamento Pós Despesas</span>
        <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${faturamentoPosDespesas >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
          {formatBRL(faturamentoPosDespesas)}
        </div>
        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between text-slate-400">
            <span>Ofertado + Extra:</span>
            <span className="text-emerald-400 font-semibold">R$ {formatDecimalBRL(financialTotals.totalValoresOfertados + financialTotals.totalValoresExtras)}</span>
          </div>
          <div className="flex justify-between text-slate-400 font-sans">
            <span>Despesas op.:</span>
            <span className="text-rose-450 font-bold">-R$ {formatDecimalBRL(financialTotals.despesasTotais)}</span>
          </div>
        </div>
      </div>

      {/* Saldos dos Apps (Uber + 99) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-violet-400 font-bold uppercase tracking-wider block" title="Saldo acumulado nas carteiras digitais dos aplicativos">Saldos dos Apps</span>
        <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${(financialTotals.uberBalance + financialTotals.ninetyNineBalance) >= 0 ? 'text-violet-400' : 'text-rose-400'}`}>
          {formatBRL(financialTotals.uberBalance + financialTotals.ninetyNineBalance)}
        </div>
        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
            <span className={`font-bold ${financialTotals.uberBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.uberBalance)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
            <span className={`font-bold ${financialTotals.ninetyNineBalance >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.ninetyNineBalance)}</span>
          </div>
          <div className="text-[11px] text-violet-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
            Saldo líquido nas carteiras digitais
          </div>
        </div>
      </div>

      {/* Score 3: Lucro Extra */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-amber-400 font-bold uppercase tracking-wider block" title="O que você está ganhando em cima do que o passageiro pagou para a plataforma">Lucro Extra</span>
        <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal">
          {formatBRL(financialTotals.totalValoresExtras)}
        </div>
        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
            <span className="font-bold text-white">R$ {formatDecimalBRL(financialTotals.valoresExtrasUber)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
            <span className="font-bold text-amber-400">R$ {formatDecimalBRL(financialTotals.valoresExtras99)}</span>
          </div>
          {financialTotals.valoresExtrasParticular > 0 && (
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Particular:</span>
              <span className="font-bold text-emerald-400">R$ {formatDecimalBRL(financialTotals.valoresExtrasParticular)}</span>
            </div>
          )}
          <div className="flex justify-between text-amber-500 font-bold border-t border-slate-800/40 pt-1.5 mt-0.5">
            <span className="font-sans">Adicional Total:</span>
            <span>+{financialTotals.totalValoresOfertados > 0 ? ((financialTotals.totalValoresExtras / financialTotals.totalValoresOfertados) * 100).toFixed(0) : '0'}%</span>
          </div>
        </div>
      </div>

      {/* Score 5: Progresso da Meta de Faturamento Real (Goal Tracker) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-[12.5px] text-amber-500 font-bold uppercase tracking-wider block">Progresso Meta</span>
          <span className="text-[12px] text-slate-500 font-mono font-bold">🎯 R$ {formatDecimalBRL(monthlyGoalMath.monthlyGoal)}</span>
        </div>
        <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal flex items-center justify-between">
          <div>
            {monthlyGoalMath.progressPct.toFixed(0)}%
            <span className="text-[14px] text-slate-400 font-sans font-normal ml-1">da diária</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextVal = !excludeSundays;
              onToggleExcludeSundays(nextVal);
              localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
            }}
            className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
              excludeSundays
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title={excludeSundays ? "Calculando sem contar domingos" : "Calculando contando domingos"}
          >
            {excludeSundays ? 'Sem Domingos' : 'Com Domingos'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 rounded-full h-1 mt-1 overflow-hidden">
          <div
            className="bg-amber-500 h-1 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, monthlyGoalMath.progressPct)}%` }}
          />
        </div>

        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-rose-400 font-bold">Falta:</span>
            <strong className={`font-black font-mono ${monthlyGoalMath.faltaParaMeta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {monthlyGoalMath.faltaParaMeta <= 0 ? '✅ Meta atingida!' : `R$ ${formatDecimalBRL(monthlyGoalMath.faltaParaMeta)}`}
            </strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Feito:</span>
            <strong className="text-white font-bold">R$ {formatDecimalBRL(monthlyGoalMath.accumulatedMonthlyFaturamento)}</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Meta diária:</span>
            <strong className="text-slate-300 font-bold">R$ {formatDecimalBRL(monthlyGoalMath.dailyGoal)}</strong>
          </div>
        </div>
      </div>

      {/* Score 6: Despesas Totais */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-rose-500 font-bold uppercase tracking-wider block">Despesas Totais</span>
        <div className="mt-1 text-lg font-black font-mono text-rose-400 tracking-tight leading-normal">
          {formatBRL(financialTotals.despesasTotais)}
        </div>
        <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
          <div className="flex justify-between text-slate-400">
            <span>Registros:</span>
            <span className="font-bold text-white">{financialTotals.expensesCount} lanç.</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Proporção:</span>
            <span className="text-rose-450 font-bold">-{financialTotals.faturamentoBruto > 0 ? `${Math.round((financialTotals.despesasTotais / financialTotals.faturamentoBruto) * 100)}%` : '0%'}</span>
          </div>
          <span className="text-[11px] text-rose-450 font-sans mt-1">Deduzido do caixa geral</span>
        </div>
      </div>

      {/* Corridas por Plataforma */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-teal-400 font-bold uppercase tracking-wider block">Corridas / Plataforma</span>
        <div className="mt-1 text-lg font-black font-mono text-teal-400 tracking-tight leading-normal">
          {financialTotals.ridesCount} <span className="text-[13px] font-sans font-normal text-slate-500">corridas</span>
        </div>
        <div className="text-[12px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
            <span className="text-white font-black">{financialTotals.uberRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.uberPercent.toFixed(0)}%)</span></span>
          </div>
          <div className="flex justify-between items-center text-amber-500">
            <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
            <span className="font-black text-amber-400">{financialTotals.ninetyNineRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.ninetyNinePercent.toFixed(0)}%)</span></span>
          </div>
          <div className="flex justify-between items-center text-slate-500 font-sans mt-0.5 border-t border-slate-800/20 pt-0.5">
            <span>Média/corr.:</span>
            <span className="text-slate-300 font-medium font-mono">{formatBRL(financialTotals.avgRide)}</span>
          </div>
        </div>
      </div>

      {/* Score 9: KM Rodados & Fora das Plataformas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
        <span className="text-[12.5px] text-indigo-400 font-bold uppercase tracking-wider block" title="Total de quilômetros rodados no turno e o quanto foi fora dos aplicativos">KM Rodados no Turno</span>
        <div className="mt-1 text-lg font-black font-mono text-white tracking-tight leading-normal flex justify-between items-baseline">
          <span>{financialTotals.totalKM.toFixed(1).replace('.', ',')} <span className="text-[13px] font-sans font-normal text-slate-500">KM</span></span>
          {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 ? (
            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">
              Meta: {activeShift.dailyKmGoal} KM
            </span>
          ) : financialTotals.particularKM > 0 ? (
            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1 py-0.5 rounded animate-pulse">
              Por Fora
            </span>
          ) : null}
        </div>

        {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 && (
          <div className="mt-2">
            <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
              <div
                className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (financialTotals.totalKM / activeShift.dailyKmGoal) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10.5px] text-slate-500 mt-1 font-mono">
              <span>Progresso: {((financialTotals.totalKM / activeShift.dailyKmGoal) * 100).toFixed(0)}%</span>
              {activeShift.dailyKmGoal - financialTotals.totalKM > 0 ? (
                <span>Falta: {(activeShift.dailyKmGoal - financialTotals.totalKM).toFixed(1).replace('.', ',')} KM</span>
              ) : (
                <span className="text-emerald-400 font-bold">✅ Meta batida!</span>
              )}
            </div>
          </div>
        )}
        <div className="text-[11.5px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
          <div className="flex justify-between items-center text-slate-400">
            <span>Uber:</span>
            <span className="text-white">{financialTotals.uberKM.toFixed(1).replace('.', ',')} km</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>99 App:</span>
            <span className="text-amber-500">{financialTotals.ninetyNineKM.toFixed(1).replace('.', ',')} km</span>
          </div>
          <div className="flex justify-between items-center text-indigo-400 border-t border-slate-800/20 pt-1 mt-0.5 font-sans">
            <span className="font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Fora do App:
            </span>
            <span className="font-bold font-mono text-[12px]">{financialTotals.particularKM.toFixed(1).replace('.', ',')} km</span>
          </div>
        </div>
      </div>
    </div>
  );
}

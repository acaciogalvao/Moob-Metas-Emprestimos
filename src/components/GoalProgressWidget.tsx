/**
 * GoalProgressWidget.tsx — Barra de progresso da meta mensal no topo do Caixa.
 * Acumula todos os turnos fechados do mês atual + turno aberto atual.
 */

import React, { useMemo, useRef } from 'react';
import { Target } from 'lucide-react';
import { Shift } from '../types';
import { formatBRL } from '../utils/format';

interface GoalProgressWidgetProps {
  shifts: Shift[];
  monthlyGoal: number;
  faturamentoPosDespesas: number;  // net do turno aberto atual
  excludeSundays: boolean;
}

function getWorkingDaysInfo(excludeSundays: boolean) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let totalDays = 0;
  let remainingDays = 0;

  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month, d).getDay();
    if (excludeSundays && dow === 0) continue;
    totalDays++;
    if (d >= today) remainingDays++;
  }

  return { totalDays: Math.max(totalDays, 1), remainingDays: Math.max(remainingDays, 1) };
}

export function GoalProgressWidget({
  shifts,
  monthlyGoal,
  faturamentoPosDespesas,
  excludeSundays,
}: GoalProgressWidgetProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyAccumulated = useMemo(() => {
    const closedThisMonth = shifts
      .filter(s => s.status === 'CLOSED' && s.closedAt)
      .filter(s => {
        const d = new Date(s.closedAt!);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, shift) => {
        const inflow = shift.transactions
          .filter(t => t.type === 'IN' && !t.isVirtual)
          .reduce((s, t) => s + t.value, 0);
        const outflow = shift.transactions
          .filter(t => t.type === 'OUT')
          .reduce((s, t) => s + t.value, 0);
        return sum + Math.max(0, inflow - outflow);
      }, 0);

    return closedThisMonth + Math.max(0, faturamentoPosDespesas);
  }, [shifts, faturamentoPosDespesas, currentMonth, currentYear]);

  const { remainingDays } = getWorkingDaysInfo(excludeSundays);
  const progressPct = monthlyGoal > 0 ? Math.min(100, (monthlyAccumulated / monthlyGoal) * 100) : 0;
  const remaining = Math.max(0, monthlyGoal - monthlyAccumulated);
  const adaptiveDailyGoal = remainingDays > 0 ? remaining / remainingDays : 0;
  const achieved = progressPct >= 100;

  const barColor = achieved
    ? 'bg-emerald-500'
    : progressPct >= 75
    ? 'bg-amber-500'
    : progressPct >= 40
    ? 'bg-sky-500'
    : 'bg-slate-500';

  return (
    <div className={`bg-slate-900 border rounded-xl p-3.5 space-y-2.5 transition-colors ${achieved ? 'border-emerald-500/40' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${achieved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">Meta Mensal</p>
            <p className="text-base font-black text-white font-mono leading-tight truncate">
              {formatBRL(monthlyAccumulated)}
              <span className="text-[11px] font-normal text-slate-500 ml-1">/ {formatBRL(monthlyGoal)}</span>
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-black font-mono ${achieved ? 'text-emerald-400' : 'text-white'}`}>{progressPct.toFixed(0)}%</p>
          <p className="text-[10.5px] text-slate-500">{remainingDays} dia{remainingDays !== 1 ? 's' : ''} restante{remainingDays !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Linha inferior */}
      <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
        {achieved ? (
          <span className="text-emerald-400 font-bold text-xs">✅ Meta do mês atingida!</span>
        ) : (
          <>
            <span>Falta: <strong className="text-amber-400">{formatBRL(remaining)}</strong></span>
            <span>Meta/dia: <strong className="text-slate-300">{formatBRL(adaptiveDailyGoal)}</strong></span>
          </>
        )}
      </div>
    </div>
  );
}

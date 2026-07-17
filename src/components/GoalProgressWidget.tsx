/**
 * GoalProgressWidget.tsx — Barra de progresso da meta mensal no topo do Caixa.
 */

import React, { useMemo } from 'react';
import { Target, TrendingUp } from 'lucide-react';
import { Shift } from '../types';
import { formatBRL } from '../utils/format';

interface GoalProgressWidgetProps {
  shifts: Shift[];
  monthlyGoal: number;
  faturamentoPosDespesas: number;
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

  const barGradient = achieved
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : progressPct >= 75
    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
    : progressPct >= 40
    ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
    : 'linear-gradient(90deg, #475569, #64748b)';

  const glowColor = achieved
    ? 'rgba(52,211,153,0.25)'
    : progressPct >= 75
    ? 'rgba(251,191,36,0.25)'
    : 'rgba(14,165,233,0.15)';

  return (
    <div
      className={`rounded-3xl p-5 space-y-3.5 transition-all duration-500`}
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #0d1526 100%)',
        border: `1px solid ${achieved ? 'rgba(52,211,153,0.25)' : 'rgba(51,65,85,0.40)'}`,
        boxShadow: achieved
          ? `0 0 0 1px rgba(52,211,153,0.10), 0 8px 32px rgba(52,211,153,0.12), 0 2px 8px rgba(0,0,0,0.40)`
          : '0 2px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: achieved
                ? 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.12))'
                : 'rgba(15,23,42,1)',
              border: achieved ? '1px solid rgba(52,211,153,0.30)' : '1px solid rgba(51,65,85,0.60)',
            }}
          >
            {achieved
              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
              : <Target className="w-5 h-5 text-slate-500" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Meta Mensal</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-white font-mono leading-tight truncate">
                {formatBRL(monthlyAccumulated)}
              </span>
              <span className="text-xs font-normal text-slate-600">/ {formatBRL(monthlyGoal)}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-black font-mono leading-none ${achieved ? 'text-emerald-400 num-glow-emerald' : 'text-white'}`}>
            {progressPct.toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {remainingDays} dia{remainingDays !== 1 ? 's' : ''} restante{remainingDays !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,1)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: barGradient,
            boxShadow: `0 0 10px ${glowColor}`,
          }}
        />
      </div>

      {/* Footer row */}
      <div className="flex justify-between items-center text-xs font-mono">
        {achieved ? (
          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
            ✅ Meta do mês atingida!
          </span>
        ) : (
          <>
            <span className="text-slate-500">
              Falta: <strong className="text-amber-400 num-glow-amber">{formatBRL(remaining)}</strong>
            </span>
            <span className="text-slate-500">
              Meta/dia: <strong className="text-slate-300">{formatBRL(adaptiveDailyGoal)}</strong>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

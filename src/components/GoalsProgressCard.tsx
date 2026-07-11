import React from 'react';
import { Target, Landmark, ArrowUpRight, ArrowDownRight, PiggyBank, Sparkles, ChevronRight } from 'lucide-react';
import { formatBRL } from '../utils/format';

interface GoalOrLoan {
  _id: string;
  category?: string;
  itemName: string;
  totalValue: number;
  savedP1: number;
  savedP2: number;
  type?: string;
}

interface GoalsProgressCardProps {
  goals: GoalOrLoan[];
  isLoading?: boolean;
  onViewGoalsSystem?: () => void;
}

export function GoalsProgressCard({ goals, isLoading = false, onViewGoalsSystem }: GoalsProgressCardProps) {
  // Separate savings/goals and loans
  const savings = goals.filter(g => g.category !== 'loan');
  const loans = goals.filter(g => g.category === 'loan');

  // Savings (Metas / Poupança) calculations
  const totalSavingsTarget = savings.reduce((acc, g) => acc + (g.totalValue || 0), 0);
  const totalSavingsSaved = savings.reduce((acc, g) => acc + ((g.savedP1 || 0) + (g.savedP2 || 0)), 0);
  const totalSavingsRemaining = Math.max(0, totalSavingsTarget - totalSavingsSaved);
  const savingsProgressPct = totalSavingsTarget > 0 ? (totalSavingsSaved / totalSavingsTarget) * 100 : 0;

  // Loans (Empréstimos / Dívidas) calculations
  const totalLoansTarget = loans.reduce((acc, l) => acc + (l.totalValue || 0), 0);
  const totalLoansPaid = loans.reduce((acc, l) => acc + ((l.savedP1 || 0) + (l.savedP2 || 0)), 0);
  const totalLoansRemaining = Math.max(0, totalLoansTarget - totalLoansPaid);
  const loansProgressPct = totalLoansTarget > 0 ? (totalLoansPaid / totalLoansTarget) * 100 : 0;

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
      </div>
    );
  }

  const hasItems = goals.length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-750">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Metas e Empréstimos
            </h3>
            <p className="text-[13px] text-slate-400 font-medium">
              Controle de progresso e saldo devedor
            </p>
          </div>
        </div>

        {onViewGoalsSystem && (
          <button
            onClick={onViewGoalsSystem}
            className="flex items-center gap-0.5 text-[13px] font-extrabold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider bg-amber-500/5 hover:bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20"
          >
            Ajustar
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {!hasItems ? (
          <div className="text-center py-6 text-slate-500">
            <PiggyBank className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <p className="text-[14.5px] font-bold text-slate-400">Nenhuma meta ou empréstimo cadastrado</p>
            <p className="text-[13px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-normal">
              Acesse a aba <strong className="text-amber-500/90">Metas & Empréstimos</strong> para registrar seus objetivos ou compromissos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Metas / Poupança Card Summary */}
            {savings.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-805 rounded-xl p-3 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-md text-xs">
                      <PiggyBank className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <span className="text-[14px] font-black text-emerald-400 uppercase tracking-wider block">
                        Metas de Poupança
                      </span>
                      <span className="text-[12px] text-slate-500 block leading-none">
                        Dinheiro Acumulado (Entrando)
                      </span>
                    </div>
                  </div>
                  <span className="text-[14px] font-black font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                    {savingsProgressPct.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, savingsProgressPct)}%` }}
                  />
                </div>

                {/* Financial values details */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-center border-t border-slate-900/60">
                  <div>
                    <span className="text-sm text-slate-500 uppercase font-black block">Total Alvo</span>
                    <span className="text-[14px] font-black font-mono text-white mt-0.5 block">
                      {formatBRL(totalSavingsTarget)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-emerald-500 uppercase font-black block">Acumulado</span>
                    <span className="text-[14px] font-black font-mono text-emerald-400 mt-0.5 block flex items-center justify-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      {formatBRL(totalSavingsSaved)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-amber-500 uppercase font-black block">Faltando</span>
                    <span className="text-[14px] font-black font-mono text-amber-500 mt-0.5 block">
                      {formatBRL(totalSavingsRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empréstimos Card Summary */}
            {loans.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-805 rounded-xl p-3 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-cyan-500/10 text-cyan-400 rounded-md text-xs">
                      <Landmark className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <span className="text-[14px] font-black text-cyan-400 uppercase tracking-wider block">
                        Amortização Empréstimos
                      </span>
                      <span className="text-[12px] text-slate-500 block leading-none">
                        Dívida Amortizada (Saindo)
                      </span>
                    </div>
                  </div>
                  <span className="text-[14px] font-black font-mono text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                    {loansProgressPct.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, loansProgressPct)}%` }}
                  />
                </div>

                {/* Financial values details */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-center border-t border-slate-900/60">
                  <div>
                    <span className="text-sm text-slate-500 uppercase font-black block">Dívida Total</span>
                    <span className="text-[14px] font-black font-mono text-white mt-0.5 block">
                      {formatBRL(totalLoansTarget)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-cyan-400 uppercase font-black block">Amortizado</span>
                    <span className="text-[14px] font-black font-mono text-cyan-400 mt-0.5 block flex items-center justify-center gap-0.5">
                      <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                      {formatBRL(totalLoansPaid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-rose-450 uppercase font-black block">Faltando</span>
                    <span className="text-[14px] font-black font-mono text-rose-450 mt-0.5 block">
                      {formatBRL(totalLoansRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Items Scrollable Breakdown */}
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              <span className="text-[12px] text-slate-500 uppercase font-black tracking-wider block border-b border-slate-850 pb-1">
                Detalhamento dos Itens Ativos
              </span>
              <div className="space-y-1.5">
                {goals.map((item) => {
                  const isLoan = item.category === 'loan';
                  const saved = (item.savedP1 || 0) + (item.savedP2 || 0);
                  const missing = Math.max(0, item.totalValue - saved);
                  const pct = item.totalValue > 0 ? (saved / item.totalValue) * 100 : 0;
                  const isCompleted = missing <= 0;

                  return (
                    <div
                      key={item._id}
                      className="p-2 bg-slate-950 rounded-lg border border-slate-850/60 flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="font-extrabold text-white truncate max-w-[120px] flex items-center gap-1">
                          <span className={isLoan ? 'text-cyan-400' : 'text-emerald-400'}>
                            {isLoan ? '🏛️' : '🎯'}
                          </span>
                          {item.itemName}
                        </span>
                        <span className="font-mono text-slate-400 text-[12.5px]">
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-1 rounded-full ${isLoan ? 'bg-cyan-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[12.5px] font-mono leading-none">
                        <span className="text-slate-500">
                          {isLoan ? 'Pago: ' : 'Guardo: '}
                          <strong className={isLoan ? 'text-cyan-400/90 font-bold' : 'text-emerald-400/90 font-bold'}>
                            {formatBRL(saved)}
                          </strong>
                        </span>
                        <span className="text-right">
                          {isCompleted ? (
                            <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> Concluído!
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Falta: <strong className="text-amber-500/90 font-bold">{formatBRL(missing)}</strong>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

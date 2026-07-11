/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Coins, TrendingUp, Calendar, Award, Edit2, Check, Flame, Trophy, Percent, Info, Plus, Trash2, X, AlertTriangle
} from 'lucide-react';
import { Transaction } from '../types';
import { playBeep, playCashRegister } from '../utils/audio';
import { maskBRL, parseBRLInput, getTransactionFaturamentoReal } from '../utils/format';

interface GoalTrackerProps {
  transactions: Transaction[];
}

interface Goal {
  id: string;
  name: string;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  target: number;
}

export function GoalTracker({ transactions }: GoalTrackerProps) {
  // Load goals from local storage - start empty/zerado if none exist
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('motorista_metas_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return []; // starts empty ("inicie zerado")
  });

  // Modals / Editing States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null); // if null, we are creating a new goal
  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState<Goal['period']>('daily');
  const [formValue, setFormValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Persist goals on changes
  useEffect(() => {
    localStorage.setItem('motorista_metas_v3', JSON.stringify(goals));
  }, [goals]);

  // General average ride value to calculate projected metrics
  const rideIncomes = transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA');
  const avgRideValue = rideIncomes.length > 0 
    ? rideIncomes.reduce((sum, t) => {
        return sum + getTransactionFaturamentoReal(t);
      }, 0) / rideIncomes.length 
    : 24.50; // default estimated average run in Brazil

  // Current timestamps for calculations
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Calculates current real net profit based on goal period (Incomes - Expenses)
  const calculateProgress = (period: Goal['period']) => {
    let periodTx = transactions;
    if (period === 'daily') {
      periodTx = transactions.filter(t => new Date(t.timestamp) >= todayStart);
    } else if (period === 'weekly') {
      const weeklyStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      periodTx = transactions.filter(t => new Date(t.timestamp) >= weeklyStart);
    } else if (period === 'monthly') {
      const monthlyStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      periodTx = transactions.filter(t => new Date(t.timestamp) >= monthlyStart);
    }
    
    const incomes = periodTx.filter(t => t.type === 'IN').reduce((sum, t) => {
      return sum + getTransactionFaturamentoReal(t);
    }, 0);
    const expenses = periodTx.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.value, 0);
    return Math.max(0, incomes - expenses);
  };

  // Format currency with BRL standards (R$ 1.250,00)
  const formatToBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Trigger Modal to Create
  const handleOpenCreate = () => {
    setActiveGoal(null);
    setFormName('');
    setFormPeriod('daily');
    setFormValue('');
    setErrorMsg(null);
    setIsModalOpen(true);
    playBeep();
  };

  // Trigger Modal to Edit existing
  const handleOpenEdit = (goal: Goal) => {
    setActiveGoal(goal);
    setFormName(goal.name);
    setFormPeriod(goal.period);
    // Set formatted real value in BRL mask format
    setFormValue(maskBRL(goal.target.toFixed(2)));
    setErrorMsg(null);
    setIsModalOpen(true);
    playBeep();
  };

  // Submit Goal creation or edit
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('Coloque um nome válido para sua meta.');
      return;
    }

    const numericVal = parseBRLInput(formValue);
    if (isNaN(numericVal) || numericVal <= 0) {
      setErrorMsg('Insira um valor em Real brasileiro maior que zero (Ex: 150,00).');
      return;
    }

    if (activeGoal) {
      // Edit mode
      setGoals(prev => prev.map(g => g.id === activeGoal.id ? {
        ...g,
        name: formName.trim(),
        period: formPeriod,
        target: numericVal
      } : g));
      playCashRegister();
    } else {
      // New Goal mode
      const newGoal: Goal = {
        id: 'goal_' + Date.now(),
        name: formName.trim(),
        period: formPeriod,
        target: numericVal
      };
      setGoals(prev => [...prev, newGoal]);
      playCashRegister();
    }

    setIsModalOpen(false);
  };

  // Exclude Goal function
  const handleDeleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    setIsModalOpen(false);
    playBeep();
  };

  // Priority sorting for goals: Daily first, then Weekly, then Monthly, and finally Custom.
  const periodPriority: Record<Goal['period'], number> = {
    daily: 1,
    weekly: 2,
    monthly: 3,
    custom: 4
  };
  const sortedGoals = [...goals].sort((a, b) => periodPriority[a.period] - periodPriority[b.period]);

  // Independent Period Progress Mapping:
  // Calculates the real-time net profit (Lucro Real Líquido) achieved within each goal's period.
  const getGoalProgressMap = () => {
    const progressMap: Record<string, { current: number; status: 'completed' | 'active'; surplus: number }> = {};
    
    goals.forEach((g) => {
      const current = calculateProgress(g.period);
      const target = g.target;
      if (current >= target) {
        progressMap[g.id] = {
          current: current,
          status: 'completed',
          surplus: current - target
        };
      } else {
        progressMap[g.id] = {
          current: current,
          status: 'active',
          surplus: 0
        };
      }
    });
    return progressMap;
  };

  const goalProgress = getGoalProgressMap();

  return (
    <div className="space-y-6">
      {/* Dynamic Dashboard Banner with Create Button */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
          <Target className="w-48 h-48 text-white" />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500/25 animate-pulse" />
              <span className="text-[13px] font-black text-amber-500 uppercase tracking-widest font-mono">Metas Customizadas</span>
            </div>
            <h2 className="text-lg font-black text-white tracking-tight uppercase">Plano de Ganhos Dinâmicos (Lucro Líquido Real)</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Crie e acompanhe suas metas baseadas no seu <strong>Lucro Líquido Real</strong> (Ganhos menos Despesas). O objetivo é mostrar exatamente quanto você está faturando de verdade naquele período para bater suas metas sem ficar devendo taxas ou saldo negativo para as plataformas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 font-extrabold text-xs text-slate-950 px-4 py-2.5 rounded-xl transition-all shadow-md shadow-amber-550/5 self-stretch sm:self-auto text-center justify-center uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nova Meta Real
          </button>
        </div>
      </div>

      {/* Grid of Dynamic Target Cards */}
      {goals.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Target className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Nenhuma meta ativa</h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Seu painel de faturamento está zerado. Cadastre uma meta diária, semanal ou mensal acima e controle o faturamento real das suas viagens com projeção automática!
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-amber-550 border border-slate-800/80 hover:border-slate-705 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar Primeira Meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {sortedGoals.map((g) => {
            const { current, status, surplus } = goalProgress[g.id] || { current: 0, status: 'active', surplus: 0 };
            const target = g.target;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const remaining = Math.max(0, target - current);
            const estRidesLeft = avgRideValue > 0 ? Math.ceil(remaining / avgRideValue) : 0;
            const isCompleted = status === 'completed';

            // Badges colors depending on completion
            const indicatorWord = 
              g.period === 'daily' ? 'Diário' : 
              g.period === 'weekly' ? 'Semanal' : 
              g.period === 'monthly' ? 'Mensal' : 'Geral';

            const barColor = isCompleted 
              ? 'bg-emerald-500' 
              : pct > 75 
                ? 'bg-amber-400' 
                : pct > 40 
                  ? 'bg-amber-500/80' 
                  : 'bg-rose-500/80';

            return (
              <div 
                key={g.id} 
                onClick={() => handleOpenEdit(g)}
                className={`border rounded-2xl p-5 cursor-pointer transition-all relative overflow-hidden group hover:scale-[1.01] duration-150 backdrop-blur-md ${
                  isCompleted 
                    ? 'border-emerald-500/20 bg-emerald-950/5 hover:border-emerald-500/35 font-sans' 
                    : 'border-slate-800/85 bg-slate-900/10 hover:border-slate-700/80 ring-1 ring-amber-500/10 font-sans'
                }`}
              >
                {/* Meta Status Sticker */}
                {isCompleted ? (
                  <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-slate-950 font-black text-[12px] uppercase tracking-wider rounded-bl-lg font-mono">
                    Meta Batida 🎉
                  </div>
                ) : (
                  <div className="absolute top-0 right-0 p-1 bg-amber-500 text-slate-950 font-black text-[12px] uppercase tracking-wider rounded-bl-lg font-mono animate-pulse">
                    Foco Ativo 🔥
                  </div>
                )}

                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border shrink-0 ${
                      isCompleted 
                        ? 'bg-emerald-500/10 border-emerald-900/40 text-emerald-400' 
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    }`}>
                      {g.period === 'monthly' ? (
                        <Trophy className="w-5 h-5 text-amber-500" />
                      ) : g.period === 'weekly' ? (
                        <Award className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Target className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-550 font-black uppercase tracking-widest leading-none mb-1 font-mono">
                        Alvo {indicatorWord}
                      </p>
                      <h4 className="text-sm font-black text-white tracking-tight group-hover:text-amber-500 transition-colors">
                        {g.name}
                      </h4>
                    </div>
                  </div>

                  {/* Tiny Click-to-edit cue */}
                  <span className="text-[12px] text-slate-500 font-bold uppercase tracking-wider border border-slate-900 bg-slate-955/60 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Edit2 className="w-2 h-2" />
                    Editar
                  </span>
                </div>

                {/* Progress Indicators */}
                <div className="mt-4 flex justify-between items-baseline font-mono">
                  <div>
                    <span className="text-2xl font-black text-white tracking-tight">
                      {formatToBRL(current)}
                    </span>
                    <span className="text-xs text-slate-550 ml-1">/ {formatToBRL(target)}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-xs font-extrabold text-slate-400">
                    <span className={`text-xs ${isCompleted ? 'text-emerald-450 font-black text-sm' : 'text-slate-300 font-semibold'}`}>{pct}%</span>
                  </div>
                </div>

                {/* Progress Bar Component */}
                <div className="mt-2.5 h-2 bg-slate-955 rounded-full overflow-hidden border border-slate-900/50 relative">
                  <div 
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  />
                </div>

                {/* Performance forecast indicators (operational metrics) */}
                <div className="mt-4 text-[14px] text-slate-400 font-sans space-y-1 bg-slate-955/40 p-2 rounded-xl border border-slate-900/50 leading-relaxed font-mono">
                  {isCompleted ? (
                    <div className="space-y-0.5">
                      <p className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-450" />
                        Meta Realizada!
                      </p>
                      {surplus > 0 && (
                        <p className="text-[13px] text-slate-400 leading-normal pl-4.5">
                          ↳ Lucro Real excedente de <span className="text-emerald-400 font-bold">{formatToBRL(surplus)}</span>!
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Falta para quitar:</span>
                        <span className="font-extrabold text-slate-200">{formatToBRL(remaining)}</span>
                      </div>
                      <div className="flex justify-between text-slate-450 text-[13px]">
                        <span>Viagens restantes (est. {formatToBRL(avgRideValue)}/med):</span>
                        <span className="font-black text-amber-500/90">{estRidesLeft} viagens</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPREHENSIVE FINANCIAL CALCULATION INFO PANEL */}
      <div className="bg-slate-900/30 border border-slate-805 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1 px-1">
          <Info className="w-4 h-4 text-amber-500 shrink-0" />
          Como o Painel Consolida suas Viagens?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-350 pr-2">
          <div className="space-y-1.5 border-l border-slate-800 pl-4">
            <h5 className="font-bold text-white uppercase text-[14px] tracking-wide">
              01/ Períodos Inteligentes
            </h5>
            <p className="leading-relaxed">
              As metas Diárias processam apenas as corridas realizadas a partir da meia-noite do dia corrente. Já os alvos Semanais e Mensais consolidam faturamentos em janelas de 7 e 30 dias respectivamente.
            </p>
          </div>

          <div className="space-y-1.5 border-l border-slate-800 pl-4">
            <h5 className="font-bold text-white uppercase text-[14px] tracking-wide">
              02/ Preenchimento em Real (R$)
            </h5>
            <p className="leading-relaxed">
              Todos os valores cadastrados utilizam a moeda do país. Ao editar qualquer faturamento bruto, insira as importâncias com separador decimal por vírgula para manter a integridade dos caixas.
            </p>
          </div>

          <div className="space-y-1.5 border-l border-slate-800 pl-4">
            <h5 className="font-bold text-white uppercase text-[14px] tracking-wide">
              03/ Integração Direta com Caixa
            </h5>
            <p className="leading-relaxed">
              Não há redundância de dados. Quando os passageiros pagam por Pix, Dinheiro ou Cartão de repasse, os saldos são computados de acordo com as taxas e comissões informadas no ato de lançamento.
            </p>
          </div>
        </div>
      </div>

      {/* EDIT / CREATE GOAL MODAL DIALOG */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col font-sans text-slate-200"
            >
              {/* Dynamic decorative colors based on selection */}
              <div className="h-1.5 w-full bg-amber-500" />

              <div className="p-5 border-b border-slate-900 flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    {activeGoal ? 'Editar Meta Cadastrada' : 'Cadastrar Nova Meta'}
                  </h3>
                  <p className="text-[14px] text-slate-400 mt-0.5">Define seus termos de faturamento em Real (R$)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    playBeep();
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-xl border border-slate-850 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Input Container */}
              <form onSubmit={handleSaveGoal} className="p-5 space-y-4">
                {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs py-2 px-3 rounded-xl flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-450" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-1">
                  <label className="text-[12.5px] font-black uppercase text-slate-400 tracking-wider">
                    Nome / Objetivo da Meta:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Meta da Gasolina, Faturamento Diário..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 transition-all font-medium"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12.5px] font-black uppercase text-slate-400 tracking-wider">
                    Período de Acompanhamento:
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-300 focus:border-slate-600 focus:outline-none transition-all font-medium appearance-none cursor-pointer"
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value as Goal['period'])}
                  >
                    <option value="daily">Diária (Apenas Entradas de Hoje)</option>
                    <option value="weekly">Semanal (Ganhos nos últimos 7 dias)</option>
                    <option value="monthly">Mensal (Ganhos nos últimos 30 dias)</option>
                    <option value="custom">Geral (Faturamento histórico acumulado)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[12.5px] font-black uppercase text-slate-400 tracking-wider">
                    Valor Alvo (R$):
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-slate-450 text-xs font-mono font-bold">R$</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white font-mono focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 transition-all"
                      value={formValue}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setFormValue(masked);
                      }}
                    />
                  </div>
                  <p className="text-[12px] text-slate-500 italic mt-0.5">Use separação decimal com vírgula para os centavos.</p>
                </div>

                {/* Footer and dynamic exclusions */}
                <div className="pt-3 border-t border-slate-900 flex flex-col sm:flex-row gap-2 justify-between">
                  {activeGoal ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(activeGoal.id)}
                      className="inline-flex items-center gap-1.5 justify-center bg-rose-500/10 hover:bg-rose-500/15 border border-rose-905 text-rose-455 font-bold hover:text-rose-400 py-2 px-3.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer self-stretch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Meta
                    </button>
                  ) : (
                    <div className="hidden sm:block" />
                  )}

                  <div className="flex gap-2 self-stretch sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        playBeep();
                      }}
                      className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-slate-955 font-extrabold py-2 px-5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/10"
                    >
                      {activeGoal ? 'Salvar' : 'Cadastrar'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

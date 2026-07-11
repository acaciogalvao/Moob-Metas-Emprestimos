/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shift, Transaction, PlatformType } from '../types';
import { formatDecimalBRL } from '../utils/format';

interface ChartsProps {
  shifts: Shift[];
  transactions: Transaction[];
}

export function Charts({ shifts, transactions }: ChartsProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'WEEK' | 'CATEGORY'>('WEEK');
  const [periodMode, setPeriodMode] = useState<'WEEK' | 'MONTH' | 'ALL'>('WEEK');

  const _chartNow = new Date();
  const _allEligibleShifts = [...shifts]
    .filter(s => s.status === 'CLOSED' || s.transactions.length > 0)
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());

  const sortedClosedShifts = periodMode === 'WEEK'
    ? _allEligibleShifts.slice(-7)
    : periodMode === 'MONTH'
      ? _allEligibleShifts.filter(s => {
          const d = new Date(s.openedAt);
          return d.getFullYear() === _chartNow.getFullYear() && d.getMonth() === _chartNow.getMonth();
        })
      : _allEligibleShifts; // ALL = todos os turnos sem limite

  // Calculate daily data
  const dailyData = sortedClosedShifts.map((shift, idx) => {
    const uber = shift.transactions
      .filter(t => t.type === 'IN' && t.platform === 'UBER')
      .reduce((sum, t) => sum + t.value, 0);
    const ninetyNine = shift.transactions
      .filter(t => t.type === 'IN' && t.platform === '99')
      .reduce((sum, t) => sum + t.value, 0);
    const dateObj = new Date(shift.openedAt);
    const label = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
    const fullDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    return {
      id: shift.id,
      label,
      fullDate,
      uber,
      ninetyNine,
      total: uber + ninetyNine,
    };
  });

  const maxVal = Math.max(...dailyData.map(d => Math.max(d.uber, d.ninetyNine, 50)), 150);

  // KPI summary
  const totalPeriodValue = dailyData.reduce((s, d) => s + d.total, 0);
  const avgPerShift = dailyData.length > 0 ? totalPeriodValue / dailyData.length : 0;
  const bestShift = dailyData.length > 0
    ? dailyData.reduce((best, d) => d.total > best.total ? d : best)
    : { total: 0, label: '-' };

  // Category summary for all transactions in selection
  const categoriesIn: { [cat: string]: number } = {};
  const categoriesOut: { [cat: string]: number } = {};
  let totalIn = 0;
  let totalOut = 0;

  transactions.forEach(t => {
    if (t.type === 'IN') {
      categoriesIn[t.category] = (categoriesIn[t.category] || 0) + t.value;
      totalIn += t.value;
    } else {
      categoriesOut[t.category] = (categoriesOut[t.category] || 0) + t.value;
      totalOut += t.value;
    }
  });

  // Prepare categories list sorted by volume
  const catInList = Object.entries(categoriesIn).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val);
  const catOutList = Object.entries(categoriesOut).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val);

  // Platform totals
  const uberTotalIn = transactions.filter(t => t.type === 'IN' && t.platform === 'UBER').reduce((s, t) => s + t.value, 0);
  const ninetyNineTotalIn = transactions.filter(t => t.type === 'IN' && t.platform === '99').reduce((s, t) => s + t.value, 0);
  const grandPlatformTotal = uberTotalIn + ninetyNineTotalIn || 1;

  const uberPercent = Math.round((uberTotalIn / grandPlatformTotal) * 100);
  const ninetyNinePercent = Math.round((ninetyNineTotalIn / grandPlatformTotal) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5" id="dashboard-charts-container">
      {/* 1. Daily Comparison Bar Chart */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
        <div>
          {/* Header: título + seletor de período */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold text-white font-sans uppercase tracking-wider">Evolução por Plataforma</h3>
              <p className="text-[11px] text-slate-500">Últimos {dailyData.length} turnos</p>
            </div>
            <div className="flex gap-0.5 bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              {(['WEEK', 'MONTH', 'ALL'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setPeriodMode(mode)}
                  className={`text-[11px] font-bold px-2 py-1 rounded transition-all duration-150 ${periodMode === mode ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  {mode === 'WEEK' ? '7T' : mode === 'MONTH' ? 'Mês' : 'Tudo'}
                </button>
              ))}
            </div>
          </div>

          {/* KPI summary row */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <div className="bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-800/60 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide leading-tight">Melhor</div>
              <div className="text-[13px] font-black font-mono text-emerald-400 leading-tight">R$ {formatDecimalBRL(bestShift.total)}</div>
              <div className="text-[10px] text-slate-600 font-mono capitalize leading-tight truncate">{bestShift.label}</div>
            </div>
            <div className="bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-800/60 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide leading-tight">Média</div>
              <div className="text-[13px] font-black font-mono text-amber-400 leading-tight">R$ {formatDecimalBRL(avgPerShift)}</div>
              <div className="text-[10px] text-slate-600 leading-tight">/turno</div>
            </div>
            <div className="bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-800/60 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide leading-tight">Total</div>
              <div className="text-[13px] font-black font-mono text-white leading-tight">R$ {formatDecimalBRL(totalPeriodValue)}</div>
              <div className="text-[10px] text-slate-600 leading-tight">{dailyData.length} turnos</div>
            </div>
          </div>

          {/* Legenda */}
          <div className="flex gap-3 text-[12px] font-mono mb-2">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 bg-slate-100 rounded-sm inline-block border border-black shadow"></span>
              Uber
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm inline-block shadow"></span>
              99 App
            </span>
          </div>

          {dailyData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500 text-xs">
              Nenhuma informação registrada para exibir no gráfico.
            </div>
          ) : (
            <div className="relative pt-6 h-52 flex items-end justify-between border-b border-slate-800 pb-1 px-4 gap-2">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[12px] text-slate-600 font-mono">
                <div className="border-b border-slate-800/50 w-full pb-0.5 text-right">R$ {Math.round(maxVal).toFixed(0)}</div>
                <div className="border-b border-slate-800/30 w-full pb-0.5 text-right">R$ {Math.round(maxVal * 0.66).toFixed(0)}</div>
                <div className="border-b border-slate-800/30 w-full pb-0.5 text-right">R$ {Math.round(maxVal * 0.33).toFixed(0)}</div>
                <div></div>
              </div>

              {/* Bar Charts */}
              {dailyData.map((d) => {
                const uberHeight = (d.uber / maxVal) * 90; // max 90%
                const ninetyNineHeight = (d.ninetyNine / maxVal) * 90;
                const isHovered = hoveredBar === d.id;

                return (
                  <div
                    key={d.id}
                    className="flex-1 flex flex-col items-center relative group h-full justify-end z-10"
                    onMouseEnter={() => setHoveredBar(d.id)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-12 bg-slate-950 text-white text-[14px] p-2 rounded-lg shadow-2xl border border-slate-800 z-50 pointer-events-none min-w-[110px] text-center font-mono">
                        <p className="font-bold text-slate-400 border-b border-slate-800 pb-0.5 mb-1 text-[12.5px]">{d.fullDate}</p>
                        <p className="flex justify-between gap-2 leading-none mb-1">
                          <span className="text-slate-350">Uber:</span>
                          <span className="font-bold text-white">R$ {formatDecimalBRL(d.uber)}</span>
                        </p>
                        <p className="flex justify-between gap-2 leading-none mb-1">
                          <span className="text-amber-400">99:</span>
                          <span className="font-bold text-amber-400 font-mono">R$ {formatDecimalBRL(d.ninetyNine)}</span>
                        </p>
                        <div className="border-t border-slate-800 mt-1 pt-1 flex justify-between font-bold text-slate-100 leading-none">
                          <span>Total:</span>
                          <span>R$ {formatDecimalBRL(d.total)}</span>
                        </div>
                      </div>
                    )}

                    {/* Valor total acima das barras */}
                    {d.total > 0 && (
                      <div className="absolute top-0 text-[9px] font-black text-slate-400 font-mono w-full text-center leading-none pointer-events-none">
                        {formatDecimalBRL(d.total)}
                      </div>
                    )}

                    {/* The Double Bars */}
                    <div className="w-full max-w-[44px] flex items-end gap-1 h-full">
                      {/* Uber Bar */}
                      <div className="flex-1 h-full flex items-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${uberHeight}%` }}
                          transition={{ type: "spring", stiffness: 60, damping: 15 }}
                          className="w-full bg-linear-to-t from-slate-850 to-slate-200 rounded-t-sm hover:brightness-110 transition-all shadow-inner border-t border-slate-500"
                        />
                      </div>
                      
                      {/* 99 Bar */}
                      <div className="flex-1 h-full flex items-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${ninetyNineHeight}%` }}
                          transition={{ type: "spring", stiffness: 60, damping: 15 }}
                          className="w-full bg-linear-to-t from-amber-700 to-amber-400 rounded-t-sm hover:brightness-110 transition-all shadow-inner border-t border-amber-300"
                        />
                      </div>
                    </div>

                    {/* Label */}
                    <span className="text-[12px] text-slate-450 mt-1.5 font-mono uppercase font-semibold">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Small insights helper footer */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[14px] text-slate-400 font-mono">
          <div>
            <span>Eficiência: </span>
            <span className={uberTotalIn > ninetyNineTotalIn ? 'text-white font-bold' : 'text-amber-400 font-bold'}>
              {uberTotalIn > ninetyNineTotalIn ? 'Uber é Maior' : '99 App é Maior'}
            </span>
          </div>
          <div>
            <span>Volume Faturado: </span>
            <span className="text-emerald-400 font-bold font-mono">
              R$ {formatDecimalBRL(uberTotalIn + ninetyNineTotalIn)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Platform Share Pie Simulation & category distribution */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
        <div>
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-0.5">Market Share e Categorias</h3>
          <p className="text-[14px] text-slate-400 mb-3">Divisão proporcional de faturamento</p>

          <div className="flex items-center justify-center gap-4 py-1.5">
            {/* Custom SVG Donut Chart */}
            <div className="relative w-22 h-22 flex items-center justify-center shrink-0">
              {grandPlatformTotal > 1 ? (
                <>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Gray track background */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="3" />
                    
                    {/* Ninety Nine Orange circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.2"
                      strokeDasharray={`${ninetyNinePercent} ${100 - ninetyNinePercent}`}
                      strokeDashoffset="0"
                    />

                    {/* Uber White Circle, starting after Ninety Nine */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#f4f4f5"
                      strokeWidth="3.2"
                      strokeDasharray={`${uberPercent} ${100 - uberPercent}`}
                      strokeDashoffset={-ninetyNinePercent}
                    />
                  </svg>
                  {/* Center Text */}
                  <div className="absolute text-center bg-slate-900 w-16 h-16 rounded-full flex flex-col items-center justify-center">
                    <span className="text-[12px] text-slate-400 uppercase leading-none">Uber</span>
                    <span className="text-xs font-black text-white font-mono leading-tight">{uberPercent}%</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-650 text-[12.5px] text-center font-mono leading-tight">Sem dados de corrida</div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="flex-1 space-y-2 font-mono">
              <div className="flex flex-col border-l-2 border-slate-200 pl-1.5">
                <span className="text-[12px] text-slate-400 font-semibold tracking-wider uppercase">UBER</span>
                <span className="text-xs font-bold text-slate-100">
                  R$ {formatDecimalBRL(uberTotalIn)}
                </span>
                <span className="text-[12px] text-slate-500">{uberPercent}% do total</span>
              </div>
              <div className="flex flex-col border-l-2 border-amber-500 pl-1.5">
                <span className="text-[12px] text-amber-500 font-semibold tracking-wider uppercase">99 APP</span>
                <span className="text-xs font-bold text-amber-400">
                  R$ {formatDecimalBRL(ninetyNineTotalIn)}
                </span>
                <span className="text-[12px] text-slate-500">{ninetyNinePercent}% do total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories mini progress breakdown */}
        <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex justify-between items-center text-[14px] font-bold text-slate-450">
            <span>DISTRIBUIÇÃO DE GASTOS</span>
            <span className="text-rose-455 font-mono">Total: R$ {formatDecimalBRL(totalOut)}</span>
          </div>

          {catOutList.length === 0 ? (
            <p className="text-[13px] text-slate-505 italic py-1 font-mono">Nenhum custo registrado.</p>
          ) : (
            <div className="space-y-1.5 max-h-[75px] overflow-y-auto pr-0.5 scrollbar-thin">
              {catOutList.slice(0, 3).map((item, index) => {
                const pct = totalOut > 0 ? (item.val / totalOut) * 100 : 0;
                const progressColors = ["bg-rose-500", "bg-amber-500", "bg-slate-400"];
                const color = progressColors[index % progressColors.length];

                return (
                  <div key={item.name} className="text-[14px] font-mono">
                    <div className="flex justify-between text-[12.5px] text-slate-450 mb-0.5">
                      <span className="capitalize">{item.name.toLowerCase()}</span>
                      <span className="font-bold text-slate-200">
                        R$ {formatDecimalBRL(item.val)} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-900/40">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

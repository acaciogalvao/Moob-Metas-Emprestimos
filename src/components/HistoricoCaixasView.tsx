/**
 * HistoricoCaixasView.tsx — Closed shifts historical list view with weekly summary.
 */

import React from 'react';
import { motion } from 'motion/react';
import { FolderArchive, History, Eye, Trash2, CalendarDays } from 'lucide-react';
import { Shift } from '../types';
import { formatDecimalBRL } from '../utils/format';
import { playBeep } from '../utils/audio';

interface HistoricoCaixasViewProps {
  shifts: Shift[];
  driverName: string;
  onSelectShiftForReport: (shift: Shift) => void;
  onDeleteHistoryShift: (shiftId: string) => void;
}

/** Retorna a chave "YYYY-Www" do turno para agrupamento semanal. */
function getISOWeekKey(shift: Shift): string {
  const d = new Date(shift.openedAt);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Rótulo legível para a semana: "Semana de DD/MM a DD/MM/YYYY" */
function weekLabel(key: string): string {
  const [year, weekStr] = key.split('-W');
  const weekNum = parseInt(weekStr, 10);
  // ISO week: semana 1 é a que contém a primeira quinta-feira do ano
  const jan4 = new Date(Date.UTC(parseInt(year, 10), 0, 4));
  const startOfWeek = new Date(jan4);
  startOfWeek.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (weekNum - 1) * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  return `Semana de ${fmt(startOfWeek)} a ${fmt(endOfWeek)}/${endOfWeek.getUTCFullYear()}`;
}

export function HistoricoCaixasView({
  shifts,
  driverName,
  onSelectShiftForReport,
  onDeleteHistoryShift,
}: HistoricoCaixasViewProps) {
  const closedShifts = shifts
    .filter(s => s.status === 'CLOSED')
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  // Agrupa por semana ISO (mais recente primeiro)
  const weeks: Array<{ key: string; shiftList: Shift[] }> = [];
  closedShifts.forEach(shift => {
    const key = getISOWeekKey(shift);
    const existing = weeks.find(w => w.key === key);
    if (existing) {
      existing.shiftList.push(shift);
    } else {
      weeks.push({ key, shiftList: [shift] });
    }
  });

  return (
    <motion.div
      key="historico-caixas-system"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2 }}
      className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white font-sans tracking-tight flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-amber-500" />
            Histórico de Caixas Fechados
          </h3>
          <p className="text-[14px] text-slate-400">Aqui você pode visualizar, imprimir relatórios ou gerenciar caixas fechados.</p>
        </div>
        <div className="text-[14px] font-mono text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800 self-start sm:self-auto">
          Total: {closedShifts.length} caixa(s) fechado(s)
        </div>
      </div>

      {closedShifts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg bg-slate-950/20">
          <History className="w-8 h-8 text-slate-650 mx-auto mb-2" />
          <p className="text-xs font-semibold">Nenhum caixa histórico registrado ainda.</p>
          <p className="text-[14px] text-slate-650 mt-1">Abra um caixa na aba "Caixa de Corridas" e comece a registrar suas corridas operacionais.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {weeks.map(({ key, shiftList }) => {
            // Totais da semana
            const weekRides = shiftList.flatMap(s => s.transactions.filter(t => t.type === 'IN' && !t.isVirtual));
            const weekOut   = shiftList.flatMap(s => s.transactions.filter(t => t.type === 'OUT'));
            const weekIn    = weekRides.reduce((s, t) => s + t.value, 0);
            const weekOutTotal = weekOut.reduce((s, t) => s + t.value, 0);
            const weekProfit = weekIn - weekOutTotal;
            const avgPerDay = weekProfit / shiftList.length;

            return (
              <div key={key} className="space-y-2">
                {/* Cabeçalho da semana */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11.5px] font-bold text-slate-300">{weekLabel(key)}</span>
                    <span className="text-[11px] text-slate-500">• {shiftList.length} dia{shiftList.length !== 1 ? 's' : ''} trabalhado{shiftList.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono ml-5 sm:ml-0">
                    <span className="text-slate-500">Lucro: <strong className="text-emerald-400">R$ {formatDecimalBRL(weekProfit)}</strong></span>
                    <span className="text-slate-500">Média/dia: <strong className="text-amber-400">R$ {formatDecimalBRL(avgPerDay)}</strong></span>
                    <span className="text-slate-500">Gastos: <strong className="text-rose-400">R$ {formatDecimalBRL(weekOutTotal)}</strong></span>
                  </div>
                </div>

                {/* Cards dos turnos da semana */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shiftList.map((shift) => {
                    const dateStr = new Date(shift.openedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    const rides = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
                    const expenses = shift.transactions.filter(t => t.type === 'OUT');
                    const ridesCount = rides.length;
                    const totalIn = rides.reduce((s, t) => s + t.value, 0);
                    const totalOut = expenses.reduce((s, t) => s + t.value, 0);
                    const profit = totalIn - totalOut;

                    const hasOdo =
                      shift.initialOdometer !== undefined &&
                      shift.finalOdometer !== undefined &&
                      shift.finalOdometer >= shift.initialOdometer;
                    const kmRun =
                      hasOdo && shift.finalOdometer !== undefined && shift.initialOdometer !== undefined
                        ? shift.finalOdometer - shift.initialOdometer
                        : 0;
                    const kmPerL =
                      hasOdo && shift.totalLitersFueled && shift.totalLitersFueled > 0
                        ? kmRun / shift.totalLitersFueled
                        : undefined;

                    return (
                      <div
                        key={shift.id}
                        className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-amber-500/10 text-amber-500 rounded text-xs font-bold font-mono">
                              #{shift.id.slice(-8).toUpperCase()}
                            </span>
                            <span className="text-[14px] text-slate-450 font-mono">{dateStr}</span>
                          </div>
                          <span className="text-[13px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            Operador: {driverName || 'Sem nome'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[14px] text-slate-400 font-mono">
                          <div>
                            Corridas: <span className="text-white font-bold">{ridesCount}</span>
                          </div>
                          <div>
                            Gasto total: <span className="text-rose-400 font-semibold">R$ {formatDecimalBRL(totalOut)}</span>
                          </div>
                          {shift.difference !== undefined && shift.difference !== 0 && (
                            <div className="col-span-2">
                              Diferença de Caixa:{' '}
                              <span className={`font-bold ${shift.difference < 0 ? 'text-rose-400' : 'text-emerald-450'}`}>
                                R$ {formatDecimalBRL(shift.difference)}
                              </span>
                            </div>
                          )}
                          {hasOdo && (
                            <div className="col-span-2 text-[13px] text-slate-500 mt-1 flex items-center gap-1.5 font-sans">
                              <span className="flex items-center gap-0.5">
                                🛣️ <strong>{kmRun.toFixed(1)} KM rodados</strong>
                              </span>
                              {kmPerL !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5" title="Consumo Médio">
                                    ⛽ <strong className="text-amber-500/90">{kmPerL.toFixed(1)} km/L</strong>
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-900 pt-2.5">
                          <div className="text-left">
                            <span className="block text-[12px] font-bold text-slate-500 uppercase">Lucro Líquido</span>
                            <span className="text-xs font-black text-emerald-400 font-mono">
                              R$ {formatDecimalBRL(profit)}
                            </span>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                playBeep();
                                onSelectShiftForReport(shift);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[14px] text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              Ver Relatório
                            </button>
                            <button
                              onClick={() => onDeleteHistoryShift(shift.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 bg-slate-900/40 border border-slate-900 hover:border-rose-950 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

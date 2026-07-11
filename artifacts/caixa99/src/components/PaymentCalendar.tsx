import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { parseLocalDate } from "../loan-lib/utils";

interface PaymentCalendarProps {
  startDate: string;
  frequencyP1: string;
  frequencyP2: string;
  nameP1: string;
  nameP2: string;
  paymentsHistory: any[];
  excludeSundays: boolean;
  goalType: "individual" | "shared";
  results: any;
  formatCurrency: (v: number) => string;
}

function getDueDateForPeriod(
  startDate: string,
  freq: string,
  excludeSundays: boolean,
  periodIndex: number
): Date {
  const d = parseLocalDate(startDate);
  d.setHours(0, 0, 0, 0);

  if (freq === "daily") {
    let added = 0;
    while (added < periodIndex + 1) {
      d.setDate(d.getDate() + 1);
      if (excludeSundays && d.getDay() === 0) {
        // pula domingo
      } else {
        added++;
      }
    }
  } else if (freq === "weekly") {
    d.setDate(d.getDate() + 7 * (periodIndex + 1));
    if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
  } else if (freq === "monthly") {
    d.setMonth(d.getMonth() + periodIndex + 1);
    if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

function computeDueDatesMap(
  startDate: string,
  freqP1: string,
  totalPeriodsP1: number,
  freqP2: string,
  totalPeriodsP2: number,
  excludeSundays: boolean,
  goalType: "individual" | "shared",
  monthYear: { year: number; month: number },
  paymentsHistory: any[],
  baseInstallmentP1: number,
  baseInstallmentP2: number
): Record<number, { dueP1: boolean; paidP1: boolean; dueP2: boolean; paidP2: boolean }> {
  const { year, month } = monthYear;
  const result: Record<number, { dueP1: boolean; paidP1: boolean; dueP2: boolean; paidP2: boolean }> = {};

  const processPayer = (
    payerId: "P1" | "P2",
    freq: string,
    totalPeriods: number,
    baseAmount: number
  ) => {
    const dueDates: Date[] = [];
    for (let i = 0; i < totalPeriods; i++) {
        dueDates.push(getDueDateForPeriod(startDate, freq, excludeSundays, i));
    }

    const paidIndices = new Set<number>();
    const sortedPayments = [...(paymentsHistory || [])].filter(p => p.payerId === payerId).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Fill sequentially from the beginning
    let currentIdx = 0;
    for (const p of sortedPayments) {
        let periodsCovered = 1;
        if (baseAmount > 0) {
            periodsCovered = Math.floor(p.amount / baseAmount + 0.05);
            if (periodsCovered < 1 && p.amount > 0) periodsCovered = 1; 
        }

        let filled = 0;
        while (filled < periodsCovered && currentIdx < totalPeriods) {
            if (!paidIndices.has(currentIdx)) {
                paidIndices.add(currentIdx);
                filled++;
            }
            currentIdx++;
        }
    }

    // Populate result for the calendar view month
    for (let i = 0; i < totalPeriods; i++) {
        const d = dueDates[i];
        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (!result[day]) result[day] = { dueP1: false, paidP1: false, dueP2: false, paidP2: false };
            const isPaid = paidIndices.has(i);
            if (payerId === "P1") {
               result[day].dueP1 = true;
               result[day].paidP1 = result[day].paidP1 || isPaid; 
            } else {
               result[day].dueP2 = true;
               result[day].paidP2 = result[day].paidP2 || isPaid; 
            }
        }
    }
  };

  processPayer("P1", freqP1, totalPeriodsP1, baseInstallmentP1);
  if (goalType === "shared") {
     processPayer("P2", freqP2, totalPeriodsP2, baseInstallmentP2);
  }

  return result;
}

export function PaymentCalendar({
  startDate,
  frequencyP1,
  frequencyP2,
  nameP1,
  nameP2,
  paymentsHistory,
  excludeSundays,
  goalType,
  results,
  formatCurrency,
}: PaymentCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const monthYear = { year: viewYear, month: viewMonth };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const dueDatesMap = useMemo(() => {
    return computeDueDatesMap(
      startDate,
      frequencyP1, results.totalPeriodsP1,
      frequencyP2, results.totalPeriodsP2,
      excludeSundays, goalType, monthYear,
      paymentsHistory, results.baseInstallmentP1 || results.installmentP1, results.baseInstallmentP2 || results.installmentP2
    );
  }, [startDate, frequencyP1, results.totalPeriodsP1,
      frequencyP2, results.totalPeriodsP2,
      excludeSundays, goalType, monthYear, paymentsHistory,
      results.baseInstallmentP1, results.installmentP1,
      results.baseInstallmentP2, results.installmentP2]);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getDayStatus = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const isToday = date.toDateString() === today.toDateString();
    const isPast = date < today && !isToday;
    const info = dueDatesMap[day] || { dueP1: false, paidP1: false, dueP2: false, paidP2: false };
    return { 
      isToday, 
      isPast, 
      isDueP1: info.dueP1, 
      isDueP2: info.dueP2, 
      paidP1: info.paidP1, 
      paidP2: info.paidP2 
    };
  };

  return (
    <div className="space-y-4 pb-24">
      <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md border-0">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{monthNames[viewMonth]} {viewYear}</h3>
              {(viewMonth !== today.getMonth() || viewYear !== today.getFullYear()) && (
                <button
                  onClick={() => {
                    setViewYear(today.getFullYear());
                    setViewMonth(today.getMonth());
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  Hoje
                </button>
              )}
            </div>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Week days header */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[14px] font-bold text-slate-500 uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const { isToday, isPast, isDueP1, isDueP2, paidP1, paidP2 } = getDayStatus(day);
              const hasDue = isDueP1 || isDueP2;
              const hasPaid = paidP1 || paidP2;

              return (
                <div 
                  key={day} 
                  className={`flex flex-col items-center py-1 ${hasDue ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
                  onClick={() => {
                    if (hasDue) setSelectedDay(day);
                  }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium relative
                    ${isToday ? "ring-2 ring-amber-400 text-amber-300 font-bold" : ""}
                    ${hasPaid ? "bg-emerald-500/30 text-emerald-300" : ""}
                    ${hasDue && !hasPaid && !isPast ? "bg-amber-500/20 text-amber-300" : ""}
                    ${hasDue && !hasPaid && isPast ? "bg-rose-500/20 text-rose-400" : ""}
                    ${!hasDue && !hasPaid && !isToday ? "text-slate-400" : ""}
                  `}>
                    {day}
                    {hasDue && (
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {isDueP1 && <div className={`w-1 h-1 rounded-full ${paidP1 ? "bg-emerald-400" : isPast ? "bg-rose-400" : "bg-amber-400"}`} />}
                        {isDueP2 && <div className={`w-1 h-1 rounded-full ${paidP2 ? "bg-emerald-400" : isPast ? "bg-rose-400" : "bg-amber-400"}`} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full bg-emerald-500/50" /> Pago
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full bg-amber-500/30" /> Vencimento futuro
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full bg-rose-500/30" /> Vencimento atrasado
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full ring-2 ring-amber-400" /> Hoje
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Due date summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 rounded-2xl flex flex-col h-full">
          <div className="flex-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-2">
              {nameP1.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-semibold text-white">{nameP1}</p>
            <p className="text-xs text-slate-400 mt-1">
              {results.daysToNextP1 > 0
                ? `Próximo em ${results.daysToNextP1} dia${results.daysToNextP1 > 1 ? "s" : ""}`
                : results.daysToNextP1 === 0 ? "Vence hoje!"
                : `Atrasado ${Math.abs(results.daysToNextP1)} dia${Math.abs(results.daysToNextP1) > 1 ? "s" : ""}`}
            </p>
            {results.paidPeriodsCountP1 > 0 && (
              <p className="text-xs text-slate-400 mt-1">Pagas: {results.paidPeriodsCountP1} {results.paidPeriodsCountP1 === 1 ? 'parcela' : 'parcelas'}</p>
            )}
            {results.latePeriodsCountP1 > 0 && (
              <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <p className="text-xs text-rose-400 font-medium">Atrasadas: {results.latePeriodsCountP1} {results.latePeriodsCountP1 === 1 ? 'parcela' : 'parcelas'}</p>
                <p className="text-sm font-bold text-rose-400 mt-1">{formatCurrency(results.lateValueP1 || 0)}</p>
              </div>
            )}
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">Próxima parcela</p>
            <p className="text-sm font-bold text-emerald-400">{formatCurrency(results.installmentP1 || 0)}</p>
          </div>
        </div>
        {goalType === "shared" && (
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 rounded-2xl flex flex-col h-full">
            <div className="flex-1">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm mb-2">
                {nameP2.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-white">{nameP2}</p>
              <p className="text-xs text-slate-400 mt-1">
                {results.daysToNextP2 > 0
                  ? `Próximo em ${results.daysToNextP2} dia${results.daysToNextP2 > 1 ? "s" : ""}`
                  : results.daysToNextP2 === 0 ? "Vence hoje!"
                  : `Atrasado ${Math.abs(results.daysToNextP2)} dia${Math.abs(results.daysToNextP2) > 1 ? "s" : ""}`}
              </p>
              {results.paidPeriodsCountP2 > 0 && (
                <p className="text-xs text-slate-400 mt-1">Pagas: {results.paidPeriodsCountP2} {results.paidPeriodsCountP2 === 1 ? 'parcela' : 'parcelas'}</p>
              )}
              {results.latePeriodsCountP2 > 0 && (
                <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p className="text-xs text-rose-400 font-medium">Atrasadas: {results.latePeriodsCountP2} {results.latePeriodsCountP2 === 1 ? 'parcela' : 'parcelas'}</p>
                  <p className="text-sm font-bold text-rose-400 mt-1">{formatCurrency(results.lateValueP2 || 0)}</p>
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1">Próxima parcela</p>
              <p className="text-sm font-bold text-amber-400">{formatCurrency(results.installmentP2 || 0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Day Details Modal */}
      {selectedDay !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-xl max-w-sm w-full relative animate-in zoom-in-95 duration-200 z-[101]">
            <button 
              onClick={() => setSelectedDay(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-1">
              Dia {selectedDay} de {monthNames[viewMonth]}
            </h3>
            <p className="text-sm text-slate-400 mb-6">Valores esperados para esta data</p>
            
            <div className="space-y-3">
              {(() => {
                const dayStatus = getDayStatus(selectedDay);
                return (
                  <>
                    {dayStatus.isDueP1 && (
                      <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                            {nameP1.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{nameP1}</p>
                            <p className={`text-xs ${dayStatus.paidP1 ? "text-emerald-400" : "text-amber-400"}`}>{dayStatus.paidP1 ? "Baixado" : "Pendente"}</p>
                          </div>
                        </div>
                        <p className="font-bold text-white">{formatCurrency(results.baseInstallmentP1 || results.installmentP1 || 0)}</p>
                      </div>
                    )}
                    {dayStatus.isDueP2 && (
                      <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                            {nameP2.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{nameP2}</p>
                            <p className={`text-xs ${dayStatus.paidP2 ? "text-emerald-400" : "text-amber-400"}`}>{dayStatus.paidP2 ? "Baixado" : "Pendente"}</p>
                          </div>
                        </div>
                        <p className="font-bold text-white">{formatCurrency(results.baseInstallmentP2 || results.installmentP2 || 0)}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            <button
              onClick={() => setSelectedDay(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition"
            >
              Fechar
            </button>
          </div>
          <div className="absolute inset-0 z-[100]" onClick={() => setSelectedDay(null)} />
        </div>
      )}
    </div>
  );
}

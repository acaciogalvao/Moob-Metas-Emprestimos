import { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Calendar, CheckCircle2, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { parseLocalDate } from "../loan-lib/utils";
import { calculateGoal, getLoanTotalWithInterest } from "../loan-lib/calculations";

interface DashboardProps {
  goalsList: any[];
  formatCurrency: (v: number) => string;
  onSelectGoal: (id: string, section: "metas" | "emprestimos") => void;
}

export function Dashboard({ goalsList, formatCurrency, onSelectGoal }: DashboardProps) {
  const loans = goalsList.filter((g) => g.category === "loan");
  const savings = goalsList.filter((g) => g.category !== "loan");

  const getRealSaved = (g: any) => {
    if (g.payments && g.payments.length > 0) {
      return g.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    }
    return (g.savedP1 || 0) + (g.savedP2 || 0);
  };

  const loanStats = useMemo(() => {
    const totalComJuros = loans.reduce((s, g) => s + getLoanTotalWithInterest(g), 0);
    const paid = loans.reduce((s, g) => s + getRealSaved(g), 0);
    const remaining = Math.max(0, totalComJuros - paid);
    return { count: loans.length, total: totalComJuros, paid, remaining };
  }, [loans]);

  const savingsStats = useMemo(() => {
    const total = savings.reduce((s, g) => s + (g.totalValue || 0), 0);
    const saved = savings.reduce((s, g) => s + getRealSaved(g), 0);
    const remaining = Math.max(0, total - saved);
    return { count: savings.length, total, saved, remaining };
  }, [savings]);

  const upcomingPayments = useMemo(() => {
    const paymentsSummary: any[] = [];
    
    goalsList.forEach(g => {
      const isLoan = g.category === "loan";
      const results = calculateGoal({
        totalValue: g.totalValue?.toString() || "0",
        months: g.months?.toString() || "1",
        savedP1: (g.savedP1 || 0).toString(),
        savedP2: (g.savedP2 || 0).toString(),
        contributionP1: (g.contributionP1 || 50).toString(),
        goalType: g.type || "shared",
        startDate: g.startDate || new Date().toISOString(),
        endDate: g.endDate || new Date().toISOString(),
        frequencyP1: g.frequencyP1 || "monthly",
        frequencyP2: g.frequencyP2 || "monthly",
        interestRate: (g.interestRate || 0).toString(),
        excludeSundays: g.excludeSundays ?? false,
        applyLateFees: g.applyLateFees ?? false,
        category: g.category || "other",
        durationUnit: g.durationUnit || "months",
        deadlineType: g.deadlineType || "duration",
        payments: g.payments || [],
        dueDayP1: g.dueDayP1 || Math.min(28, new Date().getDate()),
        dueDayP2: g.dueDayP2 || Math.min(28, new Date().getDate()),
      });

      const addPayer = (payerId: string, name: string, isLate: boolean, daysToNext: number, installment: number, remaining: number) => {
         if (remaining <= 0) return;
         
         // Consider all upcoming payments and late payments
         if (daysToNext !== undefined) {
            paymentsSummary.push({
               goal: g,
               payerName: name || "Usuário",
               isLate,
               daysToNext,
               installment,
               category: g.category
            });
         }
      };

      if (g.type === "individual") {
         addPayer("P1", g.nameP1, results.isLateP1, results.daysToNextP1, results.installmentP1, results.remainingP1);
      } else {
         addPayer("P1", g.nameP1, results.isLateP1, results.daysToNextP1, results.installmentP1, results.remainingP1);
         addPayer("P2", g.nameP2, results.isLateP2, results.daysToNextP2, results.installmentP2, results.remainingP2);
      }
    });

    return paymentsSummary.sort((a, b) => a.daysToNext - b.daysToNext);
  }, [goalsList]);

  const StatCard = ({ icon, label, value, sub, color }: any) => (
    <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-2 sm:p-4 flex flex-col gap-1 sm:gap-2 justify-center">
      <div className={`flex items-center gap-1 sm:gap-2 ${color} overflow-hidden`}>
        <div className="shrink-0">{icon}</div>
        <span className="text-[12.5px] sm:text-xs font-bold uppercase tracking-normal sm:tracking-widest truncate">{label}</span>
      </div>
      <div className="text-sm sm:text-xl font-black text-white truncate" title={value}>{value}</div>
      {sub && <div className="text-[12.5px] sm:text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );

  const chartData = [
    { name: "Empréstimos", value: loanStats.total, color: "#f43f5e" }, // rose-500
    { name: "Metas", value: savingsStats.total, color: "#0ea5e9" }, // amber-500
  ].filter(d => d.value > 0);

  const COLORS = chartData.map(d => d.color);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <div className="uppercase tracking-widest text-[13px] font-bold text-slate-500 pl-1">Resumo Geral</div>
      
      {chartData.length > 0 && (
        <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md border-0 mb-6">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-40 h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    stroke="none"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <PieChartIcon className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-[14px] font-bold text-slate-500 uppercase">Portfólio</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 w-full">
               <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-rose-500" />
                   <span className="text-sm font-medium text-slate-300">Empréstimos</span>
                 </div>
                 <span className="text-sm font-bold text-white">{formatCurrency(loanStats.total)}</span>
               </div>
               <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-amber-500" />
                   <span className="text-sm font-medium text-slate-300">Metas</span>
                 </div>
                 <span className="text-sm font-bold text-white">{formatCurrency(savingsStats.total)}</span>
               </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empréstimos */}
      <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md border-0">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-rose-500/20">
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="font-bold text-white">Empréstimos <span className="text-slate-400 font-normal text-sm">({loanStats.count} ativo{loanStats.count !== 1 ? "s" : ""})</span></h3>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Total" value={formatCurrency(loanStats.total)} color="text-slate-400" />
            <StatCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Pago" value={formatCurrency(loanStats.paid)} color="text-emerald-400" />
            <StatCard icon={<AlertCircle className="w-3.5 h-3.5" />} label="Restante" value={formatCurrency(loanStats.remaining)} color="text-rose-400" />
          </div>
          {loanStats.total > 0 && (
            <div className="mt-3">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (loanStats.paid / loanStats.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-right">
                {Math.round((loanStats.paid / loanStats.total) * 100)}% quitado
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metas */}
      <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md border-0">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="font-bold text-white">Metas <span className="text-slate-400 font-normal text-sm">({savingsStats.count} ativa{savingsStats.count !== 1 ? "s" : ""})</span></h3>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Objetivo" value={formatCurrency(savingsStats.total)} color="text-slate-400" />
            <StatCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Guardado" value={formatCurrency(savingsStats.saved)} color="text-amber-400" />
            <StatCard icon={<AlertCircle className="w-3.5 h-3.5" />} label="Faltando" value={formatCurrency(savingsStats.remaining)} color="text-amber-400" />
          </div>
          {savingsStats.total > 0 && (
            <div className="mt-3">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (savingsStats.saved / savingsStats.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-right">
                {Math.round((savingsStats.saved / savingsStats.total) * 100)}% concluído
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximos vencimentos */}
      <div>
        <div className="uppercase tracking-widest text-[13px] font-bold text-slate-500 pl-1 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Próximos Vencimentos
        </div>
        {upcomingPayments.length === 0 ? (
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-6 text-center text-slate-400 text-sm rounded-2xl">
            Nenhum vencimento futuro 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingPayments.map(({ goal, payerName, isLate, daysToNext, installment, category }, idx) => {
              const isLoan = category === "loan";
              return (
                <button
                  key={`${goal._id}-${idx}`}
                  onClick={() => onSelectGoal(goal._id, isLoan ? "emprestimos" : "metas")}
                  className="w-full bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/10 transition-all text-left gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isLoan ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {(goal.itemName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{goal.itemName || "Sem nome"}</p>
                      <p className="text-xs text-slate-400">{payerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <div className={`text-[14px] sm:text-xs px-2 py-1 rounded-md font-bold whitespace-nowrap uppercase tracking-widest ${
                      isLate 
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : daysToNext === 0
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {isLate 
                         ? `Atrasado ${Math.max(1, Math.abs(daysToNext))} dia(s)`
                         : daysToNext === 0 
                           ? "Vence hoje" 
                           : `Próximo em ${daysToNext} dia(s)`
                      }
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Parcela de</p>
                      <p className={`font-bold text-sm ${isLoan ? "text-rose-400" : "text-amber-400"}`}>{formatCurrency(installment)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

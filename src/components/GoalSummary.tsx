import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  MessageCircle,
  Copy,
  CheckCircle2,
  Clock,
  Share2,
  Edit2,
  Trash2,
  PlusCircle,
  Bell,
  BellRing,
  Zap,
  Calculator,
  MessageSquare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useState } from "react";
import { ReminderModal } from "./ReminderModal";

interface GoalSummaryProps {
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  handleDeleteGoal: () => void;
  setShowPixModal: (val: boolean) => void;
  setCurrentPayer: (val: "P1" | "P2") => void;
  goalType: "individual" | "shared";
  category: string;
  interestRate: string;
  results: any;
  savedP1: string;
  savedP2: string;
  nameP1: string;
  nameP2: string;
  contributionP1: string;
  contributionP2: number;
  frequencyP1: string;
  frequencyP2: string;
  phoneP1: string;
  phoneP2: string;
  pixKeyP1?: string;
  pixKeyP2?: string;
  startDate: string;
  endDate: string;
  itemName: string;
  months: string;
  durationUnit: "days" | "weeks" | "months";
  dueDayP1?: number;
  dueDayP2?: number;
  formatCurrency: (value: number) => string;
  getFreqLabel: (freq: string) => string;
  handleExportText: () => string;
  showToast: (text: string, type?: "success" | "error") => void;
  remindersEnabled?: boolean;
  setRemindersEnabled?: (val: boolean) => void;
  handleSaveGoals?: (overrideUpdates?: any) => Promise<void>;
  motivationalMessage?: string;
  excludeSundays?: boolean;
  onShowCalculator?: () => void;
  onShowEarlySettlement?: () => void;
}

export function GoalSummary({
  isEditing,
  setIsEditing,
  handleDeleteGoal,
  setShowPixModal,
  setCurrentPayer,
  goalType,
  category,
  interestRate,
  results,
  savedP1,
  savedP2,
  nameP1,
  nameP2,
  contributionP1,
  contributionP2,
  frequencyP1,
  frequencyP2,
  phoneP1,
  phoneP2,
  pixKeyP1 = "",
  pixKeyP2 = "",
  startDate,
  endDate,
  itemName,
  months,
  durationUnit,
  dueDayP1 = 5,
  dueDayP2 = 5,
  formatCurrency,
  getFreqLabel,
  handleExportText,
  showToast,
  remindersEnabled,
  setRemindersEnabled,
  handleSaveGoals,
  motivationalMessage,
  excludeSundays,
  onShowCalculator,
  onShowEarlySettlement,
}: GoalSummaryProps) {
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  const getDueDateLabel = (freq: string, day: number) => {
    if (freq === "daily") return "";
    if (freq === "weekly") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return `(Venc. ${days[day] || "Seg"})`;
    }
    return `(Venc. dia ${day})`;
  };

  const handleOpenReminder = () => {
    const text = handleExportText();
    setSummaryText(text);
    setShowReminderModal(true);
  };

  const sendWhatsAppReminder = (payerId: "P1" | "P2") => {
    const isP1 = payerId === "P1";
    const name = isP1 ? nameP1 : nameP2;
    const phone = isP1 ? phoneP1 : phoneP2;
    const daysToNext = isP1 ? results.daysToNextP1 : results.daysToNextP2;
    const installment = isP1 ? results.installmentP1 : results.installmentP2;
    const pixKey = isP1 ? pixKeyP2 : pixKeyP1;

    let msg = `🔔 *LEMBRETE DE PAGAMENTO*\n\n`;
    msg += `Olá, *${name}*!\n\n`;
    if (daysToNext < 0) {
      msg += `⚠️ Sua parcela está *ATRASADA há ${Math.abs(daysToNext)} dia${Math.abs(daysToNext) > 1 ? "s" : ""}*!\n\n`;
    } else if (daysToNext === 0) {
      msg += `🚨 Sua parcela de *${formatCurrency(installment)}* vence *hoje*!\n\n`;
    } else if (daysToNext === 1) {
      msg += `⏰ Sua parcela de *${formatCurrency(installment)}* vence *amanhã*!\n\n`;
    } else {
      msg += `📅 Sua parcela de *${formatCurrency(installment)}* vence em *${daysToNext} dias*.\n\n`;
    }
    msg += `📋 *${itemName || (category === "loan" ? "Empréstimo" : "Meta")}*\n`;
    msg += `💰 Valor da parcela: *${formatCurrency(installment)}*\n`;
    if (pixKey) msg += `\n🔑 *Chave PIX:* \`${pixKey}\`\n`;
    msg += `\n_Metacompartilhada Empréstimos_`;

    const encodedMsg = encodeURIComponent(msg);
    const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
    if (cleanPhone) {
      window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodedMsg}`, "_blank");
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, "_blank");
    }
  };

  let daysRemainingGoal: null | number = null;
  if (results.endDate || endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(results.endDate || endDate);
    end.setHours(0, 0, 0, 0);
    let totalDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (excludeSundays) {
      let sundaysCount = 0;
      if (totalDays > 0) {
        let cur = new Date(today);
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) { if (cur.getDay() === 0) sundaysCount++; cur.setDate(cur.getDate() + 1); }
        totalDays -= sundaysCount;
      } else if (totalDays < 0) {
        let cur = new Date(end);
        cur.setDate(cur.getDate() + 1);
        while (cur <= today) { if (cur.getDay() === 0) sundaysCount++; cur.setDate(cur.getDate() + 1); }
        totalDays += sundaysCount;
      }
    }
    daysRemainingGoal = totalDays;
  }

  const isLoanActive = category === "loan" && results.total - results.saved > 0;

  return (
    <div className="space-y-6">
      {/* MAIN GOAL CARD */}
      <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md relative overflow-hidden text-white border-0">
        <CardContent className="p-5 sm:p-8">
          <div className="flex justify-between items-start mb-6 w-full">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {itemName || (category === "loan" ? "Novo Empréstimo" : "Nova Meta")}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-400">
                  {goalType === "individual" ? nameP1 : `${nameP1} & ${nameP2}`}
                </p>
                {category === "loan" && (
                  <span className="px-2 py-0.5 rounded text-[14px] uppercase font-bold tracking-wider bg-rose-500/20 shadow-sm border border-rose-500/30 text-rose-400">
                    Empréstimo ({interestRate}% Juros)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              {category === "loan" && onShowCalculator && (
                <button
                  onClick={onShowCalculator}
                  title="Calculadora"
                  className="w-10 h-10 rounded-xl bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/50 shadow-md shadow-amber-500/5 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Calculator className="w-5.5 h-5.5 stroke-[2.2]" />
                </button>
              )}
              {isLoanActive && onShowEarlySettlement && (
                <button
                  onClick={onShowEarlySettlement}
                  title="Quitação Antecipada"
                  className="w-10 h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Zap className="w-5.5 h-5.5 stroke-[2.2]" />
                </button>
              )}
              <button
                onClick={handleOpenReminder}
                title="Enviar Lembrete"
                className="w-10 h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/50 shadow-md shadow-amber-500/5 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <BellRing className="w-5.5 h-5.5 stroke-[2.2]" />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                title="Editar"
                className="w-10 h-10 rounded-xl bg-slate-700/20 hover:bg-white text-slate-300 hover:text-slate-950 border border-slate-500/50 shadow-[0_0_10px_rgba(100,116,139,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Edit2 className="w-5.5 h-5.5 stroke-[2.2]" />
              </button>
              <button
                onClick={handleDeleteGoal}
                title="Excluir"
                className="w-10 h-10 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-5.5 h-5.5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          <div className="flex flex-col mb-6">
            <div className="flex justify-between items-end mb-2">
              <div className="text-[3rem] sm:text-4xl leading-none font-bold text-white tracking-tighter">
                {Math.floor(results.progressPercent)}%
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-3xl font-mono font-bold text-white">
                  {formatCurrency(results.saved)}
                </div>
                <span className="text-sm text-slate-500 italic">de {formatCurrency(results.total)}</span>
              </div>
            </div>
            <div className="w-full h-8 bg-slate-900/50 rounded-full overflow-hidden border border-white/5 mb-2 relative">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 progress-glow transition-all duration-1000 ease-in-out"
                style={{ width: `${Math.min(100, Math.floor(results.progressPercent))}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 group">
              <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-400 transition-colors mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Prazo</span>
              </div>
              <span className="font-bold text-white text-[15px] leading-tight">
                {new Date(results.startDate || startDate).toLocaleDateString()}
                <br />
                <span className="text-slate-400 font-normal mt-1 block">
                  até {new Date(results.endDate || endDate).toLocaleDateString()}
                </span>
                {daysRemainingGoal !== null && (
                  <div className="flex flex-col items-start mt-2">
                    <span className="text-[14.5px] font-medium text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md inline-block">
                      {daysRemainingGoal < 0 ? (
                        <span className="text-rose-400">
                          Atrasado há {Math.abs(daysRemainingGoal)} dia{Math.abs(daysRemainingGoal) > 1 ? "s" : ""}
                        </span>
                      ) : daysRemainingGoal === 0 ? (
                        <span className="text-amber-400">Termina hoje!</span>
                      ) : (
                        <span>Faltam {daysRemainingGoal} dia{daysRemainingGoal > 1 ? "s" : ""}</span>
                      )}
                    </span>
                    
                    {category === "loan" && (
                      <span className="text-[14.5px] font-medium text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md inline-block mt-1.5">
                        {goalType === "individual" ? (
                          <>{Math.min(results.paidPeriodsCountP1, results.totalPeriodsP1)} pagas • {Math.max(0, results.totalPeriodsP1 - results.paidPeriodsCountP1)} faltam (de {results.totalPeriodsP1})</>
                        ) : (
                          <>{Math.min(Math.max(results.paidPeriodsCountP1, results.paidPeriodsCountP2), Math.max(results.totalPeriodsP1, results.totalPeriodsP2))} pagas • {Math.max(0, Math.max(results.totalPeriodsP1, results.totalPeriodsP2) - Math.max(results.paidPeriodsCountP1, results.paidPeriodsCountP2))} faltam (de {Math.max(results.totalPeriodsP1, results.totalPeriodsP2)})</>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 group">
              <div className="flex items-center gap-2 text-slate-400 group-hover:text-pink-400 transition-colors mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Restante</span>
              </div>
              <span className="font-bold text-pink-400 text-lg">
                {formatCurrency(results.total - results.saved)}
              </span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 col-span-2 md:col-span-1 flex flex-col justify-between cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-400 transition-colors">
                  <Bell className="w-4 h-4" />
                  <span className="text-xs font-medium">Lembretes</span>
                </div>
                <button
                  onClick={() => {
                    const newValue = !remindersEnabled;
                    if (setRemindersEnabled) setRemindersEnabled(newValue);
                    if (handleSaveGoals) handleSaveGoals({ remindersEnabled: newValue });
                  }}
                  className={`w-10 h-5 rounded-full relative transition-colors focus:outline-none ${remindersEnabled ? "bg-amber-500" : "bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${remindersEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              <span className="text-xs text-slate-500">
                {remindersEnabled ? "Ativados (WhatsApp/Email)" : "Desativados"}
              </span>
            </div>
          </div>

          {results.total - results.saved > 0 && (frequencyP1 === "monthly" || frequencyP2 === "monthly") && (
            <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
              <div className="text-left w-full border-b border-white/5 pb-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">Esforço Sugerido Consolidado</p>
                <p className="text-xs text-slate-400 leading-normal">
                  Para bater o prazo total de {new Date(results.endDate || endDate).toLocaleDateString()} com periodicidade mensal, sugerimos acumular:
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diário */}
                <div className="flex flex-col justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[12.5px] font-bold text-slate-400 uppercase tracking-wide">Equivalente Diário</span>
                  <span className="text-lg font-black text-white font-mono mt-1">
                    {formatCurrency(results.dailyTotal)} <span className="text-xs text-slate-400 font-normal">/ dia</span>
                  </span>
                  {goalType === "shared" && (
                    <p className="text-xs text-slate-500 mt-1 leading-snug">
                      ({formatCurrency(results.dailyP1)} {nameP1} + {formatCurrency(results.dailyP2)} {nameP2})
                    </p>
                  )}
                </div>
                {/* Semanal */}
                <div className="flex flex-col justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[12.5px] font-bold text-slate-400 uppercase tracking-wide">Equivalente Semanal</span>
                  <span className="text-lg font-black text-white font-mono mt-1">
                    {formatCurrency(results.weeklyTotal)} <span className="text-xs text-slate-400 font-normal">/ sem</span>
                  </span>
                  {goalType === "shared" && (
                    <p className="text-xs text-slate-500 mt-1 leading-snug">
                      ({formatCurrency(results.weeklyP1)} {nameP1} + {formatCurrency(results.weeklyP2)} {nameP2})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-amber-400 text-[15px] font-medium tracking-tight">
            {motivationalMessage || "Bom começo! Mantenham a consistência."}
          </div>
        </CardContent>
      </Card>

      {/* CONTRIBUTIONS OVERVIEW */}
      {!isEditing && (
        <div className="space-y-4 pt-2">
          <div className="uppercase tracking-widest text-[13px] font-bold text-slate-400 pl-2">
            {category === "loan" ? "Quitações" : "Contribuições"}
          </div>

          {/* P1 Card */}
          <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md shadow-sm border-0 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl shrink-0">
                    {nameP1.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg leading-tight flex items-center gap-2">
                      {nameP1}
                      {results.remainingP1 === 0 ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[14px] px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-widest font-bold">Concluído</span>
                      ) : results.isLateP1 ? (
                        <span className="bg-rose-500/20 text-rose-400 text-[14px] px-2 py-0.5 rounded-md border border-rose-500/30 uppercase tracking-widest font-bold">Atrasado</span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[14px] px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-widest font-bold">Em Dia</span>
                      )}
                    </h3>
                    <p className="text-[13px] text-slate-400 font-medium mb-1.5">
                      {contributionP1}% {category === "loan" ? "do empréstimo" : "da meta"}
                    </p>
                    {results.remainingP1 > 0 && results.daysToNextP1 !== undefined && !Number.isNaN(results.daysToNextP1) && (
                      <p className={`text-[14.5px] font-medium px-2 py-0.5 rounded-md inline-flex mt-1 ${results.isLateP1 ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" : "bg-white/5 border border-white/10 text-slate-300"}`}>
                        {results.isLateP1 ? (
                          <span>Atraso de {Math.max(1, Math.abs(results.daysToNextP1))} dia{Math.max(1, Math.abs(results.daysToNextP1)) > 1 ? "s" : ""}</span>
                        ) : results.daysToNextP1 === 0 ? (
                          <span className="text-amber-400 font-bold">Vence hoje!</span>
                        ) : (
                          <span>Próximo: vence em {results.daysToNextP1} dia{results.daysToNextP1 > 1 ? "s" : ""}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-900/50 border border-white/5 h-2 rounded-full mb-6 relative overflow-hidden">
                <div
                  className="bg-emerald-500 progress-glow h-full rounded-full transition-all duration-1000 ease-in-out"
                  style={{ width: `${Math.min(100, (results.sP1 / results.totalP1) * 100)}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6 divide-x divide-white/10">
                <div className="flex flex-col text-left px-1">
                  <span className="text-[14.5px] text-slate-400 mb-1">{category === "loan" ? "Pago" : "Guardado"}</span>
                  <span className="text-sm sm:text-[15px] font-bold text-white">{formatCurrency(results.sP1)}</span>
                </div>
                <div className="flex flex-col text-center px-1">
                  <span className="text-[14.5px] text-pink-400 mb-1">Restante</span>
                  <span className="text-sm sm:text-[15px] font-bold text-pink-500">{formatCurrency(results.remainingP1)}</span>
                </div>
                <div className="flex flex-col text-right px-1">
                  <span className="text-[14.5px] text-amber-400 mb-1">{getFreqLabel(frequencyP1)} <span className="text-[12.5px] text-amber-200/70">{getDueDateLabel(frequencyP1, dueDayP1)}</span></span>
                  <span className="text-sm sm:text-[15px] font-bold text-amber-500">{formatCurrency(results.installmentP1)}</span>
                </div>
              </div>

              {frequencyP1 === "monthly" && results.remainingP1 > 0 && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex flex-col gap-2.5">
                  <span className="flex items-center gap-1.5 font-bold text-[12.5px] uppercase tracking-wide text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Sugestão de Acúmulo Proporcional
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col p-2 bg-slate-950/40 rounded-lg border border-white/5">
                      <span className="text-slate-400 text-[11px] uppercase font-semibold">Valor Diário</span>
                      <strong className="text-white font-extrabold font-mono text-[14px] mt-0.5">
                        {formatCurrency(results.dailyP1)} <span className="text-[11px] text-slate-400 font-normal">/ dia</span>
                      </strong>
                    </div>
                    <div className="flex flex-col p-2 bg-slate-950/40 rounded-lg border border-white/5">
                      <span className="text-slate-400 text-[11px] uppercase font-semibold">Valor Semanal</span>
                      <strong className="text-white font-extrabold font-mono text-[14px] mt-0.5">
                        {formatCurrency(results.weeklyP1)} <span className="text-[11px] text-slate-400 font-normal">/ sem</span>
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-white text-slate-900 border-0 hover:bg-slate-100 rounded-xl shadow-lg shadow-white/10 h-14 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                  onClick={() => { setCurrentPayer("P1"); setShowPixModal(true); }}
                >
                  {category === "loan" ? "NOVA QUITAÇÃO" : "NOVA CONTRIBUIÇÃO"}
                </Button>
                {results.remainingP1 > 0 && phoneP1 && (
                  <button
                    onClick={() => sendWhatsAppReminder("P1")}
                    title="Enviar lembrete via WhatsApp"
                    className="h-14 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 text-sm font-bold"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Lembrete</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* P2 Card */}
          {goalType === "shared" && (
            <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md shadow-sm relative border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl shrink-0">
                      {nameP2.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight flex items-center gap-2">
                        {nameP2}
                        {results.remainingP2 === 0 ? (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[14px] px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-widest font-bold">Concluído</span>
                        ) : results.isLateP2 ? (
                          <span className="bg-rose-500/20 text-rose-400 text-[14px] px-2 py-0.5 rounded-md border border-rose-500/30 uppercase tracking-widest font-bold">Atrasado</span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[14px] px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-widest font-bold">Em Dia</span>
                        )}
                      </h3>
                      <p className="text-[13px] text-slate-400 font-medium mb-1.5">
                        {contributionP2}% {category === "loan" ? "do empréstimo" : "da meta"}
                      </p>
                      {results.remainingP2 > 0 && results.daysToNextP2 !== undefined && !Number.isNaN(results.daysToNextP2) && (
                        <p className={`text-[14.5px] font-medium px-2 py-0.5 rounded-md inline-flex mt-1 ${results.isLateP2 ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" : "bg-white/5 border border-white/10 text-slate-300"}`}>
                          {results.isLateP2 ? (
                            <span>Atraso de {Math.max(1, Math.abs(results.daysToNextP2))} dia{Math.max(1, Math.abs(results.daysToNextP2)) > 1 ? "s" : ""}</span>
                          ) : results.daysToNextP2 === 0 ? (
                            <span className="text-amber-400 font-bold">Vence hoje!</span>
                          ) : (
                            <span>Próximo: vence em {results.daysToNextP2} dia{results.daysToNextP2 > 1 ? "s" : ""}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-slate-900/50 border border-white/5 h-2 rounded-full mb-6 relative overflow-hidden">
                  <div
                    className="bg-amber-500 progress-glow h-full rounded-full transition-all duration-1000 ease-in-out"
                    style={{ width: `${Math.min(100, (results.sP2 / results.totalP2) * 100)}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6 divide-x divide-white/10">
                  <div className="flex flex-col text-left px-1">
                    <span className="text-[14.5px] text-slate-400 mb-1">{category === "loan" ? "Pago" : "Guardado"}</span>
                    <span className="text-sm sm:text-[15px] font-bold text-white">{formatCurrency(results.sP2)}</span>
                  </div>
                  <div className="flex flex-col text-center px-1">
                    <span className="text-[14.5px] text-pink-400 mb-1">Restante</span>
                    <span className="text-sm sm:text-[15px] font-bold text-pink-500">{formatCurrency(results.remainingP2)}</span>
                  </div>
                  <div className="flex flex-col text-right px-1">
                    <span className="text-[14.5px] text-amber-400 mb-1">{getFreqLabel(frequencyP2)} <span className="text-[12.5px] text-amber-200/70">{getDueDateLabel(frequencyP2, dueDayP2)}</span></span>
                    <span className="text-sm sm:text-[15px] font-bold text-amber-500">{formatCurrency(results.installmentP2)}</span>
                  </div>
                </div>

                {frequencyP2 === "monthly" && results.remainingP2 > 0 && (
                  <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <span className="flex items-center gap-1.5 font-bold text-[12.5px] uppercase tracking-wide text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Sugestão de Acúmulo Proporcional
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col p-2 bg-slate-950/40 rounded-lg border border-white/5">
                        <span className="text-slate-400 text-[11px] uppercase font-semibold">Valor Diário</span>
                        <strong className="text-white font-extrabold font-mono text-[14px] mt-0.5">
                          {formatCurrency(results.dailyP2)} <span className="text-[11px] text-slate-400 font-normal">/ dia</span>
                        </strong>
                      </div>
                      <div className="flex flex-col p-2 bg-slate-950/40 rounded-lg border border-white/5">
                        <span className="text-slate-400 text-[11px] uppercase font-semibold">Valor Semanal</span>
                        <strong className="text-white font-extrabold font-mono text-[14px] mt-0.5">
                          {formatCurrency(results.weeklyP2)} <span className="text-[11px] text-slate-400 font-normal">/ sem</span>
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-white text-slate-900 border-0 hover:bg-slate-100 rounded-xl shadow-lg shadow-white/10 h-14 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                    onClick={() => { setCurrentPayer("P2"); setShowPixModal(true); }}
                  >
                    {category === "loan" ? "NOVA QUITAÇÃO" : "NOVA CONTRIBUIÇÃO"}
                  </Button>
                  {results.remainingP2 > 0 && phoneP2 && (
                    <button
                      onClick={() => sendWhatsAppReminder("P2")}
                      title="Enviar lembrete via WhatsApp"
                      className="h-14 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 text-sm font-bold"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">Lembrete</span>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        goalType={goalType}
        category={category}
        nameP1={nameP1}
        nameP2={nameP2}
        phoneP1={phoneP1}
        phoneP2={phoneP2}
        summaryText={summaryText}
        showToast={showToast}
      />
    </div>
  );
}

/**
 * Componente GoalForm.
 * Renderiza o formulário completo para criação e edição de metas e empréstimos.
 * Contém campos para nome, valor, prazos, taxas de juros (para empréstimos),
 * e configurações de divisão entre as pessoas envolvidas.
 */
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface GoalFormProps {
  goalType: "individual" | "shared";
  setGoalType: (val: "individual" | "shared") => void;
  category: string;
  setCategory: (val: string) => void;
  interestRate: string;
  setInterestRate: (val: string) => void;
  applyLateFees?: boolean;
  setApplyLateFees?: (val: boolean) => void;
  itemName: string;
  setItemName: (val: string) => void;
  totalValue: string;
  setTotalValue: (val: string) => void;
  months: string;
  setMonths: (val: string) => void;
  durationUnit: "days" | "weeks" | "months";
  setDurationUnit: (val: "days" | "weeks" | "months") => void;
  deadlineType: "duration" | "dates";
  setDeadlineType: (val: "duration" | "dates") => void;
  excludeSundays: boolean;
  setExcludeSundays: (val: boolean) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  nameP1: string;
  setNameP1: (val: string) => void;
  nameP2: string;
  setNameP2: (val: string) => void;
  pixKeyP1: string;
  setPixKeyP1: (val: string) => void;
  pixKeyP2: string;
  setPixKeyP2: (val: string) => void;
  phoneP1: string;
  setPhoneP1: (val: string) => void;
  phoneP2: string;
  setPhoneP2: (val: string) => void;
  contributionP1: string;
  setContributionP1: (val: string) => void;
  frequencyP1: string;
  setFrequencyP1: (val: string) => void;
  frequencyP2: string;
  setFrequencyP2: (val: string) => void;
  dueDayP1: number;
  setDueDayP1: (val: number) => void;
  dueDayP2: number;
  setDueDayP2: (val: number) => void;
  formatCurrency: (val: number) => string;
  handleCurrencyChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function GoalForm({
  goalType,
  setGoalType,
  category,
  setCategory,
  interestRate,
  setInterestRate,
  applyLateFees,
  setApplyLateFees,
  itemName,
  setItemName,
  totalValue,
  setTotalValue,
  months,
  setMonths,
  durationUnit,
  setDurationUnit,
  deadlineType,
  setDeadlineType,
  excludeSundays,
  setExcludeSundays,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  nameP1,
  setNameP1,
  nameP2,
  setNameP2,
  pixKeyP1,
  setPixKeyP1,
  pixKeyP2,
  setPixKeyP2,
  phoneP1,
  setPhoneP1,
  phoneP2,
  setPhoneP2,
  contributionP1,
  setContributionP1,
  frequencyP1,
  setFrequencyP1,
  frequencyP2,
  setFrequencyP2,
  dueDayP1,
  setDueDayP1,
  dueDayP2,
  setDueDayP2,
  formatCurrency,
  handleCurrencyChange,
  onCancel,
  onSave,
}: GoalFormProps) {
  const [activeTab, setActiveTab] = useState<"meta" | "pessoas">("meta");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getInitialPixType = (key: string) => {
    if (!key) return "celular";
    if (key.includes("@")) return "email";
    if (key.includes("-") && key.length === 36) return "random";
    const num = key.replace(/\D/g, "");
    if (num.length === 11 && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(key))
      return "celular";
    if (num.length > 0) return "cpf_cnpj";
    return "celular";
  };

  const [pixTypeP1, setPixTypeP1] = useState<string>(
    getInitialPixType(pixKeyP1),
  );
  const [pixTypeP2, setPixTypeP2] = useState<string>(
    getInitialPixType(pixKeyP2),
  );

  const commonMonths = ["3", "6", "12", "18", "24", "36", "48", "60"];
  const percentages = ["10", "20", "30", "40", "50", "60", "70", "80", "90"];

  const formatPhone = (val: string) => {
    val = val.replace(/\D/g, "");
    if (val.length === 0) return "";
    if (val.length <= 2) return `(${val}`;
    if (val.length <= 6) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length <= 10)
      return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
    return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`;
  };

  const formatPixKeyInput = (inputVal: string, type: string) => {
    if (!inputVal) return "";
    let val = inputVal;

    // Extract from copy-paste BR-code
    if (val.startsWith("000201") && val.includes("br.gov.bcb.pix01")) {
      const idx = val.indexOf("br.gov.bcb.pix01");
      if (idx !== -1) {
        const lenStr = val.substring(idx + 16, idx + 18);
        const len = parseInt(lenStr, 10);
        if (!isNaN(len)) {
          val = val.substring(idx + 18, idx + 18 + len);
        }
      }
    }

    if (type === "email" || type === "random") return val;

    if (type === "celular") {
      const digits = val.replace(/\D/g, "");
      if (digits.length === 0) return "";
      if (digits.length <= 2) return `(${digits}`;
      if (digits.length <= 6)
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      if (digits.length <= 10)
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }

    if (type === "cpf_cnpj") {
      const digits = val.replace(/\D/g, "");
      if (digits.length <= 11) {
        if (digits.length <= 3) return digits;
        if (digits.length <= 6)
          return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9)
          return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
      } else {
        let res = digits.slice(0, 14);
        if (res.length <= 2) return res;
        if (res.length <= 5) return `${res.slice(0, 2)}.${res.slice(2)}`;
        if (res.length <= 8)
          return `${res.slice(0, 2)}.${res.slice(2, 5)}.${res.slice(5)}`;
        if (res.length <= 12)
          return `${res.slice(0, 2)}.${res.slice(2, 5)}.${res.slice(5, 8)}/${res.slice(8)}`;
        return `${res.slice(0, 2)}.${res.slice(2, 5)}.${res.slice(5, 8)}/${res.slice(8, 12)}-${res.slice(12, 14)}`;
      }
    }

    return val;
  };

  const handleValidation = () => {
    const newErrors: Record<string, string> = {};
    if (!itemName.trim())
      newErrors.itemName =
        category === "loan"
          ? "O título do empréstimo é obrigatório."
          : "O nome da meta é obrigatório.";
    if (!totalValue || Number(totalValue) <= 0)
      newErrors.totalValue = "O valor deve ser maior que 0.";
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e <= s)
      newErrors.months = "A data final deve ser maior que a data de início.";

    const isValidPix = (key: string, type: string) => {
      if (!key) return true;
      if (type === "email") return key.includes("@") && key.length > 4;
      if (type === "random") return key.length > 10;

      const digits = key.replace(/\D/g, "");
      if (type === "celular")
        return digits.length === 11 || digits.length === 10;
      if (type === "cpf_cnpj")
        return digits.length === 11 || digits.length === 14;
      return digits.length >= 10 && digits.length <= 14;
    };

    if (activeTab === "pessoas" || category === "loan") {
      if (!nameP1.trim()) newErrors.nameP1 = "O nome é obrigatório.";
      if (pixKeyP1 && !isValidPix(pixKeyP1, pixTypeP1))
        newErrors.pixKeyP1 = "Chave Pix inválida para o tipo selecionado.";

      if (goalType === "shared") {
        if (!nameP2.trim()) newErrors.nameP2 = "O nome é obrigatório.";
        if (pixKeyP2 && !isValidPix(pixKeyP2, pixTypeP2))
          newErrors.pixKeyP2 = "Chave Pix inválida para o tipo selecionado.";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // If errors are on the other tab, switch to it
      if (category !== "loan") {
        if (newErrors.itemName || newErrors.totalValue || newErrors.months) {
          if (activeTab !== "meta") setActiveTab("meta");
        } else if (newErrors.nameP1 || newErrors.nameP2) {
          if (activeTab !== "pessoas") setActiveTab("pessoas");
        }
      }
      return false;
    }
    return true;
  };

  const handleSaveClick = () => {
    if (handleValidation()) {
      onSave();
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-xl bg-slate-950/95 z-[100] flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle sticky top-0 z-10 border-b border-white/10 shadow-sm">
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-white font-medium transition-colors"
        >
          Cancelar
        </button>
        <h2 className="font-bold text-white text-lg">
          {itemName
            ? category === "loan"
              ? "Editar Empréstimo"
              : "Editar Meta"
            : category === "loan"
              ? "Novo Empréstimo"
              : "Nova Meta"}
        </h2>
        <button
          onClick={handleSaveClick}
          className="text-amber-400 hover:text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(245, 158, 11,0.3)] transition-colors"
        >
          Salvar
        </button>
      </div>

      {/* Tabs */}
      {category !== "loan" && (
        <div className="flex p-4 pb-2 z-10">
          <div className="flex w-full bg-white/5 rounded-2xl p-1 border border-white/10 backdrop-blur-md">
            <button
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "meta" ? "bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245, 158, 11,0.2)] border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
              onClick={() => setActiveTab("meta")}
            >
              A Meta
            </button>
            <button
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "pessoas" ? "bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245, 158, 11,0.2)] border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
              onClick={() => setActiveTab("pessoas")}
            >
              {goalType === "shared" ? "As Pessoas" : "Seus Dados"}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide z-10 pb-20">
        {(activeTab === "meta" || category === "loan") && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-2 mb-4">
              <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                {category === "loan" ? "Tipo de Empréstimo" : "Tipo de Meta"}
              </Label>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${goalType === "shared" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-300"}`}
                  onClick={() => setGoalType("shared")}
                >
                  Em Casal (Dividida)
                </button>
                <button
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${goalType === "individual" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-300"}`}
                  onClick={() => setGoalType("individual")}
                >
                  Individual (Só eu)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="itemName"
                className="text-amber-400 font-bold text-[14px] uppercase tracking-widest"
              >
                {category === "loan"
                  ? goalType === "shared"
                    ? "Qual o título do empréstimo? *"
                    : "Qual o título do empréstimo? *"
                  : goalType === "shared"
                    ? "O que vocês querem conquistar? *"
                    : "O que você quer conquistar? *"}
              </Label>
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  if (errors.itemName) setErrors({ ...errors, itemName: "" });
                }}
                className={`rounded-xl h-12 text-white placeholder-slate-500 bg-white/5 focus-visible:ring-amber-500/50 ${errors.itemName ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10 focus:border-amber-500/50"}`}
              />
              {errors.itemName && (
                <p className="text-xs text-red-400 font-medium mt-1">
                  {errors.itemName}
                </p>
              )}
            </div>

            <div
              className={
                category === "loan"
                  ? "grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_150px] gap-3"
                  : "space-y-2"
              }
            >
              <div className="space-y-2">
                <Label
                  htmlFor="totalValue"
                  className="text-amber-400 font-bold text-[14px] uppercase tracking-widest"
                >
                  Valor Total *
                </Label>
                <Input
                  id="totalValue"
                  inputMode="numeric"
                  value={
                    totalValue === "" ? "" : formatCurrency(Number(totalValue))
                  }
                  onChange={(e) => {
                    handleCurrencyChange(e, setTotalValue as any);
                    if (errors.totalValue)
                      setErrors({ ...errors, totalValue: "" });
                  }}
                  className={`rounded-xl h-12 text-white bg-white/5 focus-visible:ring-amber-500/50 ${errors.totalValue ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10 focus:border-amber-500/50"}`}
                />
                {errors.totalValue && (
                  <p className="text-xs text-red-400 font-medium mt-1">
                    {errors.totalValue}
                  </p>
                )}
              </div>

              {category === "loan" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="interestRate"
                      className="text-amber-400 font-bold text-[14px] uppercase tracking-widest"
                    >
                      {applyLateFees ? "% Juros da Regra (Fixo)" : "% Juros (ao Mês)"}
                    </Label>
                    <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-sm h-12">
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        disabled={applyLateFees}
                        value={applyLateFees ? "7.73" : interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full border-0 bg-transparent text-center font-bold text-white focus-visible:ring-0 h-full px-1 sm:px-3 disabled:opacity-50"
                      />
                      <div className="flex items-center pr-2 pl-1 sm:px-3 text-slate-400 text-xs sm:text-sm border-l border-white/10 bg-black/20">
                        %
                      </div>
                    </div>
                  </div>

                  {setApplyLateFees && (
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-amber-500/20 rounded-xl">
                      <Label className="text-white text-xs font-medium cursor-pointer max-w-[80%]" htmlFor="applyLateFees">
                        Aplicar Regra Especial (Tabela Price: 7.73% a.m. | Atraso: 1.076% ao dia)
                      </Label>
                      <div
                        className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          applyLateFees ? "bg-rose-500" : "bg-white/10"
                        }`}
                        onClick={() => setApplyLateFees(!applyLateFees)}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            applyLateFees ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

  {category === "loan" && (
              <div className="text-xs text-slate-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex justify-between items-center">
                <span>Total a pagar com Juros:</span>
                <strong className="text-sm text-amber-400">
                  {formatCurrency((() => {
                    const baseTotal = Number(totalValue) || 0;
                    if (applyLateFees) {
                      const rate = 0.0772782;
                      let timeValue = Number(months) || 1;
                      let totalMonths = timeValue;
                      if (durationUnit === "days") totalMonths = timeValue / 30.4166;
                      if (durationUnit === "weeks") totalMonths = timeValue / 4.3333;
                      const n = totalMonths > 0 ? totalMonths : 1;
                      const pmt = baseTotal * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
                      return pmt * n;
                    } else {
                      const rate = Number(interestRate) / 100;
                      if (rate <= 0) return baseTotal;
                      return baseTotal * (1 + rate);
                    }
                  })())}
                </strong>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2 mb-4">
                <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                  Formato de Prazo
                </Label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${deadlineType === "duration" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-300"}`}
                    onClick={() => setDeadlineType("duration")}
                  >
                    Duração
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${deadlineType === "dates" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-300"}`}
                    onClick={() => setDeadlineType("dates")}
                  >
                    Datas Abertas
                  </button>
                </div>
              </div>

              {deadlineType === "duration" ? (
                <div className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_150px] gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="months"
                      className={`font-bold text-[14px] uppercase tracking-widest ${errors.months ? "text-red-400" : "text-amber-400"}`}
                    >
                      Quantidade de tempo *
                    </Label>
                    <Input
                      id="months"
                      type="number"
                      min="1"
                      value={months}
                      onChange={(e) => {
                        setMonths(e.target.value);
                        if (errors.months) setErrors({ ...errors, months: "" });
                      }}
                      className={`rounded-xl h-12 text-white bg-white/5 focus-visible:ring-amber-500/50 ${errors.months ? "border-red-400/50 focus-visible:ring-red-400" : "border-white/10 focus:border-amber-500/50"}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-transparent font-bold text-[14px] uppercase tracking-widest block">
                      Unidade
                    </Label>
                    <select
                      value={durationUnit}
                      onChange={(e) =>
                        setDurationUnit(
                          e.target.value as "days" | "weeks" | "months",
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-800 text-white h-12 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      <option value="days">Dias</option>
                      <option value="weeks">Semanas</option>
                      <option value="months">Meses</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 space-y-2">
                    <Label
                      className={`font-bold text-[14px] uppercase tracking-widest ${errors.months ? "text-red-400" : "text-amber-400"}`}
                    >
                      Data Início *
                    </Label>
                    <Input
                      type="date"
                      value={
                        startDate.includes("T")
                          ? startDate.split("T")[0]
                          : startDate
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          const newStart = new Date(
                            e.target.value + "T12:00:00Z",
                          );
                          setStartDate(newStart.toISOString());

                          const currentEnd = new Date(endDate);
                          if (currentEnd <= newStart) {
                            const newEnd = new Date(newStart);
                            newEnd.setDate(newEnd.getDate() + 1);
                            setEndDate(newEnd.toISOString());
                          } else if (
                            currentEnd.getFullYear() !== newStart.getFullYear()
                          ) {
                            const newEnd = new Date(currentEnd);
                            newEnd.setFullYear(newStart.getFullYear());
                            if (newEnd <= newStart) {
                              newEnd.setDate(newStart.getDate() + 1);
                            }
                            setEndDate(newEnd.toISOString());
                          }
                        }
                      }}
                      className={`bg-white/5 text-white h-12 ${errors.months ? "border-red-400/50 focus-visible:ring-red-400" : "border-white/10"}`}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label
                      className={`font-bold text-[14px] uppercase tracking-widest ${errors.months ? "text-red-400" : "text-amber-400"}`}
                    >
                      Data Final *
                    </Label>
                    <Input
                      type="date"
                      min={
                        startDate.includes("T")
                          ? startDate.split("T")[0]
                          : startDate
                      }
                      value={
                        endDate.includes("T") ? endDate.split("T")[0] : endDate
                      }
                      onChange={(e) => {
                        if (e.target.value)
                          setEndDate(
                            new Date(
                              e.target.value + "T12:00:00Z",
                            ).toISOString(),
                          );
                        if (errors.months) setErrors({ ...errors, months: "" });
                      }}
                      className={`bg-white/5 text-white h-12 ${errors.months ? "border-red-400/50 focus-visible:ring-red-400" : "border-white/10"}`}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 ml-1">
                <input
                  type="checkbox"
                  id="excludeSundays"
                  checked={excludeSundays}
                  onChange={(e) => {
                    setExcludeSundays(e.target.checked);
                    if (e.target.checked) {
                      if (dueDayP1 === 0) setDueDayP1(1);
                      if (dueDayP2 === 0) setDueDayP2(1);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500 bg-slate-800"
                />
                <Label
                  htmlFor="excludeSundays"
                  className="text-xs text-slate-300 font-medium cursor-pointer"
                >
                  Descontar domingos da contagem de dias
                </Label>
              </div>

              {errors.months && (
                <p className="text-red-400 text-xs font-semibold">
                  {errors.months}
                </p>
              )}
            </div>

            {goalType === "shared" && (
              <div className="space-y-3">
                <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest">
                  Divisão: {nameP1} {contributionP1}% / {nameP2}{" "}
                  {100 - Number(contributionP1)}%
                </Label>

                <div className="w-full bg-white/5 h-1.5 rounded-full mb-4 relative overflow-hidden border border-white/5">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all shadow-[0_0_8px_rgba(245, 158, 11,0.8)]"
                    style={{ width: `${contributionP1}%` }}
                  ></div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {percentages.map((p) => (
                    <button
                      key={p}
                      onClick={() => setContributionP1(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${contributionP1 === p ? "bg-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245, 158, 11,0.5)]" : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 text-white"}`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Injected Pessoa fields for Loan */}
            {category === "loan" && (
              <div className="space-y-6 pt-4 border-t border-white/10">
                <div className="space-y-4">
                  {goalType === "shared" && (
                    <h3 className="font-bold text-amber-400 text-sm">
                      Dados do Titular 1
                    </h3>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      {category === "loan"
                        ? "Nome (quem está pagando) *"
                        : "Nome *"}
                    </Label>
                    <Input
                      value={nameP1}
                      onChange={(e) => {
                        setNameP1(e.target.value);
                        if (errors.nameP1) setErrors({ ...errors, nameP1: "" });
                      }}
                      className={`rounded-xl bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.nameP1 ? "border-red-400/50" : "border-white/10"}`}
                    />
                    {errors.nameP1 && (
                      <p className="text-[14px] text-red-400 font-medium">
                        {errors.nameP1}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      WhatsApp
                    </Label>
                    <Input
                      type="tel"
                      value={phoneP1}
                      onChange={(e) => setPhoneP1(formatPhone(e.target.value))}
                      placeholder="(99) 99999-9999"
                      className="rounded-xl border-white/10 bg-white/5 text-white placeholder-slate-600 h-11 focus-visible:ring-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      {category === "loan"
                        ? "Chave Pix (quem vai receber)"
                        : "Chave Pix"}
                    </Label>
                    <div className="flex gap-2">
                      <select
                        value={pixTypeP1}
                        onChange={(e) => {
                          setPixTypeP1(e.target.value);
                          setPixKeyP1(
                            formatPixKeyInput(pixKeyP1, e.target.value),
                          );
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 text-white h-11 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none text-[14.5px] w-[95px] sm:w-[120px] shrink-0"
                      >
                        <option value="celular" className="text-slate-900">
                          Celular
                        </option>
                        <option value="cpf_cnpj" className="text-slate-900">
                          CPF/CNPJ
                        </option>
                        <option value="email" className="text-slate-900">
                          E-mail
                        </option>
                        <option value="random" className="text-slate-900">
                          Aleatória
                        </option>
                      </select>
                      <Input
                        value={pixKeyP1}
                        onChange={(e) => {
                          setPixKeyP1(
                            formatPixKeyInput(e.target.value, pixTypeP1),
                          );
                          if (errors.pixKeyP1)
                            setErrors({ ...errors, pixKeyP1: "" });
                        }}
                        inputMode={
                          pixTypeP1 === "celular"
                            ? "tel"
                            : pixTypeP1 === "cpf_cnpj"
                              ? "numeric"
                              : pixTypeP1 === "email"
                                ? "email"
                                : "text"
                        }
                        className={`rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 flex-1 ${errors.pixKeyP1 ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10"}`}
                        placeholder={
                          pixTypeP1 === "celular"
                            ? "(99) 99999-9999"
                            : pixTypeP1 === "cpf_cnpj"
                              ? "000.000.000-00"
                              : pixTypeP1 === "email"
                                ? "email@exemplo.com"
                                : "Aleatória"
                        }
                      />
                    </div>
                    {errors.pixKeyP1 && (
                      <p className="text-[14px] text-red-400 font-medium">
                        {errors.pixKeyP1}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <>
                      <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                        Frequência de pagamento
                      </Label>
                      <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 mb-3">
                        {["daily", "weekly", "monthly"].map((freq) => (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => setFrequencyP1(freq)}
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${frequencyP1 === freq ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                          >
                            {freq === "daily"
                              ? "Diário"
                              : freq === "weekly"
                                ? "Semanal"
                                : "Mensal"}
                          </button>
                        ))}
                      </div>
                    </>
                  </div>
                </div>

                {goalType === "shared" && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <h3 className="font-bold text-amber-400 text-sm">
                      Dados do Titular 2
                    </h3>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 font-bold text-xs">
                        {category === "loan"
                          ? "Nome (quem está pagando) *"
                          : "Nome *"}
                      </Label>
                      <Input
                        value={nameP2}
                        onChange={(e) => {
                          setNameP2(e.target.value);
                          if (errors.nameP2)
                            setErrors({ ...errors, nameP2: "" });
                        }}
                        className={`rounded-xl bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.nameP2 ? "border-red-400/50" : "border-white/10"}`}
                      />
                      {errors.nameP2 && (
                        <p className="text-[14px] text-red-400 font-medium">
                          {errors.nameP2}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 font-bold text-xs">
                        WhatsApp
                      </Label>
                      <Input
                        type="tel"
                        value={phoneP2}
                        onChange={(e) =>
                          setPhoneP2(formatPhone(e.target.value))
                        }
                        placeholder="(99) 99999-9999"
                        className="rounded-xl border-white/10 bg-white/5 text-white placeholder-slate-600 h-11 focus-visible:ring-amber-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 font-bold text-xs">
                        {category === "loan"
                          ? "Chave Pix (quem vai receber)"
                          : "Chave Pix"}
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={pixTypeP2}
                          onChange={(e) => {
                            setPixTypeP2(e.target.value);
                            setPixKeyP2(
                              formatPixKeyInput(pixKeyP2, e.target.value),
                            );
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 text-white h-11 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none text-[14.5px] w-[95px] sm:w-[120px] shrink-0"
                        >
                          <option value="celular" className="text-slate-900">
                            Celular
                          </option>
                          <option value="cpf_cnpj" className="text-slate-900">
                            CPF/CNPJ
                          </option>
                          <option value="email" className="text-slate-900">
                            E-mail
                          </option>
                          <option value="random" className="text-slate-900">
                            Aleatória
                          </option>
                        </select>
                        <Input
                          value={pixKeyP2}
                          onChange={(e) => {
                            setPixKeyP2(
                              formatPixKeyInput(e.target.value, pixTypeP2),
                            );
                            if (errors.pixKeyP2)
                              setErrors({ ...errors, pixKeyP2: "" });
                          }}
                          inputMode={
                            pixTypeP2 === "celular"
                              ? "tel"
                              : pixTypeP2 === "cpf_cnpj"
                                ? "numeric"
                                : pixTypeP2 === "email"
                                  ? "email"
                                  : "text"
                          }
                          className={`flex-1 rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.pixKeyP2 ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10"}`}
                          placeholder={
                            pixTypeP2 === "celular"
                              ? "(99) 99999-9999"
                              : pixTypeP2 === "cpf_cnpj"
                                ? "000.000.000-00"
                                : pixTypeP2 === "email"
                                  ? "email@exemplo.com"
                                  : "Aleatória"
                          }
                        />
                      </div>
                      {errors.pixKeyP2 && (
                        <p className="text-[14px] text-red-400 font-medium">
                          {errors.pixKeyP2}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <>
                        <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                          Frequência de pagamento
                        </Label>
                        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 mb-3">
                          {["daily", "weekly", "monthly"].map((freq) => (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setFrequencyP2(freq)}
                              className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${frequencyP2 === freq ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                            >
                              {freq === "daily"
                                ? "Diário"
                                : freq === "weekly"
                                  ? "Semanal"
                                  : "Mensal"}
                            </button>
                          ))}
                        </div>
                      </>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "pessoas" && category !== "loan" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 pb-10">
            {/* Pessoa 1 */}
            <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle border-white/10 rounded-2xl shadow-sm overflow-hidden bg-transparent">
              <div className="bg-white/5 p-3 border-b border-white/10">
                <h3 className="font-bold text-amber-400">Pessoa 1</h3>
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 font-bold text-xs">
                    Nome *
                  </Label>
                  <Input
                    value={nameP1}
                    onChange={(e) => {
                      setNameP1(e.target.value);
                      if (errors.nameP1) setErrors({ ...errors, nameP1: "" });
                    }}
                    className={`rounded-xl bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.nameP1 ? "border-red-400/50" : "border-white/10"}`}
                  />
                  {errors.nameP1 && (
                    <p className="text-[14px] text-red-400 font-medium">
                      {errors.nameP1}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 font-bold text-xs">
                    WhatsApp
                  </Label>
                  <Input
                    type="tel"
                    value={phoneP1}
                    onChange={(e) => setPhoneP1(formatPhone(e.target.value))}
                    placeholder="(99) 99999-9999"
                    className="rounded-xl border-white/10 bg-white/5 text-white placeholder-slate-600 h-11 focus-visible:ring-amber-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 font-bold text-xs">
                    Chave Pix
                  </Label>
                  <div className="flex gap-2">
                    <select
                      value={pixTypeP1}
                      onChange={(e) => {
                        setPixTypeP1(e.target.value);
                        setPixKeyP1(
                          formatPixKeyInput(pixKeyP1, e.target.value),
                        );
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 text-white h-11 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none text-[14.5px] w-[95px] sm:w-[120px] shrink-0"
                    >
                      <option value="celular" className="text-slate-900">
                        Celular
                      </option>
                      <option value="cpf_cnpj" className="text-slate-900">
                        CPF/CNPJ
                      </option>
                      <option value="email" className="text-slate-900">
                        E-mail
                      </option>
                      <option value="random" className="text-slate-900">
                        Aleatória
                      </option>
                    </select>
                    <Input
                      value={pixKeyP1}
                      onChange={(e) => {
                        setPixKeyP1(
                          formatPixKeyInput(e.target.value, pixTypeP1),
                        );
                        if (errors.pixKeyP1)
                          setErrors({ ...errors, pixKeyP1: "" });
                      }}
                      inputMode={
                        pixTypeP1 === "celular"
                          ? "tel"
                          : pixTypeP1 === "cpf_cnpj"
                            ? "numeric"
                            : pixTypeP1 === "email"
                              ? "email"
                              : "text"
                      }
                      className={`rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 flex-1 ${errors.pixKeyP1 ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10"}`}
                      placeholder={
                        pixTypeP1 === "celular"
                          ? "(99) 99999-9999"
                          : pixTypeP1 === "cpf_cnpj"
                            ? "000.000.000-00"
                            : pixTypeP1 === "email"
                              ? "email@exemplo.com"
                              : "Aleatória"
                      }
                    />
                  </div>
                  {errors.pixKeyP1 && (
                    <p className="text-[14px] text-red-400 font-medium">
                      {errors.pixKeyP1}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 pt-2">
                  <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                    Frequência de contribuição
                  </Label>
                  <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 mb-3">
                    {["daily", "weekly", "monthly"].map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setFrequencyP1(freq)}
                        className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${frequencyP1 === freq ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                      >
                        {freq === "daily"
                          ? "Diário"
                          : freq === "weekly"
                            ? "Semanal"
                            : "Mensal"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pessoa 2 */}
            {goalType === "shared" && (
              <Card className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle border-white/10 rounded-2xl shadow-sm overflow-hidden bg-transparent">
                <div className="bg-white/5 p-3 border-b border-white/10">
                  <h3 className="font-bold text-amber-400">Pessoa 2</h3>
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      Nome *
                    </Label>
                    <Input
                      value={nameP2}
                      onChange={(e) => {
                        setNameP2(e.target.value);
                        if (errors.nameP2) setErrors({ ...errors, nameP2: "" });
                      }}
                      className={`rounded-xl bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.nameP2 ? "border-red-400/50" : "border-white/10"}`}
                    />
                    {errors.nameP2 && (
                      <p className="text-[14px] text-red-400 font-medium">
                        {errors.nameP2}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      WhatsApp
                    </Label>
                    <Input
                      type="tel"
                      value={phoneP2}
                      onChange={(e) => setPhoneP2(formatPhone(e.target.value))}
                      placeholder="(99) 99999-9999"
                      className="rounded-xl border-white/10 bg-white/5 text-white placeholder-slate-600 h-11 focus-visible:ring-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 font-bold text-xs">
                      Chave Pix
                    </Label>
                    <div className="flex gap-2">
                      <select
                        value={pixTypeP2}
                        onChange={(e) => {
                          setPixTypeP2(e.target.value);
                          setPixKeyP2(
                            formatPixKeyInput(pixKeyP2, e.target.value),
                          );
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 text-white h-11 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none text-[14.5px] w-[95px] sm:w-[120px] shrink-0"
                      >
                        <option value="celular" className="text-slate-900">
                          Celular
                        </option>
                        <option value="cpf_cnpj" className="text-slate-900">
                          CPF/CNPJ
                        </option>
                        <option value="email" className="text-slate-900">
                          E-mail
                        </option>
                        <option value="random" className="text-slate-900">
                          Aleatória
                        </option>
                      </select>
                      <Input
                        value={pixKeyP2}
                        onChange={(e) => {
                          setPixKeyP2(
                            formatPixKeyInput(e.target.value, pixTypeP2),
                          );
                          if (errors.pixKeyP2)
                            setErrors({ ...errors, pixKeyP2: "" });
                        }}
                        inputMode={
                          pixTypeP2 === "celular"
                            ? "tel"
                            : pixTypeP2 === "cpf_cnpj"
                              ? "numeric"
                              : pixTypeP2 === "email"
                                ? "email"
                                : "text"
                        }
                        className={`flex-1 rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-amber-500/50 ${errors.pixKeyP2 ? "border-red-400/50 focus-visible:ring-red-500/50" : "border-white/10"}`}
                        placeholder={
                          pixTypeP2 === "celular"
                            ? "(99) 99999-9999"
                            : pixTypeP2 === "cpf_cnpj"
                              ? "000.000.000-00"
                              : pixTypeP2 === "email"
                                ? "email@exemplo.com"
                                : "Aleatória"
                        }
                      />
                    </div>
                    {errors.pixKeyP2 && (
                      <p className="text-[14px] text-red-400 font-medium">
                        {errors.pixKeyP2}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-amber-400 font-bold text-[14px] uppercase tracking-widest block mb-2">
                      Frequência de contribuição
                    </Label>
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 mb-3">
                      {["daily", "weekly", "monthly"].map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setFrequencyP2(freq)}
                          className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${frequencyP2 === freq ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                        >
                          {freq === "daily"
                            ? "Diário"
                            : freq === "weekly"
                              ? "Semanal"
                              : "Mensal"}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

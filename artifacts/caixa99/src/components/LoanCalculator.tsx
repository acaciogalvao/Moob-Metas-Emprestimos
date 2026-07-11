import React, { useState, useMemo } from "react";
import { X, Calculator, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoanCalculatorProps {
  onClose: () => void;
  initialValue?: string;
  initialRate?: string;
  formatCurrency: (v: number) => string;
  handleCurrencyChange: (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => void;
}

export function LoanCalculator({ onClose, initialValue = "", initialRate = "", formatCurrency, handleCurrencyChange }: LoanCalculatorProps) {
  const [valor, setValor] = useState(initialValue);
  const [taxa, setTaxa] = useState(initialRate || "2");
  const [entrada, setEntrada] = useState("0");
  const [parcelas, setParcelas] = useState("12");

  const principal = useMemo(() => {
    const v = Number(valor) || 0;
    const e = Number(entrada) || 0;
    return Math.max(0, v - e);
  }, [valor, entrada]);

  const calcSimpleInterest = (n: number) => {
    if (principal <= 0 || n <= 0) return { installment: 0, total: 0, interest: 0 };
    const r = Number(taxa) / 100;
    const totalAmount = principal * (1 + r);
    return { 
      installment: totalAmount / n, 
      total: totalAmount, 
      interest: totalAmount - principal 
    };
  };

  const scenarios = useMemo(() => {
    const customN = parseInt(parcelas, 10);
    const defaultScenarios = [6, 12, 18, 24, 36, 48];
    if (customN > 0 && !defaultScenarios.includes(customN)) {
      const arr = [...defaultScenarios, customN].sort((a, b) => a - b);
      return arr;
    }
    return defaultScenarios;
  }, [parcelas]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4">
      <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/90 border border-slate-800/80 backdrop-blur-md p-5 border-b border-white/10 flex justify-between items-center z-10">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-400" />
            Calculadora de Empréstimo
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor total</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="R$ 0,00"
                value={valor === "" ? "" : formatCurrency(Number(valor))}
                onChange={(e) => handleCurrencyChange(e, setValor)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Taxa Total (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entrada (opcional)</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="R$ 0,00"
                value={entrada === "" ? "" : formatCurrency(Number(entrada))}
                onChange={(e) => handleCurrencyChange(e, setEntrada)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Parcelas</label>
              <input
                type="number"
                min="1"
                max="360"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            </div>
          </div>

          {principal > 0 && (
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-3 rounded-xl text-center">
              <p className="text-xs text-slate-400">Valor financiado</p>
              <p className="text-lg font-black text-white">{formatCurrency(principal)}</p>
            </div>
          )}

          {/* Scenarios table */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> Cenários de parcelamento
            </p>
            <div className="rounded-xl overflow-hidden border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-xs">
                    <th className="text-left px-3 py-2 font-bold">Prazo</th>
                    <th className="text-right px-3 py-2 font-bold">Parcela</th>
                    <th className="text-right px-3 py-2 font-bold">Total juros</th>
                    <th className="text-right px-3 py-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((n) => {
                    const { installment, total, interest } = calcSimpleInterest(n);
                    const isCustom = n === parseInt(parcelas, 10);
                    return (
                      <tr key={n} className={`border-t border-white/5 transition-colors ${isCustom ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-white/5"}`}>
                        <td className="px-3 py-2.5 text-white font-semibold flex items-center gap-2">
                          {n}x {isCustom && <span className="text-[14px] bg-amber-500/20 text-amber-400 px-1 rounded truncate max-w-[60px]">Sua escolha</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-emerald-400 font-bold">{formatCurrency(installment)}</td>
                        <td className="px-3 py-2.5 text-right text-rose-400 text-xs">{formatCurrency(interest)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300 text-xs">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[14px] text-slate-500 text-center">* Juros simples flat (aplicado ao final e dividido em parcelas fixas)</p>
          </div>

          <Button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl mt-2">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente AppHeader.
 * Responsável por renderizar o cabeçalho superior da aplicação, 
 * exibindo o título correspondente à seção atual (Metas ou Empréstimos)
 * e o botão para criação de novo registro.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Calculator } from "lucide-react";
import { GoalType } from "../types";

interface AppHeaderProps {
  currentSection: "metas" | "emprestimos";
  goalType: GoalType;
  handleCreateNewGoal: () => void;
  onShowCalculator?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentSection,
  goalType,
  handleCreateNewGoal,
  onShowCalculator,
}) => {
  return (
    <header className="flex justify-between items-end mb-6">
      <div>
        <h1 
          className="text-lg font-black text-white tracking-tight uppercase leading-none animate-in fade-in font-sans"
        >
          {currentSection === "emprestimos"
            ? "Meus Empréstimos"
            : goalType === "individual"
              ? "Meta Individual"
              : "Meta Compartilhada"}
        </h1>
        <p className="text-slate-400 mt-1 uppercase text-[12px] tracking-wider font-semibold font-mono">
          {currentSection === "emprestimos"
            ? "Controle suas dívidas e quitações"
            : goalType === "individual"
              ? "Acompanhe o seu progresso financeiro"
              : "Dashboard de Controle Financeiro"}
        </p>
      </div>
      <div className="text-right flex items-center gap-2">
        {currentSection === "emprestimos" && onShowCalculator && (
          <button
            onClick={onShowCalculator}
            title="Simulador"
            className="w-11 h-11 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Calculator className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}
        <button
          onClick={handleCreateNewGoal}
          title={currentSection === "emprestimos" ? "Novo Empréstimo" : "Nova Meta"}
          className="w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 hover:text-slate-950 border border-amber-600/30 hover:scale-105 active:scale-95 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>
    </header>
  );
};

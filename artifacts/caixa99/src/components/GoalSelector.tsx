/**
 * Componente GoalSelector.
 * Dropdown para selecionar qual meta ou empréstimo está sendo 
 * visualizado/editado no momento. Lista os itens disponíveis 
 * da seção atual.
 */
import React from "react";
import { Target, ChevronDown } from "lucide-react";
import { Goal } from "../types";

interface GoalSelectorProps {
  currentGoalId: string;
  setCurrentGoalId: (id: string) => void;
  filteredGoalsList: Goal[];
  currentSection: "metas" | "emprestimos";
  setIsEditing: (val: boolean) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (val: boolean) => void;
}

export const GoalSelector: React.FC<GoalSelectorProps> = ({
  currentGoalId,
  setCurrentGoalId,
  filteredGoalsList,
  currentSection,
  setIsEditing,
  isDropdownOpen,
  setIsDropdownOpen,
}) => {
  if (filteredGoalsList.length === 0) {
    return (
      <div className="mb-6">
        <p className="text-sm text-slate-500 italic">
          Nenhum item cadastrado nesta sessão.
        </p>
      </div>
    );
  }

  const selectedGoal = filteredGoalsList.find((g) => g._id === currentGoalId);

  return (
    <div className="relative mb-6 md:w-1/2 lg:w-1/3 text-left">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full h-11 pl-10 pr-10 bg-slate-900 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm flex items-center justify-between cursor-pointer"
      >
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Target className="w-4 h-4 text-amber-500" />
        </div>
        <span className="truncate">
          {selectedGoal?.itemName ||
            (currentSection === "emprestimos"
              ? "Novo Empréstimo"
              : "Nova Meta")}
          {selectedGoal?.nameP1
            ? ` (${selectedGoal.nameP1}${selectedGoal.type === "shared" && selectedGoal.nameP2 ? ` e ${selectedGoal.nameP2}` : ""})`
            : ""}
        </span>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40 blur-sm bg-black/10 transition-all"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute top-12 left-0 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="max-h-60 overflow-y-auto w-full scrollbar-thin scrollbar-thumb-amber-500/50 scrollbar-track-transparent">
              {filteredGoalsList.map((goal) => (
                <button
                  key={goal._id}
                  onClick={() => {
                    setCurrentGoalId(goal._id);
                    setIsEditing(false);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors cursor-pointer ${currentGoalId === goal._id ? "bg-amber-500/10 border-l-2 border-amber-500" : "hover:bg-white/5 border-l-2 border-transparent"}`}
                >
                  <div className="flex-1 truncate">
                    <div
                      className={`text-sm font-semibold truncate ${currentGoalId === goal._id ? "text-amber-500" : "text-slate-200"}`}
                    >
                      {goal.itemName ||
                        (currentSection === "emprestimos"
                          ? "Novo Empréstimo"
                          : "Nova Meta")}
                    </div>
                    {goal.nameP1 && (
                      <div className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5 font-mono">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${currentGoalId === goal._id ? "bg-amber-500" : "bg-slate-600"}`}
                        />
                        {goal.nameP1}
                        {goal.type === "shared" && goal.nameP2
                          ? ` e ${goal.nameP2}`
                          : ""}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

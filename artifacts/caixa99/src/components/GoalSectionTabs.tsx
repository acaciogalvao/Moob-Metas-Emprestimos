/**
 * Componente GoalSectionTabs.
 * Exibe os botões de alternância globais entre as seções principais 
 * do aplicativo: "Minhas Metas" e "Empréstimos".
 */
import React from "react";
import { Goal } from "../types";

interface GoalSectionTabsProps {
  currentSection: "metas" | "emprestimos";
  setCurrentSection: (section: "metas" | "emprestimos") => void;
  setCategory: (category: string) => void;
  goalsList: Goal[];
  setCurrentGoalId: (id: string) => void;
  clearGoalData: () => void;
}

export const GoalSectionTabs: React.FC<GoalSectionTabsProps> = ({
  currentSection,
  setCurrentSection,
  setCategory,
  goalsList,
  setCurrentGoalId,
  clearGoalData,
}) => {
  return (
    <div className="flex justify-center mt-3 mb-6">
      <div className="bg-slate-900/60 p-1 border border-slate-800/80 rounded-xl flex gap-1 w-full max-w-sm shadow-lg">
        <button
          onClick={() => {
            setCurrentSection("metas");
            setCategory("saving");
            const metas = goalsList.filter((g) => g.category !== "loan");
            if (metas.length > 0) setCurrentGoalId(metas[0]._id);
            else clearGoalData();
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${currentSection === "metas" ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10" : "text-slate-400 hover:text-white"}`}
        >
          Minhas Metas
        </button>
        <button
          onClick={() => {
            setCurrentSection("emprestimos");
            setCategory("loan");
            const loans = goalsList.filter((g) => g.category === "loan");
            if (loans.length > 0) setCurrentGoalId(loans[0]._id);
            else clearGoalData();
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${currentSection === "emprestimos" ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10" : "text-slate-400 hover:text-white"}`}
        >
          Empréstimos
        </button>
      </div>
    </div>
  );
};

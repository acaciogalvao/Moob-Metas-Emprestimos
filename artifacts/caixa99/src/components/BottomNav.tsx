import React from "react";
import { Home, List, Calendar, LayoutDashboard } from "lucide-react";
import type { AppTab } from "../loan-hooks/useAppNavigation";

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isEditing: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  isEditing,
}) => {
  if (isEditing) return null;

  const tabs: { id: AppTab; icon: React.ReactNode; label: string }[] = [
    { id: "inicio", icon: <Home className="w-5 h-5" />, label: "Início" },
    { id: "calendario", icon: <Calendar className="w-5 h-5" />, label: "Calendário" },
    { id: "historico", icon: <List className="w-5 h-5" />, label: "Histórico" },
    { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Painel" },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-md flex justify-around items-center p-2 z-40 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-2xl rounded-t-2xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 w-full transition-colors cursor-pointer ${
            activeTab === tab.id
              ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {tab.icon}
          <span className="text-[12px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

import React from "react";
import { Home, List, Calendar, LayoutDashboard } from "lucide-react";
import type { AppTab } from "../loan-hooks/useAppNavigation";

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isEditing: boolean;
}

const TABS: { id: AppTab; Icon: React.FC<{ className?: string }>; label: string }[] = [
  { id: "inicio",    Icon: Home,            label: "Início"     },
  { id: "calendario",Icon: Calendar,        label: "Calendário" },
  { id: "historico", Icon: List,            label: "Histórico"  },
  { id: "dashboard", Icon: LayoutDashboard, label: "Painel"     },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, isEditing }) => {
  if (isEditing) return null;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] border-t border-slate-800/60 flex justify-around items-end px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40"
      style={{ background: 'linear-gradient(180deg, rgba(10,12,20,0.85) 0%, rgba(10,12,20,0.98) 100%)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      {TABS.map(({ id, Icon, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex flex-col items-center gap-1 flex-1 py-1 transition-all cursor-pointer"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className={`relative flex items-center justify-center w-10 h-6 rounded-full transition-all duration-300 ${
              isActive ? 'scale-110' : ''
            }`}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(251,191,36,0.20), rgba(245,158,11,0.10))',
                boxShadow: '0 0 12px rgba(251,191,36,0.20)',
              } : undefined}
            >
              <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-amber-400' : 'text-slate-600'}`} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-amber-400' : 'text-slate-600'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

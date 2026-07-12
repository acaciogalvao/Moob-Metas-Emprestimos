/**
 * useGoalsSync.ts — Hook for goals list background sync.
 */

import { useState, useEffect } from 'react';

export function useGoalsSync(systemTab: string) {
  const [goalsList, setGoalsList] = useState<any[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);

  const fetchGoalsList = (silent = false) => {
    if (!silent) {
      setIsLoadingGoals(true);
    }
    try {
      const cached = localStorage.getItem("offline_goalsList");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setGoalsList(parsed);
        }
      }
    } catch (e) {
      console.warn("Erro ao ler cache de metas:", e);
    }

    fetch("/moob-api/goals")
      .then(res => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        return null;
      })
      .then(data => {
        if (data && Array.isArray(data)) {
          setGoalsList(data);
          localStorage.setItem("offline_goalsList", JSON.stringify(data));
        }
      })
      .catch(err => {
        console.warn("Erro ao sincronizar metas do servidor:", err);
      })
      .finally(() => {
        if (!silent) {
          setIsLoadingGoals(false);
        }
      });
  };

  useEffect(() => {
    fetchGoalsList(false);
    const interval = setInterval(() => {
      fetchGoalsList(true); // silent background sync
    }, 15000); // sync every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (systemTab === 'caixa') {
      fetchGoalsList(false);
    }
  }, [systemTab]);

  return { goalsList, isLoadingGoals, fetchGoalsList };
}

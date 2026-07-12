/**
 * Hook useGoalData.
 * Responsável por buscar, salvar e deletar dados de metas no backend (API) com suporte offline-first.
 * Faz também o agrupamento da lista ("polling") e gerencia operações de 
 * histórico de pagamentos.
 */
import { useState, useEffect } from "react";

export const useGoalData = (
  currentGoalId: string,
  setCurrentGoalId: (id: string) => void,
  currentSection: "metas" | "emprestimos",
  setCurrentSection: (section: "metas" | "emprestimos") => void,
  goalState: any,
  results: any,
  triggerConfetti: () => void,
  showToast: (msg: string, type?: "success" | "error") => void,
) => {
  const [goalsList, setGoalsList] = useState<any[]>([]);

  // Carregamento inicial
  useEffect(() => {
    const loadInitial = async () => {
      // 1. Carregamento otimista do cache offline local
      try {
        const cachedList = localStorage.getItem("offline_goalsList");
        if (cachedList) {
          const parsed = JSON.parse(cachedList);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGoalsList(parsed);
            const firstGoal = parsed[0];
            setCurrentSection(
              firstGoal.category === "loan" ? "emprestimos" : "metas",
            );
            setCurrentGoalId(firstGoal._id);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar cache offline:", e);
      }

      // 2. Busca e sincroniza do servidor
      try {
        const res = await fetch("/moob-api/goals");
        if (!res.ok) return;

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return;
        }

        const data = await res.json();
        setGoalsList(data);
        localStorage.setItem("offline_goalsList", JSON.stringify(data));
        
        if (data.length > 0) {
          // Se não há id selecionado, pega o primeiro
          if (!currentGoalId) {
            const firstGoal = data[0];
            setCurrentSection(
              firstGoal.category === "loan" ? "emprestimos" : "metas",
            );
            setCurrentGoalId(firstGoal._id);
          }
        } else {
          goalState.clearGoalData(currentSection);
          setCurrentGoalId("");
        }
      } catch (e) {
        console.error("Erro ao sincronizar metas do servidor:", e);
      }
    };
    loadInitial();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling e sincronização contínua quando o currentGoalId mudar
  useEffect(() => {
    const fetchGoalsList = async () => {
      try {
        const res = await fetch("/moob-api/goals");
        if (!res.ok) return;

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return;
        }

        const data = await res.json();
        setGoalsList(data);
        localStorage.setItem("offline_goalsList", JSON.stringify(data));
      } catch (e: any) {
        if (e.message === "Failed to fetch") return;
        console.error("Erro ao atualizar lista de metas via polling:", e);
      }
    };

    const fetchGoalData = async (isInitialLoad: boolean = false) => {
      if (!currentGoalId) return;

      if (isInitialLoad) {
        try {
          const cachedGoal = localStorage.getItem(`offline_goal_${currentGoalId}`);
          if (cachedGoal) {
            const parsed = JSON.parse(cachedGoal);
            goalState.populateGoalData(parsed, isInitialLoad, triggerConfetti);
          }
        } catch (e) {
          console.error("Erro ao ler meta do cache offline:", e);
        }
      }

      try {
        const res = await fetch(`/moob-api/goal/${currentGoalId}`);
        if (!res.ok) return;

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return;
        }

        const data = await res.json();
        localStorage.setItem(`offline_goal_${currentGoalId}`, JSON.stringify(data));
        goalState.populateGoalData(data, isInitialLoad, triggerConfetti);
      } catch (e: any) {
        if (e.message === "Failed to fetch") return;
        console.error("Erro ao sincronizar dados da meta do servidor:", e);
      }
    };

    if (currentGoalId) {
      fetchGoalData(true);
    }

    const interval = setInterval(() => {
      if (currentGoalId) {
        fetchGoalData(false);
      }
      fetchGoalsList();
    }, 5000); // Sincroniza a cada 5 segundos

    return () => clearInterval(interval);
  }, [currentGoalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveGoals = async (overrideUpdates?: any) => {
    try {
      const updates = {
        type: goalState.goalType,
        category: goalState.category,
        interestRate: Number(goalState.interestRate),
        itemName: goalState.itemName,
        totalValue: Number(goalState.totalValue),
        months: Number(goalState.months),
        durationUnit: goalState.durationUnit,
        deadlineType: goalState.deadlineType,
        excludeSundays: goalState.excludeSundays,
        startDate: results.startDate,
        endDate: results.endDate,
        contributionP1:
          goalState.goalType === "individual"
            ? 100
            : Number(goalState.contributionP1),
        remindersEnabled: goalState.remindersEnabled,
        applyLateFees: goalState.applyLateFees,
        nameP1: goalState.nameP1,
        nameP2: goalState.nameP2,
        phoneP1: goalState.phoneP1,
        phoneP2: goalState.phoneP2,
        pixKeyP1: goalState.pixKeyP1,
        pixKeyP2: goalState.pixKeyP2,
        frequencyP1: goalState.frequencyP1,
        frequencyP2: goalState.frequencyP2,
        dueDayP1: goalState.dueDayP1,
        dueDayP2: goalState.dueDayP2,
        savedP1: currentGoalId ? results.sP1 : 0,
        savedP2: currentGoalId ? (goalState.goalType === "individual" ? 0 : results.sP2) : 0,
        ...overrideUpdates,
      };

      let res;
      if (currentGoalId) {
        res = await fetch(`/moob-api/goal/${currentGoalId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } else {
        res = await fetch("/moob-api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const savedGoal = await res.json();
          setCurrentGoalId(savedGoal._id);
        } else {
          const text = await res.text();
          if (text.toLowerCase().includes("<!doctype html>")) {
            throw new Error(
              "O servidor está reiniciando ou indisponível no momento. Por favor, aguarde alguns segundos e tente salvar novamente.",
            );
          }
          throw new Error(
            `Erro desconhecido do servidor (Status ${res.status}). Detalhes: ${text.substring(0, 50)}`,
          );
        }

        // Atualiza a lista geral
        const listRes = await fetch("/moob-api/goals");
        if (listRes.ok) {
          const listContentType = listRes.headers.get("content-type");
          if (listContentType && listContentType.includes("application/json")) {
            const data = await listRes.json();
            setGoalsList(data);
            localStorage.setItem("offline_goalsList", JSON.stringify(data));
          }
        }
        showToast("Metas salvas com sucesso!", "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || "Erro ao salvar metas.", "error");
      }
    } catch (error: any) {
      console.error("Erro ao salvar dados da meta:", error);
      showToast(error.message || "Erro de conexão ao salvar metas.", "error");
    }
  };

  const confirmClearHistory = async (
    setShowClearHistoryConfirm: (v: boolean) => void,
  ) => {
    try {
      await fetch(`/moob-api/goal/${currentGoalId}/clear-history`, {
        method: "POST",
      });
      showToast("Histórico excluído com sucesso!", "success");

      // Limpa localmente
      goalState.setSavedP1("0");
      goalState.setSavedP2("0");
      goalState.setPaymentsHistory([]);

      // Recarrega para garantir sincronização
      const res = await fetch(`/moob-api/goal/${currentGoalId}`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(`offline_goal_${currentGoalId}`, JSON.stringify(data));
        goalState.populateGoalData(data, false, triggerConfetti);
      }
    } catch (error) {
      console.error("Erro ao excluir histórico:", error);
      showToast("Erro ao excluir histórico.", "error");
    } finally {
      setShowClearHistoryConfirm(false);
    }
  };

  const confirmDeleteGoal = async (
    setShowDeleteConfirm: (v: boolean) => void,
  ) => {
    try {
      await fetch(`/moob-api/goal/${currentGoalId}`, {
        method: "DELETE",
      });

      // Atualiza lista do servidor
      const listRes = await fetch("/moob-api/goals");
      if (listRes.ok) {
        const data = await listRes.json();
        setGoalsList(data);
        localStorage.setItem("offline_goalsList", JSON.stringify(data));
        
        if (data.length > 0) {
          const matchingGoals = data.filter((g: any) =>
            currentSection === "emprestimos"
              ? g.category === "loan"
              : g.category !== "loan",
          );
          if (matchingGoals.length > 0) {
            setCurrentGoalId(matchingGoals[0]._id);
          } else {
            goalState.clearGoalData(currentSection);
            setCurrentGoalId("");
          }
        } else {
          goalState.clearGoalData(currentSection);
          setCurrentGoalId("");
        }
      }
      setShowDeleteConfirm(false);
      showToast("Meta excluída com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao deletar meta:", error);
    }
  };

  const handleDeletePaymentItem = async (pid: string) => {
    if (!currentGoalId) return;
    try {
      await fetch(`/moob-api/goal/${currentGoalId}/payment/${pid}`, {
        method: "DELETE",
      });
      const res = await fetch(`/moob-api/goal/${currentGoalId}`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(`offline_goal_${currentGoalId}`, JSON.stringify(data));
        goalState.populateGoalData(data, false, triggerConfetti);
      }
    } catch (error) {
      console.error("Erro ao deletar item de pagamento:", error);
    }
  };

  return {
    goalsList,
    setGoalsList,
    handleSaveGoals,
    confirmClearHistory,
    confirmDeleteGoal,
    handleDeletePaymentItem,
  };
};

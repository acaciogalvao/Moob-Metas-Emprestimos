/**
 * Hook useGoalState.
 * Centraliza os múltiplos estados que compõem uma Meta ou Empréstimo 
 * (nomes, valores, datas, configuração de divisão, etc.).
 * Fornece métodos para popular dados (load) ou limpá-los (clear).
 */
import { useState, useRef } from "react";

export const useGoalState = () => {
  const [category, setCategory] = useState("saving");
  const [interestRate, setInterestRate] = useState("0");
  const [itemName, setItemName] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [months, setMonths] = useState("12");
  const [durationUnit, setDurationUnit] = useState<"days" | "weeks" | "months">(
    "months",
  );
  const [deadlineType, setDeadlineType] = useState<"duration" | "dates">(
    "duration",
  );
  const [excludeSundays, setExcludeSundays] = useState(false);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  });
  const [contributionP1, setContributionP1] = useState("50");
  const [goalType, setGoalType] = useState<"individual" | "shared">("shared");
  const [savedP1, setSavedP1] = useState("");
  const [savedP2, setSavedP2] = useState("");
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);

  const [nameP1, setNameP1] = useState("Você");
  const [nameP2, setNameP2] = useState("Seu Amor");
  const [phoneP1, setPhoneP1] = useState("");
  const [phoneP2, setPhoneP2] = useState("");
  const [pixKeyP1, setPixKeyP1] = useState("");
  const [pixKeyP2, setPixKeyP2] = useState("");
  const [frequencyP1, setFrequencyP1] = useState<
    "daily" | "weekly" | "monthly"
  >("monthly");
  const [frequencyP2, setFrequencyP2] = useState<
    "daily" | "weekly" | "monthly"
  >("monthly");
  const [dueDayP1, setDueDayP1] = useState(5);
  const [dueDayP2, setDueDayP2] = useState(5);
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [applyLateFees, setApplyLateFees] = useState(false);

  const previousSavedRef = useRef<number | null>(null);

  const clearGoalData = (currentSection: "metas" | "emprestimos") => {
    setCategory(currentSection === "emprestimos" ? "loan" : "saving");
    setItemName("");
    setTotalValue("");
    setMonths("12");
    setDurationUnit("months");
    setDeadlineType("duration");
    setExcludeSundays(false);
    setApplyLateFees(false);
    const d = new Date();
    setStartDate(d.toISOString());
    d.setMonth(d.getMonth() + 12);
    setEndDate(d.toISOString());
    setContributionP1("50");
    setGoalType("shared");
    setNameP1("Você");
    setNameP2("Seu Amor");
    setPhoneP1("");
    setPhoneP2("");
    setPixKeyP1("");
    setPixKeyP2("");
    setFrequencyP1("monthly");
    setFrequencyP2("monthly");
    setDueDayP1(5);
    setDueDayP2(5);
    setSavedP1("");
    setSavedP2("");
    setPaymentsHistory([]);
    setRemindersEnabled(false);
  };

  const populateGoalData = (
    data: any,
    isInitialLoad: boolean = false,
    triggerConfetti: () => void,
  ) => {
    if (isInitialLoad) {
      if (data.category !== undefined) setCategory(data.category);
      if (data.interestRate !== undefined)
        setInterestRate(data.interestRate.toString());
      if (data.itemName !== undefined) setItemName(data.itemName);
      if (data.totalValue !== undefined)
        setTotalValue(data.totalValue.toString());
      if (data.months !== undefined) setMonths(data.months.toString());
      if (data.durationUnit !== undefined) setDurationUnit(data.durationUnit);
      if (data.deadlineType !== undefined) setDeadlineType(data.deadlineType);
      setExcludeSundays(
        data.excludeSundays !== undefined ? data.excludeSundays : false,
      );
      if (data.endDate !== undefined) setEndDate(data.endDate);
      if (data.contributionP1 !== undefined)
        setContributionP1(data.contributionP1.toString());
      if (data.type !== undefined) setGoalType(data.type);
      if (data.nameP1 !== undefined) setNameP1(data.nameP1);
      if (data.nameP2 !== undefined) setNameP2(data.nameP2);
      if (data.phoneP1 !== undefined) setPhoneP1(data.phoneP1);
      if (data.phoneP2 !== undefined) setPhoneP2(data.phoneP2);
      if (data.pixKeyP1 !== undefined) setPixKeyP1(data.pixKeyP1);
      if (data.pixKeyP2 !== undefined) setPixKeyP2(data.pixKeyP2);
      if (data.frequencyP1 !== undefined) setFrequencyP1(data.frequencyP1);
      if (data.frequencyP2 !== undefined) setFrequencyP2(data.frequencyP2);
      if (data.dueDayP1 !== undefined) setDueDayP1(data.dueDayP1);
      if (data.dueDayP2 !== undefined) setDueDayP2(data.dueDayP2);
      if (data.startDate !== undefined) setStartDate(data.startDate);
      if (data.remindersEnabled !== undefined)
        setRemindersEnabled(data.remindersEnabled);
      if (data.applyLateFees !== undefined)
        setApplyLateFees(data.applyLateFees);
    }

    // Check if goal was just completed
    const newSaved = (data.savedP1 || 0) + (data.savedP2 || 0);
    const total = data.totalValue || 0;

    if (data.savedP1 !== undefined) setSavedP1(data.savedP1.toString());
    if (data.savedP2 !== undefined) setSavedP2(data.savedP2.toString());
    if (data.payments !== undefined) setPaymentsHistory(data.payments);

    if (isInitialLoad) {
      previousSavedRef.current = newSaved;
    } else if (
      previousSavedRef.current !== null &&
      newSaved >= total &&
      previousSavedRef.current < total &&
      total > 0
    ) {
      triggerConfetti();
      previousSavedRef.current = newSaved;
    } else {
      previousSavedRef.current = newSaved;
    }
  };

  return {
    category,
    setCategory,
    interestRate,
    setInterestRate,
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
    endDate,
    setEndDate,
    contributionP1,
    setContributionP1,
    goalType,
    setGoalType,
    savedP1,
    setSavedP1,
    savedP2,
    setSavedP2,
    paymentsHistory,
    setPaymentsHistory,
    nameP1,
    setNameP1,
    nameP2,
    setNameP2,
    phoneP1,
    setPhoneP1,
    phoneP2,
    setPhoneP2,
    pixKeyP1,
    setPixKeyP1,
    pixKeyP2,
    setPixKeyP2,
    frequencyP1,
    setFrequencyP1,
    frequencyP2,
    setFrequencyP2,
    dueDayP1,
    setDueDayP1,
    dueDayP2,
    setDueDayP2,
    startDate,
    setStartDate,
    remindersEnabled,
    setRemindersEnabled,
    applyLateFees,
    setApplyLateFees,
    clearGoalData,
    populateGoalData,
  };
};

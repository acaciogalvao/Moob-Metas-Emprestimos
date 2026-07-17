/**
 * Módulo de cálculos (calculations.ts).
 * Contém a função `calculateGoal`, o "motor" financeiro do app.
 * Ela recebe os parâmetros da meta ou empréstimo e processa:
 * parcelas, progresso percentual, valores restantes, dados para gráficos
 * e datas de vencimento de acordo com a periodicidade escolhida.
 */

/**
 * Taxa mensal utilizada na Tabela Price para empréstimos com multa aplicada.
 * ~7,73% a.m. — fonte: regra de negócio definida pelo usuário.
 * Exporte aqui para evitar que esse valor fique duplicado em outros módulos.
 */
export const LATE_FEE_MONTHLY_RATE = 0.0772782;

/**
 * Calcula o total (com juros) de um empréstimo ou meta a partir dos campos
 * básicos do objeto. Use esta função sempre que precisar do total sem chamar
 * o `calculateGoal` completo (que envolve cálculo de datas e parcelas).
 */
export function getLoanTotalWithInterest(g: {
  category?: string;
  totalValue?: number;
  applyLateFees?: boolean;
  months?: number;
  durationUnit?: string;
  interestRate?: number;
}): number {
  const base = g.totalValue || 0;
  if (g.category !== 'loan') return base;

  if (g.applyLateFees) {
    const timeValue = Number(g.months) || 1;
    let totalMonths = timeValue;
    if (g.durationUnit === 'days') totalMonths = timeValue / 30.4166;
    if (g.durationUnit === 'weeks') totalMonths = timeValue / 4.3333;
    const n = totalMonths > 0 ? totalMonths : 1;
    const pmt =
      (base * (LATE_FEE_MONTHLY_RATE * Math.pow(1 + LATE_FEE_MONTHLY_RATE, n))) /
      (Math.pow(1 + LATE_FEE_MONTHLY_RATE, n) - 1);
    return pmt * n;
  }

  const rate = (g.interestRate || 0) / 100;
  if (rate > 0) return base * (1 + rate);
  return base;
}

import {
  CalculationResults,
  DurationUnit,
  DeadlineType,
  GoalType,
  Frequency,
} from "../types";
import { parseLocalDate } from "../loan-lib/utils";

interface CalculationParams {
  totalValue: string;
  category: string;
  interestRate: string;
  startDate: string;
  endDate: string;
  excludeSundays: boolean;
  deadlineType: DeadlineType;
  months: string;
  durationUnit: DurationUnit;
  frequencyP1: Frequency;
  frequencyP2: Frequency;
  savedP1: string;
  savedP2: string;
  goalType: GoalType;
  contributionP1: string;
  dueDayP1: number;
  dueDayP2: number;
  applyLateFees?: boolean;
  payments?: any[];
}

export const calculateGoal = (
  params: CalculationParams,
): CalculationResults => {
  const {
    totalValue,
    category,
    interestRate,
    startDate,
    endDate,
    excludeSundays,
    deadlineType,
    months,
    durationUnit,
    frequencyP1,
    frequencyP2,
    savedP1,
    savedP2,
    goalType,
    contributionP1,
    dueDayP1,
    dueDayP2,
  } = params;

  let timeValue = Number(months) || 1;
  let actualDurationUnit = durationUnit;

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (excludeSundays) {
    let current = new Date(start);
    current.setDate(current.getDate() + 1);
    let sundaysCount = 0;
    while (current <= end) {
      if (current.getDay() === 0) sundaysCount++;
      current.setDate(current.getDate() + 1);
    }
    diffDays = Math.max(1, diffDays - sundaysCount);
  }

  let calculatedStartDate = start.toISOString();
  let calculatedEndDate = end.toISOString();

  if (deadlineType === "duration") {
    let daysToAdd = timeValue;
    if (actualDurationUnit === "weeks") daysToAdd = timeValue * 7;
    if (actualDurationUnit === "months")
      daysToAdd = Math.round(timeValue * 30.4166);

    let current = new Date(start);
    let added = 0;
    while (added < daysToAdd) {
      current.setDate(current.getDate() + 1);
      if (excludeSundays && current.getDay() === 0) {
        // Skip
      } else {
        added++;
      }
    }
    calculatedEndDate = current.toISOString();
  } else {
    timeValue = Math.max(1, diffDays);
    actualDurationUnit = "days";
    calculatedStartDate = start.toISOString();
    calculatedEndDate = end.toISOString();
  }

  let totalMonths = timeValue;
  if (actualDurationUnit === "days") totalMonths = timeValue / 30.4166;
  if (actualDurationUnit === "weeks") totalMonths = timeValue / 4.3333;

  const baseTotal = Number(totalValue) || 0;
  const isLoan = category === "loan";
  
  let total = baseTotal;
  if (isLoan) {
    if (params.applyLateFees) {
       const n = totalMonths > 0 ? totalMonths : 1;
       // Tabela Price for monthly installments
       const pmt = baseTotal * (LATE_FEE_MONTHLY_RATE * Math.pow(1 + LATE_FEE_MONTHLY_RATE, n)) / (Math.pow(1 + LATE_FEE_MONTHLY_RATE, n) - 1);
       total = pmt * n;
    } else {
       const rate = Number(interestRate) / 100;
       if (rate > 0) {
         total = baseTotal * (1 + rate);
       }
    }
  }

  const actualFreqP1 = frequencyP1;
  const actualFreqP2 = frequencyP2;

  let sP1 = 0;
  let sP2 = 0;
  let baseSavedP1 = Number(savedP1) || 0;
  let baseSavedP2 = Number(savedP2) || 0;

  if (params.payments && params.payments.length > 0) {
    for (const p of params.payments) {
      if (p.payerId === "P1") sP1 += p.amount;
      else if (p.payerId === "P2") sP2 += p.amount;
    }
  } else {
    sP1 = 0;
    sP2 = 0;
  }

  const saved = sP1 + sP2;

  const remaining = Math.max(0, total - saved);
  const progressPercent = total > 0 ? Math.min(100, (saved / total) * 100) : 0;

  const contributionP1Num = Number(contributionP1) || 0;
  const actualContributionP1 =
    goalType === "individual" ? 100 : contributionP1Num;
  const actualContributionP2 =
    goalType === "individual" ? 0 : 100 - contributionP1Num;

  const totalP1 = total * (actualContributionP1 / 100);
  const totalP2 = total * (actualContributionP2 / 100);

  const remainingP1 = Math.max(0, totalP1 - sP1);
  const remainingP2 = Math.max(0, totalP2 - sP2);

  const getPeriodsCount = (rawTime: number, unit: string, freq: string) => {
    if (rawTime <= 0) return 1;
    let totalDays = rawTime;
    if (unit === "weeks") totalDays = rawTime * 7;
    if (unit === "months") totalDays = rawTime * 30.4166;

    if (freq === "daily") return Math.max(1, Math.round(totalDays));
    if (freq === "weekly") return Math.max(1, Math.round(totalDays / 7));
    return Math.max(1, Math.round(totalDays / 30.4166));
  };

  const getInstallment = (
    remainingAmount: number,
    rawTime: number,
    unit: string,
    freq: string,
  ) => {
    const periods = getPeriodsCount(rawTime, unit, freq);
    return remainingAmount / periods;
  };

  const baseInstallmentP1 = getInstallment(
    totalP1,
    timeValue,
    actualDurationUnit,
    actualFreqP1,
  );
  const baseInstallmentP2 = getInstallment(
    totalP2,
    timeValue,
    actualDurationUnit,
    actualFreqP2,
  );

  const installmentP1 = Math.min(baseInstallmentP1, remainingP1);
  const installmentP2 = Math.min(baseInstallmentP2, remainingP2);

  const totalPeriodsP1 = getPeriodsCount(
    timeValue,
    actualDurationUnit,
    actualFreqP1,
  );
  const totalPeriodsP2 = getPeriodsCount(
    timeValue,
    actualDurationUnit,
    actualFreqP2,
  );

  const getPaidPeriodsCount = (payerId: string, baseInstallment: number) => {
    if (!params.payments || params.payments.length === 0) return 0;
    
    const sorted = [...params.payments].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let cumulative = 0;
    let endPeriod = 0;
    let fallbackCount = 0;

    for (const payment of sorted) {
      if (payment.payerId === payerId) {
        if (baseInstallment > 0) {
          cumulative += payment.amount;
          endPeriod = Math.floor(cumulative / baseInstallment + 0.05);
        } else if (payment.amount >= 0) {
          fallbackCount++;
          endPeriod = fallbackCount;
        }
      }
    }
    return endPeriod;
  };

  const paidPeriodsCountP1 =
    params.payments && params.payments.length > 0
      ? getPaidPeriodsCount("P1", baseInstallmentP1)
      : baseInstallmentP1 > 0 ? Math.floor(sP1 / baseInstallmentP1 + 0.05) : 0;
  
  const paidPeriodsCountP2 =
    params.payments && params.payments.length > 0
      ? getPaidPeriodsCount("P2", baseInstallmentP2)
      : baseInstallmentP2 > 0 ? Math.floor(sP2 / baseInstallmentP2 + 0.05) : 0;

  const monthlyP1 = totalMonths > 0 ? remainingP1 / totalMonths : 0;
  const monthlyP2 = totalMonths > 0 ? remainingP2 / totalMonths : 0;
  const monthlyTotal = monthlyP1 + monthlyP2;

  const weeklyP1 = monthlyP1 / 4.3333;
  const weeklyP2 = monthlyP2 / 4.3333;
  const weeklyTotal = monthlyTotal / 4.3333;

  const dailyP1 = monthlyP1 / 30.4166;
  const dailyP2 = monthlyP2 / 30.4166;
  const dailyTotal = monthlyTotal / 30.4166;

  const chartData = [];
  let currentSaved = saved;
  for (let i = 0; i <= timeValue; i++) {
    const unitLabel =
      actualDurationUnit === "days"
        ? "Dia"
        : actualDurationUnit === "weeks"
          ? "Sem"
          : "Mês";
    chartData.push({
      month: i === 0 ? "Hoje" : `${unitLabel} ${i}`,
      acumulado: currentSaved,
      meta: total,
    });
    if (actualDurationUnit === "days") currentSaved += dailyTotal;
    else if (actualDurationUnit === "weeks") currentSaved += weeklyTotal;
    else currentSaved += monthlyTotal;
  }

  const currentNow = new Date();
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const today = new Date(
    currentNow.getFullYear(),
    currentNow.getMonth(),
    currentNow.getDate(),
  );

  const getNextDueDate = (
    freq: string,
    paidPeriods: number,
  ) => {
    const d = new Date(
      startDay.getFullYear(),
      startDay.getMonth(),
      startDay.getDate(),
    );
    if (freq === "daily") {
      let added = 0;
      while (added < paidPeriods + 1) {
        d.setDate(d.getDate() + 1);
        if (excludeSundays && d.getDay() === 0) {
          // pula domingo
        } else {
          added++;
        }
      }
    } else if (freq === "weekly") {
      d.setDate(d.getDate() + 7 * (paidPeriods + 1));
      if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
    } else if (freq === "monthly") {
      d.setMonth(d.getMonth() + paidPeriods + 1);
      if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const getLatePeriodsCount = (freq: string, paidPeriods: number, totalPeriods: number) => {
    let lateCount = 0;
    for (let i = paidPeriods; i < totalPeriods; i++) {
        // we use getNextDueDate logic for the ith period (so pass i instead of paidPeriods inside, wait getNextDueDate uses paidPeriods+1 logic actually)
        const d = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate());
        if (freq === "daily") {
            let added = 0;
            while (added < i + 1) {
              d.setDate(d.getDate() + 1);
              if (excludeSundays && d.getDay() === 0) {} else { added++; }
            }
        } else if (freq === "weekly") {
            d.setDate(d.getDate() + 7 * (i + 1));
            if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
        } else if (freq === "monthly") {
            d.setMonth(d.getMonth() + (i + 1));
            if (excludeSundays && d.getDay() === 0) d.setDate(d.getDate() + 1);
        }
        if (d.getTime() < today.getTime()) {
           lateCount++;
        }
    }
    return lateCount;
  };

  const latePeriodsCountP1 = getLatePeriodsCount(actualFreqP1, paidPeriodsCountP1, totalPeriodsP1);
  const latePeriodsCountP2 = getLatePeriodsCount(actualFreqP2, paidPeriodsCountP2, totalPeriodsP2);

  const lateValueP1 = latePeriodsCountP1 * baseInstallmentP1;
  const lateValueP2 = latePeriodsCountP2 * baseInstallmentP2;

  const isLateP1 = (() => {
    const payerTotal = totalP1;
    const payerSaved = sP1;
    if (payerSaved >= payerTotal || payerTotal === 0) return false;
    const nextDue = getNextDueDate(actualFreqP1, paidPeriodsCountP1);
    return nextDue.getTime() < today.getTime();
  })();

  const isLateP2 = (() => {
    const payerTotal = totalP2;
    const payerSaved = sP2;
    if (payerSaved >= payerTotal || payerTotal === 0) return false;
    const nextDue = getNextDueDate(actualFreqP2, paidPeriodsCountP2);
    return nextDue.getTime() < today.getTime();
  })();

  const daysToNextP1 = Math.ceil(
    (getNextDueDate(actualFreqP1, paidPeriodsCountP1).getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const daysToNextP2 = Math.ceil(
    (getNextDueDate(actualFreqP2, paidPeriodsCountP2).getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return {
    startDate: calculatedStartDate,
    endDate: calculatedEndDate,
    baseTotal,
    total,
    time: timeValue,
    saved,
    sP1,
    sP2,
    remaining,
    progressPercent,
    totalP1,
    totalP2,
    remainingP1,
    remainingP2,
    actualFreqP1,
    actualFreqP2,
    baseInstallmentP1,
    baseInstallmentP2,
    installmentP1,
    installmentP2,
    monthlyP1,
    monthlyP2,
    monthlyTotal,
    weeklyP1,
    weeklyP2,
    weeklyTotal,
    dailyP1,
    dailyP2,
    dailyTotal,
    totalPeriodsP1,
    paidPeriodsCountP1,
    totalPeriodsP2,
    paidPeriodsCountP2,
    chartData,
    isLateP1,
    isLateP2,
    daysToNextP1,
    daysToNextP2,
    latePeriodsCountP1,
    latePeriodsCountP2,
    lateValueP1,
    lateValueP2,
  };
};

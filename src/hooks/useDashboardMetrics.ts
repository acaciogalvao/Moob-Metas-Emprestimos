/**
 * useDashboardMetrics.ts — Wraps all analytical computations for the Caixa dashboard.
 */

import { useMemo } from 'react';
import { Shift } from '../types';
import { PeriodFilter } from '../types';
import { computeFilteredTransactions, computeRefuelMetrics, computeFinancialTotals, computeMonthlyGoalMath } from '../utils/financialCalculations';
import { getTransactionFaturamentoReal } from '../utils/format';

interface UseDashboardMetricsParams {
  shifts: Shift[];
  vehicleType: 'CAR' | 'BIKE';
  periodFilter: PeriodFilter;
  activeTab: 'REGISTER' | 'ANALYTICS';
  excludeSundays: boolean;
}

export function useDashboardMetrics({
  shifts,
  vehicleType,
  periodFilter,
  activeTab,
  excludeSundays,
}: UseDashboardMetricsParams) {
  const activeShift = shifts.find(s => s.status === 'OPEN') || null;

  const allFilteredTransactions = useMemo(
    () => computeFilteredTransactions(shifts, periodFilter),
    [shifts, periodFilter]
  );

  const refuelMetrics = useMemo(
    () => computeRefuelMetrics(shifts, vehicleType),
    [shifts, vehicleType]
  );

  const financialTotals = useMemo(
    () => computeFinancialTotals(activeShift, activeTab, allFilteredTransactions),
    [activeShift, activeTab, allFilteredTransactions]
  );

  const faturamentoPosDespesas = financialTotals.saldoLiquido;

  const monthlyGoalMath = useMemo(
    () => computeMonthlyGoalMath(activeShift, excludeSundays, faturamentoPosDespesas),
    [activeShift, excludeSundays, faturamentoPosDespesas]
  );

  const lastClosedShiftRef = useMemo(
    () =>
      shifts
        .filter(s => s.status === 'CLOSED')
        .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null,
    [shifts]
  );

  const lastClosedShiftFaturamento = useMemo(() => {
    if (!lastClosedShiftRef) return 0;
    const shiftRides = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
    const shiftInflows = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
    return (
      shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) +
      shiftInflows
        .filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA')
        .reduce((s, t) => s + t.value, 0)
    );
  }, [lastClosedShiftRef]);

  return {
    activeShift,
    allFilteredTransactions,
    refuelMetrics,
    financialTotals,
    faturamentoPosDespesas,
    monthlyGoalMath,
    lastClosedShiftFaturamento,
  };
}

/**
 * financialCalculations.ts — Pure computation functions extracted from App.tsx.
 * No hooks, no side effects — plain functions over shift/transaction data.
 *
 * Cache TTL: resultados caros são memoizados por 2 s para evitar recálculos em
 * renders rápidos. A chave é derivada dos dados (id + contagem + último timestamp),
 * então mudanças reais invalidam o cache imediatamente.
 */

import { Shift, Transaction, PeriodFilter } from '../types';
import { getTransactionFaturamentoReal, calculateExtraValue, getPlatformBalanceDelta } from './format';

// ─── Cache TTL ────────────────────────────────────────────────────────────────

interface CacheEntry<T> { value: T; ts: number; }
const _cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 2_000;

function memoWithTTL<T>(key: string, fn: () => T): T {
  const now   = Date.now();
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (entry && now - entry.ts < CACHE_TTL_MS) return entry.value;
  const value = fn();
  _cache.set(key, { value, ts: now });
  return value;
}

/** Invalida todo o cache (chamar após mutações de dados, ex: novo turno) */
export function clearFinancialCache(): void { _cache.clear(); }

/**
 * Filters all transactions across all shifts based on the given period filter.
 */
export function computeFilteredTransactions(shifts: Shift[], periodFilter: PeriodFilter): Transaction[] {
  let list: Transaction[] = [];
  shifts.forEach(s => {
    list.push(...s.transactions);
  });

  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday);
  endOfYesterday.setMilliseconds(-1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return list.filter(t => {
    const tDate = new Date(t.timestamp);
    switch (periodFilter) {
      case 'HOJE':
        return tDate >= startOfToday;
      case 'ONTEM':
        return tDate >= startOfYesterday && tDate <= endOfYesterday;
      case 'SETE_DIAS':
        return tDate >= sevenDaysAgo;
      case 'TRINTA_DIAS':
        return tDate >= thirtyDaysAgo;
      case 'ESTE_MES':
        return tDate >= startOfThisMonth;
      case 'TOTAL':
      default:
        return true;
    }
  });
}

/**
 * Computes refuel metrics based on shifts and vehicle type.
 */
export function computeRefuelMetrics(shifts: Shift[], vehicleType: 'CAR' | 'BIKE') {
  // 1. Get closed shifts with valid odometer readings (final >= initial)
  const shiftsWithOdo = shifts.filter(s =>
    s.status === 'CLOSED' &&
    s.initialOdometer !== undefined &&
    s.finalOdometer !== undefined &&
    s.finalOdometer >= s.initialOdometer
  );

  // 2. Determine KM driven: check if there is an active shift
  const activeShift = shifts.find(s => s.status === 'OPEN');
  let kmDriven = 0;
  let isCurrentShift = false;

  if (activeShift) {
    isCurrentShift = true;
    const activeRidesWithKm = activeShift.transactions.filter(
      t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual
    );
    const kmFromRides = activeRidesWithKm.reduce((sum, t) => sum + (t.km || 0), 0);

    // Se o motorista rodou com o app desligado e digitou o hodômetro ao abastecer,
    // usa o hodômetro da transação para recalcular o km real rodado (inclui km off-app).
    if (activeShift.initialOdometer) {
      const fuelTxsWithOdo = activeShift.transactions.filter(
        t =>
          (t.category === 'COMBUSTIVEL' || (t.liters !== undefined && t.liters > 0)) &&
          t.odometer !== undefined &&
          t.odometer > activeShift.initialOdometer!
      );
      if (fuelTxsWithOdo.length > 0) {
        // Pega o hodômetro mais alto registrado (último abastecimento)
        const maxFuelOdo = Math.max(...fuelTxsWithOdo.map(t => t.odometer!));
        const kmFromOdo = maxFuelOdo - activeShift.initialOdometer;
        // Usa o maior valor: hodômetro real ou soma de km dos apps
        kmDriven = Math.max(kmFromRides, kmFromOdo);
      } else {
        kmDriven = kmFromRides;
      }
    } else {
      kmDriven = kmFromRides;
    }
  } else {
    // Fallback: Average KM driven per shift based on closed shifts
    if (shiftsWithOdo.length > 0) {
      const totalKm = shiftsWithOdo.reduce((sum, s) => {
        const kmRun = (s.finalOdometer || 0) - (s.initialOdometer || 0);
        return sum + kmRun;
      }, 0);
      kmDriven = totalKm / shiftsWithOdo.length;
    } else {
      const allRidesWithKm = shifts.flatMap(s => s.transactions).filter(
        t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual
      );
      if (allRidesWithKm.length > 0) {
        const totalKmFromTx = allRidesWithKm.reduce((sum, t) => sum + (t.km || 0), 0);
        const uniqueShifts = new Set(shifts.map(s => s.id)).size || 1;
        kmDriven = totalKmFromTx / uniqueShifts;
      }
    }
  }

  const hasKmData = kmDriven > 0;
  if (kmDriven <= 0 && !isCurrentShift) {
    kmDriven = vehicleType === 'CAR' ? 120 : 80;
  }

  // 3. Average Autonomy (km/L)
  const shiftKmPerLArray = shiftsWithOdo
    .map(s => {
      const kmRun = (s.finalOdometer || 0) - (s.initialOdometer || 0);
      return s.totalLitersFueled && s.totalLitersFueled > 0 ? (kmRun / s.totalLitersFueled) : null;
    })
    .filter((v): v is number => v !== null && v > 0);

  let avgAutonomy = 0;
  if (shiftKmPerLArray.length > 0) {
    avgAutonomy = shiftKmPerLArray.reduce((s, v) => s + v, 0) / shiftKmPerLArray.length;
  } else {
    const carConsumption = parseFloat(localStorage.getItem('moob_fuel_car_consumption') || '12');
    const motoConsumption = parseFloat(localStorage.getItem('moob_fuel_moto_consumption') || '35');
    avgAutonomy = vehicleType === 'CAR' ? carConsumption : motoConsumption;
  }

  if (avgAutonomy <= 0) {
    avgAutonomy = vehicleType === 'CAR' ? 12 : 35;
  }

  // 4. Preço do litro para o custo de reposição: usa o valor do ÚLTIMO abastecimento
  // registrado (o mais recente por data/hora), não uma média histórica — o preço da
  // bomba muda com frequência, então o que vale pra estimar o custo de reabastecer
  // agora é o preço mais recente que o motorista realmente pagou.
  const fuelTransactions = shifts.flatMap(s => s.transactions).filter(
    t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || t.category === 'combustivel' || (t.liters !== undefined && t.liters > 0)) && t.pricePerLiter && t.pricePerLiter > 0
  );
  let avgPricePerLiter = 5.50;
  if (fuelTransactions.length > 0) {
    const mostRecent = [...fuelTransactions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    if (mostRecent.pricePerLiter && mostRecent.pricePerLiter > 0) {
      avgPricePerLiter = mostRecent.pricePerLiter;
    }
  }

  // 5. Recommended Liters to cover or replenish
  const recommendedLiters = kmDriven / avgAutonomy;
  const estimatedCost = recommendedLiters * avgPricePerLiter;

  return {
    kmDriven,
    avgAutonomy,
    recommendedLiters,
    estimatedCost,
    avgPricePerLiter,
    hasKmData,
    shiftsWithOdoCount: shiftsWithOdo.length,
    isCurrentShift
  };
}

/**
 * Computes financial totals for the active shift or filtered transactions.
 */
export function computeFinancialTotals(
  activeShift: Shift | null,
  activeTab: 'REGISTER' | 'ANALYTICS',
  allFilteredTransactions: Transaction[]
) {
  const activeTx = activeShift
    ? activeShift.transactions
    : (activeTab === 'REGISTER' ? [] : allFilteredTransactions);
  const rides = activeTx.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
  const allInTransactions = activeTx.filter(t => t.type === 'IN' && !t.isVirtual);
  const expenses = activeTx.filter(t => t.type === 'OUT');

  const uberKM = rides.filter(t => t.platform === 'UBER' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const ninetyNineKM = rides.filter(t => t.platform === '99' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const particularKM = rides.filter(t => t.platform === 'PARTICULAR' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const totalKM = uberKM + ninetyNineKM + particularKM;

  const rawIn = rides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
  const rawOut = expenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);

  const passageiroMaisExtra = rides.reduce((s, t) => {
    if (t.platform === 'PARTICULAR') return s + t.value;
    const paidToApp = t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value);
    return s + paidToApp + (t.extraChargedValue || 0);
  }, 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'GORJETA' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);

  const uberIn = rides.filter(t => t.platform === 'UBER').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);
  const ninetyNineIn = rides.filter(t => t.platform === '99').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);

  // Tips (t.tipValue) and independent GORJETA entries always go straight to the platform (app)
  // balance — never to Pix/Dinheiro — for every ride type (normal Pix/Dinheiro or Direto no App).
  const cashIn = allInTransactions.reduce((sum, t) => {
    if (t.category === 'GORJETA') return sum;
    if (t.paymentMethod === 'DINHEIRO') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'dinheiro')) {
      const extra = t.extraChargedValue !== undefined
        ? t.extraChargedValue
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  const pixIn = allInTransactions.reduce((sum, t) => {
    if (t.category === 'GORJETA') return sum;
    if (t.paymentMethod === 'PIX') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix')) {
      const extra = t.extraChargedValue !== undefined
        ? t.extraChargedValue
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((s, t) => s + t.value, 0);
  const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((s, t) => s + t.value, 0);

  const totalInitialBalance = activeShift ? (activeShift.initialBalance || 0) : 0;
  const initialCash = activeShift ? (activeShift.initialCashBalance !== undefined ? activeShift.initialCashBalance : activeShift.initialBalance) : 0;
  const initialPix = activeShift ? (activeShift.initialPixBalance !== undefined ? activeShift.initialPixBalance : 0) : 0;

  const expectedPocketCash = initialCash + cashIn - cashOut;
  const expectedPixBalance = initialPix + pixIn - pixOut;

  const ridesAndCancels = activeTx.filter(t => t.type === 'IN' && (t.category === 'CORRIDA' || t.category === 'CANCELAMENTO' || t.category === 'GORJETA' || t.category === 'CAMPANHA') && !t.isVirtual);

  const uberBalanceDelta = ridesAndCancels.filter(t => t.platform === 'UBER').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const uberWithdrawals = activeTx.filter(t => t.platform === 'UBER' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  // Quitação de saldo negativo: dinheiro pago (sempre via Pix) para zerar a dívida com a plataforma.
  const uberDebtPayments = activeTx.filter(t => t.platform === 'UBER' && t.category === 'QUITACAO_SALDO').reduce((s, t) => s + t.value, 0);
  const uberBalance = activeShift ? ((activeShift.initialUberBalance ?? 0) + uberBalanceDelta - uberWithdrawals + uberDebtPayments) : 0;

  const ninetyNineBalanceDelta = ridesAndCancels.filter(t => t.platform === '99').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const ninetyNineWithdrawals = activeTx.filter(t => t.platform === '99' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  const ninetyNineDebtPayments = activeTx.filter(t => t.platform === '99' && t.category === 'QUITACAO_SALDO').reduce((s, t) => s + t.value, 0);
  const ninetyNineBalance = activeShift ? ((activeShift.initial99Balance ?? 0) + ninetyNineBalanceDelta - ninetyNineWithdrawals + ninetyNineDebtPayments) : 0;

  const saldosPlataformas = uberBalance + ninetyNineBalance;

  // Indicadores de plataforma:
  // - oferta: valor que Uber/99 informou que pagaria ao motorista;
  // - extra: valor cobrado por fora e registrado como extra da corrida;
  // - pagamento da plataforma: oferta + extra, separado por app.
  //
  // Para registros antigos, o extra pode não estar salvo. Só usamos a fórmula
  // legada como fallback em corridas "Direto no App"; em corridas Pix/Dinheiro
  // o valor digitado já é o total recebido do passageiro, não um extra.
  const getPlatformOffer = (t: Transaction): number =>
    t.appOfferValue !== undefined
      ? t.appOfferValue
      : Math.max(0, t.value - (t.paymentMethod === 'APP' ? (t.extraChargedValue || 0) : 0));
  const getPlatformExtra = (t: Transaction): number => {
    if (t.extraChargedValue !== undefined) return Math.max(0, t.extraChargedValue);
    return t.paymentMethod === 'APP'
      ? calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue)
      : 0;
  };
  const appRides = rides.filter(t => t.platform === 'UBER' || t.platform === '99');
  const uberRides = appRides.filter(t => t.platform === 'UBER');
  const ninetyNineRides = appRides.filter(t => t.platform === '99');

  const valoresOfertadosUber = uberRides.reduce((s, t) => s + getPlatformOffer(t), 0);
  const valoresOfertados99 = ninetyNineRides.reduce((s, t) => s + getPlatformOffer(t), 0);
  const totalValoresOfertados = valoresOfertadosUber + valoresOfertados99;

  const valoresExtrasUber = uberRides.reduce((s, t) => s + getPlatformExtra(t), 0);
  const valoresExtras99 = ninetyNineRides.reduce((s, t) => s + getPlatformExtra(t), 0);
  const valoresExtrasParticular = 0;
  const totalValoresExtras = valoresExtrasUber + valoresExtras99;

  const ganhosPlataformaUber = valoresOfertadosUber + valoresExtrasUber;
  const ganhosPlataforma99 = valoresOfertados99 + valoresExtras99;
  const ganhosPlataformas = ganhosPlataformaUber + ganhosPlataforma99;

  const expectedGeral = rawIn - rawOut;

  const cancels = activeTx.filter(t => t.type === 'IN' && t.category === 'CANCELAMENTO' && !t.isVirtual);
  const totalCancels = cancels.reduce((s, t) => s + t.value, 0);
  const cancelsCount = cancels.length;

  const tips = activeTx.filter(t => t.type === 'IN' && t.category === 'GORJETA' && !t.isVirtual);
  const totalIndependentTips = tips.reduce((s, t) => s + t.value, 0);
  const independentTipsCount = tips.length;

  const rideTips = activeTx.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.tipValue && t.tipValue > 0 && !t.isVirtual);
  const totalRideTips = rideTips.reduce((s, t) => s + (t.tipValue || 0), 0);
  const rideTipsCount = rideTips.length;

  const totalTips = totalIndependentTips + totalRideTips;
  const tipsCount = independentTipsCount + rideTipsCount;

  // Faturamento bruto de plataformas = soma do valor que o passageiro pagou
  // diretamente à Uber/99. Não inclui o valor ofertado ao motorista, extras,
  // gorjetas, cancelamentos, campanhas ou corridas particulares.
  const getPassengerAppPaid = (t: Transaction): number =>
    t.passengerAppValue !== undefined
      ? t.passengerAppValue
      : t.passengerValue !== undefined
        ? t.passengerValue
        : t.value;
  const faturamentoBrutoUber = uberRides.reduce((s, t) => s + getPassengerAppPaid(t), 0);
  const faturamentoBruto99 = ninetyNineRides.reduce((s, t) => s + getPassengerAppPaid(t), 0);
  const faturamentoBrutoTotal = faturamentoBrutoUber + faturamentoBruto99;

  const valoresOfertadosParticular = 0;

  const particularRidesCount = rides.filter(t => t.platform === 'PARTICULAR').length;

  // Saldo Pós Despesas = Saldo Pix + Saldo Dinheiro + Saldo App − Despesas.
  // expectedPocketCash  = saldo inicial em dinheiro + entradas em dinheiro − saídas em dinheiro.
  // expectedPixBalance  = saldo inicial em Pix      + entradas via Pix      − saídas via Pix.
  // saldosPlataformas   = saldo nas carteiras dos apps (Uber, 99…) — já considera initialUberBalance etc.
  // As despesas já estão descontadas dentro de expectedPocketCash e expectedPixBalance, portanto
  // NÃO se subtrai rawOut novamente — fazer isso dupla-contaria as despesas pagas em Pix/Dinheiro.
  const saldoLiquido = expectedPocketCash + expectedPixBalance + saldosPlataformas;

  // Indicador solicitado pelo motorista:
  // oferta Uber/99 + extras registrados nessas plataformas − despesas.
  const faturamentoPosDespesas = ganhosPlataformas - rawOut;

  return {
    faturamentoBruto: faturamentoBrutoTotal,
    faturamentoBrutoUber,
    faturamentoBruto99,
    faturamentoInflows: rawIn,
    passageiroMaisExtra,
    despesasTotais: rawOut,
    saldoLiquido: saldoLiquido,
    faturamentoPosDespesas,
    avgRide: rides.length > 0 ? rawIn / rides.length : 0,
    ridesCount: rides.length,
    expensesCount: expenses.length,
    uberPercent: rawIn > 0 ? (uberIn / rawIn) * 100 : 0,
    ninetyNinePercent: rawIn > 0 ? (ninetyNineIn / rawIn) * 100 : 0,
    cashFares: cashIn,
    cashExpenses: cashOut,
    uberRidesCount: rides.filter(t => t.platform === 'UBER').length,
    ninetyNineRidesCount: rides.filter(t => t.platform === '99').length,
    particularRidesCount,
    saldoInicialPeriodo: totalInitialBalance,
    saldoGeral: expectedGeral,
    saldosPlataformas,
    totalValoresOfertados,
    valoresOfertadosUber,
    valoresOfertados99,
    valoresOfertadosParticular,
    ganhosPlataformaUber,
    ganhosPlataforma99,
    ganhosPlataformas,
    totalValoresExtras,
    valoresExtrasUber,
    valoresExtras99,
    valoresExtrasParticular,
    totalCancels,
    cancelsCount,
    totalTips,
    tipsCount,
    expectedPocketCash,
    expectedPixBalance,
    uberBalance,
    ninetyNineBalance,
    uberKM,
    ninetyNineKM,
    particularKM,
    totalKM
  };
}

// ─── Variantes com cache TTL ──────────────────────────────────────────────────

function lastTxTs(txs: Transaction[]): string {
  return txs.length > 0 ? String(txs[txs.length - 1].timestamp) : '';
}

/**
 * computeFilteredTransactions com cache 2 s.
 * Chave: filtro + contagem total de transações.
 */
export function computeFilteredTransactionsCached(
  shifts: Shift[],
  periodFilter: PeriodFilter,
): Transaction[] {
  const total = shifts.reduce((n, s) => n + s.transactions.length, 0);
  const key   = `filt:${periodFilter}:${shifts.length}:${total}`;
  return memoWithTTL(key, () => computeFilteredTransactions(shifts, periodFilter));
}

/**
 * computeRefuelMetrics com cache 2 s.
 * Invalida quando muda contagem de transações ou tipo de veículo.
 */
export function computeRefuelMetricsCached(
  shifts: Shift[],
  vehicleType: 'CAR' | 'BIKE',
): ReturnType<typeof computeRefuelMetrics> {
  const total = shifts.reduce((n, s) => n + s.transactions.length, 0);
  const key   = `refuel:${vehicleType}:${shifts.length}:${total}`;
  return memoWithTTL(key, () => computeRefuelMetrics(shifts, vehicleType));
}

/**
 * computeFinancialTotals com cache 2 s.
 * Chave derivada do id + contagem + último timestamp do turno ativo.
 */
export function computeFinancialTotalsCached(
  activeShift: Shift | null,
  activeTab: 'REGISTER' | 'ANALYTICS',
  allFilteredTransactions: Transaction[],
): ReturnType<typeof computeFinancialTotals> {
  const shiftTxs    = activeShift?.transactions ?? [];
  const key = [
    'ft',
    activeShift?.id ?? 'null',
    shiftTxs.length,
    lastTxTs(shiftTxs),
    activeTab,
    allFilteredTransactions.length,
    lastTxTs(allFilteredTransactions),
  ].join(':');
  return memoWithTTL(key, () =>
    computeFinancialTotals(activeShift, activeTab, allFilteredTransactions),
  );
}

/**
 * Retorna o total de dias úteis no mês atual (excluindo domingos se configurado).
 */
function getWorkingDaysInCurrentMonth(excludeSundays: boolean): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (excludeSundays && dow === 0) continue;
    count++;
  }
  return Math.max(count, 1);
}

/**
 * Retorna os dias úteis restantes no mês atual a partir de hoje (inclusive).
 */
export function getRemainingWorkingDays(excludeSundays: boolean): number {
  const now = new Date();
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let count = 0;
  for (let d = today; d <= lastDay; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (excludeSundays && dow === 0) continue;
    count++;
  }
  return Math.max(count, 1);
}

/**
 * Computes monthly goal math.
 */
export function computeMonthlyGoalMath(
  activeShift: Shift | null,
  excludeSundays: boolean,
  faturamentoPosDespesas: number
) {
  const currentMonthlyGoal = activeShift?.monthlyGoal || parseFloat((localStorage.getItem('moob_caixa_monthly_goal') || '6.000,00').replace(/\./g, '').replace(',', '.')) || 6000;
  const daysInMonth = getWorkingDaysInCurrentMonth(excludeSundays);
  const daysInWeek = excludeSundays ? 6 : 7;
  const dailyGoal = currentMonthlyGoal / daysInMonth;
  const weeklyGoal = dailyGoal * daysInWeek;

  const currentShiftNet = activeShift ? Math.max(0, faturamentoPosDespesas) : 0;
  const progressPct = dailyGoal > 0 ? (currentShiftNet / dailyGoal) * 100 : 0;
  const faltaParaMeta = Math.max(0, dailyGoal - currentShiftNet);

  return {
    monthlyGoal: currentMonthlyGoal,
    dailyGoal,
    weeklyGoal,
    accumulatedMonthlyFaturamento: currentShiftNet,
    faltaParaMeta,
    progressPct,
  };
}

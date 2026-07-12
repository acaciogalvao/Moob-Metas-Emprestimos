/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, AppWindow, BarChart3, RotateCcw, Info, X
} from 'lucide-react';

import { Shift, Transaction, PlatformType, TransactionType, PaymentMethod, PeriodFilter } from './types';
import { QuickRegister } from './components/QuickRegister';
import { ShiftControl } from './components/ShiftControl';
import { HistoryList } from './components/HistoryList';
import { Charts } from './components/Charts';
import { PdfReport } from './components/PdfReport';
import { TripTracker } from './components/TripTracker';
import { LoanSystemApp } from './components/LoanSystemApp';
import { AppNavbar } from './components/AppNavbar';
import { SystemTabsNav } from './components/SystemTabsNav';
import { HistoricoCaixasView } from './components/HistoricoCaixasView';
import { ConfirmDialogModal } from './components/ConfirmDialogModal';
import { DbConfigModal } from './components/DbConfigModal';

import { playBeep, playCashRegister } from './utils/audio';
import { formatBRL, formatDecimalBRL, getTransactionFaturamentoReal, calculateExtraValue } from './utils/format';
import { computeFilteredTransactions, computeRefuelMetrics, computeFinancialTotals, computeMonthlyGoalMath } from './utils/financialCalculations';

import { useShiftGPS } from './hooks/useShiftGPS';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useWakeLock } from './hooks/useWakeLock';
import { useGoalsSync } from './hooks/useGoalsSync';
import { useDbConfig } from './hooks/useDbConfig';
import { useSpeedometer } from './hooks/useSpeedometer';
import { useShiftPersistence } from './hooks/useShiftPersistence';

export default function App() {
  // --- PERSISTENCE (shifts, clock, driver name, vehicle type) ---
  const {
    shifts,
    setShifts,
    currentTime,
    driverName,
    setDriverName,
    vehicleType,
    setVehicleType,
    saveToLocalStorage,
  } = useShiftPersistence();

  // --- UI STATE ---
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<Shift | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TOTAL');
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'ANALYTICS'>(() => {
    return (localStorage.getItem('moob_active_tab') as 'REGISTER' | 'ANALYTICS') || 'REGISTER';
  });
  const [systemTab, setSystemTab] = useState<'caixa' | 'historico' | 'viagem' | 'metas'>(() => {
    return (localStorage.getItem('moob_system_tab') as 'caixa' | 'historico' | 'viagem' | 'metas') || 'caixa';
  });

  useEffect(() => {
    localStorage.setItem('moob_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('moob_system_tab', systemTab);
  }, [systemTab]);

  const [showWelcomeMsg, setShowWelcomeMsg] = useState(false);
  const [excludeSundays, setExcludeSundays] = useState<boolean>(() => {
    return localStorage.getItem('moob_caixa_exclude_sundays') === 'true';
  });
  const [draftFuelLiters, setDraftFuelLiters] = useState<number>(0);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  // --- GPS DO TURNO ---
  const hasOpenShift = shifts.some(s => s.status === 'OPEN');
  const shiftGps = useShiftGPS(hasOpenShift);

  // --- HOOKS ---
  const { pwaPrompt, handleInstallPWA } = usePwaInstall();

  const {
    isWakeLockActive,
    wakeLockEnabled,
    setWakeLockEnabled,
    requestWakeLock,
    releaseWakeLock,
  } = useWakeLock();

  const { goalsList, isLoadingGoals, fetchGoalsList } = useGoalsSync(systemTab);

  const {
    showDbConfigModal,
    setShowDbConfigModal,
    dbStatus,
    newDbUri,
    setNewDbUri,
    newDbMetaUri,
    setNewDbMetaUri,
    dbConfigSaving,
    dbConfigMessage,
    setDbConfigMessage,
    fetchDbStatus,
    handleSaveDbUri,
    handleManualSync,
  } = useDbConfig(shifts, setShifts);

  const {
    isSpeedometerActive,
    currentSpeed,
    speedSimCount,
    setSpeedSimCount,
    isPipActive,
    canvasRef,
    videoRef,
    handleToggleSpeedometer,
    handleEnablePip,
  } = useSpeedometer(hasOpenShift, shiftGps.speedKmh, shiftGps.isActive);

  // --- CORE GETTERS & ANALYTICAL MATHS ---
  const activeShift = shifts.find(s => s.status === 'OPEN') || null;

  const allFilteredTransactions = computeFilteredTransactions(shifts, periodFilter);

  const refuelMetrics = useMemo(
    () => computeRefuelMetrics(shifts, vehicleType),
    [shifts, vehicleType]
  );

  const financialTotals = computeFinancialTotals(activeShift, activeTab, allFilteredTransactions);

  const faturamentoPosDespesas = financialTotals.saldoLiquido;

  const monthlyGoalMath = computeMonthlyGoalMath(activeShift, excludeSundays, faturamentoPosDespesas);

  // Find last closed shift faturamento real
  const lastClosedShiftRef = shifts
    .filter(s => s.status === 'CLOSED')
    .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null;

  let lastClosedShiftFaturamento = 0;
  if (lastClosedShiftRef) {
    const shiftRides = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
    const shiftInflows = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
    const shiftExpenses = lastClosedShiftRef.transactions.filter(t => t.type === 'OUT');

    const shiftBruto = shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) +
                       shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);

    lastClosedShiftFaturamento = shiftBruto;
  }

  // --- ACTIONS ---

  const handleChangeDriverName = (newName: string) => {
    setDriverName(newName);
    localStorage.setItem('moob_caixa_driver_name', newName);
  };

  const handleOpenShift = (
    initialPixBalance: number,
    initialCashBalance: number,
    initialOdometer?: number,
    initialUberBalance?: number,
    initial99Balance?: number,
    initialFuelLiters?: number,
    initialFuelLevel?: string,
    monthlyGoal?: number,
    dailyKmGoal?: number
  ) => {
    const closedOldShifts = shifts.map(s => {
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });

    const lastClosedShift = shifts
      .filter(s => s.status === 'CLOSED')
      .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null;

    let previousFaturamentoReal = 0;
    if (lastClosedShift) {
      const shiftRides = lastClosedShift.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
      const shiftInflows = lastClosedShift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const shiftExpenses = lastClosedShift.transactions.filter(t => t.type === 'OUT');

      const shiftBruto = shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) +
                         shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);

      previousFaturamentoReal = shiftBruto;
    }

    const totalBalance = initialPixBalance + initialCashBalance;
    const ajuste = lastClosedShift ? (totalBalance - previousFaturamentoReal) : 0;

    const newShift: Shift = {
      id: `shift-${Date.now()}-${new Date().toISOString().split('T')[0]}`,
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialBalance: totalBalance,
      initialPixBalance,
      initialCashBalance,
      initialUberBalance,
      initial99Balance,
      status: 'OPEN',
      transactions: [],
      closingBalanceExpected: totalBalance,
      initialOdometer: initialOdometer !== undefined && !isNaN(initialOdometer) ? initialOdometer : undefined,
      initialFuelLiters: initialFuelLiters !== undefined && !isNaN(initialFuelLiters) ? initialFuelLiters : undefined,
      initialFuelLevel,
      monthlyGoal: monthlyGoal !== undefined && !isNaN(monthlyGoal) ? monthlyGoal : undefined,
      dailyKmGoal: dailyKmGoal !== undefined && !isNaN(dailyKmGoal) ? dailyKmGoal : undefined,
      ajusteSaldoAnterior: ajuste,
      saldoAnterior: lastClosedShift ? previousFaturamentoReal : undefined
    };

    saveToLocalStorage([newShift, ...closedOldShifts]);
  };

  const handleAddTransaction = (tx: Omit<Transaction, 'id' | 'timestamp'> | Omit<Transaction, 'id' | 'timestamp'>[]) => {
    if (!activeShift) return;

    const txsArray = Array.isArray(tx) ? tx : [tx];

    setShifts(prevShifts => {
      const updated = prevShifts.map(s => {
        if (s.id === activeShift.id) {
          const newTxs: Transaction[] = txsArray.map((t, idx) => ({
            id: `tx-${Date.now()}-${idx}-${Math.round(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...t
          }));

          const trans = [...s.transactions, ...newTxs];

          const totalIn = trans.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
          const totalOut = trans.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
          const expected = s.initialBalance + totalIn - totalOut;

          return {
            ...s,
            transactions: trans,
            closingBalanceExpected: Math.round(expected * 100) / 100
          };
        }
        return s;
      });

      localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateActiveShift = (updatedFields: Partial<Shift>) => {
    if (!activeShift) return;
    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return { ...s, ...updatedFields };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  const executeDeleteTransaction = (txId: string) => {
    const updatedShifts = shifts.map(s => {
      const matchTx = s.transactions.some(t => t.id === txId);
      if (matchTx) {
        const remaining = s.transactions.filter(t => t.id !== txId);

        const totalIn = remaining.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
        const totalOut = remaining.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
        const expected = s.initialBalance + totalIn - totalOut;

        return {
          ...s,
          transactions: remaining,
          closingBalanceExpected: Math.round(expected * 100) / 100
        };
      }
      return s;
    });

    saveToLocalStorage(updatedShifts);
    setConfirmDialog(null);
  };

  const handleDeleteTransaction = (txId: string) => {
    let value = 0;
    for (const s of shifts) {
      const found = s.transactions.find(t => t.id === txId);
      if (found) {
        value = found.value;
        break;
      }
    }

    setConfirmDialog({
      title: 'Excluir Lançamento?',
      message: `Tem certeza de que deseja excluir permanentemente o lançamento no valor de R$ ${formatDecimalBRL(value)}? Esta ação não poderá ser desfeita.`,
      confirmText: 'Confirmar Exclusão',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => executeDeleteTransaction(txId)
    });
  };

  const handleCloseShift = (
    closingBalanceReal: number,
    closingPixReal: number,
    notes: string,
    finalOdometer?: number,
    totalLitersFueled?: number,
    finalFuelLiters?: number,
    finalFuelLevel?: string
  ) => {
    if (!activeShift) return;

    const getExpectedPocketCashForShift = (shift: Shift) => {
      const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const expenses = shift.transactions.filter(t => t.type === 'OUT');
      const cashIn = allInTransactions.reduce((sum, t) => {
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
      const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((acc, t) => acc + t.value, 0);
      const initialCash = shift.initialCashBalance !== undefined ? shift.initialCashBalance : shift.initialBalance;
      return initialCash + cashIn - cashOut;
    };

    const getExpectedPixBalanceForShift = (shift: Shift) => {
      const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const expenses = shift.transactions.filter(t => t.type === 'OUT');
      const pixIn = allInTransactions.reduce((sum, t) => {
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
      const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((acc, t) => acc + t.value, 0);
      const initialPix = shift.initialPixBalance !== undefined ? shift.initialPixBalance : 0;
      return initialPix + pixIn - pixOut;
    };

    const expectedPocketCash = getExpectedPocketCashForShift(activeShift);
    const diff = Math.round((closingBalanceReal - expectedPocketCash) * 100) / 100;

    const expectedPixBalance = getExpectedPixBalanceForShift(activeShift);
    const diffPix = Math.round((closingPixReal - expectedPixBalance) * 100) / 100;

    const closed: Shift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      status: 'CLOSED' as const,
      closingBalanceReal,
      difference: diff,
      closingPixReal,
      differencePix: diffPix,
      notes: notes.trim() || undefined,
      finalOdometer: finalOdometer !== undefined && !isNaN(finalOdometer) ? finalOdometer : undefined,
      totalLitersFueled: totalLitersFueled !== undefined && !isNaN(totalLitersFueled) ? totalLitersFueled : undefined,
      finalFuelLiters: finalFuelLiters !== undefined && !isNaN(finalFuelLiters) ? finalFuelLiters : undefined,
      finalFuelLevel: finalFuelLevel || undefined
    };

    setTimeout(() => setSelectedShiftForReport(closed), 200);

    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return closed;
      }
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  const executeDeleteHistoryShift = async (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));

    try {
      const response = await fetch(`/moob-api/shifts/${shiftId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        console.log(`[Sync-Offline-First] Turno ${shiftId} excluído do banco de dados com sucesso.`);
      } else {
        console.warn(`[Sync-Offline-First] Falha ao excluir turno ${shiftId} no servidor.`);
      }
    } catch (err) {
      console.warn("[Sync-Offline-First] Erro ao excluir turno do banco de dados:", err);
    }

    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: updated })
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Erro na sincronização pós-exclusão");
    })
    .then(data => {
      if (Array.isArray(data)) {
        setShifts(data);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify(data));
      }
    })
    .catch(err => {
      console.warn("[Sync-Offline-First] Falha ao sincronizar após exclusão:", err);
    });

    setConfirmDialog(null);
  };

  const handleDeleteHistoryShift = (shiftId: string) => {
    setConfirmDialog({
      title: 'Excluir Turno do Histórico?',
      message: 'Tem certeza de que deseja expurgar e deletar permanentemente as estatísticas e todos os lançamentos desse turno? É uma ação irreversível.',
      confirmText: 'Excluir Definitivamente',
      cancelText: 'Manter Turno',
      isDanger: true,
      onConfirm: () => executeDeleteHistoryShift(shiftId)
    });
  };

  const handleFactoryReset = () => {
    setConfirmDialog({
      title: 'Resetar Sistema / Banco de Dados?',
      message: 'Esta ação irá limpar absolutamente todas as estatísticas, faturamentos, cadastros e saídas do seu dispositivo para retornar ao estado original de simulação limpa. Deseja prosseguir?',
      confirmText: 'Sim, Resetar Tudo',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        const closedShifts = shifts.filter(s => s.status === 'CLOSED');
        saveToLocalStorage(closedShifts);
        setConfirmDialog(null);
        playBeep();
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 select-none relative overflow-x-hidden w-full max-w-[480px] mx-auto flex flex-col shadow-2xl md:border-x md:border-slate-800/60 md:shadow-amber-500/5">

      {/* 1. TOP NAVBAR / CASHIER TICKER */}
      <AppNavbar
        driverName={driverName}
        onChangeDriverName={handleChangeDriverName}
        vehicleType={vehicleType}
        onSetVehicleType={(type) => {
          setVehicleType(type);
          localStorage.setItem('moob_caixa_vehicle_type', type);
        }}
        isWakeLockActive={isWakeLockActive}
        wakeLockEnabled={wakeLockEnabled}
        onToggleWakeLock={async () => {
          playBeep();
          const newEnabled = !wakeLockEnabled;
          setWakeLockEnabled(newEnabled);
          localStorage.setItem('moob_wake_lock_enabled', String(newEnabled));
          if (newEnabled) {
            await requestWakeLock();
          } else {
            await releaseWakeLock();
          }
        }}
        dbStatus={dbStatus}
        onOpenDbConfig={() => {
          playBeep();
          fetchDbStatus();
          setDbConfigMessage(null);
          setShowDbConfigModal(true);
        }}
        pwaPrompt={pwaPrompt}
        onInstallPWA={handleInstallPWA}
        currentTime={currentTime}
      />

      {/* Main container */}
      <main className="w-full px-3 mt-3.5 space-y-3.5 flex-1 flex flex-col">

        {/* UNIFIED SYSTEM TABS (MoobFinance) */}
        <SystemTabsNav systemTab={systemTab} onSetSystemTab={setSystemTab} />

        {systemTab === 'historico' ? (
          <HistoricoCaixasView
            shifts={shifts}
            driverName={driverName}
            onSelectShiftForReport={setSelectedShiftForReport}
            onDeleteHistoryShift={handleDeleteHistoryShift}
          />
        ) : systemTab === 'metas' ? (
          <motion.div
            key="metas-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <LoanSystemApp />
          </motion.div>
        ) : systemTab === 'viagem' ? (
          <motion.div
            key="viagem-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <TripTracker
              activeShift={activeShift}
              onAddTransaction={handleAddTransaction}
              vehicleType={vehicleType}
              onGoToCaixa={() => setSystemTab('caixa')}
            />
          </motion.div>
        ) : (
          <>
            {/* WELCOME / TIP MESSAGE CARD */}
            {showWelcomeMsg ? (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md"
              >
                <div className="flex gap-2.5">
                  <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg mt-0.5 shrink-0">
                    <Info className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">
                      Controle de Caixa Profissional Uber & 99 (Alta Densidade)
                    </h4>
                    <p className="text-[14.5px] text-slate-400 mt-0.5 max-w-4xl leading-relaxed">
                      Fluxo financeiro rápido de faturamento integrado para motoristas de aplicativo. Compare faturamento diário,
                      gerencie despesas por categoria, audite quebras de dinheiro físico no bolso e emita recibos térmicos em PDF de forma prática.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={handleFactoryReset}
                    title="Limpar todos os dados do turno atual para reiniciar do zero"
                    className="text-[14px] flex items-center gap-1 font-mono text-slate-400 hover:text-white py-1 px-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all bg-slate-950/40 font-bold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resetar
                  </button>
                  <button
                    onClick={() => setShowWelcomeMsg(false)}
                    className="text-[14px] text-slate-350 hover:text-white font-bold bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-all"
                  >
                    Dispensar
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex justify-end -mt-1.5 -mb-1">
                <button
                  onClick={() => setShowWelcomeMsg(true)}
                  className="text-[14px] text-amber-500 hover:text-amber-400 font-bold bg-slate-900 border border-slate-800 hover:border-slate-750 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                >
                  <Info className="w-3.5 h-3.5" />
                  Abrir Painel de Instruções
                </button>
              </div>
            )}

            {/* 2. CORE FINANCIAL COUNTERS */}
            <div className="grid grid-cols-2 gap-2" id="dashboard-general-scores">
              {/* Score 1: Faturamento Bruto Real */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-emerald-400 font-bold uppercase tracking-wider block" title="Valores ofertados pelo App">Faturamento Bruto Real</span>
                <div className="mt-1 text-lg font-black font-mono text-emerald-400 tracking-tight leading-normal">
                  {formatBRL(financialTotals.totalValoresOfertados)}
                </div>
                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-250 inline-block" />
                      Uber:
                    </span>
                    <strong className="text-white font-bold">{financialTotals.uberRidesCount} corr.</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      99 App:
                    </span>
                    <strong className="text-amber-400 font-bold">{financialTotals.ninetyNineRidesCount} corr.</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
                    Valor bruto total entrado no turno
                  </div>
                </div>
              </div>

              {/* Score 2: Faturamento Real Pós Despesas */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-cyan-400 font-bold uppercase tracking-wider block" title="Valor pago pelo passageiro + Extra - Despesas do turno">Faturamento Pós Despesas</span>
                <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${faturamentoPosDespesas >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatBRL(faturamentoPosDespesas)}
                </div>
                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span>Ofertado + Extra:</span>
                    <span className="text-emerald-400 font-semibold">R$ {formatDecimalBRL(financialTotals.totalValoresOfertados + financialTotals.totalValoresExtras)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-sans">
                    <span>Despesas op.:</span>
                    <span className="text-rose-450 font-bold">-R$ {formatDecimalBRL(financialTotals.despesasTotais)}</span>
                  </div>
                </div>
              </div>

              {/* Saldos dos Apps (Uber + 99) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-violet-400 font-bold uppercase tracking-wider block" title="Saldo acumulado nas carteiras digitais dos aplicativos">Saldos dos Apps</span>
                <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${(financialTotals.uberBalance + financialTotals.ninetyNineBalance) >= 0 ? 'text-violet-400' : 'text-rose-400'}`}>
                  {formatBRL(financialTotals.uberBalance + financialTotals.ninetyNineBalance)}
                </div>
                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                    <span className={`font-bold ${financialTotals.uberBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.uberBalance)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                    <span className={`font-bold ${financialTotals.ninetyNineBalance >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.ninetyNineBalance)}</span>
                  </div>
                  <div className="text-[11px] text-violet-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
                    Saldo líquido nas carteiras digitais
                  </div>
                </div>
              </div>

              {/* Score 3: Lucro Extra */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-amber-400 font-bold uppercase tracking-wider block" title="O que você está ganhando em cima do que o passageiro pagou para a plataforma">Lucro Extra</span>
                <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal">
                  {formatBRL(financialTotals.totalValoresExtras)}
                </div>
                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                    <span className="font-bold text-white">R$ {formatDecimalBRL(financialTotals.valoresExtrasUber)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                    <span className="font-bold text-amber-400">R$ {formatDecimalBRL(financialTotals.valoresExtras99)}</span>
                  </div>
                  {financialTotals.valoresExtrasParticular > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Particular:</span>
                      <span className="font-bold text-emerald-400">R$ {formatDecimalBRL(financialTotals.valoresExtrasParticular)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-500 font-bold border-t border-slate-800/40 pt-1.5 mt-0.5">
                    <span className="font-sans">Adicional Total:</span>
                    <span>+{financialTotals.totalValoresOfertados > 0 ? ((financialTotals.totalValoresExtras / financialTotals.totalValoresOfertados) * 100).toFixed(0) : '0'}%</span>
                  </div>
                </div>
              </div>

              {/* Score 5: Progresso da Meta de Faturamento Real (Goal Tracker) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-amber-500 font-bold uppercase tracking-wider block">Progresso Meta</span>
                  <span className="text-[12px] text-slate-500 font-mono font-bold">🎯 R$ {formatDecimalBRL(monthlyGoalMath.monthlyGoal)}</span>
                </div>
                <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal flex items-center justify-between">
                  <div>
                    {monthlyGoalMath.progressPct.toFixed(0)}%
                    <span className="text-[14px] text-slate-400 font-sans font-normal ml-1">da diária</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !excludeSundays;
                      setExcludeSundays(nextVal);
                      localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
                    }}
                    className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
                      excludeSundays
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={excludeSundays ? "Calculando sem contar domingos" : "Calculando contando domingos"}
                  >
                    {excludeSundays ? 'Sem Domingos' : 'Com Domingos'}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-950 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, monthlyGoalMath.progressPct)}%` }}
                  />
                </div>

                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-rose-400 font-bold">Falta:</span>
                    <strong className={`font-black font-mono ${monthlyGoalMath.faltaParaMeta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {monthlyGoalMath.faltaParaMeta <= 0 ? '✅ Meta atingida!' : `R$ ${formatDecimalBRL(monthlyGoalMath.faltaParaMeta)}`}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Feito:</span>
                    <strong className="text-white font-bold">R$ {formatDecimalBRL(monthlyGoalMath.accumulatedMonthlyFaturamento)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Meta diária:</span>
                    <strong className="text-slate-300 font-bold">R$ {formatDecimalBRL(monthlyGoalMath.dailyGoal)}</strong>
                  </div>
                </div>
              </div>

              {/* Score 6: Despesas Totais */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-rose-500 font-bold uppercase tracking-wider block">Despesas Totais</span>
                <div className="mt-1 text-lg font-black font-mono text-rose-400 tracking-tight leading-normal">
                  {formatBRL(financialTotals.despesasTotais)}
                </div>
                <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span>Registros:</span>
                    <span className="font-bold text-white">{financialTotals.expensesCount} lanç.</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Proporção:</span>
                    <span className="text-rose-450 font-bold">-{financialTotals.faturamentoBruto > 0 ? `${Math.round((financialTotals.despesasTotais / financialTotals.faturamentoBruto) * 100)}%` : '0%'}</span>
                  </div>
                  <span className="text-[11px] text-rose-450 font-sans mt-1">Deduzido do caixa geral</span>
                </div>
              </div>

              {/* Corridas por Plataforma */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-teal-400 font-bold uppercase tracking-wider block">Corridas / Plataforma</span>
                <div className="mt-1 text-lg font-black font-mono text-teal-400 tracking-tight leading-normal">
                  {financialTotals.ridesCount} <span className="text-[13px] font-sans font-normal text-slate-500">corridas</span>
                </div>
                <div className="text-[12px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                    <span className="text-white font-black">{financialTotals.uberRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.uberPercent.toFixed(0)}%)</span></span>
                  </div>
                  <div className="flex justify-between items-center text-amber-500">
                    <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                    <span className="font-black text-amber-400">{financialTotals.ninetyNineRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.ninetyNinePercent.toFixed(0)}%)</span></span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 font-sans mt-0.5 border-t border-slate-800/20 pt-0.5">
                    <span>Média/corr.:</span>
                    <span className="text-slate-300 font-medium font-mono">{formatBRL(financialTotals.avgRide)}</span>
                  </div>
                </div>
              </div>

              {/* Score 9: KM Rodados & Fora das Plataformas */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
                <span className="text-[12.5px] text-indigo-400 font-bold uppercase tracking-wider block" title="Total de quilômetros rodados no turno e o quanto foi fora dos aplicativos">KM Rodados no Turno</span>
                <div className="mt-1 text-lg font-black font-mono text-white tracking-tight leading-normal flex justify-between items-baseline">
                  <span>{financialTotals.totalKM.toFixed(1).replace('.', ',')} <span className="text-[13px] font-sans font-normal text-slate-500">KM</span></span>
                  {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 ? (
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">
                      Meta: {activeShift.dailyKmGoal} KM
                    </span>
                  ) : financialTotals.particularKM > 0 ? (
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1 py-0.5 rounded animate-pulse">
                      Por Fora
                    </span>
                  ) : null}
                </div>

                {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (financialTotals.totalKM / activeShift.dailyKmGoal) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10.5px] text-slate-500 mt-1 font-mono">
                      <span>Progresso: {((financialTotals.totalKM / activeShift.dailyKmGoal) * 100).toFixed(0)}%</span>
                      {activeShift.dailyKmGoal - financialTotals.totalKM > 0 ? (
                        <span>Falta: {(activeShift.dailyKmGoal - financialTotals.totalKM).toFixed(1).replace('.', ',')} KM</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">✅ Meta batida!</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="text-[11.5px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Uber:</span>
                    <span className="text-white">{financialTotals.uberKM.toFixed(1).replace('.', ',')} km</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>99 App:</span>
                    <span className="text-amber-500">{financialTotals.ninetyNineKM.toFixed(1).replace('.', ',')} km</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-400 border-t border-slate-800/20 pt-1 mt-0.5 font-sans">
                    <span className="font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                      Fora do App:
                    </span>
                    <span className="font-bold font-mono text-[12px]">{financialTotals.particularKM.toFixed(1).replace('.', ',')} km</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TABS TRIGGER MENU — segmented control nativo */}
            <div className="flex mt-3 bg-slate-900 rounded-xl p-1 gap-1 border border-slate-800/80">
              <button
                onClick={() => { setActiveTab('REGISTER'); playBeep(); }}
                className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
                  activeTab === 'REGISTER'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📟 Caixa
              </button>
              <button
                onClick={() => { setActiveTab('ANALYTICS'); playBeep(); }}
                className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
                  activeTab === 'ANALYTICS'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📊 Demonstrativos
              </button>
            </div>

            {/* 4. ACTIVE SUB-COMPONENT VIEWS */}
            <AnimatePresence mode="wait">
              {activeTab === 'REGISTER' ? (
                <motion.div
                  key="register-block"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                >
                  {/* QuickRegister component (Keypad + Selection) */}
                  <div className="lg:col-span-8">
                    <QuickRegister
                      activeShift={activeShift}
                      onAddTransaction={handleAddTransaction}
                      onOpenShift={handleOpenShift}
                      vehicleType={vehicleType}
                      lastClosedShiftFaturamento={lastClosedShiftFaturamento}
                      onGoToViagem={() => setSystemTab('viagem')}
                      excludeSundays={excludeSundays}
                      onToggleExcludeSundays={setExcludeSundays}
                      onDraftFuelLitersChange={setDraftFuelLiters}
                    />
                  </div>

                  {/* ShiftControl panel (Opening/Closing, Live Pocket verification, Historical lists) */}
                  <div className="lg:col-span-4 space-y-6">
                    <ShiftControl
                      activeShift={activeShift}
                      historicalShifts={shifts.filter(s => s.status === 'CLOSED')}
                      onCloseShift={handleCloseShift}
                      onDeleteHistoryShift={handleDeleteHistoryShift}
                      onSelectShiftForReport={setSelectedShiftForReport}
                      onDeleteTransaction={handleDeleteTransaction}
                      vehicleType={vehicleType}
                      onSetVehicleType={(type) => {
                        setVehicleType(type);
                        localStorage.setItem('moob_caixa_vehicle_type', type);
                      }}
                      onAddTransaction={handleAddTransaction}
                      isSpeedometerActive={isSpeedometerActive}
                      onToggleSpeedometer={handleToggleSpeedometer}
                      onUpdateActiveShift={handleUpdateActiveShift}
                      refuelMetrics={refuelMetrics}
                      draftFuelLiters={draftFuelLiters}
                      excludeSundays={excludeSundays}
                      onToggleExcludeSundays={() => {
                        const nextVal = !excludeSundays;
                        setExcludeSundays(nextVal);
                        localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
                      }}
                      gpsSpeedKmh={shiftGps.speedKmh}
                      gpsShiftKm={shiftGps.shiftKm}
                      isGpsActive={shiftGps.isActive}
                      gpsAccuracy={shiftGps.accuracy}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Charts breakdown (Uber vs 99 daily comparison) */}
                  <Charts shifts={shifts} transactions={allFilteredTransactions} />

                  {/* Comprehensive logs and filtering */}
                  <HistoryList
                    transactions={allFilteredTransactions}
                    onDeleteTransaction={handleDeleteTransaction}
                    periodFilter={periodFilter}
                    onSetPeriodFilter={setPeriodFilter}
                    vehicleType={vehicleType}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* 5. PDF EMITTAL DIALOG PREVIEW OVERFLOW */}
        <AnimatePresence>
          {selectedShiftForReport && (
            <PdfReport
              shift={selectedShiftForReport}
              onClose={() => setSelectedShiftForReport(null)}
              vehicleType={vehicleType}
              operatorName={driverName}
            />
          )}
        </AnimatePresence>

        {/* 6. CONFIRM DIALOG */}
        <ConfirmDialogModal
          confirmDialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />

        {/* DATABASE SETTINGS MODAL */}
        <DbConfigModal
          showDbConfigModal={showDbConfigModal}
          onClose={() => setShowDbConfigModal(false)}
          dbStatus={dbStatus}
          newDbUri={newDbUri}
          onSetNewDbUri={setNewDbUri}
          newDbMetaUri={newDbMetaUri}
          onSetNewDbMetaUri={setNewDbMetaUri}
          dbConfigSaving={dbConfigSaving}
          dbConfigMessage={dbConfigMessage}
          onSaveDbUri={handleSaveDbUri}
          onManualSync={handleManualSync}
          onClearFields={() => {
            playBeep();
            setNewDbUri("");
          }}
        />

        {/* FLOATING GPS SPEEDOMETER WIDGET */}
        <AnimatePresence>
          {isSpeedometerActive && (
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.1}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              className="fixed bottom-24 right-4 z-[999] cursor-grab active:cursor-grabbing font-sans"
              title="Velocímetro - Toque para simular velocidade"
            >
              {(() => {
                const speeds = [0, 24, 48, 72, 95, 120];
                const displaySpeed = speedSimCount > 0 ? speeds[speedSimCount % speeds.length] : currentSpeed;
                const isSimulated = speedSimCount > 0;

                let colorClass = "border-emerald-500 shadow-emerald-500/40 text-emerald-400";
                let bgClass = "bg-emerald-950/20";
                if (displaySpeed > 90) {
                  colorClass = "border-rose-500 shadow-rose-500/40 text-rose-400 animate-pulse";
                  bgClass = "bg-rose-950/20";
                } else if (displaySpeed > 60) {
                  colorClass = "border-amber-500 shadow-amber-500/40 text-amber-400";
                  bgClass = "bg-amber-950/20";
                }

                return (
                  <div className="relative">
                    {/* Speed Bubble Circle */}
                    <div
                      onClick={() => {
                        playBeep();
                        setSpeedSimCount(prev => prev + 1);
                      }}
                      className={`w-20 h-20 rounded-full bg-slate-950/90 border-2 ${colorClass} ${bgClass} shadow-2xl flex flex-col items-center justify-center backdrop-blur-md select-none transition-all duration-300 hover:scale-105 active:scale-95`}
                    >
                      {/* Speed value */}
                      <span className="text-2xl font-black tracking-tighter leading-none mt-1">
                        {displaySpeed}
                      </span>
                      {/* Unit */}
                      <span className="text-[12px] font-bold uppercase text-slate-400 tracking-wider">
                        km/h
                      </span>

                      {/* Info tiny guide */}
                      <span className="text-[14px] text-slate-500 font-medium absolute bottom-1.5 font-mono">
                        TOQUE P/ TESTAR
                      </span>
                    </div>

                    {/* Simulation badge indicator */}
                    {isSimulated && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[14.5px] font-black font-mono px-1 py-0.2 rounded-md shadow border border-slate-950 uppercase tracking-widest leading-none">
                        SIM
                      </span>
                    )}

                    {/* Close x button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSpeedometer();
                      }}
                      className="absolute -top-1 -left-1 w-5 h-5 bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer"
                      title="Fechar Velocímetro"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* Picture-in-Picture floating toggle to overlay other apps */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnablePip();
                      }}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                        isPipActive
                          ? 'border-amber-500 text-amber-400 bg-amber-950/20 animate-pulse'
                          : 'hover:border-amber-500/50 hover:bg-slate-800 text-slate-400'
                      }`}
                      title="Minimizar para Janela Flutuante (Sobrepor outros apps)"
                    >
                      <AppWindow className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden elements for PiP overlay support */}
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '200px', height: '200px', pointerEvents: 'none', opacity: 0 }}
        />
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '200px', height: '200px', pointerEvents: 'none', opacity: 0 }}
        />

      </main>
    </div>
  );
}

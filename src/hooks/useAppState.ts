/**
 * useAppState.ts
 * Consolida todo o estado, hooks e handlers do app em um único lugar.
 * O AppShell consome este hook para renderizar a interface.
 */

import { useState, useEffect } from 'react';
import { Shift, PeriodFilter } from '../types';
import { playBeep } from '../utils/audio';

import { useShiftPersistence } from './useShiftPersistence';
import { useConfirmDialog } from './useConfirmDialog';
import { useShiftGPS } from './useShiftGPS';
import { usePwaInstall } from './usePwaInstall';
import { useWakeLock } from './useWakeLock';
import { useGoalsSync } from './useGoalsSync';
import { useDbConfig } from './useDbConfig';
import { useSpeedometer } from './useSpeedometer';
import { useDashboardMetrics } from './useDashboardMetrics';
import { useShiftActions } from './useShiftActions';

export type SystemTab = 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina';
export type ActiveTab = 'REGISTER' | 'ANALYTICS';

export function useAppState() {
  // ── Persistência base (turnos, relógio, motorista, veículo) ──────────────
  const {
    shifts,
    setShifts,
    currentTime,
    driverName,
    setDriverName,
    vehicleType,
    setVehicleType,
    saveToLocalStorage,
    queueCloudSync,
    isOnline,
    isLoadingFromServer,
  } = useShiftPersistence();

  // ── Estado de UI ─────────────────────────────────────────────────────────
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<Shift | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TOTAL');

  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    (localStorage.getItem('moob_active_tab') as ActiveTab) || 'REGISTER'
  );

  const [systemTab, setSystemTab] = useState<SystemTab>(() =>
    (localStorage.getItem('moob_system_tab') as SystemTab) || 'caixa'
  );

  const [showWelcomeMsg, setShowWelcomeMsg] = useState(false);

  const [excludeSundays, setExcludeSundays] = useState<boolean>(
    () => localStorage.getItem('moob_caixa_exclude_sundays') === 'true'
  );

  const [draftFuelLiters, setDraftFuelLiters] = useState<number>(0);
  const [liveFuelLevel, setLiveFuelLevel] = useState<number | null>(null);

  // Persiste tabs no localStorage
  useEffect(() => { localStorage.setItem('moob_active_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('moob_system_tab', systemTab); }, [systemTab]);

  // ── Confirm dialog ────────────────────────────────────────────────────────
  const { confirmDialog, setConfirmDialog } = useConfirmDialog();

  // ── GPS do turno ──────────────────────────────────────────────────────────
  const hasOpenShift = shifts.some(s => s.status === 'OPEN');
  const shiftGps = useShiftGPS(hasOpenShift);

  // ── PWA install ───────────────────────────────────────────────────────────
  const { pwaPrompt, handleInstallPWA } = usePwaInstall();

  // ── Wake lock ─────────────────────────────────────────────────────────────
  const {
    isWakeLockActive,
    wakeLockEnabled,
    setWakeLockEnabled,
    requestWakeLock,
    releaseWakeLock,
  } = useWakeLock();

  // ── Metas (sync com servidor) ─────────────────────────────────────────────
  const { goalsList, isLoadingGoals, fetchGoalsList } = useGoalsSync(systemTab);

  // ── Configuração de banco ─────────────────────────────────────────────────
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

  // ── Velocímetro GPS ───────────────────────────────────────────────────────
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

  // ── Métricas do dashboard ─────────────────────────────────────────────────
  const {
    activeShift,
    allFilteredTransactions,
    refuelMetrics,
    financialTotals,
    faturamentoPosDespesas,
    monthlyGoalMath,
    lastClosedShiftFaturamento,
    lastClosedShift,
  } = useDashboardMetrics({ shifts, vehicleType, periodFilter, activeTab, excludeSundays });

  // ── Actions (abrir/fechar caixa, transações) ──────────────────────────────
  const {
    handleChangeDriverName,
    handleOpenShift,
    handleAddTransaction,
    handleUpdateActiveShift,
    handleDeleteTransaction,
    handleCloseShift,
    handleDeleteHistoryShift,
    handleFactoryReset,
  } = useShiftActions({
    shifts,
    setShifts,
    saveToLocalStorage,
    queueCloudSync,
    setDriverName,
    setConfirmDialog,
    setSelectedShiftForReport,
    activeShift,
  });

  // ── Handlers derivados ────────────────────────────────────────────────────
  function handleSetVehicleType(type: 'CAR' | 'BIKE') {
    setVehicleType(type);
    localStorage.setItem('moob_caixa_vehicle_type', type);
  }

  async function handleToggleWakeLock() {
    playBeep();
    const newEnabled = !wakeLockEnabled;
    setWakeLockEnabled(newEnabled);
    localStorage.setItem('moob_wake_lock_enabled', String(newEnabled));
    if (newEnabled) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  }

  function handleOpenDbConfig() {
    playBeep();
    fetchDbStatus();
    setDbConfigMessage(null);
    setShowDbConfigModal(true);
  }

  function handleToggleExcludeSundays() {
    const next = !excludeSundays;
    setExcludeSundays(next);
    localStorage.setItem('moob_caixa_exclude_sundays', String(next));
  }

  function handleClearDbFields() {
    playBeep();
    setNewDbUri('');
  }

  return {
    // Dados brutos
    shifts,
    currentTime,
    driverName,
    vehicleType,
    isOnline,
    isLoadingFromServer,

    // UI
    selectedShiftForReport,
    setSelectedShiftForReport,
    periodFilter,
    setPeriodFilter,
    activeTab,
    setActiveTab,
    systemTab,
    setSystemTab,
    showWelcomeMsg,
    setShowWelcomeMsg,
    excludeSundays,
    draftFuelLiters,
    setDraftFuelLiters,
    liveFuelLevel,
    setLiveFuelLevel,

    // Dialog
    confirmDialog,
    setConfirmDialog,

    // GPS
    shiftGps,

    // PWA
    pwaPrompt,
    handleInstallPWA,

    // Wake lock
    isWakeLockActive,
    wakeLockEnabled,

    // DB config
    showDbConfigModal,
    setShowDbConfigModal,
    dbStatus,
    newDbUri,
    setNewDbUri,
    newDbMetaUri,
    setNewDbMetaUri,
    dbConfigSaving,
    dbConfigMessage,
    handleSaveDbUri,
    handleManualSync,

    // Velocímetro
    isSpeedometerActive,
    currentSpeed,
    speedSimCount,
    setSpeedSimCount,
    isPipActive,
    canvasRef,
    videoRef,
    handleEnablePip,

    // Métricas
    activeShift,
    allFilteredTransactions,
    refuelMetrics,
    financialTotals,
    faturamentoPosDespesas,
    monthlyGoalMath,
    lastClosedShiftFaturamento,
    lastClosedShift,

    // Actions
    handleChangeDriverName,
    handleOpenShift,
    handleAddTransaction,
    handleUpdateActiveShift,
    handleDeleteTransaction,
    handleCloseShift,
    handleDeleteHistoryShift,
    handleFactoryReset,

    // Handlers derivados
    handleSetVehicleType,
    handleToggleWakeLock,
    handleOpenDbConfig,
    handleToggleExcludeSundays,
    handleClearDbFields,
    handleToggleSpeedometer,
  };
}

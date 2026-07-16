/**
 * useAppState.ts
 * Consolida todo o estado, hooks e handlers do app em um único lugar.
 * O AppShell consome este hook para renderizar a interface.
 */

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
import { useUIState } from './useUIState';

// Re-exporta para compatibilidade com importadores existentes
export type { SystemTab, ActiveTab } from './useUIState';

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

  // ── Estado de UI (extraído em sub-hook dedicado) ──────────────────────────
  const {
    selectedShiftForReport, setSelectedShiftForReport,
    periodFilter,           setPeriodFilter,
    activeTab,              setActiveTab,
    systemTab,              setSystemTab,
    showWelcomeMsg,         setShowWelcomeMsg,
    excludeSundays,         handleToggleExcludeSundays,
    draftFuelLiters,        setDraftFuelLiters,
    liveFuelLevel,          setLiveFuelLevel,
  } = useUIState();

  // ── Confirm dialog ────────────────────────────────────────────────────────
  const { confirmDialog, setConfirmDialog } = useConfirmDialog();

  // ── GPS do turno ──────────────────────────────────────────────────────────
  const hasOpenShift = shifts.some(s => s.status === 'OPEN');
  const activeShiftId = shifts.find(s => s.status === 'OPEN')?.id ?? null;
  const shiftGps = useShiftGPS(hasOpenShift, activeShiftId);

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

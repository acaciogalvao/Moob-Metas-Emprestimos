/**
 * AppShell.tsx
 * Layout principal do app — consome useAppState e renderiza toda a interface.
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playBeep, warmUpAudio } from '../utils/audio';
import { GoalProgressWidget } from './GoalProgressWidget';
import { BackupManager } from './BackupManager';

import { AppNavbar } from './AppNavbar';
import { SystemTabsNav } from './SystemTabsNav';
import { CaixaSubTabNav } from './CaixaSubTabNav';
import { FinancialScoreCards } from './FinancialScoreCards';
import { QuickRegister } from './QuickRegister';
import { ShiftControl } from './ShiftControl';
import { Charts } from './Charts';
import { HistoryList } from './HistoryList';
import { HistoricoCaixasView } from './HistoricoCaixasView';
import { LoanSystemApp } from './LoanSystemApp';
import { TripTracker } from './TripTracker';
import { OficinaApp } from './OficinaApp';
import { PdfReport } from './PdfReport';
import { ConfirmDialogModal } from './ConfirmDialogModal';
import { DbConfigModal } from './DbConfigModal';
import { SpeedometerWidget } from './SpeedometerWidget';

import { useAppStateContext } from '../contexts/AppStateContext';
import { useHashRouter } from '../hooks/useHashRouter';

export function AppShell() {
  const {
    shifts,
    currentTime,
    driverName,
    vehicleType,

    selectedShiftForReport,
    setSelectedShiftForReport,
    periodFilter,
    setPeriodFilter,
    activeTab,
    setActiveTab,
    systemTab,
    setSystemTab,
    excludeSundays,
    draftFuelLiters,
    setDraftFuelLiters,
    liveFuelLevel,
    setLiveFuelLevel,

    confirmDialog,
    setConfirmDialog,

    shiftGps,
    pwaPrompt,
    handleInstallPWA,
    isWakeLockActive,
    wakeLockEnabled,

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

    isSpeedometerActive,
    currentSpeed,
    speedSimCount,
    setSpeedSimCount,
    isPipActive,
    canvasRef,
    videoRef,
    handleEnablePip,

    activeShift,
    allFilteredTransactions,
    refuelMetrics,
    financialTotals,
    faturamentoPosDespesas,
    monthlyGoalMath,
    lastClosedShiftFaturamento,
    lastClosedShift,

    handleChangeDriverName,
    handleOpenShift,
    handleAddTransaction,
    handleUpdateActiveShift,
    handleDeleteTransaction,
    handleCloseShift,
    handleDeleteHistoryShift,
    handleFactoryReset,

    handleSetVehicleType,
    handleToggleWakeLock,
    handleOpenDbConfig,
    handleToggleExcludeSundays,
    handleClearDbFields,
    handleToggleSpeedometer,
    isLoadingFromServer,
  } = useAppStateContext();

  // Sincroniza a aba ativa com o hash da URL (botão voltar / deep linking)
  useHashRouter(systemTab, setSystemTab);

  // Ref para não alertar duas vezes pelo mesmo turno
  const goalAlertedShiftRef = useRef<string | null>(null);

  // Alerta quando a meta diária é atingida
  useEffect(() => {
    if (!activeShift || monthlyGoalMath.progressPct < 100) return;
    if (goalAlertedShiftRef.current === activeShift.id) return;
    goalAlertedShiftRef.current = activeShift.id;
    playBeep();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🎯 Meta do dia atingida!', {
        body: `Parabéns! Você bateu sua meta diária de R$ ${monthlyGoalMath.dailyGoal.toFixed(2).replace('.', ',')}.`,
        icon: '/favicon.ico',
      });
    } else if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [monthlyGoalMath.progressPct, activeShift]);

  // Pré-aquece AudioContext e renderiza buffers no primeiro gesto do usuário
  useEffect(() => {
    const handler = () => {
      warmUpAudio();
      window.removeEventListener('pointerdown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <div className="min-h-screen text-slate-100 pb-24 select-none relative overflow-x-hidden w-full flex flex-col sm:max-w-[480px] sm:mx-auto" style={{ background: '#07090f' }}>

      {/* Banner de carregamento do banco — aparece apenas no boot inicial */}
      <AnimatePresence>
        {isLoadingFromServer && (
          <motion.div
            key="db-loading-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-xs text-amber-300 font-medium">Sincronizando com o banco de dados…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de navegação superior */}
      <AppNavbar
        driverName={driverName}
        onChangeDriverName={handleChangeDriverName}
        vehicleType={vehicleType}
        onSetVehicleType={handleSetVehicleType}
        isWakeLockActive={isWakeLockActive}
        wakeLockEnabled={wakeLockEnabled}
        onToggleWakeLock={handleToggleWakeLock}
        dbStatus={dbStatus}
        onOpenDbConfig={handleOpenDbConfig}
        pwaPrompt={pwaPrompt}
        onInstallPWA={handleInstallPWA}
        currentTime={currentTime}
      />

      <main className="w-full px-4 mt-4 space-y-4 flex-1 flex flex-col">

        {/* Navegação de abas do sistema */}
        <SystemTabsNav systemTab={systemTab} onSetSystemTab={setSystemTab} />

        {/* ── Abas de sistema ─────────────────────────────────────────── */}

        {systemTab === 'oficina' ? (
          <motion.div key="oficina-system" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
            <OficinaApp
              activeShift={activeShift}
              shifts={shifts}
              onAddTransaction={handleAddTransaction}
            />
          </motion.div>

        ) : systemTab === 'historico' ? (
          <div className="space-y-3">
            <HistoricoCaixasView
              shifts={shifts}
              driverName={driverName}
              onSelectShiftForReport={setSelectedShiftForReport}
              onDeleteHistoryShift={handleDeleteHistoryShift}
            />
            <BackupManager />
          </div>

        ) : systemTab === 'metas' ? (
          <motion.div key="metas-system" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
            <LoanSystemApp />
          </motion.div>

        ) : systemTab === 'viagem' ? (
          <motion.div key="viagem-system" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
            <TripTracker
              activeShift={activeShift}
              onAddTransaction={handleAddTransaction}
              vehicleType={vehicleType}
              onGoToCaixa={() => setSystemTab('caixa')}
            />
          </motion.div>

        ) : (
          /* ── Aba Caixa (padrão) ─────────────────────────────────────── */
          <>
            <GoalProgressWidget
              shifts={shifts}
              monthlyGoal={monthlyGoalMath.monthlyGoal}
              faturamentoPosDespesas={faturamentoPosDespesas}
              excludeSundays={excludeSundays}
            />
            <FinancialScoreCards
              financialTotals={financialTotals}
              monthlyGoalMath={monthlyGoalMath}
              faturamentoPosDespesas={faturamentoPosDespesas}
              activeShift={activeShift}
              excludeSundays={excludeSundays}
              onToggleExcludeSundays={setExcludeSundays => {
                handleToggleExcludeSundays();
              }}
            />

            {/* Sub-abas: Caixa / Demonstrativos */}
            <CaixaSubTabNav activeTab={activeTab} onSetActiveTab={setActiveTab} />

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
                  <div className="lg:col-span-8">
                    <QuickRegister
                      activeShift={activeShift}
                      onAddTransaction={handleAddTransaction}
                      onOpenShift={handleOpenShift}
                      vehicleType={vehicleType}
                      lastClosedShiftFaturamento={lastClosedShiftFaturamento}
                      lastClosedShift={lastClosedShift ?? undefined}
                      onGoToViagem={() => setSystemTab('viagem')}
                      excludeSundays={excludeSundays}
                      onToggleExcludeSundays={(val) => {
                        if (val !== excludeSundays) handleToggleExcludeSundays();
                      }}
                      onDraftFuelLitersChange={setDraftFuelLiters}
                      onLiveFuelLevelChange={setLiveFuelLevel}
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    <ShiftControl
                      activeShift={activeShift}
                      historicalShifts={shifts.filter(s => s.status === 'CLOSED')}
                      onCloseShift={handleCloseShift}
                      onDeleteHistoryShift={handleDeleteHistoryShift}
                      onSelectShiftForReport={setSelectedShiftForReport}
                      onDeleteTransaction={handleDeleteTransaction}
                      vehicleType={vehicleType}
                      onSetVehicleType={handleSetVehicleType}
                      onAddTransaction={handleAddTransaction}
                      isSpeedometerActive={isSpeedometerActive}
                      onToggleSpeedometer={handleToggleSpeedometer}
                      onUpdateActiveShift={handleUpdateActiveShift}
                      refuelMetrics={refuelMetrics}
                      draftFuelLiters={draftFuelLiters}
                      liveFuelLevel={liveFuelLevel}
                      excludeSundays={excludeSundays}
                      onToggleExcludeSundays={handleToggleExcludeSundays}
                      gpsSpeedKmh={shiftGps.speedKmh}
                      gpsShiftKm={shiftGps.shiftKm}
                      gpsMovingTimeMs={shiftGps.movingTimeMs}
                      gpsAvgSpeedKmh={shiftGps.avgSpeedKmh}
                      isGpsActive={shiftGps.isActive}
                      gpsAccuracy={shiftGps.accuracy}
                      isGpsBackground={shiftGps.isBackground}
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
                  <Charts shifts={shifts} transactions={allFilteredTransactions} />
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

        {/* ── Modais globais ───────────────────────────────────────────── */}

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

        <ConfirmDialogModal
          confirmDialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />

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
          onClearFields={handleClearDbFields}
        />

        <SpeedometerWidget
          isSpeedometerActive={isSpeedometerActive}
          currentSpeed={currentSpeed}
          speedSimCount={speedSimCount}
          onSetSpeedSimCount={setSpeedSimCount}
          isPipActive={isPipActive}
          canvasRef={canvasRef}
          videoRef={videoRef}
          onToggleSpeedometer={handleToggleSpeedometer}
          onEnablePip={handleEnablePip}
        />

      </main>
    </div>
  );
}

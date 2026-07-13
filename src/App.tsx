/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { Shift, Transaction, PeriodFilter } from './types';
import { QuickRegister } from './components/QuickRegister';
import { ShiftControl } from './components/ShiftControl';
import { HistoryList } from './components/HistoryList';
import { Charts } from './components/Charts';
import { PdfReport } from './components/PdfReport';
import { TripTracker } from './components/TripTracker';
import { LoanSystemApp } from './components/LoanSystemApp';
import { OficinaApp } from './components/OficinaApp';
import { AppNavbar } from './components/AppNavbar';
import { SystemTabsNav } from './components/SystemTabsNav';
import { HistoricoCaixasView } from './components/HistoricoCaixasView';
import { ConfirmDialogModal } from './components/ConfirmDialogModal';
import { DbConfigModal } from './components/DbConfigModal';
import { CaixaDashboardHeader } from './components/CaixaDashboardHeader';
import { FinancialScoreCards } from './components/FinancialScoreCards';
import { SpeedometerWidget } from './components/SpeedometerWidget';

import { playBeep } from './utils/audio';

import { useShiftGPS } from './hooks/useShiftGPS';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useWakeLock } from './hooks/useWakeLock';
import { useGoalsSync } from './hooks/useGoalsSync';
import { useDbConfig } from './hooks/useDbConfig';
import { useSpeedometer } from './hooks/useSpeedometer';
import { useShiftPersistence } from './hooks/useShiftPersistence';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useShiftActions } from './hooks/useShiftActions';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

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
  const [systemTab, setSystemTab] = useState<'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina'>(() => {
    return (localStorage.getItem('moob_system_tab') as 'caixa' | 'historico' | 'viagem' | 'metas' | 'oficina') || 'caixa';
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
  const [liveFuelLevel, setLiveFuelLevel] = useState<number | null>(null);

  // --- CONFIRM DIALOG ---
  const { confirmDialog, setConfirmDialog } = useConfirmDialog();

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

  // --- DASHBOARD METRICS ---
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

  // --- ACTIONS ---
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
    setDriverName,
    setConfirmDialog,
    setSelectedShiftForReport,
    activeShift,
  });

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

        {systemTab === 'oficina' ? (
          <motion.div
            key="oficina-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <OficinaApp
              activeShift={activeShift}
              shifts={shifts}
              onAddTransaction={handleAddTransaction}
            />
          </motion.div>
        ) : systemTab === 'historico' ? (
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
            <CaixaDashboardHeader
              showWelcomeMsg={showWelcomeMsg}
              onShowWelcomeMsg={setShowWelcomeMsg}
              onFactoryReset={handleFactoryReset}
            />

            {/* 2. CORE FINANCIAL COUNTERS */}
            <FinancialScoreCards
              financialTotals={financialTotals}
              monthlyGoalMath={monthlyGoalMath}
              faturamentoPosDespesas={faturamentoPosDespesas}
              activeShift={activeShift}
              excludeSundays={excludeSundays}
              onToggleExcludeSundays={setExcludeSundays}
            />

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
                      lastClosedShift={lastClosedShift ?? undefined}
                      onGoToViagem={() => setSystemTab('viagem')}
                      excludeSundays={excludeSundays}
                      onToggleExcludeSundays={setExcludeSundays}
                      onDraftFuelLitersChange={setDraftFuelLiters}
                      onLiveFuelLevelChange={setLiveFuelLevel}
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
                      liveFuelLevel={liveFuelLevel}
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

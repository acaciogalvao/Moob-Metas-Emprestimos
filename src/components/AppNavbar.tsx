/**
 * AppNavbar.tsx — Top navbar / header component.
 */

import React from 'react';
import { Eye, Database, Download, Car, Bike, Zap } from 'lucide-react';
import { playBeep } from '../utils/audio';

interface AppHeaderProps {
  driverName: string;
  onChangeDriverName: (name: string) => void;
  vehicleType: 'CAR' | 'BIKE';
  onSetVehicleType: (type: 'CAR' | 'BIKE') => void;
  isWakeLockActive: boolean;
  wakeLockEnabled: boolean;
  onToggleWakeLock: () => void;
  dbStatus: { connected: boolean } | null;
  onOpenDbConfig: () => void;
  pwaPrompt: any;
  onInstallPWA: () => void;
  currentTime: string;
}

export function AppNavbar({
  driverName,
  onChangeDriverName,
  vehicleType,
  onSetVehicleType,
  isWakeLockActive,
  wakeLockEnabled,
  onToggleWakeLock,
  dbStatus,
  onOpenDbConfig,
  pwaPrompt,
  onInstallPWA,
  currentTime,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 backdrop-blur-xl"
      style={{ background: 'linear-gradient(180deg, rgba(10,12,20,0.98) 0%, rgba(15,23,42,0.95) 100%)' }}
    >
      <div className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5">

        {/* Brand + driver name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}
          >
            <Zap className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-black tracking-widest uppercase leading-none brand-text">
              MoobFinance
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-semibold text-slate-600 shrink-0">op.</span>
              <input
                type="text"
                className="bg-transparent text-slate-300 focus:text-white focus:outline-none focus:ring-0 px-0 py-0 w-20 font-bold truncate text-[13px] placeholder-slate-600 border-0"
                value={driverName}
                onChange={(e) => onChangeDriverName(e.target.value)}
                placeholder="Sem nome"
                title="Clique para editar seu apelido de operador"
              />
            </div>
          </div>
        </div>

        {/* Vehicle selector */}
        <div className="flex bg-slate-900/80 border border-slate-800/80 p-0.5 rounded-lg shrink-0 gap-0.5">
          <button
            onClick={() => { onSetVehicleType('CAR'); playBeep(); }}
            title="Carro"
            aria-label="Modo Carro"
            aria-pressed={vehicleType === 'CAR'}
            className={`p-1.5 rounded-md transition-all ${
              vehicleType === 'CAR'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { onSetVehicleType('BIKE'); playBeep(); }}
            title="Moto"
            aria-label="Modo Moto"
            aria-pressed={vehicleType === 'BIKE'}
            className={`p-1.5 rounded-md transition-all ${
              vehicleType === 'BIKE'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Wake lock */}
        <button
          onClick={onToggleWakeLock}
          title={isWakeLockActive ? 'Tela sempre ativa' : 'Manter tela ativa'}
          aria-pressed={isWakeLockActive}
          className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            isWakeLockActive
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
              : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-white hover:border-slate-700'
          }`}
        >
          <Eye className={`w-3.5 h-3.5 ${isWakeLockActive ? 'animate-pulse' : ''}`} />
          <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wider">
            {isWakeLockActive ? 'Ativa' : 'Tela'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
        </button>

        {/* DB config */}
        <button
          onClick={onOpenDbConfig}
          title="Configurar banco de dados"
          className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            dbStatus?.connected
              ? 'border-emerald-500/25 bg-emerald-950/15 text-emerald-400 hover:border-emerald-500/40'
              : 'border-slate-800 bg-slate-950/60 text-amber-500 hover:border-amber-500/40'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px] font-black uppercase tracking-wider">
            {dbStatus?.connected ? 'Atlas' : 'Local'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
        </button>

        {/* PWA install */}
        {pwaPrompt && (
          <button
            onClick={() => { playBeep(); onInstallPWA(); }}
            title="Instalar app (PWA)"
            className="p-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer animate-pulse"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wider">Instalar</span>
          </button>
        )}

        {/* Clock */}
        <div
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg shrink-0 border border-slate-800/60"
          style={{ background: 'rgba(10,12,20,0.70)' }}
        >
          <span className="text-[13px] font-black text-white font-mono tracking-tight">
            {currentTime || '00:00:00'}
          </span>
        </div>
      </div>
    </header>
  );
}

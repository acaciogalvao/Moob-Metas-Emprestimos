/**
 * AppHeader.tsx — Top navbar/header component.
 */

import React from 'react';
import { Clock, Eye, Database, Download, Milestone, Car, Bike } from 'lucide-react';
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
    <header className="bg-slate-900/90 border-b border-slate-800/80 px-3.5 py-2 sticky top-0 z-40 shadow-md backdrop-blur-md">
      <div className="w-full flex items-center justify-between gap-2.5">
        
        {/* Barcode scanner style brand banner */}
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 text-slate-950 font-black p-1.5 rounded-lg shadow-sm flex items-center justify-center shrink-0">
            <Milestone className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-black tracking-tight uppercase text-amber-400 font-sans">
                MoobFinance
              </h1>
              <span className="text-[12px] uppercase font-mono font-black bg-slate-850 text-slate-450 px-1 py-0.2 rounded border border-slate-750 shrink-0">
                Móbile
              </span>
            </div>
            <div className="text-[13px] text-slate-400 flex items-center gap-1 mt-0.5 min-w-0">
              <span className="font-semibold text-slate-500 shrink-0">Operador:</span>
              <input
                type="text"
                className="bg-transparent border-b border-dashed border-slate-700 text-slate-200 focus:border-white focus:outline-none focus:ring-0 px-0.5 py-0 w-20 font-bold truncate text-[14px]"
                value={driverName}
                onChange={(e) => onChangeDriverName(e.target.value)}
                placeholder="Sem nome"
                title="Clique para editar seu apelido de operador"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Selector Segmented Control */}
        <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg shrink-0">
          <button
            onClick={() => {
              onSetVehicleType('CAR');
              playBeep();
            }}
            title="Trabalhando de Carro"
            className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
              vehicleType === 'CAR'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              onSetVehicleType('BIKE');
              playBeep();
            }}
            title="Trabalhando de Moto"
            className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
              vehicleType === 'BIKE'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global Screen Wake Lock (Tela Sempre Ativa) */}
        <button
          onClick={onToggleWakeLock}
          title={isWakeLockActive ? "Tela Sempre Ativa: Ativada" : "Tela Sempre Ativa: Desativada (Clique para Ativar)"}
          className={`p-1.5 sm:p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
            isWakeLockActive 
              ? 'border-emerald-500/35 bg-emerald-950/15 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-950/30 shadow-lg shadow-emerald-500/5' 
              : 'border-slate-800 bg-slate-950/75 hover:border-amber-500/50 hover:bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Eye className={`w-3.5 h-3.5 ${isWakeLockActive ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
          <span className="text-[14px] font-black uppercase font-sans hidden lg:inline">
            {isWakeLockActive ? 'Tela Ativa' : 'Manter Tela Ativa'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${isWakeLockActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
        </button>

        {/* Configuração de Banco para Termux / Multi-dispositivo */}
        <button
          onClick={onOpenDbConfig}
          title="Configurar Banco de Dados (Termux / MongoDB Atlas)"
          className={`p-1.5 sm:p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
            dbStatus?.connected 
              ? 'border-emerald-500/30 bg-emerald-950/10 hover:bg-emerald-950/25 text-emerald-400 hover:border-emerald-500/50' 
              : 'border-slate-800 bg-slate-950/75 hover:border-amber-500/50 hover:bg-slate-900 text-amber-500'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="text-[14px] font-black uppercase font-sans hidden md:inline">
            {dbStatus?.connected ? 'Atlas Ativo' : 'Banco Local'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        </button>

        {/* PWA Install Button */}
        {pwaPrompt && (
          <button
            onClick={() => {
              playBeep();
              onInstallPWA();
            }}
            title="Instalar Aplicativo no Aparelho (PWA)"
            className="p-1.5 sm:p-2 rounded-lg border border-amber-500 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:border-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-pulse"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[14px] font-black uppercase font-sans hidden sm:inline">
              Instalar App
            </span>
          </button>
        )}

        {/* Compact metrics clock */}
        <div className="flex items-center gap-2 bg-slate-950/75 py-1 px-2.5 rounded-lg border border-slate-800/80 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
          <div className="text-right font-mono">
            <span className="text-[14px] font-black text-white block">
              {currentTime || '00:00:00'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

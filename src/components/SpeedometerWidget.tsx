/**
 * SpeedometerWidget.tsx — Floating draggable GPS speedometer widget.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppWindow, X } from 'lucide-react';
import { playBeep } from '../utils/audio';
import { estimateMottu110Rpm, MOTTU_110_RPM_REDLINE } from '../utils/vehicleModels';

interface SpeedometerWidgetProps {
  isSpeedometerActive: boolean;
  currentSpeed: number;
  speedSimCount: number;
  onSetSpeedSimCount: React.Dispatch<React.SetStateAction<number>>;
  isPipActive: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onToggleSpeedometer: () => void;
  onEnablePip: () => void;
}

export function SpeedometerWidget({
  isSpeedometerActive,
  currentSpeed,
  speedSimCount,
  onSetSpeedSimCount,
  isPipActive,
  canvasRef,
  videoRef,
  onToggleSpeedometer,
  onEnablePip,
}: SpeedometerWidgetProps) {
  const speeds = [0, 24, 48, 72, 95, 120];
  const displaySpeed = speedSimCount > 0 ? speeds[speedSimCount % speeds.length] : currentSpeed;
  const isSimulated = speedSimCount > 0;

  // RPM estimado a partir da velocidade (Mottu Sport 110 / 110cc)
  const estimatedRpm = estimateMottu110Rpm(displaySpeed);
  const rpmDisplay = (estimatedRpm / 1000).toFixed(1);
  const rpmRatio = estimatedRpm / MOTTU_110_RPM_REDLINE;
  let rpmColorClass = "border-emerald-500 shadow-emerald-500/30 text-emerald-400";
  let rpmBgClass = "bg-emerald-950/20";
  if (rpmRatio > 0.75) {
    rpmColorClass = "border-rose-500 shadow-rose-500/30 text-rose-400 animate-pulse";
    rpmBgClass = "bg-rose-950/20";
  } else if (rpmRatio > 0.5) {
    rpmColorClass = "border-amber-500 shadow-amber-500/30 text-amber-400";
    rpmBgClass = "bg-amber-950/20";
  }

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
    <>
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
            {/* Wrapper lado a lado: RPM + Velocidade */}
            <div className="flex items-center gap-2">

              {/* RPM Bubble */}
              <div className="relative">
                <div className={`w-16 h-16 rounded-full bg-slate-950/90 border-2 ${rpmColorClass} ${rpmBgClass} shadow-xl flex flex-col items-center justify-center backdrop-blur-md select-none transition-all duration-300`}>
                  <span className="text-lg font-black tracking-tighter leading-none mt-0.5">
                    {rpmDisplay}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 tracking-wide leading-tight">
                    ×1000
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 tracking-wide leading-tight">
                    RPM
                  </span>
                </div>
              </div>

            <div className="relative">
              {/* Speed Bubble Circle */}
              <div
                onClick={() => {
                  playBeep();
                  onSetSpeedSimCount(prev => prev + 1);
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
                  onToggleSpeedometer();
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
                  onEnablePip();
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
            </div> {/* flex wrapper */}
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
    </>
  );
}

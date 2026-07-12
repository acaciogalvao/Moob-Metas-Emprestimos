/**
 * PainelBordo — Dashboard de bordo para motoristas de app
 * Velocímetro GPS em tempo real + autonomia + km + horas + velocidade média
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PainelBordoProps {
  activeShift: any;
  fuelLitersRemaining: number;   // litros restantes estimados
  fuelCapacity: number;           // capacidade do tanque
  autonomyKmPerL: number;         // km/L configurado
  totalKmRun: number;             // km rodados (odômetro)
  remainingKm: number;            // km que ainda dá pra rodar com o combustível
  vehicleType: 'CARRO' | 'MOTO';
}

type GpsSignal = 'SEM_SINAL' | 'FRACO' | 'BOM' | 'EXCELENTE';

// ── helpers SVG ────────────────────────────────────────────────────────────────
const CX = 120, CY = 125, R = 90;

function polar(angleDeg: number, radius: number = R) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, radius: number) {
  const span = ((endDeg - startDeg) % 360 + 360) % 360;
  const s = polar(startDeg, radius);
  const e = polar(endDeg, radius);
  const largeArc = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// Velocímetro: 0 km/h → 225°, 160 km/h → 495°(=135°) — sweep 270°
const MAX_SPEED = 160;
const GAUGE_START = 225;
const GAUGE_SWEEP = 270;

function speedAngle(kmh: number) {
  return GAUGE_START + (Math.min(kmh, MAX_SPEED) / MAX_SPEED) * GAUGE_SWEEP;
}

// ── componente principal ───────────────────────────────────────────────────────
export function PainelBordo({
  activeShift,
  fuelLitersRemaining,
  fuelCapacity,
  autonomyKmPerL,
  totalKmRun,
  remainingKm,
  vehicleType,
}: PainelBordoProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsSignal, setGpsSignal] = useState<GpsSignal>('SEM_SINAL');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsKm, setGpsKm] = useState(0);
  const [tick, setTick] = useState(0); // force re-render a cada segundo para atualizar horas/minutos

  const gpsWatchRef = useRef<number | null>(null);
  const speedHistRef = useRef<number[]>([]);
  const lastCoordRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const currentSpeedRef = useRef(0);

  // ── relógio interno ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    lastCoordRef.current = null;
    speedHistRef.current = [];

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const now = pos.timestamp ?? Date.now();

        setGpsAccuracy(accuracy);
        if (accuracy <= 15) setGpsSignal('EXCELENTE');
        else if (accuracy <= 35) setGpsSignal('BOM');
        else if (accuracy <= 55) setGpsSignal('FRACO');
        else setGpsSignal('SEM_SINAL');

        let kmh = speed != null && speed >= 0 ? speed * 3.6 : 0;

        if (lastCoordRef.current) {
          const prev = lastCoordRef.current;
          const R_earth = 6371e3;
          const phi1 = (prev.lat * Math.PI) / 180;
          const phi2 = (latitude * Math.PI) / 180;
          const dPhi = ((latitude - prev.lat) * Math.PI) / 180;
          const dLam = ((longitude - prev.lng) * Math.PI) / 180;
          const a =
            Math.sin(dPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
          const distM = R_earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          if (speed == null) {
            const dt = (now - prev.time) / 1000;
            if (dt > 0.5) kmh = (distM / dt) * 3.6;
          }

          if (accuracy <= 45 && kmh >= 1.8 && kmh < 200 && distM > 1.2 && distM < 500) {
            setGpsKm(k => k + distM / 1000);
          }
        }

        if (kmh < 1.5) kmh = 0;
        if (kmh > 200) kmh = currentSpeedRef.current;

        const hist = speedHistRef.current;
        hist.push(kmh);
        if (hist.length > 4) hist.shift();
        const smoothed = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
        const final = Math.min(MAX_SPEED, smoothed);
        setCurrentSpeed(final);
        currentSpeedRef.current = final;
        lastCoordRef.current = { lat: latitude, lng: longitude, time: now };
      },
      () => setGpsSignal('SEM_SINAL'),
      { enableHighAccuracy: true, timeout: 2500, maximumAge: 0 }
    );
  }, []);

  const stopGPS = useCallback(() => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setCurrentSpeed(0);
    setGpsSignal('SEM_SINAL');
  }, []);

  useEffect(() => {
    if (isActive) startGPS();
    else stopGPS();
    return stopGPS;
  }, [isActive, startGPS, stopGPS]);

  // ── métricas ─────────────────────────────────────────────────────────────────
  const shiftMs = activeShift
    ? Math.max(0, Date.now() - new Date(activeShift.openedAt).getTime())
    : 0;
  const totalSeconds = Math.floor(shiftMs / 1000);
  const horas = Math.floor(totalSeconds / 3600);
  const minutos = Math.floor((totalSeconds % 3600) / 60);
  const segundos = totalSeconds % 60;

  const shiftHours = shiftMs / 3_600_000;
  const combinedKm = totalKmRun + gpsKm;
  const avgSpeed = shiftHours > 0.05 ? combinedKm / shiftHours : 0;

  const fuelPct = fuelCapacity > 0 ? Math.max(0, Math.min(100, (fuelLitersRemaining / fuelCapacity) * 100)) : 0;

  // ── cores GPS ────────────────────────────────────────────────────────────────
  const gpsColor: Record<GpsSignal, string> = {
    SEM_SINAL: 'text-slate-500',
    FRACO: 'text-red-400',
    BOM: 'text-yellow-400',
    EXCELENTE: 'text-emerald-400',
  };
  const gpsDot: Record<GpsSignal, string> = {
    SEM_SINAL: 'bg-slate-600',
    FRACO: 'bg-red-500 animate-pulse',
    BOM: 'bg-yellow-400 animate-pulse',
    EXCELENTE: 'bg-emerald-400',
  };

  // ── SVG velocímetro ──────────────────────────────────────────────────────────
  const needleDeg = speedAngle(currentSpeed);
  const needleTip = polar(needleDeg, R - 12);
  const needleL = polar(needleDeg + 145, 14);
  const needleR = polar(needleDeg - 145, 14);

  // Arcos de cor: verde 0-60, amarelo 60-100, vermelho 100-160
  const arcGreenEnd = speedAngle(60);
  const arcYellowEnd = speedAngle(100);
  const arcRedEnd = speedAngle(160);

  // Ticks do velocímetro (a cada 20 km/h)
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const kmh = i * 20;
    const ang = speedAngle(kmh);
    const outer = polar(ang, R + 2);
    const inner = polar(ang, R - (i % 2 === 0 ? 12 : 6));
    const label = polar(ang, R - 22);
    return { kmh, ang, outer, inner, label, major: i % 2 === 0 };
  });

  // Combustível - cor
  const fuelColor = fuelPct > 40 ? '#10b981' : fuelPct > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-xl border border-slate-800/80 overflow-hidden mt-2 mb-2">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏎️</span>
          <span className="text-[13px] font-black text-white uppercase tracking-widest">
            Painel de Bordo
          </span>
          {isActive && (
            <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
              ● AO VIVO
            </span>
          )}
        </div>
        <button
          onClick={() => setIsActive(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
            isActive
              ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
          }`}
        >
          {isActive ? '⏹ Desligar' : '▶ Ligar GPS'}
        </button>
      </div>

      <div className="p-4">
        {/* ── Layout principal ── */}
        <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start">

          {/* ── Velocímetro SVG ── */}
          <div className="flex flex-col items-center shrink-0">
            <svg
              viewBox="0 0 240 195"
              className="w-56 h-48 select-none"
              style={{ filter: isActive ? 'drop-shadow(0 0 12px rgba(6,182,212,0.2))' : 'none' }}
            >
              {/* Fundo circular */}
              <circle cx={CX} cy={CY} r={R + 14} fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />

              {/* Track de fundo cinza */}
              <path
                d={arcPath(GAUGE_START, GAUGE_START + GAUGE_SWEEP, R)}
                fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"
              />

              {/* Zonas de cor */}
              {/* Verde: 0→60 */}
              <path
                d={arcPath(GAUGE_START, arcGreenEnd, R)}
                fill="none" stroke="#059669" strokeWidth="10" strokeLinecap="round" opacity="0.6"
              />
              {/* Amarelo: 60→100 */}
              <path
                d={arcPath(arcGreenEnd, arcYellowEnd, R)}
                fill="none" stroke="#d97706" strokeWidth="10" strokeLinecap="round" opacity="0.6"
              />
              {/* Vermelho: 100→160 */}
              <path
                d={arcPath(arcYellowEnd, arcRedEnd, R)}
                fill="none" stroke="#dc2626" strokeWidth="10" strokeLinecap="round" opacity="0.6"
              />

              {/* Progresso ativo (velocidade atual) */}
              {currentSpeed > 0 && (
                <path
                  d={arcPath(GAUGE_START, needleDeg, R)}
                  fill="none"
                  stroke={currentSpeed < 60 ? '#10b981' : currentSpeed < 100 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              )}

              {/* Ticks */}
              {ticks.map(t => (
                <g key={t.kmh}>
                  <line
                    x1={t.inner.x} y1={t.inner.y}
                    x2={t.outer.x} y2={t.outer.y}
                    stroke={t.major ? '#94a3b8' : '#475569'}
                    strokeWidth={t.major ? 2 : 1}
                    strokeLinecap="round"
                  />
                  {t.major && (
                    <text
                      x={t.label.x} y={t.label.y}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#64748b" fontSize="9" fontFamily="monospace" fontWeight="bold"
                    >
                      {t.kmh}
                    </text>
                  )}
                </g>
              ))}

              {/* Agulha */}
              <polygon
                points={`${needleTip.x.toFixed(1)},${needleTip.y.toFixed(1)} ${needleL.x.toFixed(1)},${needleL.y.toFixed(1)} ${needleR.x.toFixed(1)},${needleR.y.toFixed(1)}`}
                fill={isActive ? '#06b6d4' : '#334155'}
                style={{ transition: 'all 0.25s ease-out', filter: isActive ? 'drop-shadow(0 0 4px #06b6d4)' : 'none' }}
              />

              {/* Centro hub */}
              <circle cx={CX} cy={CY} r="8" fill={isActive ? '#0e7490' : '#1e293b'} stroke="#334155" strokeWidth="2" />
              <circle cx={CX} cy={CY} r="3" fill={isActive ? '#67e8f9' : '#475569'} />

              {/* Velocidade numérica */}
              <text x={CX} y={CY + 28} textAnchor="middle" fill="white" fontSize="28" fontFamily="monospace" fontWeight="900">
                {currentSpeed}
              </text>
              <text x={CX} y={CY + 42} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace" fontWeight="bold">
                km/h
              </text>
            </svg>

            {/* Sinal GPS */}
            <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${gpsColor[gpsSignal]}`}>
              <span className={`w-2 h-2 rounded-full ${gpsDot[gpsSignal]}`} />
              GPS: {gpsSignal.replace('_', ' ')}
              {gpsAccuracy != null && gpsSignal !== 'SEM_SINAL' && (
                <span className="text-slate-500 font-normal normal-case">±{Math.round(gpsAccuracy)}m</span>
              )}
            </div>
          </div>

          {/* ── Grade de métricas ── */}
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5">

            {/* Velocidade atual */}
            <MetricCard
              icon="⚡"
              label="Velocidade"
              value={`${currentSpeed} km/h`}
              color="cyan"
              highlight={isActive && currentSpeed > 0}
            />

            {/* Velocidade média */}
            <MetricCard
              icon="📊"
              label="Vel. Média"
              value={`${avgSpeed.toFixed(1).replace('.', ',')} km/h`}
              color="blue"
            />

            {/* Tempo de trabalho */}
            <MetricCard
              icon="⏱️"
              label="Tempo Turno"
              value={`${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`}
              color="violet"
              mono
            />

            {/* KM Rodados */}
            <MetricCard
              icon="🛣️"
              label="KM Rodados"
              value={`${combinedKm.toFixed(1).replace('.', ',')} km`}
              sub={gpsKm > 0 ? `GPS: +${gpsKm.toFixed(1).replace('.', ',')} km` : undefined}
              color="slate"
            />

            {/* Combustível restante */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">⛽ Combustível</span>
              <span className="font-mono font-black text-sm text-white">
                {fuelLitersRemaining > 0 ? `${fuelLitersRemaining.toFixed(1).replace('.', ',')} L` : '-- L'}
              </span>
              {/* barra de combustível */}
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${fuelPct}%`, backgroundColor: fuelColor }}
                />
              </div>
              <span className="text-[9px] text-slate-500 font-mono">
                {fuelCapacity > 0 ? `${fuelPct.toFixed(0)}% de ${fuelCapacity}L` : '--'}
              </span>
            </div>

            {/* Autonomia km/L */}
            <MetricCard
              icon="🔋"
              label="Autonomia"
              value={autonomyKmPerL > 0 ? `${autonomyKmPerL.toFixed(1).replace('.', ',')} km/L` : '--'}
              color="amber"
            />

            {/* KM restantes com combustível */}
            <MetricCard
              icon="🏁"
              label="KM p/ Esvaziar"
              value={remainingKm > 0 ? `${remainingKm.toFixed(0)} km` : '-- km'}
              color={remainingKm > 0 && remainingKm < autonomyKmPerL * 2 ? 'red' : 'emerald'}
              highlight={remainingKm > 0 && remainingKm < autonomyKmPerL * 2}
            />

            {/* Veículo */}
            <MetricCard
              icon={vehicleType === 'CARRO' ? '🚗' : '🏍️'}
              label="Veículo"
              value={vehicleType === 'CARRO' ? 'Carro' : 'Moto'}
              color="slate"
            />

            {/* KM por litro neste turno */}
            <MetricCard
              icon="💧"
              label="Consumido"
              value={
                autonomyKmPerL > 0 && combinedKm > 0
                  ? `${(combinedKm / autonomyKmPerL).toFixed(1).replace('.', ',')} L`
                  : '-- L'
              }
              sub={combinedKm > 0 && autonomyKmPerL > 0 ? `em ${combinedKm.toFixed(1)} km` : undefined}
              color="slate"
            />
          </div>
        </div>

        {/* ── Aviso quando desligado ── */}
        {!isActive && (
          <div className="mt-3 flex items-center gap-2 bg-slate-900/40 border border-slate-800/60 rounded-lg px-3 py-2">
            <span className="text-[13px]">ℹ️</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ligue o painel para ativar o velocímetro GPS em tempo real. As métricas de combustível e km já ficam visíveis sem GPS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card de métrica reutilizável ───────────────────────────────────────────────
type CardColor = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'red' | 'slate';

const colorMap: Record<CardColor, { text: string; bg: string; border: string }> = {
  cyan:    { text: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  blue:    { text: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  red:     { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25' },
  slate:   { text: 'text-slate-200',   bg: 'bg-slate-900/60',   border: 'border-slate-800' },
};

function MetricCard({
  icon, label, value, sub, color = 'slate', highlight = false, mono = false,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: CardColor;
  highlight?: boolean;
  mono?: boolean;
}) {
  const c = colorMap[color];
  return (
    <div
      className={`${c.bg} border ${c.border} rounded-lg p-2.5 flex flex-col gap-0.5 transition-all ${
        highlight ? 'animate-pulse' : ''
      }`}
    >
      <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
        {icon} {label}
      </span>
      <span className={`font-black text-sm ${c.text} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
      {sub && <span className="text-[9px] text-slate-600 font-mono">{sub}</span>}
    </div>
  );
}

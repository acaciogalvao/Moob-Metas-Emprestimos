/**
 * gpsProcessor.ts — Módulo GPS seguindo a lógica da 99/Uber
 *
 * Regras implementadas:
 *  1. Entrada: array de pontos {timestamp (ms), latitude, longitude}
 *  2. Velocidade instantânea via Haversine + suavização EMA (α=0.3)
 *     - velBruta < 1 km/h → força 0 (elimina ruído de parado)
 *     - Limite de 180 km/h (descarta picos espúrios)
 *  3. Odômetro = soma acumulada das distâncias Haversine; histórico dos últimos 100 pontos
 *  4. Validação:
 *     - > 500m em ≤ 1 segundo → descarta ponto (falha de GPS)
 *     - Ângulo > 90° em < 2 segundos → reduz velocidade em 50% (curva)
 *  5. Saída em tempo real: "Velocidade: X km/h | Distância total: Y km"
 */

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface GpsPoint {
  timestamp: number;       // ms (epoch)
  latitude: number;        // graus decimais
  longitude: number;       // graus decimais
  speed?: number | null;   // m/s do chip GPS (opcional)
  accuracy?: number;       // precisão em metros (opcional)
}

export interface GpsProcessorState {
  velSuave: number;              // km/h — velocidade EMA suavizada atual
  totalKm: number;               // odômetro total acumulado (nunca reseta)
  tripKm: number;                // km do turno atual (resetável)
  lastPoint: GpsPoint | null;    // último ponto válido processado
  history: GpsPoint[];           // últimos 100 pontos (regra 3c)
  lastBearing: number | null;    // rumo do último deslocamento (graus 0-360)
  lastBearingTime: number | null; // timestamp do último rumo calculado
}

export interface GpsProcessorOutput {
  speedKmh: number;     // velocidade suavizada para exibição (km/h, inteiro)
  totalKm: number;      // odômetro acumulado (km)
  tripKm: number;       // km do turno atual (km)
  state: GpsProcessorState;
  discarded: boolean;   // true = ponto descartado por falha de GPS
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ALPHA = 0.3;            // fator EMA (regra 2d)
const MAX_SPEED_KMH = 180;    // limite de velocidade (regra 2e)
const MAX_DIST_1S_M = 500;    // distância máxima por segundo antes de descartar (regra 4a)
const MIN_MOVE_M = 1.5;       // deslocamento mínimo para calcular rumo

// ─── Funções auxiliares ──────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Distância Haversine entre dois pontos geodésicos — retorna metros.
 * Regra 2a / Regra 3a.
 */
export function haversineM(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000; // raio médio da Terra em metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Rumo (bearing) de A → B em graus [0, 360).
 * Usado para detectar mudanças bruscas de direção (regra 4b).
 */
function bearingDeg(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Diferença angular mínima entre dois rumos (arco mais curto).
 */
function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Inicializa o estado do processador GPS. */
export function gpsProcessorInit(): GpsProcessorState {
  return {
    velSuave: 0,
    totalKm: 0,
    tripKm: 0,
    lastPoint: null,
    history: [],
    lastBearing: null,
    lastBearingTime: null,
  };
}

/**
 * Processa um novo ponto GPS e retorna velocidade + odômetro atualizados.
 * Aplica todas as regras obrigatórias do spec.
 *
 * @param prev   Estado anterior do processador
 * @param point  Novo ponto GPS recebido
 * @returns      Saída com velocidade, km e novo estado
 */
export function processGpsPoint(
  prev: GpsProcessorState,
  point: GpsPoint,
): GpsProcessorOutput {
  // Mantém histórico de até 100 pontos (regra 3c)
  const history = [...prev.history, point].slice(-100);

  // ── Primeiro ponto: inicializa sem velocidade ───────────────────────────
  if (!prev.lastPoint) {
    return {
      speedKmh: 0,
      totalKm: prev.totalKm,
      tripKm: prev.tripKm,
      state: { ...prev, lastPoint: point, history },
      discarded: false,
    };
  }

  const last = prev.lastPoint;
  const deltaTMs = Math.max(1, point.timestamp - last.timestamp);
  const deltaTSec = deltaTMs / 1000;
  const deltaTHours = deltaTMs / 3_600_000;

  // ── Cálculo da distância (Haversine) — Regra 2a / Regra 3a ────────────
  const distM = haversineM(last.latitude, last.longitude, point.latitude, point.longitude);

  // ── Regra 4a: descarta se > 500m em ≤ 1 segundo (falha de GPS) ─────────
  if (distM > MAX_DIST_1S_M && deltaTSec <= 1) {
    return {
      speedKmh: prev.velSuave,
      totalKm: prev.totalKm,
      tripKm: prev.tripKm,
      state: { ...prev, history },
      discarded: true,
    };
  }

  // ── Rumo para detecção de curva (regra 4b) ─────────────────────────────
  const movingSig = distM >= MIN_MOVE_M;
  const currentBearing = movingSig
    ? bearingDeg(last.latitude, last.longitude, point.latitude, point.longitude)
    : (prev.lastBearing ?? 0);

  // ── Regra 4b: ângulo > 90° em < 2s → reduz velocidade 50% (curva) ─────
  let turnReduction = false;
  if (
    movingSig &&
    prev.lastBearing !== null &&
    prev.lastBearingTime !== null
  ) {
    const timeSinceBearingS = (point.timestamp - prev.lastBearingTime) / 1000;
    if (
      timeSinceBearingS < 2 &&
      angleDiff(currentBearing, prev.lastBearing) > 90
    ) {
      turnReduction = true;
    }
  }

  // ── Regra 2b-c: velocidade bruta = distância / ΔT ─────────────────────
  let velBruta = (distM / 1000) / deltaTHours; // km/h

  // ── Regra 2e: limita a 180 km/h (descarta picos espúrios) ─────────────
  if (velBruta > MAX_SPEED_KMH) velBruta = MAX_SPEED_KMH;

  // ── Regra 2d: suavização EMA (α=0.3) ──────────────────────────────────
  let velSuave = ALPHA * velBruta + (1 - ALPHA) * prev.velSuave;

  // ── Regra 2d: < 1 km/h → força 0 (elimina ruído de parado) ───────────
  if (velBruta < 1) velSuave = 0;

  // ── Regra 4b: aplica redução por curva ────────────────────────────────
  if (turnReduction) velSuave *= 0.5;

  velSuave = Math.max(0, Math.min(MAX_SPEED_KMH, velSuave));

  // ── Regra 3a-b: odômetro — acumula todas as distâncias válidas ─────────
  const distKm = distM / 1000;
  const totalKm = prev.totalKm + distKm;
  const tripKm = prev.tripKm + distKm;

  const newState: GpsProcessorState = {
    velSuave,
    totalKm,
    tripKm,
    lastPoint: point,
    history,
    lastBearing: movingSig ? currentBearing : prev.lastBearing,
    lastBearingTime: movingSig ? point.timestamp : prev.lastBearingTime,
  };

  return {
    speedKmh: Math.round(velSuave),
    totalKm,
    tripKm,
    state: newState,
    discarded: false,
  };
}

/**
 * Reseta o km do turno (trip) sem afetar o odômetro total.
 * Regra 5: "Mantenha um odômetro separado para a viagem atual (resetável)."
 */
export function resetTripKm(state: GpsProcessorState): GpsProcessorState {
  return { ...state, tripKm: 0 };
}

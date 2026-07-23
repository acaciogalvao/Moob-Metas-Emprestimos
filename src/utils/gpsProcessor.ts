/**
 * gpsProcessor.ts — Processador GPS de alta precisão e baixa latência
 *
 * Estratégia de velocidade:
 *  - FONTE PRIMÁRIA: coords.speed do chip GPS (Doppler, já filtrado por Kalman no SO)
 *    → suavização leve EMA α=0.80 (rápido, pois o sinal já é limpo)
 *  - FALLBACK: Haversine (quando chip não fornece speed)
 *    → suavização EMA α=0.65 (mais conservador, sinal calculado)
 *
 * Snap-to-zero imediato:
 *  - Nativo: speed < 0.5 m/s (~1.8 km/h) → 0 na hora
 *  - Haversine: velBruta < 2 km/h → 0 na hora
 *
 * Sem redução por curva (causava falsos slowdowns com speed nativo).
 * Odômetro usa Haversine sempre (coordenadas são mais confiáveis que integração de speed).
 */

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface GpsPoint {
  timestamp: number;       // ms (epoch)
  latitude: number;        // graus decimais
  longitude: number;       // graus decimais
  speed?: number | null;   // m/s do chip GPS (já filtrado por Kalman no SO)
  accuracy?: number;       // precisão em metros
}

export interface GpsProcessorState {
  velSuave: number;              // km/h — velocidade EMA suavizada atual
  totalKm: number;               // odômetro total acumulado (nunca reseta)
  tripKm: number;                // km do turno atual (resetável)
  lastPoint: GpsPoint | null;    // último ponto válido processado
  history: GpsPoint[];           // últimos 100 pontos
  lastBearing: number | null;
  lastBearingTime: number | null;
  usingNativeSpeed: boolean;     // indica qual fonte está sendo usada (para debug)
  zeroCount: number;             // leituras consecutivas abaixo do limiar de parada
}

export interface GpsProcessorOutput {
  speedKmh: number;         // velocidade suavizada para exibição (km/h, inteiro)
  totalKm: number;          // odômetro acumulado (km)
  tripKm: number;           // km do turno atual (km)
  state: GpsProcessorState;
  discarded: boolean;       // true = ponto descartado por falha de GPS
  usingNativeSpeed: boolean;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** EMA para velocidade nativa do chip (sinal já suave — resposta rápida) */
const ALPHA_NATIVE = 0.80;

/** EMA para velocidade calculada por Haversine (sinal mais ruidoso — mais conservador) */
const ALPHA_HAVERSINE = 0.65;

/** Velocidade máxima aceita — acima disso é ruído */
const MAX_SPEED_KMH = 180;

/** Distância máxima em ≤1s — acima é falha de GPS */
const MAX_DIST_1S_M = 500;

/** Deslocamento mínimo para calcular rumo */
const MIN_MOVE_M = 1.5;

/** Velocidade nativa abaixo deste valor (m/s) → snap imediato para zero */
const NATIVE_ZERO_SNAP_MS = 0.5;   // ~1.8 km/h

/** Velocidade Haversine abaixo deste valor (km/h) → snap imediato para zero */
const HAVERSINE_ZERO_SNAP_KMH = 2;

/** Precisão máxima aceita (metros) — acima disso descarta o ponto */
const MAX_ACCURACY_M = 65;

/** Limite físico de aceleração/frenagem (m/s²) — impede saltos impossíveis */
const MAX_ACCEL_MS2 = 6;

/** Leituras consecutivas abaixo de 1.8 km/h para confirmar parada */
const ZERO_CONFIRM_COUNT = 3;

// ─── Funções auxiliares ──────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineM(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

// ─── API pública ─────────────────────────────────────────────────────────────

export function gpsProcessorInit(): GpsProcessorState {
  return {
    velSuave: 0,
    totalKm: 0,
    tripKm: 0,
    lastPoint: null,
    history: [],
    lastBearing: null,
    lastBearingTime: null,
    usingNativeSpeed: false,
    zeroCount: 0,
  };
}

export function processGpsPoint(
  prev: GpsProcessorState,
  point: GpsPoint,
): GpsProcessorOutput {
  const history = [...prev.history, point].slice(-100);

  // Primeiro ponto — sem velocidade ainda
  if (!prev.lastPoint) {
    return {
      speedKmh: 0,
      totalKm: prev.totalKm,
      tripKm: prev.tripKm,
      state: { ...prev, lastPoint: point, history },
      discarded: false,
      usingNativeSpeed: false,
    };
  }

  const last = prev.lastPoint;
  const deltaTMs  = Math.max(1, point.timestamp - last.timestamp);
  const deltaTSec = deltaTMs / 1000;
  const deltaTHours = deltaTMs / 3_600_000;

  // Distância Haversine — usada sempre para o odômetro
  const distM = haversineM(last.latitude, last.longitude, point.latitude, point.longitude);

  // Descarta pontos com sinal ruim (accuracy > 65m) — ruído demais
  if (point.accuracy !== undefined && point.accuracy > MAX_ACCURACY_M) {
    return {
      speedKmh: Math.round(prev.velSuave),
      totalKm: prev.totalKm,
      tripKm: prev.tripKm,
      state: { ...prev, history },
      discarded: true,
      usingNativeSpeed: prev.usingNativeSpeed,
    };
  }

  // Descarta ponto impossível (> 500m em ≤ 1s)
  if (distM > MAX_DIST_1S_M && deltaTSec <= 1) {
    return {
      speedKmh: Math.round(prev.velSuave),
      totalKm: prev.totalKm,
      tripKm: prev.tripKm,
      state: { ...prev, history },
      discarded: true,
      usingNativeSpeed: prev.usingNativeSpeed,
    };
  }

  // ── Rumo (só para manutenção do estado) ────────────────────────────────
  const movingSig = distM >= MIN_MOVE_M;
  const currentBearing = movingSig
    ? bearingDeg(last.latitude, last.longitude, point.latitude, point.longitude)
    : (prev.lastBearing ?? 0);

  // ── Cálculo de velocidade: nativo primeiro, Haversine como fallback ────
  let velSuave: number;
  let usingNativeSpeed = false;
  const nativeSpeedMs = point.speed;
  const hasNativeSpeed = nativeSpeedMs !== null && nativeSpeedMs !== undefined && nativeSpeedMs >= 0;

  if (hasNativeSpeed) {
    // ── Fonte primária: chip GPS (Doppler + Kalman interno do SO) ─────────
    usingNativeSpeed = true;
    const nativeKmh = nativeSpeedMs! * 3.6;

    if (nativeKmh > MAX_SPEED_KMH) {
      // Pico impossível — mantém valor anterior
      velSuave = prev.velSuave;
    } else if (nativeSpeedMs! < NATIVE_ZERO_SNAP_MS) {
      // EMA em direção a zero — NÃO faz snap imediato.
      // Uma única leitura zero espúria (comum em chips GPS baratos) não deve
      // piscar 0 no velocímetro e voltar ao valor real no frame seguinte.
      // O limitador de aceleração física garante queda realista ao freiar de
      // verdade; ZERO_CONFIRM_COUNT confirma a parada após 3 leituras seguidas.
      velSuave = (1 - ALPHA_NATIVE) * prev.velSuave; // decai ~20% por leitura
    } else {
      // EMA leve (α=0.80) — responde rápido sem tremer
      velSuave = ALPHA_NATIVE * nativeKmh + (1 - ALPHA_NATIVE) * prev.velSuave;
    }
  } else {
    // ── Fallback: velocidade calculada por coordenadas (Haversine) ─────────
    const haversineKmh = (distM / 1000) / deltaTHours;

    if (haversineKmh > MAX_SPEED_KMH) {
      velSuave = prev.velSuave;
    } else if (haversineKmh < HAVERSINE_ZERO_SNAP_KMH) {
      // Mesmo tratamento: EMA em direção a zero, não snap imediato.
      // Haversine é ruidoso e leituras abaixo de 2 km/h são comuns em trânsito
      // lento — snap imediato causaria piscar constante perto de zero.
      velSuave = (1 - ALPHA_HAVERSINE) * prev.velSuave; // decai ~35% por leitura
    } else {
      // EMA moderado (α=0.65)
      velSuave = ALPHA_HAVERSINE * haversineKmh + (1 - ALPHA_HAVERSINE) * prev.velSuave;
    }
  }

  velSuave = Math.max(0, Math.min(MAX_SPEED_KMH, velSuave));

  // ── Limitador de aceleração física — impede saltos bruscos ────────────
  const maxDeltaKmh = MAX_ACCEL_MS2 * deltaTSec * 3.6;
  velSuave = Math.min(
    prev.velSuave + maxDeltaKmh,
    Math.max(prev.velSuave - maxDeltaKmh * 2, velSuave),
  );
  velSuave = Math.max(0, velSuave);

  // ── Confirmação de parada: evita piscar no velocímetro ────────────────
  let zeroCount = prev.zeroCount ?? 0;
  if (velSuave < 1.8) {
    zeroCount++;
  } else {
    zeroCount = 0;
  }
  if (zeroCount >= ZERO_CONFIRM_COUNT) velSuave = 0;

  // ── Odômetro: acumula apenas quando em movimento real ─────────────────
  // Gate de velocidade usa a mesma fonte e limiar do velocímetro:
  //  - chip GPS (Doppler): nativeSpeed >= 0.5 m/s (~1.8 km/h)
  //  - Haversine (fallback): velocidade calculada >= 2 km/h
  // Isso evita acumular ruído de posição GPS enquanto o veículo está parado
  // (semáforos, esperas, estacionamento), que é a principal causa de
  // diferença entre o hodômetro GPS e o odômetro real do veículo.
  const haversineKmhRaw = (distM / 1000) / deltaTHours;
  const odoGateOk = hasNativeSpeed
    ? nativeSpeedMs! >= NATIVE_ZERO_SNAP_MS           // chip Doppler: ≥ 0.5 m/s
    : haversineKmhRaw >= HAVERSINE_ZERO_SNAP_KMH;     // calculado: ≥ 2 km/h
  const distKm  = odoGateOk ? distM / 1000 : 0;
  const totalKm = prev.totalKm + distKm;
  const tripKm  = prev.tripKm  + distKm;

  const newState: GpsProcessorState = {
    velSuave,
    totalKm,
    tripKm,
    lastPoint: point,
    history,
    lastBearing: movingSig ? currentBearing : prev.lastBearing,
    lastBearingTime: movingSig ? point.timestamp : prev.lastBearingTime,
    usingNativeSpeed,
    zeroCount,
  };

  return {
    speedKmh: Math.round(velSuave),
    totalKm,
    tripKm,
    state: newState,
    discarded: false,
    usingNativeSpeed,
  };
}

export function resetTripKm(state: GpsProcessorState): GpsProcessorState {
  return { ...state, tripKm: 0 };
}

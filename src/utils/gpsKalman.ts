/**
 * gpsKalman.ts — Filtro de Kalman 2D para velocidade GPS
 *
 * Mesma abordagem usada em apps de transporte como 99 e Uber:
 *  1. Filtro de Kalman por eixo (lat / lng) com estado [posição, velocidade]
 *  2. Fusão ponderada entre velocidade Kalman e velocidade bruta do chip GPS
 *  3. Limitador de aceleração física (evita saltos impossíveis)
 *  4. EMA (média exponencial) para suavizar o display
 *  5. Confirmação de parada: exige N leituras consecutivas ≤ threshold
 */

// ── Estado de um eixo do Kalman (lat ou lng) ─────────────────────────────────
export interface KalmanAxis {
  pos: number;                         // posição estimada (graus)
  vel: number;                         // velocidade estimada (graus/s)
  p: [number, number, number, number]; // covariância 2×2 [p00,p01,p10,p11]
}

// ── Constantes de ruído de processo ──────────────────────────────────────────
// Q_POS  — variação de posição além do que a velocidade explica (GPS perde sinal, etc.)
// Q_VEL  — aceleração típica do veículo em graus/s por segundo
//           0,5 m/s² ÷ 111 319 m/grau ≈ 4,5e-6 graus/s por segundo → ao quadrado
const DEG_PER_METER = 1 / 111_319.5;
const Q_POS = Math.pow(0.1  * DEG_PER_METER, 2); // ruído de posição
const Q_VEL = Math.pow(0.6  * DEG_PER_METER, 2); // ruído de velocidade (aceleração típica)

// ── Inicializa o filtro para um eixo ─────────────────────────────────────────
export function kalmanInit(pos: number): KalmanAxis {
  return { pos, vel: 0, p: [1e-4, 0, 0, 1e-4] };
}

/**
 * kalmanStep — predição + atualização de um eixo
 * @param k         estado atual
 * @param meas      medição (graus)
 * @param dt        tempo desde a última leitura (segundos)
 * @param rVariance variância do ruído de medição (graus²) = (accuracy_m * DEG_PER_METER)²
 */
export function kalmanStep(
  k: KalmanAxis,
  meas: number,
  dt: number,
  rVariance: number,
): KalmanAxis {
  // Predição
  const posP = k.pos + k.vel * dt;
  const velP = k.vel;
  const p00p = k.p[0] + dt * (k.p[2] + k.p[1]) + dt * dt * k.p[3] + Q_POS * dt;
  const p01p = k.p[1] + dt * k.p[3];
  const p10p = k.p[2] + dt * k.p[3];
  const p11p = k.p[3] + Q_VEL * dt;

  // Atualização (observação = posição, H = [1, 0])
  const S  = p00p + rVariance;
  const K0 = p00p / S; // ganho → posição
  const K1 = p10p / S; // ganho → velocidade
  const innov = meas - posP;

  return {
    pos: posP + K0 * innov,
    vel: velP + K1 * innov,
    p: [
      (1 - K0) * p00p,
      (1 - K0) * p01p,
      p10p - K1 * p00p,
      p11p - K1 * p01p,
    ],
  };
}

/**
 * kalmanSpeedKmh — converte velocidades Kalman (graus/s) → km/h
 */
export function kalmanSpeedKmh(
  vLat: number,
  vLng: number,
  latDeg: number,
): number {
  const cosLat = Math.cos(latDeg * (Math.PI / 180));
  const vLatMs = vLat * 111_319.5;
  const vLngMs = vLng * 111_319.5 * cosLat;
  return Math.sqrt(vLatMs * vLatMs + vLngMs * vLngMs) * 3.6;
}

// ── Estado completo do rastreador GPS ─────────────────────────────────────────
export interface GpsTrackerState {
  kLat:        KalmanAxis | null;
  kLng:        KalmanAxis | null;
  lastTime:    number;              // ms
  displaySpd:  number;             // km/h suavizado (display)
  zeroCount:   number;             // leituras consecutivas perto de 0
}

export function gpsTrackerInit(): GpsTrackerState {
  return { kLat: null, kLng: null, lastTime: 0, displaySpd: 0, zeroCount: 0 };
}

export interface GpsInput {
  latitude:  number;
  longitude: number;
  speed:     number | null;  // m/s do chip GPS (pode ser null)
  accuracy:  number;         // metros
  timestamp: number;         // ms
}

export interface GpsOutput {
  speedKmh:  number;   // velocidade final para exibição (inteiro)
  state:     GpsTrackerState;
}

// Parâmetros de fusão e suavização
const MAX_ACCEL_MS2  = 6;   // m/s² — limite físico de aceleração/frenagem
const EMA_ALPHA      = 0.40; // fator EMA (0 = sem resposta, 1 = sem suavização)
const ZERO_THRESHOLD = 3;   // km/h — abaixo disso considera "parado"
const ZERO_CONFIRM   = 3;   // N leituras consecutivas abaixo para confirmar parada
const MAX_ACCURACY   = 65;  // metros — acima disso ignora a leitura de velocidade

/**
 * processGpsReading — processa uma leitura GPS e devolve a velocidade filtrada
 */
export function processGpsReading(
  prev: GpsTrackerState,
  input: GpsInput,
): GpsOutput {
  const { latitude, longitude, speed, accuracy, timestamp } = input;

  // Inicialização do filtro na primeira leitura
  if (!prev.kLat || !prev.kLng) {
    const state: GpsTrackerState = {
      kLat:       kalmanInit(latitude),
      kLng:       kalmanInit(longitude),
      lastTime:   timestamp,
      displaySpd: 0,
      zeroCount:  0,
    };
    return { speedKmh: 0, state };
  }

  const dt = Math.max(0.1, (timestamp - prev.lastTime) / 1000); // segundos
  const rVar = Math.pow(Math.max(5, accuracy) * DEG_PER_METER, 2);

  // Kalman step para lat e lng
  const kLat = kalmanStep(prev.kLat, latitude,  dt, rVar);
  const kLng = kalmanStep(prev.kLng, longitude, dt, rVar);

  // Velocidade a partir das velocidades estimadas pelo Kalman
  let speedKalman = kalmanSpeedKmh(kLat.vel, kLng.vel, latitude);

  // Velocidade bruta do chip GPS (mais confiável em movimento rápido)
  const rawGps = speed != null && speed >= 0 ? speed * 3.6 : null;

  // Fusão: pondera Kalman vs chip GPS com base na precisão
  // Quanto menor a accuracy (melhor sinal), mais peso no chip GPS
  let fused = speedKalman;
  if (rawGps !== null && accuracy <= MAX_ACCURACY) {
    // w = 0 (Kalman puro) quando accuracy=65m, w = 0.7 (70% chip) quando accuracy=5m
    const w = Math.max(0, Math.min(0.7, (MAX_ACCURACY - accuracy) / MAX_ACCURACY * 0.7));
    fused = speedKalman * (1 - w) + rawGps * w;
  }

  // Rejeita leituras fisicamente impossíveis (spike de GPS)
  if (fused > 250) fused = prev.displaySpd;

  // Limitador de aceleração — impede saltos bruscos
  const maxDeltaKmh = MAX_ACCEL_MS2 * dt * 3.6;
  const prevKmh = prev.displaySpd;
  fused = Math.max(0, Math.min(prevKmh + maxDeltaKmh, Math.max(prevKmh - maxDeltaKmh * 2, fused)));

  // EMA para suavizar o número no display
  let ema = EMA_ALPHA * fused + (1 - EMA_ALPHA) * prevKmh;

  // Confirmação de parada: só zera após N leituras consecutivas
  let zeroCount = prev.zeroCount;
  if (fused < ZERO_THRESHOLD) {
    zeroCount++;
  } else {
    zeroCount = 0;
  }
  if (zeroCount >= ZERO_CONFIRM) ema = 0;

  const finalKmh = Math.round(Math.min(220, Math.max(0, ema)));

  const state: GpsTrackerState = {
    kLat, kLng,
    lastTime:   timestamp,
    displaySpd: finalKmh,
    zeroCount,
  };
  return { speedKmh: finalKmh, state };
}

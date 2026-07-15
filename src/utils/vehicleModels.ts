/**
 * vehicleModels.ts — Vehicle model presets for physics-based fuel consumption.
 *
 * Instead of a single manually-configured km/L number, a "modelo de veículo"
 * derives instantaneous consumption (km/L) from real-time GPS speed, using a
 * simplified torque/power curve calibrated to the vehicle's known consumption
 * range. This lets the fuel gauge react to how the vehicle is actually being
 * driven instead of assuming a constant average.
 */

export type VehicleModelId = 'MANUAL' | 'MOTTU_SPORT_110';

export interface VehicleModelDefinition {
  id: VehicleModelId;
  label: string;
  type: 'MOTO' | 'CARRO';
  /** Real-world consumption range (km/L) used to sanity-clamp the formula's output. */
  minConsumptionKmL: number;
  maxConsumptionKmL: number;
  /** Consumption to show when speed is ~0 (stopped/idle) — avoids division by zero. */
  idleConsumptionKmL: number;
}

// ── Mottu Sport 110 ──────────────────────────────────────────────────────────
// Calibration point: 70 km/h ≈ 51,5 km/L (dentro da faixa real 50-55 km/L).
const MOTTU_110_CALIBRATION_SPEED_KMH = 70;

// Consumo de combustível em L/h = perda de marcha-lenta (fixa) + termo quadrático
// de arrasto/aceleração (crescente com a velocidade). Isso faz o km/L SUBIR conforme
// a velocidade sai de perto de zero (tráfego parado/andando bem devagar é o cenário
// menos econômico: o motor ainda gasta combustível de marcha-lenta enquanto pouquíssima
// distância é percorrida), atingir um pico numa velocidade de cruzeiro moderada, e
// depois CAIR de novo em velocidades altas (arrasto aerodinâmico). Sem o termo de
// marcha-lenta, a fórmula antiga (só potência ∝ velocidade²) dava km/L ∝ 1/velocidade,
// que diverge para velocidades baixas e ficava presa no teto do clamp (80 km/L) bem
// abaixo dos 70 km/h — ou seja, mostrava a moto "andando devagar" mais econômica que
// parada, o que é fisicamente ao contrário do esperado.
const MOTTU_110_IDLE_LPH = 0.5;
const MOTTU_110_CALIBRATION_TARGET_KML = 51.5;
const MOTTU_110_DRAG_COEFFICIENT =
  (MOTTU_110_CALIBRATION_SPEED_KMH / MOTTU_110_CALIBRATION_TARGET_KML - MOTTU_110_IDLE_LPH) /
  (MOTTU_110_CALIBRATION_SPEED_KMH * MOTTU_110_CALIBRATION_SPEED_KMH);

export const VEHICLE_MODELS: Record<VehicleModelId, VehicleModelDefinition> = {
  MANUAL: {
    id: 'MANUAL',
    label: 'Manual (km/L configurado)',
    type: 'MOTO',
    minConsumptionKmL: 1,
    maxConsumptionKmL: 100,
    idleConsumptionKmL: 35,
  },
  MOTTU_SPORT_110: {
    id: 'MOTTU_SPORT_110',
    label: 'Mottu Sport 110',
    type: 'MOTO',
    // Faixa real de consumo da Mottu 110i: 50-55 km/L; margem de segurança 20-80 km/L.
    minConsumptionKmL: 20,
    maxConsumptionKmL: 80,
    idleConsumptionKmL: 51.5,
  },
};

/**
 * Fórmula de consumo da Mottu Sport 110 baseada em L/h = perda de marcha-lenta fixa +
 * termo de arrasto/aceleração quadrático com a velocidade:
 *
 *   Consumo_L_h = MOTTU_110_IDLE_LPH + MOTTU_110_DRAG_COEFFICIENT × velocidade²
 *   Consumo_km_L = velocidade / Consumo_L_h
 *
 * O coeficiente de arrasto é calibrado para que, a 70 km/h, o resultado seja ~51,5 km/L
 * (dentro da faixa real de 50-55 km/L da Mottu 110i). Isso dá uma curva em forma de sino:
 * pior (menos km/L) andando bem devagar — porque a marcha-lenta consome combustível
 * quase independente da distância percorrida —, melhor numa velocidade de cruzeiro
 * moderada (~50-55 km/h), e pior de novo em velocidade alta (arrasto).
 */
export function computeMottuSport110ConsumptionKmL(speedKmh: number): number {
  const model = VEHICLE_MODELS.MOTTU_SPORT_110;

  if (!speedKmh || speedKmh <= 0) {
    return model.idleConsumptionKmL;
  }

  const consumptionLitersPerHour = MOTTU_110_IDLE_LPH + MOTTU_110_DRAG_COEFFICIENT * speedKmh * speedKmh;
  if (consumptionLitersPerHour <= 0) {
    return model.idleConsumptionKmL;
  }

  const consumptionKmL = speedKmh / consumptionLitersPerHour;

  // Se o resultado sair da faixa real conhecida do modelo, aplica o limite.
  return Math.max(model.minConsumptionKmL, Math.min(model.maxConsumptionKmL, consumptionKmL));
}

/**
 * Aprendizado contínuo (auto-calibração) do modelo Mottu Sport 110.
 *
 * A fórmula de torque/potência é apenas um ponto de partida (calibrada em
 * laboratório para 70 km/h @ 4.500 RPM). Na prática, cada moto/motorista tem
 * um desgaste, estilo de pilotagem e condição de uso diferentes, então o
 * consumo real medido a cada abastecimento e a cada fechamento de caixa é
 * usado para ir ajustando um "fator de calibração" multiplicativo sobre a
 * fórmula física — sem exigir nenhuma ação manual do motorista.
 */
const MOTTU_110_CALIBRATION_FACTOR_KEY = 'moob_fuel_mottu110_calibration_factor';
const MOTTU_110_CALIBRATION_SAMPLES_KEY = 'moob_fuel_mottu110_calibration_samples';
const MOTTU_110_LEARNING_RATE = 0.25; // peso de cada nova medição real na média móvel
const MOTTU_110_MIN_FACTOR = 0.5;
const MOTTU_110_MAX_FACTOR = 2;

export function getMottuSport110CalibrationFactor(): number {
  const raw = localStorage.getItem(MOTTU_110_CALIBRATION_FACTOR_KEY);
  const parsed = raw ? parseFloat(raw) : 1;
  if (!isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(MOTTU_110_MIN_FACTOR, Math.min(MOTTU_110_MAX_FACTOR, parsed));
}

export function getMottuSport110CalibrationSampleCount(): number {
  const raw = localStorage.getItem(MOTTU_110_CALIBRATION_SAMPLES_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Registra uma medição real de km/L (de um trecho entre abastecimentos, ou de
 * um turno inteiro no fechamento de caixa) e ajusta o fator de calibração via
 * média móvel ponderada — evita que um único dado ruim (ex.: hodômetro
 * digitado errado) distorça tudo de uma vez, mas converge rápido para o
 * consumo real do veículo/motorista ao longo dos abastecimentos.
 */
export function recordMottuSport110CalibrationSample(measuredKmL: number, avgSpeedKmh: number): number {
  if (!measuredKmL || measuredKmL <= 0 || !avgSpeedKmh || avgSpeedKmh <= 0) {
    return getMottuSport110CalibrationFactor();
  }

  const rawPredictedKmL = computeMottuSport110ConsumptionKmL(avgSpeedKmh);
  if (!rawPredictedKmL || rawPredictedKmL <= 0) {
    return getMottuSport110CalibrationFactor();
  }

  const measuredFactor = Math.max(
    MOTTU_110_MIN_FACTOR,
    Math.min(MOTTU_110_MAX_FACTOR, measuredKmL / rawPredictedKmL)
  );

  const currentFactor = getMottuSport110CalibrationFactor();
  const newFactor = Math.max(
    MOTTU_110_MIN_FACTOR,
    Math.min(MOTTU_110_MAX_FACTOR, currentFactor * (1 - MOTTU_110_LEARNING_RATE) + measuredFactor * MOTTU_110_LEARNING_RATE)
  );

  localStorage.setItem(MOTTU_110_CALIBRATION_FACTOR_KEY, newFactor.toFixed(4));
  localStorage.setItem(MOTTU_110_CALIBRATION_SAMPLES_KEY, String(getMottuSport110CalibrationSampleCount() + 1));

  console.log(
    `[Mottu110-Calibração] Novo dado real: ${measuredKmL.toFixed(1)} km/L a ~${avgSpeedKmh.toFixed(0)} km/h` +
    ` → fator ${currentFactor.toFixed(3)} → ${newFactor.toFixed(3)}`
  );

  return newFactor;
}

/**
 * Retorna o consumo instantâneo (km/L) para um modelo de veículo, dado a
 * velocidade atual (km/h). Para 'MANUAL', retorna o valor configurado manualmente
 * (fallback) sem cálculo físico. Para 'MOTTU_SPORT_110', aplica o fator de
 * calibração aprendido automaticamente a cada abastecimento/fechamento de caixa.
 */
export function getVehicleModelConsumptionKmL(
  modelId: VehicleModelId,
  speedKmh: number,
  manualFallbackKmL: number
): number {
  switch (modelId) {
    case 'MOTTU_SPORT_110': {
      const model = VEHICLE_MODELS.MOTTU_SPORT_110;
      const raw = computeMottuSport110ConsumptionKmL(speedKmh);
      const calibrated = raw * getMottuSport110CalibrationFactor();
      return Math.max(model.minConsumptionKmL, Math.min(model.maxConsumptionKmL, calibrated));
    }
    case 'MANUAL':
    default:
      return manualFallbackKmL;
  }
}

export const MOTO_VEHICLE_MODEL_OPTIONS: VehicleModelDefinition[] = Object.values(VEHICLE_MODELS).filter(
  (m) => m.type === 'MOTO'
);

/**
 * Consumo ESTÁVEL (km/L) para contabilidade de combustível (marcador do tanque, km/L
 * "real" do Painel de Bordo, custo de combustível por corrida, litros sugeridos ao
 * abastecer, etc.).
 *
 * Diferente de getVehicleModelConsumptionKmL, NÃO depende da velocidade instantânea do
 * GPS — usa sempre a velocidade de calibração de referência do modelo. Isso evita que
 * o km/L "real" exibido para o motorista suba/desça a cada leitura do velocímetro; ele
 * só muda quando o fator de calibração aprendido é atualizado (a cada abastecimento ou
 * fechamento de turno com divergência entre o previsto e o medido).
 *
 * O cálculo por velocidade instantânea (getVehicleModelConsumptionKmL) continua existindo
 * só para o mostrador "consumo em tempo real" — informativo, não usado em contabilidade.
 */
export function getStableVehicleModelConsumptionKmL(
  modelId: VehicleModelId,
  manualFallbackKmL: number
): number {
  switch (modelId) {
    case 'MOTTU_SPORT_110':
      return getVehicleModelConsumptionKmL(modelId, MOTTU_110_CALIBRATION_SPEED_KMH, manualFallbackKmL);
    case 'MANUAL':
    default:
      return manualFallbackKmL;
  }
}

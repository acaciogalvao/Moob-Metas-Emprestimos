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

// ── Mottu Sport 110 2025 ─────────────────────────────────────────────────────
// Motor: 109,1 cc monocilíndrico (base Honda CG 110), 4 tempos, injeção eletrônica.
// Consumo real confirmado pelo operador em uso cidade: 50-55 km/L.
// Ponto de calibração escolhido: 50 km/h (cruzeiro típico em cidade com paradas),
// alvo = 52,5 km/L (ponto médio da faixa 50-55 km/L confirmada).
const MOTTU_110_CALIBRATION_SPEED_KMH = 50;

// Modelo de consumo: L/h = consumo de marcha-lenta (fixo, independente da velocidade)
//                        + coeficiente de arrasto × velocidade²
//
// Isso produz uma curva em "sino" fisicamente correta:
//  • Pior em velocidades muito baixas (tráfego parado/rastejar): motor gasta combustível
//    de marcha-lenta enquanto avança pouquíssima distância → km/L baixo.
//  • Pico de eficiência em ~43 km/h (cruzeiro suave cidade): equilíbrio ótimo.
//  • Degrada acima do pico pelo aumento de arrasto aerodinâmico.
//
// Coeficiente de arrasto (b) derivado para que Lph(50 km/h) = 50/52,5 = 0,9524 L/h:
//   b = (0,9524 − idleLph) / 50² = 0,5524 / 2500 ≈ 0,00022095
//
// Resultados nas velocidades de uso do operador (cidade 20-60 km/h):
//   20 km/h → ~41 km/L | 30 km/h → ~50 | 40 km/h → ~53 | 50 km/h → 52,5 | 60 km/h → ~50
const MOTTU_110_IDLE_LPH = 0.4;       // L/h no marcha-lenta: típico 110cc injeção ≈ 0,35-0,45 L/h
const MOTTU_110_CALIBRATION_TARGET_KML = 52.5;
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
    label: 'Mottu Sport 110 (2025)',
    type: 'MOTO',
    // Faixa real confirmada pelo operador em cidade: 50-55 km/L.
    // min: valor realista em tráfego muito parado (rastejar)/subida; max: downhill/vento a favor.
    minConsumptionKmL: 20,
    maxConsumptionKmL: 60,
    idleConsumptionKmL: 52.5, // mostrado ao parar — ponto médio da faixa real do operador
  },
};

/**
 * Fórmula de consumo da Mottu Sport 110 2025.
 *
 *   L/h = MOTTU_110_IDLE_LPH + MOTTU_110_DRAG_COEFFICIENT × velocidade²
 *   km/L = velocidade / L/h
 *
 * Calibrada com dados reais do operador: 52,5 km/L a 50 km/h (cruzeiro cidade),
 * pico de ~53,2 km/L em ~43 km/h. Clampada entre 20 e 60 km/L.
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

// ── Estimativa de RPM (Mottu Sport 110 / Honda CG 110) ────────────────────────
// Sem OBD, o RPM é estimado a partir da velocidade via curva linear calibrada
// para uso em cidade (3ª/4ª marcha predominante).
//
// Calibração:
//   • Marcha-lenta (idle): ~1 500 RPM
//   • Cruzeiro 50 km/h (4ª): ~4 400 RPM  → fator ≈ 58 RPM/(km/h)
//   • Linha vermelha (redline): ~8 000 RPM (motor 110cc 4T)
//
// Resultados:
//   0 km/h → 1 500 | 30 km/h → ~3 200 | 50 km/h → ~4 400 | 60 km/h → ~5 000
const MOTTU_110_IDLE_RPM      = 1500;
const MOTTU_110_RPM_PER_KMPH  = 58;   // RPM adicionado por km/h (marcha de cruzeiro)
export const MOTTU_110_RPM_REDLINE = 8000;

/**
 * Estima o RPM do motor Mottu Sport 110 a partir da velocidade (GPS).
 * Retorna o valor em RPM (ex.: 4400). Para exibição ×1000, divida por 1000.
 */
export function estimateMottu110Rpm(speedKmh: number): number {
  if (!speedKmh || speedKmh <= 0) return MOTTU_110_IDLE_RPM;
  const rpm = MOTTU_110_IDLE_RPM + speedKmh * MOTTU_110_RPM_PER_KMPH;
  return Math.min(rpm, MOTTU_110_RPM_REDLINE);
}

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

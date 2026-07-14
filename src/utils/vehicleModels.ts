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
// Calibration point: 70 km/h @ 4.500 RPM ≈ torque máximo do motor 110i.
// A partir desse ponto, deriva-se uma relação linear simplificada velocidade → RPM
// (RPM ≈ velocidade × RPM_MAX_TORQUE / VELOCIDADE_NO_TORQUE_MAX), usada para alimentar
// a fórmula de torque/potência/consumo fornecida.
const MOTTU_110_REDLINE_RPM = 7_350;
const MOTTU_110_CALIBRATION_SPEED_KMH = 70;
const MOTTU_110_CALIBRATION_RPM = 4_500;
const MOTTU_110_SPEED_TO_RPM_RATIO = MOTTU_110_CALIBRATION_RPM / MOTTU_110_CALIBRATION_SPEED_KMH;

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
 * Fórmula de consumo da Mottu Sport 110, derivada de torque/potência estimados a
 * partir da velocidade (km/h):
 *
 *   RPM      = velocidade × (4.500 / 70)                      // calibrado no torque máx.
 *   Torque   = 0,9 × (RPM / 7.350) × 1,2                       // kgf.m, fator de ajuste
 *   Potência = (Torque × RPM) / 716,2                          // cv
 *   Consumo_L_h = (Potência × 245) / 750                       // L/h
 *   Consumo_km_L = velocidade / Consumo_L_h
 *
 * Validado com o ponto de calibração (70 km/h @ 4.500 RPM): resulta em ~51,5 km/L,
 * dentro da faixa real de 50-55 km/L da Mottu 110i.
 */
export function computeMottuSport110ConsumptionKmL(speedKmh: number): number {
  const model = VEHICLE_MODELS.MOTTU_SPORT_110;

  if (!speedKmh || speedKmh <= 0) {
    return model.idleConsumptionKmL;
  }

  const rpm = speedKmh * MOTTU_110_SPEED_TO_RPM_RATIO;
  const torqueKgfM = 0.9 * (rpm / MOTTU_110_REDLINE_RPM) * 1.2;
  const powerCv = (torqueKgfM * rpm) / 716.2;

  if (powerCv <= 0) {
    return model.idleConsumptionKmL;
  }

  const consumptionLitersPerHour = (powerCv * 245) / 750;
  if (consumptionLitersPerHour <= 0) {
    return model.idleConsumptionKmL;
  }

  const consumptionKmL = speedKmh / consumptionLitersPerHour;

  // Se o resultado sair da faixa real conhecida do modelo, aplica o limite.
  return Math.max(model.minConsumptionKmL, Math.min(model.maxConsumptionKmL, consumptionKmL));
}

/**
 * Retorna o consumo instantâneo (km/L) para um modelo de veículo, dado a
 * velocidade atual (km/h). Para 'MANUAL', retorna o valor configurado manualmente
 * (fallback) sem cálculo físico.
 */
export function getVehicleModelConsumptionKmL(
  modelId: VehicleModelId,
  speedKmh: number,
  manualFallbackKmL: number
): number {
  switch (modelId) {
    case 'MOTTU_SPORT_110':
      return computeMottuSport110ConsumptionKmL(speedKmh);
    case 'MANUAL':
    default:
      return manualFallbackKmL;
  }
}

export const MOTO_VEHICLE_MODEL_OPTIONS: VehicleModelDefinition[] = Object.values(VEHICLE_MODELS).filter(
  (m) => m.type === 'MOTO'
);

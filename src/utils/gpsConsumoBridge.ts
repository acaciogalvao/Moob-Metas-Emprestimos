/**
 * gpsConsumoBridge.ts — Pipeline GPS ↔ Consumo de Combustível
 *
 * Camada de integração pura (sem hooks, sem side effects de React) que conecta
 * os dados do GPS com o modelo de consumo de combustível.
 *
 * Funções:
 *  - computeGpsConsumo()     → GPS km + config → estado unificado de combustível
 *  - autoCalibrarConsumoGPS() → GPS km + litros → auto-calibra localStorage quando
 *                               não há hodômetro disponível (fallback do modelo físico)
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface GpsConsumoInput {
  /** Km acumulados no turno via GPS (useShiftGPS.shiftKm) */
  shiftKm: number;
  /** Capacidade total do tanque (litros) */
  fuelCapacity: number;
  /** Consumo configurado (km/L) */
  autonomyKmL: number;
  /** Litros abastecidos neste turno (soma das despesas de combustível) */
  litersFueled: number;
  /** Preço do último litro (R$) */
  pricePerLiter: number;
}

export interface GpsConsumoOutput {
  litersConsumed: number;   // litros consumidos desde o início do turno
  litersRemaining: number;  // litros estimados restantes no tanque
  remainingKm: number;      // autonomia restante estimada (km)
  fuelCostEstimate: number; // custo estimado de reposição (R$)
}

export interface AutoCalibracaoResult {
  calibrated: number;  // novo km/L calibrado
  updated: boolean;    // true = localStorage foi atualizado
}

// ─── Pipeline GPS → Combustível ───────────────────────────────────────────────

/**
 * Calcula o estado de combustível usando km do GPS como fonte primária.
 * Útil quando o motorista não registrou hodômetro manual.
 */
export function computeGpsConsumo(input: GpsConsumoInput): GpsConsumoOutput {
  const { shiftKm, fuelCapacity, autonomyKmL, litersFueled, pricePerLiter } = input;

  if (autonomyKmL <= 0) {
    return { litersConsumed: 0, litersRemaining: fuelCapacity, remainingKm: 0, fuelCostEstimate: 0 };
  }

  const litersConsumed = shiftKm / autonomyKmL;
  // litersRemaining cresce quando abastece (litersFueled) e cai com consumo
  const litersRemaining = Math.max(0, fuelCapacity - litersConsumed + litersFueled);
  const remainingKm = litersRemaining * autonomyKmL;
  const fuelCostEstimate = litersConsumed * pricePerLiter;

  return { litersConsumed, litersRemaining, remainingKm, fuelCostEstimate };
}

// ─── Auto-Calibração por GPS ──────────────────────────────────────────────────

/** Chaves usadas no localStorage (mesmas que ShiftControl usa) */
const CONSUMPTION_KEYS = {
  CARRO: 'moob_fuel_car_consumption',
  MOTO:  'moob_fuel_moto_consumption',
} as const;

const DEFAULT_CONSUMPTION = { CARRO: 12, MOTO: 35 };

/** Valores físicos mínimos e máximos aceitáveis por tipo de veículo (km/L) */
const CONSUMPTION_BOUNDS = {
  CARRO: { min: 5,  max: 22 },
  MOTO:  { min: 18, max: 60 },
};

/**
 * Calibra o consumo com base nos km reais do GPS + litros consumidos no turno.
 * Só age quando não há hodômetro disponível (o modelo físico do ShiftControl
 * já cuida do caso com hodômetro). Usa EMA 70% medido / 30% histórico.
 *
 * @param gpsKm       — km do turno pelo GPS
 * @param litersUsed  — litros consumidos no turno (despesas de combustível)
 * @param vehicleType — 'CARRO' | 'MOTO'
 * @param hasOdometer — se true, ShiftControl já cuida da calibração; não interfere
 */
export function autoCalibrarConsumoGPS(
  gpsKm: number,
  litersUsed: number,
  vehicleType: 'CARRO' | 'MOTO',
  hasOdometer: boolean,
): AutoCalibracaoResult {
  // Não interfere quando há hodômetro (ShiftControl é mais preciso)
  if (hasOdometer) return { calibrated: getStoredConsumption(vehicleType), updated: false };

  // Dados mínimos para calibração confiável
  if (gpsKm < 10 || litersUsed < 0.5) {
    return { calibrated: getStoredConsumption(vehicleType), updated: false };
  }

  const measured = gpsKm / litersUsed;
  const { min, max } = CONSUMPTION_BOUNDS[vehicleType];

  // Rejeita medições fora dos limites físicos (GPS ou litros incorretos)
  if (measured < min || measured > max) {
    console.warn(
      `[GpsConsumoBridge] Calibração GPS rejeitada: ${measured.toFixed(2)} km/L` +
      ` fora do intervalo [${min}, ${max}] para ${vehicleType}`
    );
    return { calibrated: getStoredConsumption(vehicleType), updated: false };
  }

  const prev = getStoredConsumption(vehicleType);
  // EMA: 70% novo dado real, 30% histórico acumulado
  const calibrated = parseFloat((measured * 0.7 + prev * 0.3).toFixed(2));

  localStorage.setItem(CONSUMPTION_KEYS[vehicleType], String(calibrated));
  console.log(
    `[GpsConsumoBridge] Auto-calibração GPS: ${prev.toFixed(2)} → ${calibrated.toFixed(2)} km/L` +
    ` (${gpsKm.toFixed(1)} km ÷ ${litersUsed.toFixed(2)} L = ${measured.toFixed(2)} km/L real)`
  );

  return { calibrated, updated: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStoredConsumption(vehicleType: 'CARRO' | 'MOTO'): number {
  const key = CONSUMPTION_KEYS[vehicleType];
  const raw = localStorage.getItem(key);
  if (!raw) return DEFAULT_CONSUMPTION[vehicleType];
  const parsed = parseFloat(raw);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_CONSUMPTION[vehicleType] : parsed;
}

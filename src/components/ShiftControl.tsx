/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, ArrowUpRight, ArrowDownRight, Wallet, Clipboard, 
  RefreshCw, CheckCircle, AlertTriangle, Play, Calendar, HelpCircle, Eye, Coins, TrendingUp, MapPin, Info, Clock, X, Trash2, Fuel
} from 'lucide-react';
import { Shift, Transaction } from '../types';
import { playBeep, playCashRegister } from '../utils/audio';
import { parseBRLInput, maskBRL, maskOdometer, parseOdometerInput, getPlatformBalanceDelta, getTransactionNetValue, formatDecimalBRL, calculateExtraValue, getTransactionFaturamentoReal, formatOdometer, formatBRL } from '../utils/format';
import { PainelBordo } from './PainelBordo';
import {
  VehicleModelId,
  MOTO_VEHICLE_MODEL_OPTIONS,
  getVehicleModelConsumptionKmL,
  recordMottuSport110CalibrationSample,
  getMottuSport110CalibrationFactor,
  getMottuSport110CalibrationSampleCount,
} from '../utils/vehicleModels';

interface ShiftControlProps {
  activeShift: Shift | null;
  historicalShifts: Shift[];
  onCloseShift: (
    closingBalanceReal: number, 
    closingPixReal: number, 
    notes: string, 
    finalOdometer?: number, 
    totalLitersFueled?: number,
    finalFuelLiters?: number,
    finalFuelLevel?: string
  ) => void;
  onDeleteHistoryShift: (id: string) => void;
  onSelectShiftForReport: (shift: Shift) => void;
  onDeleteTransaction?: (id: string) => void;
  vehicleType?: 'CAR' | 'BIKE';
  onSetVehicleType?: (type: 'CAR' | 'BIKE') => void;
  onAddTransaction?: (tx: Omit<Transaction, 'id' | 'timestamp'> | Omit<Transaction, 'id' | 'timestamp'>[]) => void;
  isSpeedometerActive?: boolean;
  onToggleSpeedometer?: () => void;
  onUpdateActiveShift?: (fields: Partial<Shift>) => void;
  refuelMetrics?: any;
  excludeSundays?: boolean;
  onToggleExcludeSundays?: () => void;
  draftFuelLiters?: number;
  /** Nível do tanque recalculado em tempo real pelo QuickRegister ao digitar o hodômetro no abastecimento. */
  liveFuelLevel?: number | null;
  // GPS do turno (auto-ativo quando caixa aberto, via useShiftGPS)
  gpsSpeedKmh?: number;
  gpsShiftKm?: number;
  isGpsActive?: boolean;
  gpsAccuracy?: number | null;
  isGpsBackground?: boolean;
}

export function ShiftControl({ 
  activeShift, 
  historicalShifts, 
  onCloseShift, 
  onDeleteHistoryShift,
  onSelectShiftForReport,
  onDeleteTransaction,
  vehicleType = 'CAR',
  onSetVehicleType,
  onAddTransaction,
  isSpeedometerActive = false,
  onToggleSpeedometer,
  onUpdateActiveShift,
  refuelMetrics,
  draftFuelLiters = 0,
  liveFuelLevel = null,
  excludeSundays: propsExcludeSundays,
  onToggleExcludeSundays,
  gpsSpeedKmh,
  gpsShiftKm,
  isGpsActive = false,
  gpsAccuracy,
  isGpsBackground = false,
}: ShiftControlProps) {
  // Local fallback state if not provided as props
  const [localExcludeSundays, setLocalExcludeSundays] = useState<boolean>(() => {
    return localStorage.getItem('moob_caixa_exclude_sundays') === 'true';
  });

  const excludeSundays = propsExcludeSundays !== undefined ? propsExcludeSundays : localExcludeSundays;

  const handleToggleExcludeSundays = () => {
    if (onToggleExcludeSundays) {
      onToggleExcludeSundays();
    } else {
      const nextVal = !localExcludeSundays;
      setLocalExcludeSundays(nextVal);
      localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
    }
  };

  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [realCashInput, setRealCashInput] = useState('');
  const [realPixInput, setRealPixInput] = useState('');
  const [finalOdometerInput, setFinalOdometerInput] = useState('');
  const [totalLitersInput, setTotalLitersInput] = useState('');
  const [finalFuelLevel, setFinalFuelLevel] = useState<'CHEIO' | 'MEIO' | 'RESERVA' | 'CUSTOM'>('MEIO');
  const [finalFuelLitersInput, setFinalFuelLitersInput] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Calibração de consumo é sempre automática — não há mais opção manual.
  const calibrateConsumption = true;
  const [withdrawalModal, setWithdrawalModal] = useState<{
    platform: 'UBER' | '99';
    maxAmount: number;
    amount: string;
    method: 'PIX' | 'DINHEIRO';
    fee: string;
  } | null>(null);

  const [conversionModal, setConversionModal] = useState<{
    amount: string;
    direction: 'CASH_TO_PIX' | 'PIX_TO_CASH';
  } | null>(null);

  const [debtPaymentModal, setDebtPaymentModal] = useState<{
    platform: 'UBER' | '99';
    maxAmount: number;
    amount: string;
  } | null>(null);

  // --- FUEL TRACKER PERSISTED STATES ---
  const [fuelVehicleType, setFuelVehicleType] = useState<'CARRO' | 'MOTO'>(() => {
    return vehicleType === 'CAR' ? 'CARRO' : 'MOTO';
  });

  useEffect(() => {
    setFuelVehicleType(vehicleType === 'CAR' ? 'CARRO' : 'MOTO');
    setIsEditingConsumption(false);
    setIsEditingCapacity(false);
  }, [vehicleType]);

  const [carConsumption, setCarConsumption] = useState<number>(() => {
    const v = localStorage.getItem('moob_fuel_car_consumption');
    return v ? parseFloat(v) : 12;
  });

  const [carCapacity, setCarCapacity] = useState<number>(() => {
    const v = localStorage.getItem('moob_fuel_car_capacity');
    return v ? parseFloat(v) : 50;
  });

  const [motoConsumption, setMotoConsumption] = useState<number>(() => {
    const v = localStorage.getItem('moob_fuel_moto_consumption');
    return v ? parseFloat(v) : 35;
  });

  // Modelo de veículo da moto: 'MANUAL' usa motoConsumption fixo; um modelo
  // específico (ex. Mottu Sport 110) calcula o km/L em tempo real a partir da
  // velocidade do GPS do turno, via fórmula de torque/potência do motor.
  const [motoModel, setMotoModel] = useState<VehicleModelId>(() => {
    const v = localStorage.getItem('moob_fuel_moto_model');
    return v === 'MOTTU_SPORT_110' ? 'MOTTU_SPORT_110' : 'MANUAL';
  });

  const handleSetMotoModel = (modelId: VehicleModelId) => {
    setMotoModel(modelId);
    localStorage.setItem('moob_fuel_moto_model', modelId);
    playBeep();
  };

  // ── Auto-calibração do modelo Mottu Sport 110 a cada abastecimento ────────
  // Sempre que um novo lançamento de combustível com hodômetro é registrado,
  // usa o km real percorrido desde o abastecimento/turno anterior + os litros
  // colocados para medir o km/L real e ir ajustando o fator de calibração —
  // sem qualquer ação manual do motorista.
  const lastLearnedFuelTxIdRef = useRef<string | null>(null);
  const [mottuCalibrationFactor, setMottuCalibrationFactor] = useState<number>(() => getMottuSport110CalibrationFactor());
  const [mottuCalibrationSamples, setMottuCalibrationSamples] = useState<number>(() => getMottuSport110CalibrationSampleCount());

  // Refs para leitura segura do consumo atual dentro do effect sem adicionar ao deps
  const carConsumptionRef = useRef(carConsumption);
  useEffect(() => { carConsumptionRef.current = carConsumption; }, [carConsumption]);
  const motoConsumptionRef = useRef(motoConsumption);
  useEffect(() => { motoConsumptionRef.current = motoConsumption; }, [motoConsumption]);

  // ── Auto-calibração a cada abastecimento com hodômetro ────────────────────
  // Mottu Sport 110: calibra o fator da fórmula física de torque/potência.
  // Carro e Moto Manual: atualiza o km/L base via EMA (blend 60% atual + 40%
  // medição real) e persiste no localStorage — próximo turno já começa correto.
  useEffect(() => {
    if (!activeShift || !activeShift.transactions || activeShift.transactions.length === 0) return;

    const fuelTxs = activeShift.transactions
      .filter(t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || (t.liters && t.liters > 0)) && t.odometer !== undefined && t.liters)
      .sort((a, b) => (a.odometer || 0) - (b.odometer || 0));

    if (fuelTxs.length === 0) return;
    const lastFuelTx = fuelTxs[fuelTxs.length - 1];
    if (lastFuelTx.id === lastLearnedFuelTxIdRef.current) return; // já aprendeu com este

    const priorTx = fuelTxs.length > 1 ? fuelTxs[fuelTxs.length - 2] : null;
    const priorOdo = priorTx ? priorTx.odometer : activeShift.initialOdometer;
    const priorTimestamp = priorTx ? priorTx.timestamp : activeShift.openedAt;

    if (priorOdo !== undefined && lastFuelTx.odometer !== undefined && lastFuelTx.odometer > priorOdo && lastFuelTx.liters) {
      const legKm = lastFuelTx.odometer - priorOdo;
      const legLiters = lastFuelTx.liters;
      const measuredKmL = legKm / legLiters;
      const elapsedHours = priorTimestamp
        ? (new Date(lastFuelTx.timestamp).getTime() - new Date(priorTimestamp).getTime()) / 3_600_000
        : 0;
      const avgSpeedKmh = elapsedHours > 0 ? legKm / elapsedHours : 0;

      if (fuelVehicleType === 'MOTO' && motoModel === 'MOTTU_SPORT_110') {
        // Modelo físico: calibra o fator via amostras de velocidade × consumo
        if (measuredKmL > 0 && avgSpeedKmh > 0) {
          const newFactor = recordMottuSport110CalibrationSample(measuredKmL, avgSpeedKmh);
          setMottuCalibrationFactor(newFactor);
          setMottuCalibrationSamples(getMottuSport110CalibrationSampleCount());
          console.log(`[Combustível] Mottu calibração: ${measuredKmL.toFixed(2)} km/L medido → fator ${newFactor.toFixed(3)}`);
        }
      } else if (measuredKmL > 5 && measuredKmL < 80) {
        // Carro ou moto manual: blenda consumo atual (60%) com medição real (40%)
        const ALPHA = 0.40;
        if (fuelVehicleType === 'CARRO') {
          const blended = parseFloat((carConsumptionRef.current * (1 - ALPHA) + measuredKmL * ALPHA).toFixed(1));
          setCarConsumption(blended);
          localStorage.setItem('moob_fuel_car_consumption', String(blended));
          console.log(`[Combustível] Carro: ${measuredKmL.toFixed(2)} km/L medido → base atualizada para ${blended} km/L`);
        } else {
          const blended = parseFloat((motoConsumptionRef.current * (1 - ALPHA) + measuredKmL * ALPHA).toFixed(1));
          setMotoConsumption(blended);
          localStorage.setItem('moob_fuel_moto_consumption', String(blended));
          console.log(`[Combustível] Moto manual: ${measuredKmL.toFixed(2)} km/L medido → base atualizada para ${blended} km/L`);
        }
      }
    }

    lastLearnedFuelTxIdRef.current = lastFuelTx.id;
  }, [activeShift, fuelVehicleType, motoModel]);

  const [motoCapacity, setMotoCapacity] = useState<number>(() => {
    const v = localStorage.getItem('moob_fuel_moto_capacity');
    return v ? parseFloat(v) : 12;
  });

  useEffect(() => {
    const activeCap = fuelVehicleType === 'CARRO' ? carCapacity : motoCapacity;
    if (finalFuelLevel === 'CHEIO') {
      setFinalFuelLitersInput(activeCap.toFixed(1).replace('.', ','));
    } else if (finalFuelLevel === 'MEIO') {
      setFinalFuelLitersInput((activeCap / 2).toFixed(1).replace('.', ','));
    } else if (finalFuelLevel === 'RESERVA') {
      const reserveVal = fuelVehicleType === 'CARRO' ? 7 : 2;
      setFinalFuelLitersInput(reserveVal.toFixed(1).replace('.', ','));
    }
  }, [finalFuelLevel, fuelVehicleType, carCapacity, motoCapacity]);

  useEffect(() => {
    if (isClosingOpen && activeShift) {
      const initialLevelLabel = activeShift.initialFuelLevel;
      if (initialLevelLabel === 'Cheio') {
        setFinalFuelLevel('CHEIO');
      } else if (initialLevelLabel === 'Meio Tanque') {
        setFinalFuelLevel('MEIO');
      } else if (initialLevelLabel === 'Reserva') {
        setFinalFuelLevel('RESERVA');
      } else if (initialLevelLabel === 'Digitado' || activeShift.initialFuelLiters !== undefined) {
        setFinalFuelLevel('CUSTOM');
        if (activeShift.initialFuelLiters !== undefined) {
          setFinalFuelLitersInput(activeShift.initialFuelLiters.toFixed(1).replace('.', ','));
        }
      }
    }
  }, [isClosingOpen, activeShift]);

  const [isEditingConsumption, setIsEditingConsumption] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [tempConsumption, setTempConsumption] = useState('');
  const [tempCapacity, setTempCapacity] = useState('');

  const toggleFuelVehicleType = () => {
    const nextType = fuelVehicleType === 'CARRO' ? 'MOTO' : 'CARRO';
    setFuelVehicleType(nextType);
    localStorage.setItem('moob_fuel_vehicle_type', nextType);
    if (onSetVehicleType) {
      onSetVehicleType(nextType === 'CARRO' ? 'CAR' : 'BIKE');
    }
    setIsEditingConsumption(false);
    setIsEditingCapacity(false);
    playBeep();
  };

  const handleSaveConsumption = () => {
    const cleanValue = tempConsumption.replace(',', '.');
    const parsed = parseFloat(cleanValue);
    if (!isNaN(parsed) && parsed > 0) {
      if (fuelVehicleType === 'CARRO') {
        setCarConsumption(parsed);
        localStorage.setItem('moob_fuel_car_consumption', String(parsed));
      } else {
        setMotoConsumption(parsed);
        localStorage.setItem('moob_fuel_moto_consumption', String(parsed));
      }
    }
    setIsEditingConsumption(false);
    playBeep();
  };

  const handleSaveCapacity = () => {
    const cleanValue = tempCapacity.replace(',', '.');
    const parsed = parseFloat(cleanValue);
    if (!isNaN(parsed) && parsed > 0) {
      if (fuelVehicleType === 'CARRO') {
        setCarCapacity(parsed);
        localStorage.setItem('moob_fuel_car_capacity', String(parsed));
      } else {
        setMotoCapacity(parsed);
        localStorage.setItem('moob_fuel_moto_capacity', String(parsed));
      }
    }
    setIsEditingCapacity(false);
    playBeep();
  };

  if (!activeShift) {
    return (
      <div className="space-y-4">
        {/* REFUELING SUGGESTION CARD */}
        {refuelMetrics && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-amber-500/30 transition-all shadow-md">
            <div className="flex gap-2.5 items-start">
              <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                <Fuel className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-[14px] font-bold text-white uppercase tracking-wider">
                    Sugestão de Abastecimento
                  </h4>
                  <span className="px-1 py-0.2 bg-slate-950 text-slate-500 rounded text-sm font-mono border border-slate-800">
                    {vehicleType === 'CAR' ? '🚗 Carro' : '🏍️ Moto'}
                  </span>
                  <span className="px-1 py-0.2 bg-slate-950 text-slate-500 rounded text-sm font-mono border border-slate-800">
                    📋 Histórico
                  </span>
                </div>
                <p className="text-[13px] text-slate-400 mt-1 leading-normal">
                  Calculado com base na sua rodagem média e eficiência de combustível. {refuelMetrics.hasKmData ? (
                    <span>Utilizando dados de <strong>{refuelMetrics.shiftsWithOdoCount} caixas fechados</strong> com hodômetro.</span>
                  ) : (
                    <span className="text-amber-500/85">Dica: abra e feche turnos registrando o hodômetro para calibrar sua média de direção.</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-900">
              {/* Med 1: KM Rodados ou Média de KM */}
              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-850 flex flex-col">
                <span className="text-sm text-slate-500 uppercase font-black tracking-wider leading-none">Média de KM/Turno</span>
                <span className="text-xs font-black font-mono text-white mt-1">
                  {refuelMetrics.kmDriven.toFixed(1).replace('.', ',')} km
                </span>
              </div>

              {/* Med 2: Autonomia Média */}
              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-850 flex flex-col">
                <span className="text-sm text-slate-500 uppercase font-black tracking-wider leading-none">Consumo Médio</span>
                <span className="text-xs font-black font-mono text-amber-500 mt-1">
                  {refuelMetrics.avgAutonomy.toFixed(1).replace('.', ',')} km/L
                </span>
              </div>

              {/* Med 3: Abastecimento Sugerido */}
              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-850 flex flex-col">
                <span className="text-sm text-emerald-400 uppercase font-black tracking-wider leading-none">Litros Recomendados</span>
                <span className="text-xs font-black font-mono text-emerald-400 mt-1">
                  {refuelMetrics.recommendedLiters.toFixed(1).replace('.', ',')} L
                </span>
              </div>

              {/* Med 4: Custo Estimado */}
              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-850 flex flex-col">
                <span className="text-sm text-cyan-400 uppercase font-black tracking-wider leading-none">Custo Estimado</span>
                <span className="text-xs font-black font-mono text-cyan-400 mt-1">
                  {formatBRL(refuelMetrics.estimatedCost)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* History of Closed shifts */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-extrabold text-white font-sans tracking-tight">Histórico de Caixas Fechados</h3>
              <p className="text-[14px] text-slate-400">Turnos salvos no histórico financeiro local do navegador.</p>
            </div>
          </div>

          {historicalShifts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg bg-slate-950/20">
              <Calendar className="w-6 h-6 text-slate-650 mx-auto mb-1.5" />
              <p className="text-xs font-semibold">Nenhum caixa histórico registrado ainda.</p>
              <p className="text-[14px] text-slate-650 mt-0.5">Abra um caixa e comece a registrar suas corridas operacionais.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5 scrollbar-thin">
              {historicalShifts.map((shift) => {
                const dateStr = new Date(shift.openedAt).toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                });
                
                const shiftRides = shift.transactions.filter(t => t.category === 'CORRIDA');
                const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
                const shiftExpenses = shift.transactions.filter(t => t.type === 'OUT');
                
                const ridesCount = shiftRides.length;
                const totalIn = allInTransactions.reduce((s, t) => s + t.value, 0);
                const totalOut = shiftExpenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);
                
                const totalNetIn = shiftRides.reduce((s, t) => s + getTransactionNetValue(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => {
                  const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
                  return s + (t.value - fee);
                }, 0);
                
                const expectedNetProfit = totalNetIn - totalOut;
                const diffCash = shift.difference || 0;
                const diffPix = shift.differencePix || 0;
                const realProfit = expectedNetProfit + diffCash + diffPix;

                const hasOdo = shift.initialOdometer !== undefined && shift.finalOdometer !== undefined && shift.finalOdometer >= shift.initialOdometer;
                const kmRun = hasOdo && shift.finalOdometer !== undefined && shift.initialOdometer !== undefined ? (shift.finalOdometer - shift.initialOdometer) : 0;
                const kmPerL = hasOdo && shift.totalLitersFueled && shift.totalLitersFueled > 0 ? (kmRun / shift.totalLitersFueled) : undefined;

                return (
                  <div 
                    key={shift.id} 
                    className="p-3 bg-slate-955/65 rounded-lg border border-slate-805/85 hover:border-slate-700 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold font-mono text-slate-400">#{shift.id.slice(-8).toUpperCase()}</span>
                        <span className="text-[14px] text-slate-505 font-mono">• {dateStr}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1">
                        <div className="text-[14px] text-slate-400">
                          Corridas: <span className="text-white font-bold">{ridesCount}</span>
                        </div>
                        <div className="text-[14px] text-slate-400">
                          Gasto: <span className="text-rose-400 font-semibold">R$ {formatDecimalBRL(totalOut)}</span>
                        </div>
                        {((shift.difference !== undefined && shift.difference !== 0) || (shift.differencePix !== undefined && shift.differencePix !== 0)) && (
                          <div className="flex flex-col gap-0.5">
                            {shift.difference !== undefined && shift.difference !== 0 && (
                              <div className={`text-[12.5px] font-bold leading-none ${shift.difference < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                Dif. Dinheiro: R$ {formatDecimalBRL(shift.difference)}
                              </div>
                            )}
                            {shift.differencePix !== undefined && shift.differencePix !== 0 && (
                              <div className={`text-[12.5px] font-bold leading-none ${shift.differencePix < 0 ? 'text-rose-400' : 'text-cyan-400'}`}>
                                Dif. Pix: R$ {formatDecimalBRL(shift.differencePix)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {hasOdo && (
                        <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                          <span className="flex items-center gap-0.5">🛣️ <strong>{kmRun.toFixed(1)} KM</strong></span>
                          {kmPerL !== undefined && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5" title="Consumo Médio">⛽ <strong className="text-amber-500/90">{kmPerL.toFixed(1)} km/L</strong></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between border-t sm:border-t-0 border-slate-850 pt-1.5 sm:pt-0">
                      <div className="text-right">
                        <span className="block text-[12px] font-bold text-slate-500 uppercase">
                          {shift.status === 'CLOSED' ? 'Lucro Real' : 'Lucro Estimado'}
                        </span>
                        <span className={`text-xs font-black font-mono ${realProfit >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          R$ {formatDecimalBRL(realProfit)}
                        </span>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            playBeep();
                            onSelectShiftForReport(shift);
                          }}
                          title="Visualizar Relatório/Cupom"
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded transition-all"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            onDeleteHistoryShift(shift.id);
                          }}
                          title="Deletar Registro"
                          className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900/40 border border-slate-900/60 hover:border-rose-900/30 rounded transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active shift math
  const transactions = activeShift.transactions;
  const rides = transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
  const ridesAndCancels = transactions.filter(t => t.type === 'IN' && (t.category === 'CORRIDA' || t.category === 'CANCELAMENTO' || t.category === 'GORJETA' || t.category === 'CAMPANHA') && !t.isVirtual);
  const allInTransactions = transactions.filter(t => t.type === 'IN' && !t.isVirtual);
  const expenses = transactions.filter(t => t.type === 'OUT');
  
  const uberIn = rides.filter(t => t.platform === 'UBER' && t.paymentMethod !== 'APP').reduce((s, t) => s + t.value, 0);
  const ninetyNineIn = rides.filter(t => t.platform === '99' && t.paymentMethod !== 'APP').reduce((s, t) => s + t.value, 0);
  
  // Breakdown of income categories based on values entered in the calculator.
  // For "Direto no App" rides (CORRIDA paid via APP): the offer amount is always credited to the
  // platform's virtual wallet (saldo do app) — it never touches Pix/Dinheiro. Only the extra amount
  // typed on top of the offer (when the driver charges something extra in person) goes to Pix/Dinheiro,
  // based on extraPaymentMethod. If nothing extra was typed, nothing goes to Pix/Dinheiro for that ride.
  // Tips (t.tipValue) and independent GORJETA entries are NEVER part of Pix/Dinheiro — they always go
  // straight to the platform (app) balance, for every ride type (normal Pix/Dinheiro or Direto no App).
  const cashIn = allInTransactions.reduce((sum, t) => {
    if (t.category === 'GORJETA') return sum;
    if (t.paymentMethod === 'DINHEIRO') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'dinheiro')) {
      // Only the extra amount (beyond the app offer) goes to cash — the offer itself stays in the app balance.
      const extra = t.extraChargedValue !== undefined
        ? t.extraChargedValue
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  const pixIn = allInTransactions.reduce((sum, t) => {
    if (t.category === 'GORJETA') return sum;
    if (t.paymentMethod === 'PIX') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix')) {
      // Only the extra amount (beyond the app offer) goes to pix — the offer itself stays in the app balance.
      const extra = t.extraChargedValue !== undefined
        ? t.extraChargedValue
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  // appIn: only non-CORRIDA APP entries + tips (CORRIDA offer now lives in cashIn/pixIn)
  const appIn = allInTransactions.filter(t => t.paymentMethod === 'APP').reduce((sum, t) => {
    if (t.category === 'CORRIDA') {
      return sum; // Offer goes to Pix/Cash; tips are summed separately below
    }
    const extra = (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'pix' || t.extraPaymentMethod === 'dinheiro')
      ? (t.extraChargedValue !== undefined
          ? t.extraChargedValue
          : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue))
      : 0;
    return sum + (t.value - extra);
  }, 0) + allInTransactions.filter(t => t.category === 'CORRIDA' && t.tipValue !== undefined && t.tipValue > 0).reduce((sum, t) => sum + (t.tipValue || 0), 0);

  const appOut = transactions.filter(t => t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);

  // Faturamento / Total Entradas: Includes all faturamento bruto from rides and non-ride inflows (excluding exchange/transfers)
  const totalIn = rides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => {
    const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
    return s + (t.value - fee);
  }, 0);
  const totalOut = expenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);

  // Real Revenue / Goal calculations (Mensal, Semanal, Diária)
  const monthlyGoal = activeShift.monthlyGoal || parseFloat((localStorage.getItem('moob_caixa_monthly_goal') || '6.000,00').replace(/\./g, '').replace(',', '.')) || 6000;
  const daysInMonth = excludeSundays ? 26 : 30;
  const daysInWeek = excludeSundays ? 6 : 7;
  const dailyGoal = monthlyGoal / daysInMonth;
  const weeklyGoal = dailyGoal * daysInWeek;

  // Since goal progress is calculated post expenses (valor pós despesas),
  // we compare the net value (totalIn - totalOut) directly against the base daily/weekly goals.
  const dailyGoalWithExpenses = dailyGoal;
  const weeklyGoalWithExpenses = weeklyGoal;
  const dailyGoalProgressPct = dailyGoal > 0 ? ((totalIn - totalOut) / dailyGoal) * 100 : 0;

  const totalValoresOfertados = rides.reduce((s, t) => {
    if (t.platform === 'PARTICULAR') return s;
    const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
    return s + offer;
  }, 0);

  const valoresOfertadosUber = rides.filter(t => t.platform === 'UBER').reduce((s, t) => {
    const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
    return s + offer;
  }, 0);

  const valoresOfertados99 = rides.filter(t => t.platform === '99').reduce((s, t) => {
    const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
    return s + offer;
  }, 0);

  const totalValoresExtras = rides.reduce((s, t) => {
    const pExtra = t.platform === 'PARTICULAR' ? t.value : 0;
    return s + (t.extraChargedValue || 0) + pExtra;
  }, 0);

  // Cash in drawer should theoretically be:
  // Initial Cash Balance + Cash In (Dinheiro físico) - Cash Out (Expenses paid in cash)
  const initialCash = activeShift.initialCashBalance !== undefined ? activeShift.initialCashBalance : activeShift.initialBalance;
  const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((s, t) => s + t.value, 0);
  const expectedPocketCash = initialCash + cashIn - cashOut;
  const totalReceivedIn = cashIn + pixIn;
  const totalNetExpectedAccount = activeShift.initialBalance + totalReceivedIn - totalOut;

  const uberBalanceDelta = ridesAndCancels.filter(t => t.platform === 'UBER').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const uberWithdrawals = transactions.filter(t => t.platform === 'UBER' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  // Quitação de saldo negativo: dinheiro pago (sempre via Pix) para zerar a dívida com a plataforma.
  const uberDebtPayments = transactions.filter(t => t.platform === 'UBER' && t.category === 'QUITACAO_SALDO').reduce((s, t) => s + t.value, 0);
  const uberBalance = (activeShift.initialUberBalance ?? 0) + uberBalanceDelta - uberWithdrawals + uberDebtPayments;

  const ninetyNineBalanceDelta = ridesAndCancels.filter(t => t.platform === '99').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const ninetyNineWithdrawals = transactions.filter(t => t.platform === '99' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  const ninetyNineDebtPayments = transactions.filter(t => t.platform === '99' && t.category === 'QUITACAO_SALDO').reduce((s, t) => s + t.value, 0);
  const ninetyNineBalance = (activeShift.initial99Balance ?? 0) + ninetyNineBalanceDelta - ninetyNineWithdrawals + ninetyNineDebtPayments;

  const uberKM = rides.filter(t => t.platform === 'UBER' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const ninetyNineKM = rides.filter(t => t.platform === '99' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);

  // Expected Pix balance: Initial Pix + Pix In - Pix Out
  const initialPix = activeShift.initialPixBalance !== undefined ? activeShift.initialPixBalance : 0;
  const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((s, t) => s + t.value, 0);
  const expectedPixBalance = initialPix + pixIn - pixOut;

  // Lucro Real: Sum of net profit value of all rides and non-ride inflows minus expenses (excluding exchange)
  const totalNetIn = rides.reduce((s, t) => s + getTransactionNetValue(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => {
    const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
    return s + (t.value - fee);
  }, 0);
  const lucroReal = totalNetIn - totalOut;

  const durationHours = (() => {
    const start = new Date(activeShift.openedAt).getTime();
    const diff = Date.now() - start;
    const hours = diff / (1000 * 60 * 60);
    return hours > 0.05 ? hours : 0.05; // avoid dividing by 0 or close to 0
  })();

  const uberAverage = rides.filter(t => t.platform === 'UBER').length > 0 
    ? uberIn / rides.filter(t => t.platform === 'UBER').length : 0;
  const ninetyNineAverage = rides.filter(t => t.platform === '99').length > 0 
    ? ninetyNineIn / rides.filter(t => t.platform === '99').length : 0;

  // Weekly platform metrics logic (from Monday 00:00:00 of current week to Sunday 23:59:59)
  const getWeeklyPlatformMetrics = (platform: 'UBER' | '99') => {
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const activeTxs = activeShift ? activeShift.transactions.filter(t => t.platform === platform) : [];
    const historicalTxs = historicalShifts.flatMap(s => s.transactions).filter(t => t.platform === platform);
    const allPlatformTxs = [...activeTxs, ...historicalTxs];

    const platformRides = allPlatformTxs
      .filter(t => t.category === 'CORRIDA' && !t.isVirtual)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastRideValue = platformRides.length > 0 
      ? (platformRides[0].appOfferValue !== undefined ? platformRides[0].appOfferValue : platformRides[0].value) 
      : 0;

    const weeklyTxs = allPlatformTxs.filter(t => {
      if (!t.timestamp) return false;
      return new Date(t.timestamp) >= startOfWeek;
    });

    const weeklyRides = weeklyTxs.filter(t => t.category === 'CORRIDA' && !t.isVirtual);

    const weeklyTotalGanhos = weeklyRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);

    // For APP rides: main offer goes to Pix/Cash; only tips/cancellations go to app balance.
    const weeklyGanhosDinheiro = weeklyRides.reduce((s, t) => {
      let sum = 0;
      if (t.paymentMethod === 'DINHEIRO' || t.paymentMethod === 'PIX') {
        if (t.keypadValue === undefined || t.keypadValue <= 0) {
          sum += (t.appOfferValue !== undefined ? t.appOfferValue : t.value);
        } else {
          sum += t.value;
        }
      }
      if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix' || t.extraPaymentMethod === 'dinheiro')) {
        // Main offer + extra both go to Pix/Cash for APP rides
        const offer = t.appOfferValue !== undefined ? t.appOfferValue : t.value;
        sum += offer + (t.extraChargedValue !== undefined ? t.extraChargedValue : 0);
      }
      return s + sum;
    }, 0);

    const weeklyGanhosApp = weeklyRides.reduce((s, t) => {
      if (t.paymentMethod === 'APP') {
        // APP ride main value now goes to Pix/Cash; only tips count toward app balance
        return s + (t.tipValue !== undefined && t.tipValue > 0 ? t.tipValue : 0);
      }
      return s;
    }, 0);

    const weeklyRidesWithPass = weeklyRides.filter(t => t.passengerValue !== undefined || t.passengerAppValue !== undefined || t.appOfferValue !== undefined);
    const appOfferSum = weeklyRidesWithPass.reduce((s, t) => s + (t.appOfferValue !== undefined ? t.appOfferValue : t.value), 0);
    const passengerAppSum = weeklyRidesWithPass.reduce((s, t) => s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value)), 0);
    const feesSum = passengerAppSum - appOfferSum;
    const feePct = passengerAppSum > 0 ? (feesSum / passengerAppSum) * 100 : 0;

    return {
      lastRideValue,
      feePct,
      weeklyTotalGanhos,
      weeklyGanhosDinheiro,
      weeklyGanhosApp,
      weeklyRidesCount: weeklyRides.length
    };
  };

  const uberWeekly = getWeeklyPlatformMetrics('UBER');
  const ninetyNineWeekly = getWeeklyPlatformMetrics('99');

  const handleCloseShiftConfirm = () => {
    const realValue = parseBRLInput(realCashInput);
    if (isNaN(realValue) || realCashInput.trim() === '') {
      setErrorMsg('Favor preencher o saldo físico real contado.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const realPixValue = parseBRLInput(realPixInput);
    if (isNaN(realPixValue) || realPixInput.trim() === '') {
      setErrorMsg('Favor preencher o saldo Pix real na conta.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const finalOdo = finalOdometerInput ? parseOdometerInput(finalOdometerInput) : undefined;
    const liters = totalLitersInput ? parseFloat(totalLitersInput.replace(',', '.')) : undefined;

    if (activeShift.initialOdometer !== undefined && finalOdo !== undefined && finalOdo < activeShift.initialOdometer) {
      setErrorMsg('O odômetro final não pode ser menor do que o inicial.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const finalFuelLiters = finalFuelLitersInput ? parseFloat(finalFuelLitersInput.replace(',', '.')) : undefined;
    const initialFuelLiters = activeShift.initialFuelLiters || 0;
    const fueledLiters = liters || 0;
    const exactFuelConsumed = (activeShift.initialFuelLiters !== undefined && finalFuelLiters !== undefined)
      ? Math.max(0.001, initialFuelLiters + fueledLiters - finalFuelLiters)
      : fueledLiters;

    // Calibrate vehicle fuel consumption based on exact shift closure metrics
    if (calibrateConsumption && exactFuelConsumed > 0 && activeShift.initialOdometer !== undefined && finalOdo !== undefined) {
      const kmDriven = finalOdo - activeShift.initialOdometer;
      if (kmDriven > 0) {
        const exactCons = kmDriven / exactFuelConsumed;
        if (exactCons > 0) {
          if (fuelVehicleType === 'CARRO') {
            setCarConsumption(exactCons);
            localStorage.setItem('moob_fuel_car_consumption', exactCons.toFixed(1));
          } else if (motoModel === 'MOTTU_SPORT_110') {
            // Modelo físico: em vez de sobrescrever um número fixo, o consumo exato
            // do turno alimenta o aprendizado do fator de calibração da fórmula.
            const elapsedHours = (Date.now() - new Date(activeShift.openedAt).getTime()) / 3_600_000;
            const avgSpeedKmh = elapsedHours > 0 ? kmDriven / elapsedHours : 0;
            if (avgSpeedKmh > 0) {
              const newFactor = recordMottuSport110CalibrationSample(exactCons, avgSpeedKmh);
              setMottuCalibrationFactor(newFactor);
              setMottuCalibrationSamples(getMottuSport110CalibrationSampleCount());
            }
          } else {
            setMotoConsumption(exactCons);
            localStorage.setItem('moob_fuel_moto_consumption', exactCons.toFixed(1));
          }
        }
      }
    }

    onCloseShift(realValue, realPixValue, notes, finalOdo, liters, finalFuelLiters, finalFuelLevel);
    setIsClosingOpen(false);
    setRealCashInput('');
    setRealPixInput('');
    setNotes('');
    setFinalOdometerInput('');
    setTotalLitersInput('');
  };

  const handleInitiateWithdrawal = (platform: 'UBER' | '99', maxAmount: number) => {
    setWithdrawalModal({
      platform,
      maxAmount,
      amount: maxAmount.toFixed(2).replace('.', ','),
      method: 'PIX',
      fee: '0,00'
    });
    playBeep();
  };

  const handleInitiateDebtPayment = (platform: 'UBER' | '99', negativeBalance: number) => {
    const maxAmount = Math.abs(negativeBalance);
    setDebtPaymentModal({
      platform,
      maxAmount,
      amount: maxAmount.toFixed(2).replace('.', ','),
    });
    playBeep();
  };

  const handleConfirmDebtPayment = () => {
    if (!debtPaymentModal || !onAddTransaction) return;

    const parsedAmount = parseBRLInput(debtPaymentModal.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Valor de quitação inválido.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (parsedAmount > debtPaymentModal.maxAmount + 0.01) {
      setErrorMsg('O valor não pode ser maior do que a dívida com a plataforma.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    onAddTransaction({
      type: 'OUT',
      platform: debtPaymentModal.platform,
      category: 'QUITACAO_SALDO',
      value: parsedAmount,
      paymentMethod: 'PIX',
      description: `Quitação de Saldo Negativo ${debtPaymentModal.platform === 'UBER' ? 'Uber' : '99'} (Pix)`,
    });

    setDebtPaymentModal(null);
    playCashRegister();
  };

  const handleConfirmWithdrawal = () => {
    if (!withdrawalModal || !onAddTransaction) return;

    const parsedAmount = parseBRLInput(withdrawalModal.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Valor de saque inválido.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (parsedAmount > withdrawalModal.maxAmount + 0.01) {
      setErrorMsg('O valor do saque não pode ser maior do que o saldo retido.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const parsedFee = parseBRLInput(withdrawalModal.fee);
    if (isNaN(parsedFee) || parsedFee < 0) {
      setErrorMsg('Valor de taxa de saque inválido.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (parsedFee > parsedAmount) {
      setErrorMsg('A taxa de saque não pode ser maior do que o valor do saque.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    onAddTransaction({
      type: 'IN',
      platform: withdrawalModal.platform,
      category: 'SAQUE_APP',
      value: parsedAmount,
      withdrawalFee: parsedFee,
      paymentMethod: withdrawalModal.method,
      description: `Saque de Saldo Retido ${withdrawalModal.platform === 'UBER' ? 'Uber' : '99'} (${withdrawalModal.method === 'PIX' ? 'Pix' : 'Dinheiro'})`,
    });

    setWithdrawalModal(null);
    playCashRegister();
  };

  const handleConfirmConversion = () => {
    if (!conversionModal || !onAddTransaction) return;

    const parsedAmount = parseBRLInput(conversionModal.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Valor de conversão inválido.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const isCashToPix = conversionModal.direction === 'CASH_TO_PIX';

    // Register BOTH transactions at once using an array!
    onAddTransaction([
      {
        type: 'OUT',
        platform: 'GERAL',
        category: 'CAMBIO_PIX',
        value: parsedAmount,
        paymentMethod: isCashToPix ? 'DINHEIRO' : 'PIX',
        description: isCashToPix ? 'Conversão: Saída de Dinheiro Físico' : 'Conversão: Saída de Saldo em Pix',
      },
      {
        type: 'IN',
        platform: 'GERAL',
        category: 'CAMBIO_PIX',
        value: parsedAmount,
        paymentMethod: isCashToPix ? 'PIX' : 'DINHEIRO',
        description: isCashToPix ? 'Conversão: Entrada de Saldo em Pix' : 'Conversão: Entrada de Dinheiro Físico',
      }
    ]);

    setConversionModal(null);
    playCashRegister();
  };

  // --- FUEL CALCULATION COMMON VARIABLES ---
  const ridesWithKm = transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual);
  const totalKmRun = ridesWithKm.reduce((s, t) => s + (t.km || 0), 0);
  const ridesWithKmCount = ridesWithKm.length;
  
  // Consumo dinâmico da moto: se um modelo físico estiver selecionado, o km/L é
  // recalculado a cada leitura de velocidade do GPS do turno; senão usa o valor manual.
  const dynamicMotoConsumption = getVehicleModelConsumptionKmL(motoModel, gpsSpeedKmh || 0, motoConsumption);
  const activeConsumption = fuelVehicleType === 'CARRO' ? carConsumption : dynamicMotoConsumption;
  const activeCapacity = fuelVehicleType === 'CARRO' ? carCapacity : motoCapacity;

  // Litros de combustível abastecidos durante o turno
  const fuelTxLiters = transactions
    ?.filter(t => t.type === 'OUT' && t.liters && t.liters > 0)
    ?.reduce((acc, t) => acc + (t.liters || 0), 0) || 0;

  const initialFuelRaw = (activeShift && activeShift.initialFuelLiters !== undefined) ? activeShift.initialFuelLiters : activeCapacity;
  const initialFuel = Math.min(initialFuelRaw, activeCapacity);

  // Calculate current fuel liters with odometer-calibrated consumption if available, otherwise fallback to ride KMs
  let currentFuelLiters = initialFuel;
  let lastCalibratedOdo = activeShift ? activeShift.initialOdometer : undefined;
  let lastCalibratedFuel = initialFuel;
  let rideKmSinceCalibration = 0;
  let refuelsSinceCalibration = 0;

  for (const t of transactions) {
    if (t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual) {
      rideKmSinceCalibration += t.km;
    } else if (t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || (t.liters && t.liters > 0))) {
      const liters = t.liters || 0;
      
      if (t.odometer !== undefined && lastCalibratedOdo !== undefined && t.odometer >= lastCalibratedOdo) {
        const realKmDriven = t.odometer - lastCalibratedOdo;
        const fuelConsumedVal = activeConsumption > 0 ? (realKmDriven / activeConsumption) : 0;
        
        const fuelBeforeRefuel = Math.max(0, lastCalibratedFuel - fuelConsumedVal + refuelsSinceCalibration);
        currentFuelLiters = Math.min(activeCapacity, fuelBeforeRefuel + liters);
        
        lastCalibratedOdo = t.odometer;
        lastCalibratedFuel = currentFuelLiters;
        rideKmSinceCalibration = 0;
        refuelsSinceCalibration = 0;
      } else {
        refuelsSinceCalibration += liters;
      }
    }
  }

  const finalFuelConsumed = activeConsumption > 0 ? (rideKmSinceCalibration / activeConsumption) : 0;
  currentFuelLiters = Math.max(0, Math.min(activeCapacity, lastCalibratedFuel - finalFuelConsumed + refuelsSinceCalibration));
  
  const remainingKm = activeConsumption > 0 ? currentFuelLiters * activeConsumption : 0;

  // Live preview: while the user is typing in the refuel form in QuickRegister, update the gauge.
  // Priority: if the driver typed an odometer, use the recalculated level (liveFuelLevel) which
  // already accounts for km driven off-app. Otherwise fall back to currentFuelLiters + draftFuelLiters.
  const gaugeFuelLiters = activeCapacity > 0
    ? Math.max(0, Math.min(activeCapacity,
        liveFuelLevel !== null && liveFuelLevel !== undefined
          ? liveFuelLevel + (draftFuelLiters || 0)
          : currentFuelLiters + (draftFuelLiters || 0)
      ))
    : currentFuelLiters;

  const totalKmOdometerCalibrated = (lastCalibratedOdo !== undefined && activeShift && activeShift.initialOdometer !== undefined)
    ? (lastCalibratedOdo - activeShift.initialOdometer)
    : 0;
  const displayKmRun = totalKmOdometerCalibrated > 0 
    ? (totalKmOdometerCalibrated + rideKmSinceCalibration) 
    : totalKmRun;
  const fuelConsumed = activeConsumption > 0 ? (displayKmRun / activeConsumption) : 0;

  // Real-time metrics for current active shift
  const displayKm = refuelMetrics ? (refuelMetrics.isCurrentShift ? displayKmRun : refuelMetrics.kmDriven) : 0;
  const displayAutonomy = refuelMetrics ? (refuelMetrics.isCurrentShift ? activeConsumption : refuelMetrics.avgAutonomy) : 0;
  const displayLiters = refuelMetrics ? (refuelMetrics.isCurrentShift ? (activeConsumption > 0 ? (displayKmRun / activeConsumption) : 0) : refuelMetrics.recommendedLiters) : 0;
  const displayCost = refuelMetrics ? (refuelMetrics.isCurrentShift ? (displayLiters * (refuelMetrics.avgPricePerLiter || 5.50)) : refuelMetrics.estimatedCost) : 0;

  return (
    <div className="space-y-4">
      {/* Active Shift Card Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md relative overflow-hidden">
        {/* Top absolute light flare matching status */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 animate-pulse" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1 bg-slate-950/20 py-0.5 px-2 border border-slate-800/80 rounded-md w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-[12.5px] uppercase font-black text-emerald-400 tracking-wider">CAIXA OPERACIONAL ATIVO</span>
            </div>
            <p className="text-[14px] text-slate-400 font-mono">
              Iniciado em {new Date(activeShift.openedAt).toLocaleDateString('pt-BR')} às {new Date(activeShift.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <button
            onClick={() => {
              setIsClosingOpen(true);
              setRealCashInput(expectedPocketCash.toFixed(2).replace('.', ','));
              setRealPixInput(expectedPixBalance.toFixed(2).replace('.', ','));
              
              // Pre-populate fuel liters if they registered fuel expenses during the shift
              const fuelTxLiters = activeShift?.transactions
                ?.filter(t => t.type === 'OUT' && t.liters && t.liters > 0)
                ?.reduce((acc, t) => acc + (t.liters || 0), 0) || 0;
              if (fuelTxLiters > 0) {
                setTotalLitersInput(fuelTxLiters.toFixed(2).replace('.', ','));
              } else {
                setTotalLitersInput('');
              }

              // Auto-fill final odometer with (odômetro inicial + km rodados) so the driver only
              // needs to correct it if it differs from the real reading.
              if (activeShift && activeShift.initialOdometer !== undefined) {
                setFinalOdometerInput(formatOdometer(activeShift.initialOdometer + displayKmRun));
              } else {
                setFinalOdometerInput('');
              }
              
              playBeep();
            }}
            className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-1.5 px-3 rounded-lg text-[14px] uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3 h-3" />
            Fechar Caixa / Turno
          </button>
        </div>

        {/* Master Card: Distribuição Atual dos Saldos */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-4 rounded-xl border border-emerald-500/30 mb-4 shadow-lg shadow-emerald-950/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1.5 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] uppercase tracking-widest font-bold border-l border-b border-emerald-500/20 rounded-bl-lg">
            Saldos Atuais em Tempo Real
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
              <span className="text-[12.5px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-1">
                💰 Onde está o seu Dinheiro?
              </span>
              <p className="text-3xl font-black font-mono tracking-tight text-white">
                R$ {formatDecimalBRL(expectedPocketCash + expectedPixBalance + uberBalance + ninetyNineBalance)}
              </p>
              {/* Pix + Dinheiro destacado */}
              <div className="mt-2 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider whitespace-nowrap">💵⚡ Pix + Dinheiro</span>
                <span className="font-mono font-black text-emerald-300 text-base">R$ {formatDecimalBRL(expectedPocketCash + expectedPixBalance)}</span>
              </div>
              <p className="text-[12.5px] text-slate-400 mt-1.5 max-w-xl font-sans leading-relaxed">
                Este é o saldo líquido total que você possui atualmente, somando o dinheiro físico no bolso, o saldo na conta Pix e os valores acumulados nos aplicativos de corrida.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 w-full lg:w-auto">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="block text-[11px] text-slate-500 uppercase font-bold">💵 No Bolso (Físico)</span>
                <span className="font-mono text-sm font-black text-slate-200 block mt-0.5">R$ {formatDecimalBRL(expectedPocketCash)}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="block text-[11px] text-slate-500 uppercase font-bold">⚡ Em Conta (Pix)</span>
                <span className="font-mono text-sm font-black text-slate-200 block mt-0.5">R$ {formatDecimalBRL(expectedPixBalance)}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="block text-[11px] text-slate-500 uppercase font-bold">📱 Nos Apps</span>
                <span className="font-mono text-sm font-black text-slate-200 block mt-0.5" title={`Uber: R$ ${formatDecimalBRL(uberBalance)} | 99: R$ ${formatDecimalBRL(ninetyNineBalance)}`}>
                  R$ {formatDecimalBRL(uberBalance + ninetyNineBalance)}
                </span>
                <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                  Uber: R$ {formatDecimalBRL(uberBalance)} • 99: R$ {formatDecimalBRL(ninetyNineBalance)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cash to Pix conversion banner */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-left">
            <span className="text-[14px] font-black text-amber-500 uppercase flex items-center gap-1.5 tracking-wider">
              <span>🔄</span> Conversão de Saldos (Dinheiro / Pix)
            </span>
            <p className="text-[12.5px] text-slate-400 leading-relaxed mt-0.5 max-w-xl">
              Use estas ferramentas para transferir valores entre seu dinheiro físico no bolso e seu saldo em conta Pix, mantendo seu caixa 100% preciso.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setConversionModal({
                  amount: Math.max(0, expectedPocketCash).toFixed(2).replace('.', ','),
                  direction: 'CASH_TO_PIX'
                });
                playBeep();
              }}
              className="flex-1 sm:flex-initial bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 font-black py-1.5 px-3 rounded-lg text-[13px] uppercase flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-97 cursor-pointer"
            >
              <span>💵➔⚡</span> Dinheiro p/ Pix
            </button>
            <button
              onClick={() => {
                setConversionModal({
                  amount: Math.max(0, expectedPixBalance).toFixed(2).replace('.', ','),
                  direction: 'PIX_TO_CASH'
                });
                playBeep();
              }}
              className="flex-1 sm:flex-initial bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 font-black py-1.5 px-3 rounded-lg text-[13px] uppercase flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-97 cursor-pointer"
            >
              <span>⚡➔💵</span> Pix p/ Dinheiro
            </button>
          </div>
        </div>

        {/* PAINEL DE BORDO */}
        {activeShift && (
          <PainelBordo
            activeShift={activeShift}
            fuelLitersRemaining={currentFuelLiters}
            fuelCapacity={activeCapacity}
            autonomyKmPerL={activeConsumption}
            totalKmRun={displayKmRun}
            remainingKm={remainingKm}
            vehicleType={fuelVehicleType}
            onToggleVehicle={toggleFuelVehicleType}
            fuelCostEstimate={displayCost}
            fuelLitersConsumed={displayLiters}
            externalSpeed={gpsSpeedKmh}
            externalShiftKm={gpsShiftKm}
            isExternalGpsActive={isGpsActive}
            externalAccuracy={gpsAccuracy}
            isGpsBackground={isGpsBackground}
          />
        )}

        {/* MONITOR DE COMBUSTÍVEL */}
        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-800/80 mt-1">
          {activeConsumption <= 0 ? (
            <div className="bg-amber-500/5 border border-amber-500/15 p-2 rounded-lg flex items-start gap-1.5 text-amber-500/90 text-[12px] leading-relaxed">
              <span className="text-[14px] mt-0.5">⚠️</span>
              <p>
                Configure o consumo do seu veículo (km/L) para ativar o rastreamento de combustível.
              </p>
            </div>
          ) : (
            <>
              {/* Barra e Painel de Nível de Combustível Físico Interativo */}
              {(() => {
                const fuelPercentage = activeCapacity > 0 ? Math.max(0, Math.min(100, (gaugeFuelLiters / activeCapacity) * 100)) : 0;
                
                const getTickCoords = (angleDeg: number, rStart: number, rEnd: number) => {
                  const angleRad = (angleDeg - 90) * Math.PI / 180;
                  const x1 = 120 + rStart * Math.cos(angleRad);
                  const y1 = 100 + rStart * Math.sin(angleRad);
                  const x2 = 120 + rEnd * Math.cos(angleRad);
                  const y2 = 100 + rEnd * Math.sin(angleRad);
                  return { x1, y1, x2, y2 };
                };

                const needleAngle = -90 + (fuelPercentage / 100) * 180;

                // Determine optimal subdivisions based on capacity
                const getOptimalSubdivisions = (capacity: number) => {
                  const candidates = [10, 5, 4, 2.5, 2, 1.25, 1, 0.5, 0.25, 0.2, 0.1, 0.05];
                  let bestN = 1;
                  let bestStep = capacity / 8;
                  let bestError = Infinity;

                  for (const step of candidates) {
                    const calcN = capacity / (8 * step);
                    const roundedN = Math.round(calcN);
                    if (roundedN >= 1 && roundedN <= 5) {
                      const error = Math.abs(calcN - roundedN);
                      if (error < 1e-4) {
                        return { N: roundedN, literStep: step };
                      }
                      if (error < bestError) {
                        bestError = error;
                        bestN = roundedN;
                        bestStep = step;
                      }
                    }
                  }

                  // Relax range up to 8
                  for (const step of candidates) {
                    const calcN = capacity / (8 * step);
                    const roundedN = Math.round(calcN);
                    if (roundedN >= 1 && roundedN <= 8) {
                      const error = Math.abs(calcN - roundedN);
                      if (error < 1e-4) {
                        return { N: roundedN, literStep: step };
                      }
                    }
                  }

                  return { N: bestN, literStep: capacity / (8 * bestN) };
                };

                const { N, literStep } = getOptimalSubdivisions(activeCapacity);
                const totalTicks = fuelVehicleType === 'MOTO' ? 7 : (8 * N);

                const allPositions: { value: number; isMajor: boolean; label?: string; percentage: number; angle: number; liters: number }[] = [];
                for (let i = 0; i <= totalTicks; i++) {
                  let percentage = (i / totalTicks) * 100;
                  if (fuelVehicleType === 'MOTO') {
                    percentage = i <= 5 ? (i / 5) * 50 : 50 + ((i - 5) / 2) * 50;
                  }
                  const liters = (percentage / 100) * activeCapacity;
                  
                  if (fuelVehicleType === 'MOTO') {
                    // For MOTO, angle goes from 105 (0%) to 195 (100%)
                    const angle = 105 + ((i / totalTicks) * 100 / 100) * 90;
                    
                    const isMajor = (i === 0 || i === 2 || i === 5 || i === 7);
                    
                    let label: string | undefined = undefined;
                    if (i === 2) label = 'E';
                    else if (i === 5) label = '1/2';
                    else if (i === 7) label = 'F';

                    allPositions.push({
                      value: i,
                      isMajor,
                      label,
                      percentage,
                      angle,
                      liters
                    });
                  } else {
                    const angle = -90 + (percentage / 100) * 180;
                    const isMajor = i <= 4 * N ? (i % N === 0) : (i % (2 * N) === 0);
                    
                    let label: string | undefined = undefined;
                    if (i === N) label = 'R';
                    else if (i === 4 * N) label = '1/2';
                    else if (i === 8 * N) label = 'F';

                    allPositions.push({
                      value: i,
                      isMajor,
                      label,
                      percentage,
                      angle,
                      liters
                    });
                  }
                }

                // Find closest tick of all positions to highlight
                const closestPos = allPositions.reduce((prev, curr) => {
                  return Math.abs(fuelPercentage - curr.percentage) < Math.abs(fuelPercentage - prev.percentage) ? curr : prev;
                });

                const handleSetFuelTick = (tickIndex: number, targetPerc: number) => {
                  if (!onUpdateActiveShift || !activeShift) return;
                  playBeep();
                  
                  const targetLiters = (targetPerc / 100) * activeCapacity;
                  
                  let levelName = 'Custom';
                  if (tickIndex === totalTicks) {
                    levelName = 'CHEIO';
                  } else if (fuelVehicleType === 'MOTO' ? tickIndex === 5 : tickIndex === 4 * N) {
                    levelName = 'MEIO';
                  } else if (fuelVehicleType === 'MOTO' ? tickIndex === 2 : tickIndex === N) {
                    levelName = 'RESERVA';
                  }
                  
                  if (displayKmRun > 0) {
                    // Calculate real-time consumption based on pointer position and KM driven
                    const litersConsumed = initialFuel - targetLiters + fuelTxLiters;
                    if (litersConsumed > 0) {
                      const calculatedAutonomy = displayKmRun / litersConsumed;
                      let newConsumption = calculatedAutonomy;
                      if (fuelVehicleType === 'CARRO') {
                        newConsumption = Math.max(1, Math.min(40, calculatedAutonomy));
                        setCarConsumption(newConsumption);
                        localStorage.setItem('moob_fuel_car_consumption', String(newConsumption));
                      } else {
                        newConsumption = Math.max(5, Math.min(100, calculatedAutonomy));
                        setMotoConsumption(newConsumption);
                        localStorage.setItem('moob_fuel_moto_consumption', String(newConsumption));
                      }
                    }
                    
                    onUpdateActiveShift({
                      initialFuelLevel: levelName === 'Custom' 
                        ? `Marcador: ${tickIndex}/${totalTicks} (${Math.round(targetPerc)}%)` 
                        : levelName
                    });
                  } else {
                    // No KM run yet, so adjust starting fuel level directly
                    onUpdateActiveShift({
                      initialFuelLiters: parseFloat(targetLiters.toFixed(3)),
                      initialFuelLevel: levelName === 'Custom' 
                        ? `Marcador: ${tickIndex}/${totalTicks} (${Math.round(targetPerc)}%)` 
                        : levelName
                    });
                  }
                };

                const getPrincipalBtnLabel = (percentage: number) => {
                  if (percentage === 0) return '0%';
                  
                  if (fuelVehicleType === 'MOTO') {
                    if (Math.abs(percentage - 20) < 0.1) return 'E';
                    if (Math.abs(percentage - 50) < 0.1) return '1/2';
                    if (Math.abs(percentage - 100) < 0.1) return 'F';
                  } else {
                    if (Math.abs(percentage - 12.5) < 0.1) return 'R';
                    if (Math.abs(percentage - 25) < 0.1) return '1/4';
                    if (Math.abs(percentage - 37.5) < 0.1) return '3/8';
                    if (Math.abs(percentage - 50) < 0.1) return '1/2';
                    if (Math.abs(percentage - 75) < 0.1) return '3/4';
                    if (Math.abs(percentage - 100) < 0.1) return 'F';
                  }
                  
                  return `${Math.round(percentage)}%`;
                };

                return (
                  <div className="mt-1.5 bg-slate-900/50 border border-slate-850/80 p-3 rounded-xl flex flex-col items-center relative overflow-hidden">
                    {/* Inner glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.03)_0%,transparent_70%)] pointer-events-none" />
                    
                    <div className="w-full flex justify-between items-center text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                      <span className="flex items-center gap-1">
                        <span>⛽</span> Marcador de Combustível ({fuelVehicleType === 'CARRO' ? 'Carro' : 'Moto'})
                      </span>
                      <span className="font-mono text-[12.5px] text-slate-300 font-black">
                        {gaugeFuelLiters.toFixed(1).replace('.', ',')}L / {activeCapacity.toString().replace('.', ',')}L ({fuelPercentage.toFixed(0)}%)
                        {draftFuelLiters > 0 && (
                          <span className="text-emerald-400 ml-1">+{draftFuelLiters.toFixed(1).replace('.', ',')}L</span>
                        )}
                      </span>
                    </div>

                    {/* Seletor de Modelo de Veículo (Moto) — escolhe entre km/L manual ou fórmula física */}
                    {fuelVehicleType === 'MOTO' && (
                      <div className="w-full flex items-center justify-between gap-2 mb-2 bg-slate-950/50 border border-slate-800/70 rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] text-slate-500 uppercase font-bold shrink-0">🏍️ Modelo</span>
                        <select
                          value={motoModel}
                          onChange={(e) => handleSetMotoModel(e.target.value as VehicleModelId)}
                          className="bg-slate-900 border border-slate-800 rounded-md text-[12px] text-slate-200 font-mono px-2 py-1 flex-1 min-w-0 cursor-pointer focus:outline-none focus:border-amber-500/50"
                        >
                          {MOTO_VEHICLE_MODEL_OPTIONS.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-[11.5px] text-amber-400 font-black shrink-0">
                          {dynamicMotoConsumption.toFixed(1).replace('.', ',')} km/L
                        </span>
                      </div>
                    )}
                    {motoModel === 'MOTTU_SPORT_110' && fuelVehicleType === 'MOTO' && (
                      <p className="w-full text-[11px] text-slate-500 leading-relaxed -mt-1 mb-2 px-0.5">
                        Consumo calculado em tempo real pela velocidade do GPS (torque/potência do motor 110i), faixa 20-80 km/L.
                        {mottuCalibrationSamples > 0 ? (
                          <> Calibração automática ativa: <strong className="text-amber-400">{mottuCalibrationSamples}</strong> {mottuCalibrationSamples === 1 ? 'medição real' : 'medições reais'} de abastecimentos/turnos ajustaram o cálculo em <strong className="text-amber-400">{(mottuCalibrationFactor * 100 - 100) >= 0 ? '+' : ''}{((mottuCalibrationFactor - 1) * 100).toFixed(0)}%</strong>.</>
                        ) : (
                          <> A cada abastecimento e fechamento de caixa, o sistema aprende e ajusta esse cálculo automaticamente para o consumo real da sua moto.</>
                        )}
                      </p>
                    )}

                    {/* Physical Instrument Gauge (SVG) */}
                    <div className="relative">
                      {fuelVehicleType === 'MOTO' ? (
                        // AMAZING MOTO INSTRUMENT CLUSTER EXACTLY LIKE THE IMAGE
                        <svg
                          width="240"
                          height="120"
                          className="relative select-none cursor-pointer"
                          style={{ overflow: 'visible' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            
                            // Scale click coordinates to the SVG viewbox (240x120)
                            const svgX = (clickX / rect.width) * 240;
                            const svgY = (clickY / rect.height) * 120;
                            
                            // Pivot of the physical moto dial in SVG space is at (185, 54)
                            const dx = svgX - 185;
                            const dy = svgY - 54;
                            
                            let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
                            if (angleDeg < 0) angleDeg += 360;
                            
                            // For moto, valid sweep is 105 to 195 degrees.
                            // If they click on the dial face, let's clamp the angle to [105, 195]
                            // and compute the percentage.
                            let targetAngle = angleDeg;
                            if (targetAngle > 195 && targetAngle < 300) {
                              targetAngle = 195;
                            } else if (targetAngle < 105 || targetAngle >= 300) {
                              targetAngle = 105;
                            }
                            
                            const targetPerc = Math.max(0, Math.min(100, ((targetAngle - 105) / 90) * 100));
                            const tickIndex = Math.round((targetPerc / 100) * totalTicks);
                            const snappedPerc = fuelVehicleType === 'MOTO'
                              ? (tickIndex <= 5 ? (tickIndex / 5) * 50 : 50 + ((tickIndex - 5) / 2) * 50)
                              : (tickIndex / totalTicks) * 100;
                            handleSetFuelTick(tickIndex, snappedPerc);
                          }}
                        >
                          <defs>
                            {/* Dashboard textured plastic plate */}
                            <linearGradient id="motoDashPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#2e3542" />
                              <stop offset="60%" stopColor="#1f242e" />
                              <stop offset="100%" stopColor="#11141b" />
                            </linearGradient>

                            {/* Pivot black textured cap */}
                            <radialGradient id="pivotCap" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                              <stop offset="0%" stopColor="#4b5563" />
                              <stop offset="50%" stopColor="#1f2937" />
                              <stop offset="100%" stopColor="#030712" />
                            </radialGradient>

                            {/* Shiny physical screw radial gradient */}
                            <radialGradient id="screwGrad" cx="35%" cy="35%" r="65%">
                              <stop offset="0%" stopColor="#f1f5f9" />
                              <stop offset="40%" stopColor="#cbd5e1" />
                              <stop offset="85%" stopColor="#64748b" />
                              <stop offset="100%" stopColor="#334155" />
                            </radialGradient>

                            {/* Red glow for warning region */}
                            <radialGradient id="redGlow" cx="64.1%" cy="110%" r="25%">
                              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.25)" />
                              <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                            </radialGradient>
                          </defs>

                          {/* Outer Dashboard cluster body with custom angled cuts */}
                          <path
                            d="M 12 12 L 228 12 C 234 12, 238 18, 236 26 L 226 98 C 224 104, 218 108, 210 108 L 30 108 C 22 108, 16 104, 14 98 L 4 26 C 2 18, 6 12, 12 12 Z"
                            fill="url(#motoDashPlate)"
                            stroke="#111827"
                            strokeWidth="3.5"
                            className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                          />

                          {/* Subtle inner shadow bezel ring */}
                          <path
                            d="M 14 14 L 226 14 L 216 96 C 215 101, 211 104, 205 104 L 35 104 C 29 104, 25 101, 24 96 Z"
                            fill="none"
                            stroke="#475569"
                            strokeWidth="1.2"
                            className="opacity-20"
                          />

                          {(() => {
                            // Angle for index 0 (0%) is 105 degrees.
                            // Angle for index 2 (28.57%) is 105 + (2/7)*90 = 130.71 degrees.
                            const rad0 = 105 * Math.PI / 180;
                            const rad2 = (105 + (2 / 7) * 90) * Math.PI / 180;
                            
                            const rx1 = 185 + 44 * Math.cos(rad0);
                            const ry1 = 54 + 44 * Math.sin(rad0);
                            const rx2 = 185 + 44 * Math.cos(rad2);
                            const ry2 = 54 + 44 * Math.sin(rad2);

                            return (
                              <>
                                {/* Red Warning Reserve Glow Sector */}
                                <path
                                  d={`M 185 54 L ${rx2} ${ry2} A 44 44 0 0 0 ${rx1} ${ry1} Z`}
                                  fill="url(#redGlow)"
                                  className="pointer-events-none"
                                />

                                {/* Red Alert warning bar at 0% to 28.57% (Reserve Zone) */}
                                <path
                                  d={`M ${rx1} ${ry1} A 44 44 0 0 1 ${rx2} ${ry2}`}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth="5.5"
                                />
                              </>
                            );
                          })()}

                          {/* White Scale Track Arc */}
                          <path
                            d="M 173.4 97.5 A 45 45 0 0 1 141.5 42.4"
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 173.4 97.5 A 45 45 0 0 1 141.5 42.4"
                            fill="none"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1.5"
                            strokeDasharray="2,5"
                          />

                          {/* Fuel pump white logo slightly tilted on the left of the dashboard (completely visible, not on top of ticks) */}
                          <g transform="translate(55, 46) rotate(-10) scale(0.68)" className="opacity-75 pointer-events-none">
                            {/* Rounded fuel pump body */}
                            <path d="M4 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Pump screen */}
                            <path d="M6 6h4v4H6z" stroke="#ffffff" strokeWidth="1.5" fill="none" />
                            {/* Pump hose nozzle detail */}
                            <path d="M14 18h2a2 2 0 0 0 2-2v-4a1 1 0 0 0-2 0" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" />
                          </g>

                          {/* Dynamic Interactive Ticks (Loop over allPositions) */}
                          {allPositions.map((item, idx) => {
                            const theta = item.angle;
                            const rad = theta * Math.PI / 180;
                            const isSelected = item.value === closestPos.value;
                            const isReserve = item.value === 2; // index 2 is RED reserve

                            // Determine tick size and style
                            const rInner = item.isMajor ? 40 : 43;
                            const rOuter = 48;

                            const x1 = 185 + rInner * Math.cos(rad);
                            const y1 = 54 + rInner * Math.sin(rad);
                            const x2 = 185 + rOuter * Math.cos(rad);
                            const y2 = 54 + rOuter * Math.sin(rad);

                            // Text coordinates (only for F, 1/2)
                            const rText = 58;
                            const tx = 185 + rText * Math.cos(rad);
                            const ty = 54 + rText * Math.sin(rad) + 4; // center text vertically

                            return (
                              <g key={idx} className="group cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                handleSetFuelTick(item.value, item.percentage);
                              }}>
                                {/* Clickable wider area around tick */}
                                <line
                                  x1={185 + 32 * Math.cos(rad)}
                                  y1={54 + 32 * Math.sin(rad)}
                                  x2={185 + 53 * Math.cos(rad)}
                                  y2={54 + 53 * Math.sin(rad)}
                                  stroke="rgba(0,0,0,0)"
                                  strokeWidth="16"
                                  strokeLinecap="round"
                                />

                                {/* Tick Line representation */}
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={isSelected ? '#f59e0b' : (isReserve ? '#ef4444' : '#f1f5f9')}
                                  strokeWidth={isSelected ? '3.5' : (item.isMajor ? '2.5' : '1.0')}
                                  strokeLinecap="butt"
                                  className="transition-all duration-150 group-hover:stroke-amber-400 group-hover:stroke-[3px]"
                                />

                                {/* Subtle glow for selected tick */}
                                {isSelected && (
                                  <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={isReserve ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    className="opacity-60 blur-[1px]"
                                  />
                                )}

                                {/* Tick Labels for F, 1/2 */}
                                {item.label && item.label !== 'R' && item.label !== 'E' && (
                                  <text
                                    x={tx}
                                    y={ty}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="1000"
                                    fill={isSelected ? '#f59e0b' : '#f1f5f9'}
                                    className="font-sans tracking-tight select-none cursor-pointer"
                                  >
                                    {item.label}
                                  </text>
                                )}

                                {/* Beautiful Red Reserve Badge with 'E' for Reserve tick */}
                                {item.label === 'E' && (
                                  <g transform={`translate(${tx - 1}, ${ty - 4})`} className="select-none cursor-pointer">
                                    <rect x="-4" y="-5" width="10" height="10" fill="#ef4444" rx="1.5" />
                                    <text
                                      x="1"
                                      y="3"
                                      textAnchor="middle"
                                      fontSize="8.5"
                                      fontWeight="1000"
                                      fill="#ffffff"
                                      className="font-sans"
                                    >
                                      E
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}

                          {/* Giant physical bezel dial/axis on the right */}
                          <circle cx="185" cy="54" r="23" fill="url(#pivotCap)" stroke="#0f172a" strokeWidth="2.5" className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" />
                          <circle cx="185" cy="54" r="13" fill="#111827" stroke="#374151" strokeWidth="1.5" />
                          
                          {/* Inner dark center pinning screw */}
                          <circle cx="185" cy="54" r="6.5" fill="#030712" />
                          <circle cx="185" cy="54" r="2.5" fill="#1f2937" />

                          {/* Decorative silver screw head on the bottom right */}
                          <circle cx="212" cy="94" r="5.5" fill="url(#screwGrad)" stroke="#111827" strokeWidth="1" />
                          <line x1="209.5" y1="91.5" x2="214.5" y2="96.5" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />

                          {/* Matte orange physical needle with dark axis pivot cover */}
                          {(() => {
                            // Needle rotation calculation based on non-linear mapping
                            let needleAngleDeg = 105;
                            if (fuelPercentage <= 0) {
                              needleAngleDeg = allPositions[0]?.angle ?? 105;
                            } else if (fuelPercentage >= 100) {
                              needleAngleDeg = allPositions[allPositions.length - 1]?.angle ?? 195;
                            } else {
                              for (let i = 0; i < allPositions.length - 1; i++) {
                                const p1 = allPositions[i].percentage;
                                const p2 = allPositions[i + 1].percentage;
                                if (fuelPercentage >= p1 && fuelPercentage <= p2) {
                                  const t = (p2 - p1) > 0 ? (fuelPercentage - p1) / (p2 - p1) : 0;
                                  const a1 = allPositions[i].angle;
                                  const a2 = allPositions[i + 1].angle;
                                  needleAngleDeg = a1 + t * (a2 - a1);
                                  break;
                                }
                              }
                            }
                            const rot = needleAngleDeg - 180;
                            return (
                              <g
                                style={{
                                  transform: `rotate(${rot}deg)`,
                                  transformOrigin: '185px 54px',
                                  transition: 'transform 1s cubic-bezier(0.25, 1.4, 0.5, 1)'
                                }}
                                className="pointer-events-none"
                              >
                                {/* Under-shadow of the physical needle */}
                                <polygon
                                  points="182,51 133,53.5 133,54.5 182,57"
                                  fill="rgba(0,0,0,0.4)"
                                  transform="translate(1, 2)"
                                />

                                {/* Tapered high-fidelity custom orange physical needle */}
                                <polygon
                                  points="182,51 133,53.5 133,54.5 182,57"
                                  fill="#ea580c"
                                />

                                {/* Needle bright orange top stripe highlight */}
                                <line
                                  x1="182"
                                  y1="54"
                                  x2="133"
                                  y2="54"
                                  stroke="#f97316"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />

                                {/* Tiny circle on needle root tail */}
                                <circle cx="182" cy="54" r="3.5" fill="#b91c1c" />
                              </g>
                            );
                          })()}
                        </svg>
                      ) : (
                        // Standard Car Instrument Gauge (already implemented)
                        <svg
                          width="240"
                          height="120"
                          className="relative select-none cursor-pointer"
                          style={{ overflow: 'visible' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            
                            const svgX = (clickX / rect.width) * 240;
                            const svgY = (clickY / rect.height) * 120;
                            const dx = svgX - 120;
                            const dy = svgY - 100;
                            
                            let angleRad = Math.atan2(dy, dx);
                            if (angleRad > 0) {
                              if (angleRad < Math.PI / 2) {
                                angleRad = 0;
                              } else {
                                angleRad = -Math.PI;
                              }
                            }
                            
                            let angleDeg = (angleRad * 180 / Math.PI) + 90;
                            angleDeg = Math.max(-90, Math.min(90, angleDeg));
                            const percentageVal = ((angleDeg + 90) / 180) * 100;
                            
                            const tickIndex = Math.round((percentageVal / 100) * totalTicks);
                            const snappedPerc = (tickIndex / totalTicks) * 100;
                            handleSetFuelTick(tickIndex, snappedPerc);
                          }}
                        >
                          <defs>
                            {/* Dashboard textured plastic plate */}
                            <linearGradient id="carDashPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#2e3542" />
                              <stop offset="60%" stopColor="#1f242e" />
                              <stop offset="100%" stopColor="#11141b" />
                            </linearGradient>
                          </defs>

                          {/* Outer Dashboard cluster body with custom angled cuts */}
                          <path
                            d="M 12 8 L 228 8 C 234 8, 238 14, 238 21 L 238 108 C 238 113, 234 116, 228 116 L 12 116 C 6 116, 2 113, 2 108 L 2 21 C 2 14, 6 8, 12 8 Z"
                            fill="url(#carDashPlate)"
                            stroke="#111827"
                            strokeWidth="3.5"
                            className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                          />

                          {/* Subtle inner shadow bezel ring */}
                          <path
                            d="M 14 10 L 226 10 C 231 10, 235 15, 235 21 L 235 106 C 235 111, 231 114, 226 114 L 14 114 C 9 114, 5 111, 5 106 L 5 21 C 5 15, 9 10, 14 10 Z"
                            fill="none"
                            stroke="#475569"
                            strokeWidth="1.2"
                            className="opacity-20"
                          />

                          {/* Dial Track Arc */}
                          <path
                            d="M 55 100 A 65 65 0 0 1 185 100"
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth="8"
                            strokeLinecap="round"
                          />
                          
                          {/* Decorative central pivot cluster */}
                          <circle cx="120" cy="100" r="14" fill="#0b0f19" stroke="#1e293b" strokeWidth="2" />
                          <circle cx="120" cy="100" r="6" fill="#1e293b" />
                          <circle cx="120" cy="100" r="2.5" fill="#ef4444" />

                          {/* Interactive Ticks */}
                          {allPositions.map((item, idx) => {
                            const theta = item.angle;
                            const isLow = item.percentage <= 15;
                            const isSelected = item.value === closestPos.value;
                            
                            const isLabeled = item.label !== undefined;
                            const outerR = item.isMajor ? 72 : 70;
                            const innerR = item.isMajor ? (isLabeled ? 56 : 62) : 66;
                            const { x1, y1, x2, y2 } = getTickCoords(theta, innerR, outerR);
                            
                            const labelRad = (theta - 90) * Math.PI / 180;
                            const lx = 120 + 86 * Math.cos(labelRad);
                            const ly = 100 + 86 * Math.sin(labelRad);

                            // Calculate coordinates that cover the entire region up to the labels for perfect click capture
                            const clickCoords = getTickCoords(theta, innerR - 6, 105);

                            return (
                              <g key={idx} className="group cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                handleSetFuelTick(item.value, item.percentage);
                              }}>
                                {/* Hover/Clickable wider line area around tick - extends past the label for easy clicking */}
                                <line
                                  x1={clickCoords.x1}
                                  y1={clickCoords.y1}
                                  x2={clickCoords.x2}
                                  y2={clickCoords.y2}
                                  stroke="rgba(0,0,0,0)"
                                  strokeWidth="22"
                                  strokeLinecap="round"
                                />

                                {/* Tick Line representation */}
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={isSelected ? '#f59e0b' : (item.isMajor ? (isLow ? '#ef4444' : '#475569') : (isLow ? 'rgba(239, 68, 68, 0.3)' : '#334155'))}
                                  strokeWidth={isSelected ? (item.isMajor ? '4' : '2.5') : (item.isMajor ? '2.5' : '1.0')}
                                  strokeLinecap="round"
                                  className="transition-all duration-150 group-hover:stroke-amber-400 group-hover:stroke-[3px]"
                                />

                                {/* Highlight dot if currently selected */}
                                {isSelected && (
                                  <circle
                                    cx={x2}
                                    cy={y2}
                                    r={item.isMajor ? "2.5" : "1.5"}
                                    fill="#f59e0b"
                                    className="animate-pulse"
                                  />
                                )}

                                {/* Tick Labels for major ticks */}
                                {item.label && (
                                  <text
                                    x={lx}
                                    y={ly + 3}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="900"
                                    fontFamily="monospace"
                                    fill={isSelected ? '#f59e0b' : (isLow ? '#ef4444' : '#64748b')}
                                    className="select-none cursor-pointer font-sans"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetFuelTick(item.value, item.percentage);
                                    }}
                                  >
                                    {item.label}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          {/* Small decorative gauge brand */}
                          <text x="120" y="68" textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold" className="opacity-40">⛽ FUEL</text>

                          {/* Physical Red Needle */}
                          <line
                            x1="120"
                            y1="100"
                            x2="120"
                            y2="38"
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            style={{
                              transform: `rotate(${needleAngle}deg)`,
                              transformOrigin: '120px 100px',
                              transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                            className="pointer-events-none drop-shadow-[0_2px_4px_rgba(239,68,68,0.4)]"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Digital status and major physical buttons below */}
                    <div className="w-full mt-3.5 text-center relative z-10">
                      <span className="block text-[12px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
                        Ajustar Ponteiro Manualmente:
                      </span>
                      
                      <div className={`grid gap-1 max-w-[280px] mx-auto ${
                        fuelVehicleType === 'MOTO' ? 'grid-cols-5' : 'grid-cols-7'
                      }`}>
                        {allPositions.filter(item => item.isMajor).map((item, i) => {
                          const isSelected = closestPos.value === item.value;
                          const btnLabel = getPrincipalBtnLabel(item.percentage);

                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSetFuelTick(item.value, item.percentage)}
                              className={`py-1 rounded text-[11px] font-black uppercase transition-all border ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10'
                                  : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
                              }`}
                              title={`Definir ponteiro para ${item.percentage.toFixed(1)}% (${((item.percentage/100)*activeCapacity).toFixed(1)}L)`}
                            >
                              {btnLabel}
                            </button>
                          );
                        })}
                      </div>
                      
                      <p className="text-sm text-slate-400 italic mt-2.5 leading-none">
                        *Clique diretamente em qualquer um dos {allPositions.length} traços ou nas letras para posicionar o ponteiro!
                      </p>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Monitoramento de Saldos das Plataformas */}
        <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-800/80 mt-2 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-4 border-b border-slate-900 pb-2.5">
            <h4 className="text-[14.5px] font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-sm">📱</span> Painel Unificado de Plataformas
            </h4>
            <span className="text-[12px] font-mono text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-900/40">
              Ganhos, taxas e saques do turno atual
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Uber Platform Panel Card */}
            <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/20 p-4 rounded-xl border border-slate-800/60 shadow-lg flex flex-col justify-between hover:border-slate-700/60 transition-all duration-300">
              <div>
                {/* Platform Header */}
                <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white text-slate-950 flex items-center justify-center font-black text-xs shadow-inner">
                      U
                    </div>
                    <div>
                      <span className="text-[14.5px] font-black uppercase text-white tracking-wider block">Uber Platform</span>
                      <span className="text-[12px] font-bold text-emerald-400 font-sans uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo no Turno
                      </span>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded-md text-[12px] font-mono font-black border tracking-wider ${
                    uberBalance >= 0 
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-sm shadow-emerald-950/20' 
                      : 'bg-rose-950/40 text-rose-400 border-rose-900/40 shadow-sm shadow-rose-950/20'
                  }`}>
                    {uberBalance >= 0 ? '● SALDO POSITIVO' : '▲ CONTA DEVEDORA'}
                  </span>
                </div>

                {/* 3x2 Grid for Advanced Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Metric 1: Valor da última corrida */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-cyan-400 block truncate">
                      R$ {formatDecimalBRL(uberWeekly.lastRideValue)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Última Corrida
                      </span>
                      <span className="block text-[14.5px] text-cyan-500 font-bold uppercase tracking-widest mt-0.5">
                        [Oferta App]
                      </span>
                    </div>
                  </div>

                  {/* Metric 2: Taxa Uber (esta semana) */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-rose-450 block truncate">
                      {uberWeekly.feePct.toFixed(1)}%
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Taxa Uber
                      </span>
                      <span className="block text-[14.5px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        Média Semanal
                      </span>
                    </div>
                  </div>

                  {/* Metric 3: Ganhos desta semana */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-slate-200 block truncate">
                      R$ {formatDecimalBRL(uberWeekly.weeklyTotalGanhos)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Ganhos Semana
                      </span>
                      <span className="block text-[14.5px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
                        Acumulado
                      </span>
                    </div>
                  </div>

                  {/* Metric 4: Ganhos pagos em dinheiro/pix */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-emerald-400 block truncate">
                      R$ {formatDecimalBRL(uberWeekly.weeklyGanhosDinheiro)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Pago Dinheiro/Pix
                      </span>
                      <span className="block text-[14.5px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">
                        Na Mão / Pix
                      </span>
                    </div>
                  </div>

                  {/* Metric 5: Ganhos pagos no app */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-indigo-200 block truncate">
                      R$ {formatDecimalBRL(uberWeekly.weeklyGanhosApp)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Pago no App
                      </span>
                      <span className="block text-[14.5px] text-indigo-500/80 font-bold uppercase tracking-widest mt-0.5">
                        Saldo Conta
                      </span>
                    </div>
                  </div>

                  {/* Metric 6: Corridas Concluídas */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-amber-400 block truncate">
                      {uberWeekly.weeklyRidesCount}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Total Corridas
                      </span>
                      <span className="block text-[14.5px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">
                        Média R$ {(uberWeekly.weeklyRidesCount > 0 ? (uberWeekly.weeklyTotalGanhos / uberWeekly.weeklyRidesCount) : 0).toFixed(1)}/cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance & Instant Cashout Section */}
                <div className={`mt-3.5 p-3 rounded-lg border transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
                  uberBalance > 0 
                    ? 'bg-emerald-950/25 border-emerald-500/30 shadow-md shadow-emerald-950/10' 
                    : 'bg-slate-950/80 border-slate-900/90'
                }`}>
                  <div className="flex flex-col items-center sm:items-start">
                    <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                      Saldo Disponível na Carteira
                    </span>
                    <span className={`font-mono text-lg font-black tracking-tight ${
                      uberBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'
                    }`}>
                      {uberBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(uberBalance)}
                    </span>
                  </div>
                  
                  {uberBalance > 0 && onAddTransaction ? (
                    <button
                      onClick={() => handleInitiateWithdrawal('UBER', uberBalance)}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-450 active:scale-95 text-slate-950 font-black py-1.5 px-4 rounded-md text-[12.5px] uppercase tracking-wider cursor-pointer transition-all duration-150 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 flex items-center justify-center gap-1.5 select-none"
                    >
                      <span>💸</span> SOLICITAR SAQUE
                    </button>
                  ) : uberBalance < 0 && onAddTransaction ? (
                    <button
                      onClick={() => handleInitiateDebtPayment('UBER', uberBalance)}
                      className="w-full sm:w-auto bg-rose-500 hover:bg-rose-450 active:scale-95 text-slate-950 font-black py-1.5 px-4 rounded-md text-[12.5px] uppercase tracking-wider cursor-pointer transition-all duration-150 shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 flex items-center justify-center gap-1.5 select-none"
                    >
                      <span>⚡</span> QUITAR COM PIX
                    </button>
                  ) : (
                    <span className="text-sm font-mono text-slate-600 font-bold uppercase tracking-tight text-center sm:text-right">
                      {uberBalance <= 0 ? 'Sem saldo para saque' : 'Função de saque indisponível'}
                    </span>
                  )}
                </div>
              </div>

              {/* Extended Footer Metadata */}
              <div className="text-[12px] text-slate-400 font-mono mt-3.5 border-t border-slate-850/50 pt-2 flex flex-wrap gap-y-1 justify-between">
                <div>Inicial: <span className="text-slate-200">R$ {formatDecimalBRL(activeShift.initialUberBalance ?? 0)}</span></div>
                <div>Delta: <span className={uberBalanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{uberBalanceDelta >= 0 ? '+' : ''}R$ {formatDecimalBRL(uberBalanceDelta)}</span></div>
                {uberWithdrawals > 0 && <div>Saques: <span className="text-amber-500 font-bold">R$ {formatDecimalBRL(uberWithdrawals)}</span></div>}
                <div className="text-cyan-400 font-bold">{uberKM.toFixed(1)} km rodados</div>
              </div>
            </div>

            {/* 99 App Platform Panel Card */}
            <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/20 p-4 rounded-xl border border-slate-800/60 shadow-lg flex flex-col justify-between hover:border-slate-700/60 transition-all duration-300">
              <div>
                {/* Platform Header */}
                <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-inner">
                      99
                    </div>
                    <div>
                      <span className="text-[14.5px] font-black uppercase text-white tracking-wider block">99 App Platform</span>
                      <span className="text-[12px] font-bold text-emerald-400 font-sans uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 animate-pulse"></span> Ativo no Turno
                      </span>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded-md text-[12px] font-mono font-black border tracking-wider ${
                    ninetyNineBalance >= 0 
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-sm shadow-emerald-950/20' 
                      : 'bg-rose-950/40 text-rose-400 border-rose-900/40 shadow-sm shadow-rose-950/20'
                  }`}>
                    {ninetyNineBalance >= 0 ? '● SALDO POSITIVO' : '▲ CONTA DEVEDORA'}
                  </span>
                </div>

                {/* 3x2 Grid for Advanced Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Metric 1: Valor da última corrida */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-cyan-400 block truncate">
                      R$ {formatDecimalBRL(ninetyNineWeekly.lastRideValue)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Última Corrida
                      </span>
                      <span className="block text-[14.5px] text-cyan-500 font-bold uppercase tracking-widest mt-0.5">
                        [Oferta App]
                      </span>
                    </div>
                  </div>

                  {/* Metric 2: Taxa 99 (esta semana) */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-rose-455 block truncate">
                      {ninetyNineWeekly.feePct.toFixed(1)}%
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Taxa 99 App
                      </span>
                      <span className="block text-[14.5px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        Média Semanal
                      </span>
                    </div>
                  </div>

                  {/* Metric 3: Ganhos desta semana */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-slate-200 block truncate">
                      R$ {formatDecimalBRL(ninetyNineWeekly.weeklyTotalGanhos)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Ganhos Semana
                      </span>
                      <span className="block text-[14.5px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
                        Acumulado
                      </span>
                    </div>
                  </div>

                  {/* Metric 4: Ganhos pagos em dinheiro/pix */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-emerald-400 block truncate">
                      R$ {formatDecimalBRL(ninetyNineWeekly.weeklyGanhosDinheiro)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Pago Dinheiro/Pix
                      </span>
                      <span className="block text-[14.5px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">
                        Na Mão / Pix
                      </span>
                    </div>
                  </div>

                  {/* Metric 5: Ganhos pagos no app */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-indigo-200 block truncate">
                      R$ {formatDecimalBRL(ninetyNineWeekly.weeklyGanhosApp)}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Pago no App
                      </span>
                      <span className="block text-[14.5px] text-indigo-500/80 font-bold uppercase tracking-widest mt-0.5">
                        Saldo Conta
                      </span>
                    </div>
                  </div>

                  {/* Metric 6: Corridas Concluídas */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-900 text-center flex flex-col justify-between min-h-[62px] hover:border-slate-800 transition-colors">
                    <span className="font-mono text-xs sm:text-[13px] font-black text-amber-400 block truncate">
                      {ninetyNineWeekly.weeklyRidesCount}
                    </span>
                    <div className="mt-1">
                      <span className="block text-[14.5px] text-slate-400 font-extrabold uppercase tracking-tight leading-none">
                        Total Corridas
                      </span>
                      <span className="block text-[14.5px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">
                        Média R$ {(ninetyNineWeekly.weeklyRidesCount > 0 ? (ninetyNineWeekly.weeklyTotalGanhos / ninetyNineWeekly.weeklyRidesCount) : 0).toFixed(1)}/cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance & Instant Cashout Section */}
                <div className={`mt-3.5 p-3 rounded-lg border transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
                  ninetyNineBalance > 0 
                    ? 'bg-emerald-950/25 border-emerald-500/30 shadow-md shadow-emerald-950/10' 
                    : 'bg-slate-950/80 border-slate-900/90'
                }`}>
                  <div className="flex flex-col items-center sm:items-start">
                    <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                      Saldo Disponível na Carteira
                    </span>
                    <span className={`font-mono text-lg font-black tracking-tight ${
                      ninetyNineBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'
                    }`}>
                      {ninetyNineBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(ninetyNineBalance)}
                    </span>
                  </div>
                  
                  {ninetyNineBalance > 0 && onAddTransaction ? (
                    <button
                      onClick={() => handleInitiateWithdrawal('99', ninetyNineBalance)}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-450 active:scale-95 text-slate-950 font-black py-1.5 px-4 rounded-md text-[12.5px] uppercase tracking-wider cursor-pointer transition-all duration-150 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 flex items-center justify-center gap-1.5 select-none"
                    >
                      <span>💸</span> SOLICITAR SAQUE
                    </button>
                  ) : ninetyNineBalance < 0 && onAddTransaction ? (
                    <button
                      onClick={() => handleInitiateDebtPayment('99', ninetyNineBalance)}
                      className="w-full sm:w-auto bg-rose-500 hover:bg-rose-450 active:scale-95 text-slate-950 font-black py-1.5 px-4 rounded-md text-[12.5px] uppercase tracking-wider cursor-pointer transition-all duration-150 shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 flex items-center justify-center gap-1.5 select-none"
                    >
                      <span>⚡</span> QUITAR COM PIX
                    </button>
                  ) : (
                    <span className="text-sm font-mono text-slate-600 font-bold uppercase tracking-tight text-center sm:text-right">
                      {ninetyNineBalance <= 0 ? 'Sem saldo para saque' : 'Função de saque indisponível'}
                    </span>
                  )}
                </div>
              </div>

              {/* Extended Footer Metadata */}
              <div className="text-[12px] text-slate-400 font-mono mt-3.5 border-t border-slate-850/50 pt-2 flex flex-wrap gap-y-1 justify-between">
                <div>Inicial: <span className="text-slate-200">R$ {formatDecimalBRL(activeShift.initial99Balance ?? 0)}</span></div>
                <div>Delta: <span className={ninetyNineBalanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{ninetyNineBalanceDelta >= 0 ? '+' : ''}R$ {formatDecimalBRL(ninetyNineBalanceDelta)}</span></div>
                {ninetyNineWithdrawals > 0 && <div>Saques: <span className="text-amber-500 font-bold">R$ {formatDecimalBRL(ninetyNineWithdrawals)}</span></div>}
                <div className="text-cyan-400 font-bold">{ninetyNineKM.toFixed(1)} km rodados</div>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-slate-500 italic mt-3 leading-snug">
            * Para corridas pagas "Direto no App" (📱), o valor líquido da corrida é somado ao saldo. Para corridas diretas (Dinheiro/Pix/Cartão), a taxa da plataforma é descontada do saldo.
          </p>
        </div>

        {/* Efficiency Panel */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[14px] font-mono text-slate-400">
          <div className="border-t border-slate-800 pt-2.5">
            <span className="text-[12px] uppercase text-slate-500 block">Faturamento / Hora</span>
            <span className="font-extrabold text-slate-200 text-xs">
              R$ {formatDecimalBRL(totalIn / durationHours)}/h
            </span>
          </div>
          <div className="border-t border-slate-800 pt-2.5">
            <span className="text-[12px] uppercase text-slate-500 block">Uber Média Corrida</span>
            <span className="font-extrabold text-slate-200 text-xs">
              R$ {formatDecimalBRL(uberAverage)}
            </span>
          </div>
          <div className="border-t border-slate-800 pt-2.5">
            <span className="text-[12px] uppercase text-slate-500 block">99 Média Corrida</span>
            <span className="font-extrabold text-slate-200 text-xs">
              R$ {formatDecimalBRL(ninetyNineAverage)}
            </span>
          </div>
          <div className="border-t border-slate-800 pt-2.5">
            <span className="text-[12px] uppercase text-slate-500 block">Lucro Líquido Esperado</span>
            <span className="font-extrabold text-emerald-400 text-xs">
              R$ {formatDecimalBRL(totalIn - totalOut)}
            </span>
          </div>
        </div>

        {/* Histórico rápido de corridas deste turno */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
              <span>📋 Corridas do Turno Atual ({transactions.length})</span>
            </span>
            {transactions.length > 0 && (
              <span className="text-[12px] font-mono text-slate-500 uppercase">
                Média: R$ {formatDecimalBRL(totalIn / (rides.length || 1))}
              </span>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-slate-800 rounded-lg text-slate-500 text-[14px] bg-slate-950/20">
              Nenhuma corrida cadastrada neste turno.
              <span className="block text-[12px] opacity-70 mt-0.5">Lançar no painel numérico à esquerda.</span>
            </div>
          ) : (
            <div className="space-y-1 max-h-[190px] overflow-y-auto pr-0.5 scrollbar-thin">
              {[...transactions].reverse().map((t) => {
                const isIncome = t.type === 'IN';
                const timeStr = new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div 
                    key={t.id} 
                    onClick={() => {
                      setSelectedTx(t);
                      playBeep();
                    }}
                    className="flex items-center justify-between p-2 bg-slate-950/70 border border-slate-850 hover:border-slate-800 rounded-lg text-[14px] font-mono transition-all hover:bg-slate-900/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.platform === 'UBER' ? 'bg-slate-300' : 'bg-amber-500'}`} title={t.platform} />
                      <span className="truncate">
                        <strong className="text-slate-310">{timeStr}</strong>{' '}
                        <span className={isIncome ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {isIncome ? (t.category === 'GORJETA' ? 'GORJETA' : 'CORRIDA') : t.category}
                        </span>
                        {t.description && <span className="text-slate-500 text-[12.5px] ml-1">({t.description})</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={`${isIncome ? 'text-emerald-400 font-extrabold' : 'text-rose-400'} font-bold block`}>
                          {isIncome ? '+' : '-'}R$ {formatDecimalBRL(t.value)}
                        </span>
                        {isIncome && t.tipValue !== undefined && t.tipValue > 0 && (
                          <span className="text-[11px] text-amber-400 font-black block leading-none mt-0.5">
                            + R$ {formatDecimalBRL(t.tipValue)} 🥳
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(t);
                          playBeep();
                        }}
                        className="text-slate-500 hover:text-amber-500 p-1 rounded hover:bg-slate-900/60 border border-transparent hover:border-slate-800 transition-all"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteTransaction && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(t.id);
                          }}
                          className="text-slate-500 hover:text-rose-455 p-1 rounded hover:bg-slate-900/60 border border-transparent hover:border-slate-800 transition-all"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* DETAILED TRANSACTION MODAL DIALOG */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Top Banner Accent */}
              <div className={`h-1.5 w-full ${selectedTx.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

              <div className="p-5 border-b border-slate-900 flex justify-between items-start bg-slate-950">
                <div>
                  <span className={`text-[12px] font-black font-mono border px-2 py-0.5 rounded tracking-widest uppercase inline-block mb-1.5 ${
                    selectedTx.type === 'IN' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-900/60' 
                      : 'bg-rose-500/10 text-rose-455 border-rose-950/65'
                  }`}>
                    {selectedTx.type === 'IN' ? 'Entrada / Corrida' : 'Saída / Despesa'}
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    Detalhes do Lançamento
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTx(null);
                    playBeep();
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-850 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Core Contents */}
              <div className="p-5 space-y-4.5 max-h-[72vh] overflow-y-auto scrollbar-thin">
                {/* Platform info card */}
                <div className="bg-slate-905/40 border border-slate-850/80 rounded-xl p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2 font-sans">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span className="text-slate-400 font-medium">Plataforma Atribuída:</span>
                  </div>
                  <div>
                    {selectedTx.platform === 'UBER' ? (
                      <span className="bg-white text-slate-955 font-black font-mono text-[12.5px] py-1 px-3 rounded-full border border-slate-705">UBER</span>
                    ) : selectedTx.platform === '99' ? (
                      <span className="bg-amber-500 text-slate-955 font-black font-mono text-[12.5px] py-1 px-3 rounded-full">99 APP</span>
                    ) : (
                      <span className="bg-slate-800 text-slate-300 font-bold font-mono text-[12.5px] py-1 px-3 rounded-full uppercase">GERAL</span>
                    )}
                  </div>
                </div>

                {/* Main Details and Values list */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-900 font-sans">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Data do Registro:
                    </span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {new Date(selectedTx.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-900 font-sans">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      Descrição / Nota:
                    </span>
                    <span className="font-semibold text-white tracking-wide max-w-[210px] truncate text-right">
                      {selectedTx.description || 'Nenhum detalhe inserido'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-900 font-sans">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-slate-505" />
                      Forma de Recebimento:
                    </span>
                    <span className="font-bold text-slate-200">
                      {selectedTx.paymentMethod || 'PIX'}
                    </span>
                  </div>

                  {selectedTx.km !== undefined && (
                    <div className="flex justify-between py-1 border-b border-slate-900 font-sans">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        Quilômetros Rodados:
                      </span>
                      <span className="font-black text-amber-500 font-mono">
                        {selectedTx.km.toString()} KM
                      </span>
                    </div>
                  )}
                </div>

                {/* SPECIFIC PROFIT CALCULATOR & DETAILED VALUE BREAKDOWNS for RIDE (IN) */}
                {selectedTx.type === 'IN' ? (
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-3 font-mono">
                    <h4 className="text-[13px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      {selectedTx.category === 'SAQUE_APP' ? 'Balanço do Saque' : 'DRE / Balanço da Corrida (Faturamento)'}
                    </h4>
                    
                    <div className="space-y-1.5 text-xs">
                      {selectedTx.category === 'SAQUE_APP' ? (
                        <>
                          <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-800/60">
                            <span className="text-slate-350 font-bold">Valor Bruto do Saque:</span>
                            <span className="font-extrabold text-white text-sm">
                              R$ {formatDecimalBRL(selectedTx.value)}
                            </span>
                          </div>
                          {selectedTx.withdrawalFee !== undefined && selectedTx.withdrawalFee > 0 && (
                            <div className="flex justify-between items-center text-rose-400 pt-1.5">
                              <span>(-) Taxa de Saque Cobrada:</span>
                              <span className="font-bold">
                                - R$ {formatDecimalBRL(selectedTx.withdrawalFee)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-slate-850 pt-2.5 mt-2.5 font-black text-emerald-400">
                            <span>Valor Líquido Recebido:</span>
                            <span className="text-sm">
                              R$ {formatDecimalBRL(selectedTx.value - (selectedTx.withdrawalFee || 0))}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 1. Faturamento Total Real */}
                          <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-800/60">
                            <span className="text-slate-350 font-bold">Faturamento Real Entrado (Bruto):</span>
                            <span className="font-extrabold text-emerald-400 text-sm">
                              R$ {formatDecimalBRL(selectedTx.value)}
                            </span>
                          </div>

                          {selectedTx.appOfferValue !== undefined && selectedTx.passengerAppValue !== undefined ? (
                            <>
                              {/* Valor que foi ofertado pelo app */}
                              <div className="flex justify-between items-center pt-1">
                                <span className="text-slate-400">Valor Ofertado pelo App:</span>
                                <span className="font-bold text-slate-300">
                                  R$ {formatDecimalBRL(selectedTx.appOfferValue)}
                                </span>
                              </div>

                              {/* Valor que o passageiro pagou à plataforma */}
                              <div className="flex justify-between items-center pt-1">
                                <span className="text-slate-400">Pago pelo Passageiro no App:</span>
                                <span className="font-bold text-slate-300">
                                  R$ {formatDecimalBRL(selectedTx.passengerAppValue)}
                                </span>
                              </div>

                              {/* Valor cobrado a mais pelo motorista */}
                              {selectedTx.extraChargedValue !== undefined && selectedTx.extraChargedValue > 0 && (
                                <div className="flex justify-between items-center text-amber-400 pb-1.5 mb-1.5 border-b border-dashed border-slate-800">
                                  <span>(+) Cobrado por Fora (Extra):</span>
                                  <span className="font-extrabold">
                                    + R$ {formatDecimalBRL(selectedTx.extraChargedValue)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Valor Pago Passageiro (Bruto) fallback */}
                              <div className="flex justify-between items-center pt-1">
                                <span className="text-slate-400">Valor Pago pelo Passageiro:</span>
                                <span className="font-bold text-slate-300">
                                  R$ {formatDecimalBRL(selectedTx.value)}
                                </span>
                              </div>
                            </>
                          )}

                          {/* Valor da Gorjeta */}
                          {selectedTx.tipValue !== undefined && selectedTx.tipValue > 0 && (
                            <div className="flex justify-between items-center text-emerald-400 pt-1 border-t border-dashed border-slate-800/60 mt-1 pb-1">
                              <span className="flex items-center gap-1">
                                <span>🥳</span> Gorjeta Recebida:
                              </span>
                              <span className="font-extrabold">
                                + R$ {formatDecimalBRL(selectedTx.tipValue)}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* KM rodado metrics */}
                      {selectedTx.km !== undefined && selectedTx.km > 0 && (
                        (() => {
                          const activeCons = fuelVehicleType === 'CARRO' ? carConsumption : dynamicMotoConsumption;
                          const fTxs = activeShift?.transactions?.filter(t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || t.pricePerLiter !== undefined) && t.pricePerLiter !== undefined && t.pricePerLiter > 0) || [];
                          const avgPrice = fTxs.length > 0 
                            ? fTxs.reduce((sum, t) => sum + (t.pricePerLiter || 0), 0) / fTxs.length 
                            : 5.89;
                          const costPerKm = avgPrice / activeCons;
                          const rideFuelCost = (selectedTx.km || 0) * costPerKm;

                          return (
                            <div className="border-t border-dashed border-slate-800 pt-2 mt-1 space-y-1.5 text-[14.5px]">
                              {/* Valor recebido por KM rodado */}
                              <div className="flex justify-between text-slate-400">
                                <span>Faturamento por KM:</span>
                                <span className="font-semibold text-slate-300 font-mono">R$ {formatDecimalBRL(selectedTx.value / (selectedTx.km || 1))} / km</span>
                              </div>

                              {/* Consumo real do veículo */}
                              <div className="flex justify-between text-cyan-400">
                                <span>Consumo Real do Veículo:</span>
                                <span className="font-mono font-bold">{typeof activeCons === 'number' ? activeCons.toFixed(2).replace('.', ',') : activeCons} km/L ({fuelVehicleType === 'CARRO' ? '🚗 Carro' : '🏍️ Moto'})</span>
                              </div>

                              {/* Combustível Gasto Real */}
                              <div className="flex justify-between text-slate-400">
                                <span>Combustível Gasto na Corrida:</span>
                                <span className="font-mono text-amber-500 font-bold">{((selectedTx.km || 0) / activeCons).toFixed(3).replace('.', ',')} L</span>
                              </div>

                              <div className="flex justify-between text-slate-400">
                                <span>Preço Médio do Litro (Shift):</span>
                                <span className="font-mono text-slate-300">R$ {formatDecimalBRL(avgPrice)}/L</span>
                              </div>

                              {/* Lucro operacional real */}
                              <div className="flex justify-between text-rose-500 border-t border-dotted border-slate-800 pt-2 mt-1">
                                <span>(-) Custo Real do Combustível:</span>
                                <span>- R$ {formatDecimalBRL(rideFuelCost)}</span>
                              </div>
                              
                              <div className="flex justify-between text-xs font-black text-emerald-450 pt-1.5 border-t border-slate-800">
                                <span>SALDO OPERACIONAL RESTANTE (REAL):</span>
                                <span className="text-sm bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black">
                                  R$ {formatDecimalBRL(selectedTx.value - rideFuelCost)}
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Pro tip or disclaimer */}
                    <div className="text-[12.5px] text-slate-505 font-sans leading-relaxed pt-1.5 border-t border-slate-850 border-dashed">
                      {(() => {
                        const activeCons = fuelVehicleType === 'CARRO' ? carConsumption : dynamicMotoConsumption;
                        const fTxs = activeShift?.transactions?.filter(t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || t.pricePerLiter !== undefined) && t.pricePerLiter !== undefined && t.pricePerLiter > 0) || [];
                        const avgPrice = fTxs.length > 0 
                          ? fTxs.reduce((sum, t) => sum + (t.pricePerLiter || 0), 0) / fTxs.length 
                          : 5.89;
                        return (
                          <span>💡 <strong>Métrica de Combustível Real:</strong> Calculada com base no consumo configurado para seu veículo (<strong>{typeof activeCons === 'number' ? activeCons.toFixed(2).replace('.', ',') : activeCons} km/L</strong>) e preço médio real de abastecimentos de <strong>R$ {formatDecimalBRL(avgPrice)}/L</strong>.</span>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  /* RENDER DETAILED OUTFLOW OUT CARD */
                  selectedTx.category === 'COMBUSTIVEL' || selectedTx.liters !== undefined ? (
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                      <h4 className="text-[14px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1 border-b border-slate-800 pb-2">
                        <span>⛽</span> DETALHES DO ABASTECIMENTO
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Valor Total Pago:</span>
                        <span className="font-extrabold text-white">R$ {formatDecimalBRL(selectedTx.value)}</span>
                      </div>
                      {selectedTx.liters !== undefined && selectedTx.liters > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quantidade Abastecida:</span>
                          <span className="font-cyan-400 font-extrabold">{selectedTx.liters.toFixed(3).replace('.', ',')} L</span>
                        </div>
                      )}
                      {selectedTx.pricePerLiter !== undefined && selectedTx.pricePerLiter > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Preço por Litro:</span>
                          <span className="font-extrabold text-amber-400">R$ {formatDecimalBRL(selectedTx.pricePerLiter)}/L</span>
                        </div>
                      )}
                      {selectedTx.odometer !== undefined && selectedTx.odometer > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Hodômetro Registrado:</span>
                          <span className="font-extrabold text-emerald-400">{selectedTx.odometer} KM</span>
                        </div>
                      )}

                      {(() => {
                        const txRefuels = activeShift?.transactions
                          ? activeShift.transactions
                              .filter(t => (t.category === 'COMBUSTIVEL' || t.liters !== undefined) && t.odometer !== undefined && t.odometer > 0)
                              .sort((a, b) => (a.odometer || 0) - (b.odometer || 0))
                          : [];
                        const txIndex = txRefuels.findIndex(t => t.id === selectedTx.id);
                        const previousOdo = txIndex > 0 ? txRefuels[txIndex - 1].odometer : activeShift?.initialOdometer;
                        const distCovered = (selectedTx.odometer && previousOdo && selectedTx.odometer > previousOdo)
                          ? selectedTx.odometer - previousOdo
                          : undefined;
                        const legCons = (distCovered && selectedTx.liters && selectedTx.liters > 0)
                          ? distCovered / selectedTx.liters
                          : undefined;

                        if (legCons !== undefined && distCovered !== undefined) {
                          return (
                            <div className="bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-lg space-y-1 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-amber-400 font-black">Consumo Parcial Real:</span>
                                <span className="font-black text-white">{legCons.toFixed(1).replace('.', ',')} KM/L</span>
                              </div>
                              <p className="text-[12px] font-sans text-slate-400 leading-normal">
                                O veículo rodou <strong className="text-white font-mono">{distCovered} KM</strong> com <strong className="text-white font-mono">{selectedTx.liters?.toFixed(3).replace('.', ',')} L</strong> desde o {txIndex > 0 ? 'abastecimento anterior' : 'início do turno'} (<strong className="text-white font-mono">{previousOdo} KM</strong>).
                              </p>
                            </div>
                          );
                        }
                        return (
                          <p className="text-[12px] font-sans text-slate-505 leading-relaxed bg-slate-950/45 p-2 rounded-lg border border-slate-850/80 mt-1">
                            💡 Registre o hodômetro em cada abastecimento para acompanhar o consumo parcial real (KM/L) de cada etapa de rodagem.
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2.5 font-mono">
                      <h4 className="text-[14px] font-extrabold text-rose-455 uppercase tracking-widest flex items-center gap-1 border-b border-slate-800 pb-2">
                        <ArrowDownRight className="w-4 h-4 text-rose-455" />
                        SAÍDA OPERACIONAL REGISTRADA
                      </h4>
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-slate-400">Total Pago/Retirado:</span>
                        <span className="font-extrabold text-rose-455 text-sm">R$ {formatDecimalBRL(selectedTx.value)}</span>
                      </div>
                      <p className="text-[13px] font-sans text-slate-500 leading-normal pt-1 border-t border-slate-850">
                        As saídas operacionais deduzem diretamente o saldo do seu bico/turno ou do fundo de caixa físico.
                      </p>
                    </div>
                  )
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-900/30 border-t border-slate-900 flex justify-between items-center gap-2">
                {onDeleteTransaction && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedTx.id;
                      setSelectedTx(null);
                      onDeleteTransaction(id);
                    }}
                    className="flex items-center justify-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-white border border-rose-950/50 hover:border-rose-900 font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Registro
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTx(null);
                    playBeep();
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider transition-all ml-auto"
                >
                  Fechar Detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FECHAMENTO DE CAIXA MODAL DIALOG STYLE */}
      <AnimatePresence>
        {isClosingOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-4.5 shadow-xl relative"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wide">Relatório de Fechamento de Caixa</h3>
                </div>
                <button
                  onClick={() => setIsClosingOpen(false)}
                  className="text-slate-500 hover:text-white text-xs font-bold font-mono px-1 bg-slate-950/60 rounded"
                >
                  ESC
                </button>
              </div>

              <div className="space-y-3">
                {/* Physical Drawer variance analysis */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-805 space-y-2 text-[14px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Saldo Abertura:</span>
                    <span className="font-mono text-slate-350">R$ {formatDecimalBRL(activeShift.initialBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Arrecadado:</span>
                    <span className="font-mono text-emerald-400">+R$ {formatDecimalBRL(totalIn)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Gastos Registrados:</span>
                    <span className="font-mono text-rose-500">-R$ {formatDecimalBRL(totalOut)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-1.5 flex justify-between items-center font-bold text-xs">
                    <span className="text-white">Lucro Líquido Esperado:</span>
                    <span className="font-mono text-white text-xs">R$ {formatDecimalBRL(totalIn - totalOut)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[14px] text-amber-500 font-semibold bg-amber-500/5 p-1 rounded border border-amber-950/20">
                    <span>💵 Dinheiro Físico Esperado (Bolso):</span>
                    <span className="font-mono font-black">R$ {formatDecimalBRL(expectedPocketCash)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[14px] text-cyan-400 font-semibold bg-cyan-500/5 p-1 rounded border border-cyan-950/20">
                    <span>⚡ Saldo Pix Esperado (Conta):</span>
                    <span className="font-mono font-black">R$ {formatDecimalBRL(expectedPixBalance)}</span>
                  </div>
                </div>

                {/* App Fees & Commissions audit */}
                {(() => {
                  const platformRides = rides.filter(t => t.platform === 'UBER' || t.platform === '99');
                  const platformRidesWithPass = platformRides.filter(t => t.passengerValue !== undefined || t.passengerAppValue !== undefined);
                  
                  const uberRidesWithPass = rides.filter(t => t.platform === 'UBER' && (t.passengerValue !== undefined || t.passengerAppValue !== undefined));
                  const uberPassengerApp = uberRidesWithPass.reduce((s, t) => s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value)), 0);
                  const uberAppOffer = uberRidesWithPass.reduce((s, t) => s + (t.appOfferValue !== undefined ? t.appOfferValue : t.value), 0);
                  const uberExtraCharged = uberRidesWithPass.reduce((s, t) => s + (t.extraChargedValue || 0), 0);
                  const uberFees = uberPassengerApp - uberAppOffer;
                  const uberFeePct = uberPassengerApp > 0 ? (uberFees / uberPassengerApp) * 100 : 0;

                  const ninetyNineRidesWithPass = rides.filter(t => t.platform === '99' && (t.passengerValue !== undefined || t.passengerAppValue !== undefined));
                  const ninetyNinePassengerApp = ninetyNineRidesWithPass.reduce((s, t) => s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value)), 0);
                  const ninetyNineAppOffer = ninetyNineRidesWithPass.reduce((s, t) => s + (t.appOfferValue !== undefined ? t.appOfferValue : t.value), 0);
                  const ninetyNineExtraCharged = ninetyNineRidesWithPass.reduce((s, t) => s + (t.extraChargedValue || 0), 0);
                  const ninetyNineFees = ninetyNinePassengerApp - ninetyNineAppOffer;
                  const ninetyNineFeePct = ninetyNinePassengerApp > 0 ? (ninetyNineFees / ninetyNinePassengerApp) * 100 : 0;

                  const totalPassengerApp = uberPassengerApp + ninetyNinePassengerApp;
                  const particularRides = rides.filter(t => t.platform === 'PARTICULAR');
                  const particularExtra = particularRides.reduce((s, t) => s + t.value, 0);
                  const totalExtraCharged = uberExtraCharged + ninetyNineExtraCharged + particularExtra;
                  const totalFees = uberFees + ninetyNineFees;
                  const totalFeePct = totalPassengerApp > 0 ? (totalFees / totalPassengerApp) * 100 : 0;
                  const netResult = totalExtraCharged - totalFees;

                  if (platformRides.length === 0) return null;

                  return (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-805 space-y-2.5 text-[14px]">
                      <h4 className="text-[14px] font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">📱 Auditoria de Taxas dos Apps</span>
                        <span className="text-[12px] font-normal text-slate-500 font-mono">({platformRides.length} Corridas)</span>
                      </h4>
                      
                      <div className="space-y-2">
                        {/* Overall totals */}
                        <div className="grid grid-cols-2 gap-2 pb-1.5 border-b border-slate-900">
                          <div>
                            <span className="text-slate-500 block text-[12px] uppercase font-bold">Pago pelo Passageiro no App</span>
                            <span className="font-mono text-white font-bold">R$ {formatDecimalBRL(totalPassengerApp)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[12px] uppercase font-bold">Total Retido de Taxa</span>
                            <span className="font-mono text-rose-400 font-black">R$ {formatDecimalBRL(totalFees)} ({totalFeePct.toFixed(1)}%)</span>
                          </div>
                        </div>

                        {/* App Specific rows */}
                        {uberRidesWithPass.length > 0 && (
                          <div className="flex justify-between items-center text-[14px] font-mono">
                            <span className="text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span> Uber:
                            </span>
                            <span className="text-slate-350">
                              App: <strong className="text-white">R$ {formatDecimalBRL(uberPassengerApp)}</strong> | 
                              Taxa: <strong className="text-rose-450">R$ {formatDecimalBRL(uberFees)} ({uberFeePct.toFixed(1)}%)</strong>
                            </span>
                          </div>
                        )}

                        {ninetyNineRidesWithPass.length > 0 && (
                          <div className="flex justify-between items-center text-[14px] font-mono">
                            <span className="text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> 99 App:
                            </span>
                            <span className="text-slate-350">
                              App: <strong className="text-white">R$ {formatDecimalBRL(ninetyNinePassengerApp)}</strong> | 
                              Taxa: <strong className="text-rose-450">R$ {formatDecimalBRL(ninetyNineFees)} ({ninetyNineFeePct.toFixed(1)}%)</strong>
                            </span>
                          </div>
                        )}

                        {/* COMPARISON BREAKDOWN */}
                        <div className="bg-slate-900/40 p-2 rounded border border-slate-805 space-y-1 mt-1">
                          <div className="flex justify-between items-center text-[12px] font-black uppercase text-amber-500 border-b border-slate-800 pb-1 mb-1">
                            <span>⚖️ Comparação App vs Cobrança Extra</span>
                            <span>Lucro / Prejuízo</span>
                          </div>
                          <div className="flex justify-between text-[13px] font-mono leading-tight">
                            <span className="text-slate-500">Total Pago na Plataforma (App):</span>
                            <span className="text-slate-300 font-bold">R$ {formatDecimalBRL(totalPassengerApp)}</span>
                          </div>
                          <div className="flex justify-between text-[13px] font-mono leading-tight">
                            <span className="text-slate-500">Total Pedido Por Fora (Extra):</span>
                            <span className="text-emerald-400 font-black">+R$ {formatDecimalBRL(totalExtraCharged)}</span>
                          </div>
                          <div className="flex justify-between text-[11.5px] font-mono leading-tight pl-3 text-slate-450">
                            <span>↳ Uber Extra:</span>
                            <span>+R$ {formatDecimalBRL(uberExtraCharged)}</span>
                          </div>
                          <div className="flex justify-between text-[11.5px] font-mono leading-tight pl-3 text-slate-450">
                            <span>↳ 99 App Extra:</span>
                            <span>+R$ {formatDecimalBRL(ninetyNineExtraCharged)}</span>
                          </div>
                          {particularExtra > 0 && (
                            <div className="flex justify-between text-[11.5px] font-mono leading-tight pl-3 text-slate-450">
                              <span>↳ Particular Extra:</span>
                              <span>+R$ {formatDecimalBRL(particularExtra)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[13px] font-mono leading-tight">
                            <span className="text-slate-500">Taxas Retidas pelas Plataformas:</span>
                            <span className="text-rose-400 font-bold">-R$ {formatDecimalBRL(totalFees)}</span>
                          </div>
                          
                          <div className="border-t border-slate-800/80 pt-1.5 mt-1 flex flex-col gap-0.5">
                            <div className="flex justify-between items-center text-[14px] font-bold">
                              <span className="text-white">Balanço das Taxas (Extra vs Taxa):</span>
                              <span className={`font-mono font-black text-xs ${netResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {netResult >= 0 ? 'LUCRO: +' : 'PREJUÍZO: '}R$ {formatDecimalBRL(netResult)}
                              </span>
                            </div>
                            <span className={`text-[12px] leading-tight font-extrabold ${netResult >= 0 ? 'text-emerald-500' : 'text-rose-455'} mt-0.5 uppercase tracking-wide block`}>
                              {netResult >= 0 
                                ? `🎉 Lucro! Suas cobranças extra cobriram todas as taxas dos apps e sobraram R$ ${formatDecimalBRL(netResult)}.`
                                : `⚠️ Prejuízo! Cobranças extra não cobriram totalmente as taxas. Faltou R$ ${formatDecimalBRL(Math.abs(netResult))}.`
                              }
                            </span>
                          </div>
                        </div>

                        {/* DETALHAMENTO INDIVIDUAL DAS CORRIDAS */}
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850 space-y-2 mt-2">
                          <div className="flex justify-between items-center text-[12px] font-black uppercase text-amber-500 border-b border-slate-800 pb-1.5 mb-1.5">
                            <span>📋 Detalhamento Individual</span>
                            <span className="text-[11px] font-normal text-slate-400 font-mono">({platformRides.length} Corridas)</span>
                          </div>
                          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 text-[12px] font-mono divide-y divide-slate-800/60">
                            {platformRides.map((t, idx) => {
                              const timeStr = new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                              const extra = t.extraChargedValue || 0;
                              const gorjeta = t.tipValue || 0;
                              
                              const offer = t.appOfferValue !== undefined 
                                ? t.appOfferValue 
                                : (t.value - extra - gorjeta);
                                
                              const passenger = t.passengerAppValue !== undefined 
                                ? t.passengerAppValue 
                                : (t.passengerValue !== undefined ? t.passengerValue : offer);
                              
                              const appFee = passenger - offer;
                              const appFeePct = passenger > 0 ? (appFee / passenger) * 100 : 0;
                              const platformColor = t.platform === '99' ? 'text-amber-500' : 'text-slate-100';
                              const platformName = t.platform === '99' ? '99 App' : 'Uber';
                              
                              return (
                                <div key={t.id} className="pt-2 first:pt-0 space-y-1">
                                  <div className="flex justify-between font-bold">
                                    <span className="text-slate-300">
                                      #{platformRides.length - idx} <span className={platformColor}>{platformName}</span> <span className="text-[10px] text-slate-500 font-normal">({timeStr})</span>
                                    </span>
                                    <span className="text-slate-200">Total: R$ {formatDecimalBRL(t.value)}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-400 text-[11px] pl-2 border-l border-slate-800">
                                    <div className="flex justify-between">
                                      <span>Ofertado:</span>
                                      <strong className="text-slate-300">R$ {formatDecimalBRL(offer)}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Passag. Pago:</span>
                                      <strong className="text-slate-300">R$ {formatDecimalBRL(passenger)}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Extras:</span>
                                      <strong className="text-emerald-400">+R$ {formatDecimalBRL(extra)}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Gorjetas:</span>
                                      <strong className="text-teal-450">+R$ {formatDecimalBRL(gorjeta)}</strong>
                                    </div>
                                    <div className="flex justify-between col-span-2 text-[10.5px] border-t border-slate-900/50 mt-0.5 pt-0.5">
                                      <span className="text-slate-500 font-sans">Taxa Retida do App:</span>
                                      <span className={appFee > 0 ? 'text-rose-450 font-bold' : appFee < 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                        R$ {formatDecimalBRL(appFee)} ({appFeePct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                 {/* Input counted values */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[12.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                      💵 Dinheiro Físico (Bolso)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                        placeholder="0,00"
                        value={realCashInput}
                        onChange={(e) => {
                          const masked = maskBRL(e.target.value);
                          setRealCashInput(masked);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[12.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                      ⚡ Saldo Pix (Conta)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-cyan-500 focus:outline-none"
                        placeholder="0,00"
                        value={realPixInput}
                        onChange={(e) => {
                          const masked = maskBRL(e.target.value);
                          setRealPixInput(masked);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Calculated Discrepancy blocks */}
                <div className="space-y-2">
                  {realCashInput !== '' && !isNaN(parseBRLInput(realCashInput)) && (() => {
                    const variance = parseBRLInput(realCashInput) - expectedPocketCash;
                    const isMatching = Math.abs(variance) < 0.05;

                    return (
                      <div className={`p-2 rounded-lg flex items-start gap-2 border text-[14px] ${
                        isMatching 
                          ? 'bg-emerald-500/10 border-emerald-900/60 text-emerald-400' 
                          : variance < 0
                            ? 'bg-rose-500/10 border-rose-900/60 text-rose-455'
                            : 'bg-amber-500/10 border-amber-900/60 text-amber-500'
                      }`}>
                        {isMatching ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        
                        <div className="leading-tight">
                          {isMatching ? (
                            <p className="font-bold">Dinheiro físico coincide perfeitamente!</p>
                          ) : variance < 0 ? (
                            <p className="font-black">Quebra de Caixa (Físico): R$ {formatDecimalBRL(Math.abs(variance))} FALTANDO!</p>
                          ) : (
                            <p className="font-black">Caixa (Físico) com Sobra: R$ {formatDecimalBRL(variance)} EXTRA.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {realPixInput !== '' && !isNaN(parseBRLInput(realPixInput)) && (() => {
                    const variance = parseBRLInput(realPixInput) - expectedPixBalance;
                    const isMatching = Math.abs(variance) < 0.05;

                    return (
                      <div className={`p-2 rounded-lg flex items-start gap-2 border text-[14px] ${
                        isMatching 
                          ? 'bg-emerald-500/10 border-emerald-900/60 text-emerald-400' 
                          : variance < 0
                            ? 'bg-rose-500/10 border-rose-900/60 text-rose-455'
                            : 'bg-amber-500/10 border-amber-900/60 text-amber-500'
                      }`}>
                        {isMatching ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        
                        <div className="leading-tight">
                          {isMatching ? (
                            <p className="font-bold">Saldo Pix coincide perfeitamente!</p>
                          ) : variance < 0 ? (
                            <p className="font-black">Quebra de Caixa (Pix): R$ {formatDecimalBRL(Math.abs(variance))} FALTANDO!</p>
                          ) : (
                            <p className="font-black">Caixa (Pix) com Sobra: R$ {formatDecimalBRL(variance)} EXTRA.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Odometer & Fuel metrics section */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-805 space-y-3">
                  <h4 className="text-[14px] font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1 flex items-center gap-1">
                    <span>⛽</span> Desempenho de Combustível
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Odômetro Final (KM)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-slate-500 font-mono">
                          KM
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 pl-8 text-white text-xs font-black font-mono focus:border-amber-500 focus:outline-none"
                          placeholder="Ex: 54245"
                          value={finalOdometerInput}
                          onChange={(e) => {
                            const masked = maskOdometer(e.target.value);
                            setFinalOdometerInput(masked);
                            
                            // Automatically calculate liters based on the odometer difference and vehicle consumption only if no fuel transactions were registered
                            if (activeShift.initialOdometer !== undefined) {
                              const idxOdo = activeShift.initialOdometer;
                              const endOdo = parseOdometerInput(masked);
                              if (endOdo !== undefined && endOdo >= idxOdo) {
                                const kmDriven = endOdo - idxOdo;
                                const activeConsumption = fuelVehicleType === 'CARRO' ? carConsumption : dynamicMotoConsumption;
                                
                                const fuelTxLiters = activeShift?.transactions
                                  ?.filter(t => t.type === 'OUT' && t.liters && t.liters > 0)
                                  ?.reduce((acc, t) => acc + (t.liters || 0), 0) || 0;

                                if (fuelTxLiters === 0 && activeConsumption > 0) {
                                  const calculatedLiters = kmDriven / activeConsumption;
                                  setTotalLitersInput(calculatedLiters.toFixed(2).replace('.', ','));
                                }
                              }
                            }
                          }}
                        />
                      </div>
                      {activeShift.initialOdometer !== undefined ? (
                        <span className="text-[12px] text-slate-500 block mt-0.5 font-sans">
                          Abertura: <strong>{formatOdometer(activeShift.initialOdometer)} KM</strong>
                        </span>
                      ) : (
                        <span className="text-[12px] text-amber-500/80 block mt-0.5 font-sans leading-none">
                          ⚠️ Odômetro inicial não foi informado na abertura.
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Total Litros (L)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-slate-500 font-mono">
                          L
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 pl-6 text-white text-xs font-black font-mono focus:border-amber-500 focus:outline-none"
                          placeholder="Ex: 25.4"
                          value={totalLitersInput}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9.,]/g, '');
                            setTotalLitersInput(sanitized);
                          }}
                        />
                      </div>
                      <span className="text-[12px] text-slate-500 block mt-0.5 font-sans">
                        Soma total do dia
                      </span>
                    </div>
                  </div>

                  {/* Fuel transactions notice */}
                  {(() => {
                    const fuelTxLiters = activeShift?.transactions
                      ?.filter(t => t.type === 'OUT' && t.liters && t.liters > 0)
                      ?.reduce((acc, t) => acc + (t.liters || 0), 0) || 0;

                    if (fuelTxLiters > 0) {
                      return (
                        <div className="text-[12.5px] text-emerald-400 font-sans leading-tight bg-emerald-500/10 p-2 rounded border border-emerald-500/20 flex flex-col gap-0.5">
                          <span className="font-extrabold flex items-center gap-1">
                            <span>⛽</span> Abastecimentos Monitorados: {fuelTxLiters.toFixed(2)} L
                          </span>
                          <span className="text-slate-450 text-[12px]">
                            Detectamos despesas de combustível registradas neste turno. Usando o total de abastecimentos reais para o cálculo do consumo exato!
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-[12.5px] text-amber-500 font-sans leading-tight bg-amber-500/5 p-2 rounded border border-amber-500/10 flex flex-col gap-0.5">
                          <span className="font-bold flex items-center gap-1">
                            <span>💡</span> Sem Abastecimentos Lançados
                          </span>
                          <span className="text-slate-450 text-[12px]">
                            Nenhum abastecimento foi registrado como despesa neste turno. O consumo exato será calculado se você digitar o total de litros consumidos.
                          </span>
                        </div>
                      );
                    }
                  })()}

                  {/* Marcador de Combustível de Saída (Fechamento) */}
                  {(() => {
                    const activeCapacity = fuelVehicleType === 'CARRO' ? carCapacity : motoCapacity;
                    const parsedFinalLiters = finalFuelLitersInput ? parseFloat(finalFuelLitersInput.replace(',', '.')) : 0;
                    const finalFuelPercentage = Math.max(0, Math.min(100, activeCapacity > 0 ? (parsedFinalLiters / activeCapacity) * 100 : 0));

                    const getOptimalSubdivisions = (capacity: number) => {
                      const candidates = [10, 5, 4, 2.5, 2, 1.25, 1, 0.5, 0.25, 0.2, 0.1, 0.05];
                      let bestN = 1;
                      let bestStep = 1;
                      let bestError = Infinity;
                      for (const step of candidates) {
                        const calcN = capacity / (4 * step);
                        if (calcN % 1 === 0 && calcN >= 1 && calcN <= 6) {
                          return { N: calcN, literStep: step };
                        }
                        const roundedN = Math.round(calcN);
                        if (roundedN >= 1 && roundedN <= 6) {
                          const error = Math.abs(calcN - roundedN);
                          if (error < 1e-4) {
                            return { N: roundedN, literStep: step };
                          }
                          if (error < bestError) {
                            bestError = error;
                            bestN = roundedN;
                            bestStep = step;
                          }
                        }
                      }

                      for (const step of candidates) {
                        const calcN = capacity / (8 * step);
                        const roundedN = Math.round(calcN);
                        if (roundedN >= 1 && roundedN <= 8) {
                          const error = Math.abs(calcN - roundedN);
                          if (error < 1e-4) {
                            return { N: roundedN, literStep: step };
                          }
                        }
                      }

                      return { N: bestN, literStep: capacity / (8 * bestN) };
                    };

                    const { N, literStep } = getOptimalSubdivisions(activeCapacity);
                    const totalTicks = fuelVehicleType === 'MOTO' ? 7 : (8 * N);

                    const allPositions: { value: number; isMajor: boolean; label?: string; percentage: number; angle: number; liters: number }[] = [];
                    for (let i = 0; i <= totalTicks; i++) {
                      let percentage = (i / totalTicks) * 100;
                      if (fuelVehicleType === 'MOTO') {
                        percentage = i <= 5 ? (i / 5) * 50 : 50 + ((i - 5) / 2) * 50;
                      }
                      const litersVal = (percentage / 100) * activeCapacity;
                      
                      if (fuelVehicleType === 'MOTO') {
                        const angle = 105 + ((i / totalTicks) * 100 / 100) * 90;
                        const isMajor = (i === 0 || i === 2 || i === 5 || i === 7);
                        let label: string | undefined = undefined;
                        if (i === 2) label = 'E';
                        else if (i === 5) label = '1/2';
                        else if (i === 7) label = 'F';

                        allPositions.push({
                          value: i,
                          isMajor,
                          label,
                          percentage,
                          angle,
                          liters: litersVal
                        });
                      } else {
                        const angle = -90 + (percentage / 100) * 180;
                        const isMajor = i <= 4 * N ? (i % N === 0) : (i % (2 * N) === 0);
                        let label: string | undefined = undefined;
                        if (i === N) label = 'R';
                        else if (i === 4 * N) label = '1/2';
                        else if (i === 8 * N) label = 'F';

                        allPositions.push({
                          value: i,
                          isMajor,
                          label,
                          percentage,
                          angle,
                          liters: litersVal
                        });
                      }
                    }

                    const closestPos = allPositions.reduce((prev, curr) => {
                      return Math.abs(finalFuelPercentage - curr.percentage) < Math.abs(finalFuelPercentage - prev.percentage) ? curr : prev;
                    });

                    const handleSetFuelTick = (tickIndex: number, targetPerc: number) => {
                      playBeep();
                      const targetLiters = (targetPerc / 100) * activeCapacity;
                      
                      let levelName: 'CHEIO' | 'MEIO' | 'RESERVA' | 'CUSTOM' = 'CUSTOM';
                      if (tickIndex === totalTicks) {
                        levelName = 'CHEIO';
                      } else if (fuelVehicleType === 'MOTO' ? tickIndex === 5 : tickIndex === 4 * N) {
                        levelName = 'MEIO';
                      } else if (fuelVehicleType === 'MOTO' ? tickIndex === 2 : tickIndex === N) {
                        levelName = 'RESERVA';
                      }
                      
                      setFinalFuelLevel(levelName);
                      setFinalFuelLitersInput(targetLiters.toFixed(1).replace('.', ','));
                    };

                    const getTickCoords = (angleDeg: number, rStart: number, rEnd: number) => {
                      const angleRad = (angleDeg - 90) * Math.PI / 180;
                      const x1 = 120 + rStart * Math.cos(angleRad);
                      const y1 = 100 + rStart * Math.sin(angleRad);
                      const x2 = 120 + rEnd * Math.cos(angleRad);
                      const y2 = 100 + rEnd * Math.sin(angleRad);
                      return { x1, y1, x2, y2 };
                    };

                    let needleAngleDeg = -90;
                    if (fuelVehicleType === 'MOTO') {
                      if (finalFuelPercentage <= 0) {
                        needleAngleDeg = allPositions[0]?.angle ?? 105;
                      } else if (finalFuelPercentage >= 100) {
                        needleAngleDeg = allPositions[allPositions.length - 1]?.angle ?? 195;
                      } else {
                        for (let i = 0; i < allPositions.length - 1; i++) {
                          const p1 = allPositions[i].percentage;
                          const p2 = allPositions[i + 1].percentage;
                          if (finalFuelPercentage >= p1 && finalFuelPercentage <= p2) {
                            const t = (p2 - p1) > 0 ? (finalFuelPercentage - p1) / (p2 - p1) : 0;
                            const a1 = allPositions[i].angle;
                            const a2 = allPositions[i + 1].angle;
                            needleAngleDeg = a1 + t * (a2 - a1);
                            break;
                          }
                        }
                      }
                    } else {
                      needleAngleDeg = -90 + (finalFuelPercentage / 100) * 180;
                    }

                    return (
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-[12.5px] font-bold uppercase tracking-wider text-slate-400">
                          <span className="flex items-center gap-1">
                            <span>⛽</span> Nível de Combustível de Fechamento
                          </span>
                          <span className="font-mono text-[12px] text-amber-500 font-extrabold">
                            {parsedFinalLiters.toFixed(1).replace('.', ',')} L / {activeCapacity.toString().replace('.', ',')} L ({finalFuelPercentage.toFixed(0)}%)
                          </span>
                        </div>

                        {/* Gauge selectors */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['CHEIO', 'MEIO', 'RESERVA', 'CUSTOM'] as const).map((level) => {
                            const isSel = finalFuelLevel === level;
                            const label = level === 'CHEIO' ? 'Cheio' :
                                          level === 'MEIO' ? 'Meio' :
                                          level === 'RESERVA' ? 'Reserva' : 'Digitado';
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => {
                                  setFinalFuelLevel(level);
                                  playBeep();
                                }}
                                className={`py-1 text-center font-extrabold text-[11px] uppercase tracking-wider rounded transition-all cursor-pointer ${
                                  isSel 
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-white'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Physical SVG Gauge */}
                        <div className="flex flex-col items-center">
                          {fuelVehicleType === 'MOTO' ? (
                            <svg
                              width="240"
                              height="120"
                              className="relative select-none cursor-pointer"
                              style={{ overflow: 'visible' }}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const clickY = e.clientY - rect.top;
                                const svgX = (clickX / rect.width) * 240;
                                const svgY = (clickY / rect.height) * 120;
                                const dx = svgX - 185;
                                const dy = svgY - 54;
                                let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
                                if (angleDeg < 0) angleDeg += 360;
                                
                                // For moto, valid sweep is 105 to 195 degrees.
                                // If they click on the dial face, let's clamp the angle to [105, 195]
                                // and compute the percentage.
                                let targetAngle = angleDeg;
                                if (targetAngle > 195 && targetAngle < 300) {
                                  targetAngle = 195;
                                } else if (targetAngle < 105 || targetAngle >= 300) {
                                  targetAngle = 105;
                                }
                                
                                const targetPerc = Math.max(0, Math.min(100, ((targetAngle - 105) / 90) * 100));
                                const tickIndex = Math.round((targetPerc / 100) * totalTicks);
                                const snappedPerc = tickIndex <= 5 ? (tickIndex / 5) * 50 : 50 + ((tickIndex - 5) / 2) * 50;
                                handleSetFuelTick(tickIndex, snappedPerc);
                              }}
                            >
                              <defs>
                                <linearGradient id="motoDashPlate_sc" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#2e3542" />
                                  <stop offset="60%" stopColor="#1f242e" />
                                  <stop offset="100%" stopColor="#11141b" />
                                </linearGradient>
                                <radialGradient id="pivotCap_sc" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                                  <stop offset="0%" stopColor="#4b5563" />
                                  <stop offset="50%" stopColor="#1f2937" />
                                  <stop offset="100%" stopColor="#030712" />
                                </radialGradient>
                                <radialGradient id="redGlow_sc" cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor="rgba(239, 68, 68, 0.2)" />
                                  <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                                </radialGradient>
                              </defs>

                              <path
                                d="M 12 8 L 228 8 C 234 8, 238 14, 238 21 L 238 108 C 238 113, 234 116, 228 116 L 12 116 C 6 116, 2 113, 2 108 L 2 21 C 2 14, 6 8, 12 8 Z"
                                fill="url(#motoDashPlate_sc)"
                                stroke="#111827"
                                strokeWidth="3.5"
                                className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                              />

                              {(() => {
                                const rad0 = 105 * Math.PI / 180;
                                const rad2 = (105 + (2 / 7) * 90) * Math.PI / 180;
                                const rx1 = 185 + 44 * Math.cos(rad0);
                                const ry1 = 54 + 44 * Math.sin(rad0);
                                const rx2 = 185 + 44 * Math.cos(rad2);
                                const ry2 = 54 + 44 * Math.sin(rad2);
                                return (
                                  <>
                                    <path
                                      d={`M 185 54 L ${rx2} ${ry2} A 44 44 0 0 0 ${rx1} ${ry1} Z`}
                                      fill="url(#redGlow_sc)"
                                      className="pointer-events-none"
                                    />
                                    <path
                                      d={`M ${rx1} ${ry1} A 44 44 0 0 1 ${rx2} ${ry2}`}
                                      fill="none"
                                      stroke="#ef4444"
                                      strokeWidth="5.5"
                                    />
                                  </>
                                );
                              })()}

                              <path
                                d="M 173.4 97.5 A 45 45 0 0 1 141.5 42.4"
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="5"
                                strokeLinecap="round"
                              />
                              <path
                                d="M 173.4 97.5 A 45 45 0 0 1 141.5 42.4"
                                fill="none"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="1.5"
                                strokeDasharray="2,5"
                              />

                              <circle cx="185" cy="54" r="13" fill="#0b0f19" stroke="#1e293b" strokeWidth="2" />

                              {allPositions.map((item, idx) => {
                                const theta = item.angle;
                                const isLow = idx <= 2;
                                const isSelected = item.value === closestPos.value;
                                const thetaRad = theta * Math.PI / 180;
                                const rx1 = 185 + (item.isMajor ? 41 : 44) * Math.cos(thetaRad);
                                const ry1 = 54 + (item.isMajor ? 41 : 44) * Math.sin(thetaRad);
                                const rx2 = 185 + (item.isMajor ? 49 : 47) * Math.cos(thetaRad);
                                const ry2 = 54 + (item.isMajor ? 49 : 47) * Math.sin(thetaRad);

                                const lx = 185 + 59 * Math.cos(thetaRad);
                                const ly = 54 + 59 * Math.sin(thetaRad);

                                                               const cx1 = 185 + 32 * Math.cos(thetaRad);
                                const cy1 = 54 + 32 * Math.sin(thetaRad);
                                const cx2 = 185 + 72 * Math.cos(thetaRad);
                                const cy2 = 54 + 72 * Math.sin(thetaRad);

                                return (
                                  <g key={idx} className="group cursor-pointer" onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetFuelTick(item.value, item.percentage);
                                  }}>
                                    <line
                                      x1={cx1}
                                      y1={cy1}
                                      x2={cx2}
                                      y2={cy2}
                                      stroke="rgba(0,0,0,0)"
                                      strokeWidth="20"
                                    />
                                    <line
                                      x1={rx1}
                                      y1={ry1}
                                      x2={rx2}
                                      y2={ry2}
                                      stroke={isSelected ? '#f59e0b' : (item.isMajor ? (isLow ? '#ef4444' : 'rgba(255,255,255,0.35)') : (isLow ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255,255,255,0.18)'))}
                                      strokeWidth={isSelected ? (item.isMajor ? '3.5' : '2.5') : (item.isMajor ? '2' : '0.85')}
                                    />
                                    {item.label && (
                                      <text
                                        x={lx}
                                        y={ly + 3}
                                        textAnchor="middle"
                                        fontSize="9.5"
                                        fontWeight="900"
                                        fontFamily="monospace"
                                        fill={isSelected ? '#f59e0b' : (isLow ? '#ef4444' : '#94a3b8')}
                                        className="select-none font-sans"
                                      >
                                        {item.label}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}

                              <text x="185" y="112" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="black" className="opacity-45">MOTO</text>

                              <g
                                style={{
                                  transform: `rotate(${needleAngleDeg - 180}deg)`,
                                  transformOrigin: '185px 54px',
                                  transition: 'transform 1s cubic-bezier(0.25, 1.4, 0.5, 1)'
                                }}
                                className="pointer-events-none"
                              >
                                <polygon
                                  points="182,51 133,53.5 133,54.5 182,57"
                                  fill="rgba(0,0,0,0.4)"
                                  transform="translate(1, 2)"
                                />
                                <polygon
                                  points="182,51 133,53.5 133,54.5 182,57"
                                  fill="#ea580c"
                                />
                                <line
                                  x1="182"
                                  y1="54"
                                  x2="133"
                                  y2="54"
                                  stroke="#f97316"
                                  strokeWidth="1.6"
                                />
                              </g>
                              <circle cx="185" cy="54" r="5" fill="url(#pivotCap_sc)" />
                            </svg>
                          ) : (
                            <svg
                              width="240"
                              height="120"
                              className="relative select-none cursor-pointer"
                              style={{ overflow: 'visible' }}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const clickY = e.clientY - rect.top;
                                const svgX = (clickX / rect.width) * 240;
                                const svgY = (clickY / rect.height) * 120;
                                const dx = svgX - 120;
                                const dy = svgY - 100;
                                
                                let angleRad = Math.atan2(dy, dx);
                                if (angleRad > 0) {
                                  if (angleRad < Math.PI / 2) {
                                    angleRad = 0;
                                  } else {
                                    angleRad = -Math.PI;
                                  }
                                }
                                
                                let angleDeg = (angleRad * 180 / Math.PI) + 90;
                                angleDeg = Math.max(-90, Math.min(90, angleDeg));
                                const percentageVal = ((angleDeg + 90) / 180) * 100;
                                
                                const tickIndex = Math.round((percentageVal / 100) * totalTicks);
                                const snappedPerc = (tickIndex / totalTicks) * 100;
                                handleSetFuelTick(tickIndex, snappedPerc);
                              }}
                            >
                              <defs>
                                <linearGradient id="carDashPlate_sc" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#2e3542" />
                                  <stop offset="60%" stopColor="#1f242e" />
                                  <stop offset="100%" stopColor="#11141b" />
                                </linearGradient>
                              </defs>

                              <path
                                  d="M 12 8 L 228 8 C 234 8, 238 14, 238 21 L 238 108 C 238 113, 234 116, 228 116 L 12 116 C 6 116, 2 113, 2 108 L 2 21 C 2 14, 6 8, 12 8 Z"
                                stroke="#111827"
                                strokeWidth="3.5"
                                fill="url(#carDashPlate_sc)"
                                className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                              />

                              <path
                                d="M 55 100 A 65 65 0 0 1 185 100"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="8"
                                strokeLinecap="round"
                              />
                              
                              <circle cx="120" cy="100" r="14" fill="#0b0f19" stroke="#1e293b" strokeWidth="2" />
                              <circle cx="120" cy="100" r="6" fill="#1e293b" />
                              <circle cx="120" cy="100" r="2.5" fill="#ef4444" />

                              {allPositions.map((item, idx) => {
                                const theta = item.angle;
                                const isLow = item.percentage <= 15;
                                const isSelected = item.value === closestPos.value;
                                
                                const outerR = item.isMajor ? 72 : 70;
                                const innerR = item.isMajor ? (item.label ? 56 : 62) : 66;
                                const { x1, y1, x2, y2 } = getTickCoords(theta, innerR, outerR);
                                
                                const labelRad = (theta - 90) * Math.PI / 180;
                                const lx = 120 + 86 * Math.cos(labelRad);
                                const ly = 100 + 86 * Math.sin(labelRad);

                                const clickCoords = getTickCoords(theta, innerR - 6, 105);

                                return (
                                  <g key={idx} className="group cursor-pointer" onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetFuelTick(item.value, item.percentage);
                                  }}>
                                    <line
                                      x1={clickCoords.x1}
                                      y1={clickCoords.y1}
                                      x2={clickCoords.x2}
                                      y2={clickCoords.y2}
                                      stroke="rgba(0,0,0,0)"
                                      strokeWidth="22"
                                      strokeLinecap="round"
                                    />
                                    <line
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke={isSelected ? '#f59e0b' : (item.isMajor ? (isLow ? '#ef4444' : '#475569') : (isLow ? 'rgba(239, 68, 68, 0.3)' : '#334155'))}
                                      strokeWidth={isSelected ? (item.isMajor ? '4' : '2.5') : (item.isMajor ? '2.5' : '1.0')}
                                      strokeLinecap="round"
                                    />
                                    {isSelected && (
                                      <circle cx={x2} cy={y2} r={item.isMajor ? "2.5" : "1.5"} fill="#f59e0b" className="animate-pulse" />
                                    )}
                                    {item.label && (
                                      <text
                                        x={lx}
                                        y={ly + 3}
                                        textAnchor="middle"
                                        fontSize="10"
                                        fontWeight="900"
                                        fontFamily="monospace"
                                        fill={isSelected ? '#f59e0b' : (isLow ? '#ef4444' : '#64748b')}
                                        className="select-none cursor-pointer font-sans font-black"
                                      >
                                        {item.label}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}

                              <text x="120" y="68" textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold" className="opacity-40">⛽ CARRO</text>

                              <line
                                x1="120"
                                y1="100"
                                x2="120"
                                y2="38"
                                stroke="#ef4444"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                style={{
                                  transform: `rotate(${needleAngleDeg}deg)`,
                                  transformOrigin: '120px 100px',
                                  transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }}
                                className="pointer-events-none drop-shadow-[0_2px_4px_rgba(239,68,68,0.4)]"
                              />
                            </svg>
                          )}
                        </div>

                        <div className="w-full text-center">
                          <p className="text-[11.5px] text-slate-500 italic">
                            *Clique diretamente nos traços ou nas letras do painel acima para mover o ponteiro de fechamento.
                          </p>
                        </div>

                        {/* Numeric manual input for customization */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-slate-500">
                            LITROS EXATOS
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 pl-32 text-white text-xs font-black font-mono focus:border-amber-500 focus:outline-none"
                            value={finalFuelLitersInput}
                            disabled={finalFuelLevel !== 'CUSTOM'}
                            placeholder="0,00"
                            onChange={(e) => {
                              if (finalFuelLevel === 'CUSTOM') {
                                const val = e.target.value.replace(/[^0-9,]/g, '');
                                setFinalFuelLitersInput(val);
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Operational display of km calculated and consumption average */}
                  {(() => {
                    const idxOdo = activeShift.initialOdometer;
                    const endOdo = finalOdometerInput ? parseOdometerInput(finalOdometerInput) : undefined;
                    const lts = totalLitersInput ? parseFloat(totalLitersInput.replace(',', '.')) : 0;

                    const validOdo = idxOdo !== undefined && endOdo !== undefined && endOdo >= idxOdo;
                    const kmDriven = validOdo && idxOdo !== undefined && endOdo !== undefined ? (endOdo - idxOdo) : 0;

                    const activeCapacity = fuelVehicleType === 'CARRO' ? carCapacity : motoCapacity;
                    const initialFuelVal = activeShift.initialFuelLiters !== undefined ? activeShift.initialFuelLiters : activeCapacity;
                    const finalFuelVal = finalFuelLitersInput ? parseFloat(finalFuelLitersInput.replace(',', '.')) : 0;
                    
                    const hasBothFuelLevels = activeShift.initialFuelLiters !== undefined;
                    const exactFuelConsumed = hasBothFuelLevels
                      ? Math.max(0.001, initialFuelVal + lts - finalFuelVal)
                      : lts;

                    const consumption = validOdo && exactFuelConsumed > 0 ? (kmDriven / exactFuelConsumed) : undefined;
                    const ltPerKm = validOdo && exactFuelConsumed > 0 ? (exactFuelConsumed / kmDriven) : undefined;

                    if (!validOdo && exactFuelConsumed <= 0) return null;

                    return (
                      <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-md space-y-1.5 font-mono text-[14px]">
                        {validOdo && (
                          <div className="flex justify-between items-center text-slate-300">
                            <span>Distância Rodada:</span>
                            <span className="font-extrabold text-white">{kmDriven.toFixed(1)} KM</span>
                          </div>
                        )}
                        {hasBothFuelLevels && (
                          <div className="flex flex-col gap-0.5 border-t border-slate-800/60 pt-1.5 text-slate-300 text-[12.5px]">
                            <div className="flex justify-between">
                              <span>Combustível Consumido:</span>
                              <span className="font-extrabold text-white">{exactFuelConsumed.toFixed(2)} L</span>
                            </div>
                            <span className="text-[11px] text-slate-500 leading-none">
                              Fórmula: {initialFuelVal.toFixed(1)}L inicial + {lts.toFixed(1)}L abastecido - {finalFuelVal.toFixed(1)}L final
                            </span>
                          </div>
                        )}
                        {consumption !== undefined && (
                          <div className="flex justify-between items-center border-t border-slate-800/85 pt-1.5 text-slate-300">
                            <span>Consumo Médio Exato:</span>
                            <span className="font-black text-emerald-400 text-xs bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{consumption.toFixed(1)} km/L</span>
                          </div>
                        )}
                        {ltPerKm !== undefined && (
                          <div className="flex justify-between items-center text-[12.5px] text-slate-500">
                            <span>L/KM (Litro por KM):</span>
                            <span>{ltPerKm.toFixed(4)} L/km</span>
                          </div>
                        )}
                        
                        {/* Calibração é sempre automática — sem opção manual */}
                        {consumption !== undefined && (
                          <div className="flex items-start gap-1.5 border-t border-slate-800/80 pt-2 mt-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-[12px] text-slate-400 leading-tight font-sans">
                              Veículo calibrado automaticamente com este consumo de <strong>{consumption.toFixed(1)} km/L</strong> para os próximos turnos.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Closing notes */}
                <div className="space-y-1 font-mono text-[14px]">
                  <label className="block text-slate-400 uppercase tracking-widest text-[12px] font-extrabold">Observações Geras</label>
                  <textarea
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-805 rounded-lg p-2 text-white focus:border-slate-800 focus:outline-none text-[14px]"
                    placeholder="Ex: Trânsito intenso. Abasteci R$50."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Actions */}
                {errorMsg && (
                  <div className="bg-rose-950/40 text-rose-400 border border-rose-900/50 p-2 rounded-lg text-center text-[14px] font-bold uppercase tracking-wide font-mono animate-pulse">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2.5">
                  <button
                    onClick={() => setIsClosingOpen(false)}
                    className="w-full bg-slate-950 hover:bg-slate-805 text-slate-400 font-bold py-2 px-3 rounded-lg text-[14px] uppercase border border-slate-850"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCloseShiftConfirm}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-2 px-3 rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-97"
                  >
                    Confirmar Fechamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* withdrawalModal UI */}
      <AnimatePresence>
        {withdrawalModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-white font-sans uppercase tracking-tight flex items-center gap-1.5">
                  <span>💰</span> Sacar Saldo {withdrawalModal.platform === 'UBER' ? 'Uber' : '99'}
                </h3>
                <button
                  onClick={() => setWithdrawalModal(null)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Max balance info banner */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850/80">
                  <span className="text-[12px] uppercase font-bold text-slate-500 block mb-0.5">Saldo Retido Disponível</span>
                  <span className="text-lg font-mono font-black text-emerald-400">R$ {formatDecimalBRL(withdrawalModal.maxAmount)}</span>
                </div>

                {/* Amount input */}
                <div className="space-y-1">
                  <label className="block text-[12.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Valor do Saque
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="0,00"
                      value={withdrawalModal.amount}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setWithdrawalModal(prev => prev ? { ...prev, amount: masked } : null);
                      }}
                    />
                  </div>
                </div>

                {/* Fee input */}
                <div className="space-y-1">
                  <label className="block text-[12.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Taxa Cobrada por Saque
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="0,00"
                      value={withdrawalModal.fee}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setWithdrawalModal(prev => prev ? { ...prev, fee: masked } : null);
                      }}
                    />
                  </div>
                  <span className="block text-[12px] text-slate-500 font-mono mt-0.5">
                    Digite a taxa cobrada pelo aplicativo ou banco por esse saque.
                  </span>
                </div>

                {/* Receipt method */}
                <div className="space-y-1">
                  <label className="block text-[12.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Receber em:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawalModal(prev => prev ? { ...prev, method: 'PIX' } : null)}
                      className={`py-2 px-3 rounded-lg text-[14px] font-black uppercase border transition-all flex items-center justify-center gap-1.5 ${
                        withdrawalModal.method === 'PIX'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ⚡ Pix
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawalModal(prev => prev ? { ...prev, method: 'DINHEIRO' } : null)}
                      className={`py-2 px-3 rounded-lg text-[14px] font-black uppercase border transition-all flex items-center justify-center gap-1.5 ${
                        withdrawalModal.method === 'DINHEIRO'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      💵 Dinheiro
                    </button>
                  </div>
                </div>

                {/* Net amount display */}
                <div className="bg-slate-955 p-2.5 rounded-lg border border-slate-850 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[12px]">Líquido a Receber:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    R$ {(() => {
                      const amount = parseBRLInput(withdrawalModal.amount) || 0;
                      const fee = parseBRLInput(withdrawalModal.fee) || 0;
                      return formatDecimalBRL(Math.max(0, amount - fee));
                    })()}
                  </span>
                </div>

                {errorMsg && (
                  <div className="bg-rose-950/40 text-rose-455 border border-rose-900/50 p-2 rounded-lg text-center text-[12.5px] font-bold uppercase tracking-wide font-mono animate-pulse">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setWithdrawalModal(null)}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 font-bold py-2 px-3 rounded-lg text-[14px] uppercase border border-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmWithdrawal}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 px-3 rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-97"
                  >
                    Confirmar Saque
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* debtPaymentModal UI */}
        {debtPaymentModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-white font-sans uppercase tracking-tight flex items-center gap-1.5">
                  <span>⚡</span> Quitar Saldo {debtPaymentModal.platform === 'UBER' ? 'Uber' : '99'}
                </h3>
                <button
                  onClick={() => setDebtPaymentModal(null)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Debt info banner */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850/80">
                  <span className="text-[12px] uppercase font-bold text-slate-500 block mb-0.5">Dívida com a Plataforma</span>
                  <span className="text-lg font-mono font-black text-rose-455">R$ {formatDecimalBRL(debtPaymentModal.maxAmount)}</span>
                </div>

                {/* Amount input */}
                <div className="space-y-1">
                  <label className="block text-[12.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Valor a Pagar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-rose-500 focus:outline-none"
                      placeholder="0,00"
                      value={debtPaymentModal.amount}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setDebtPaymentModal(prev => prev ? { ...prev, amount: masked } : null);
                      }}
                    />
                  </div>
                  <span className="block text-[12px] text-slate-500 font-mono mt-0.5">
                    O valor sai do seu saldo em Pix e zera (ou reduz) a dívida com a plataforma.
                  </span>
                </div>

                {/* Fixed payment method info */}
                <div className="bg-slate-955 p-2.5 rounded-lg border border-slate-850 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[12px]">Sai de:</span>
                  <span className="font-mono font-black text-amber-400 text-sm">⚡ Pix</span>
                </div>

                {errorMsg && (
                  <div className="bg-rose-950/40 text-rose-455 border border-rose-900/50 p-2 rounded-lg text-center text-[12.5px] font-bold uppercase tracking-wide font-mono animate-pulse">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setDebtPaymentModal(null)}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 font-bold py-2 px-3 rounded-lg text-[14px] uppercase border border-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDebtPayment}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-2 px-3 rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-97"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* conversionModal UI */}
        {conversionModal && (
          <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative background flare */}
              <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-xl pointer-events-none ${conversionModal.direction === 'CASH_TO_PIX' ? 'bg-amber-500/10' : 'bg-cyan-500/10'}`} />

              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                <span className="text-xl">🔄</span>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    {conversionModal.direction === 'CASH_TO_PIX' ? 'Conversão Dinheiro p/ Pix' : 'Conversão Pix p/ Dinheiro'}
                  </h3>
                  <p className="text-[12.5px] text-slate-400">
                    {conversionModal.direction === 'CASH_TO_PIX' 
                      ? 'Transfira o dinheiro físico do seu bolso para o saldo em Pix'
                      : 'Transfira o saldo em Pix para o dinheiro físico no bolso'}
                  </p>
                </div>
                <button 
                  onClick={() => setConversionModal(null)}
                  className="ml-auto text-slate-500 hover:text-white font-mono text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Balance summary */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-805 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[12px]">
                    {conversionModal.direction === 'CASH_TO_PIX' ? 'Saldo Atual no Bolso:' : 'Saldo Atual em Pix:'}
                  </span>
                  <span className="font-mono font-black text-slate-200">
                    R$ {formatDecimalBRL(conversionModal.direction === 'CASH_TO_PIX' ? expectedPocketCash : expectedPixBalance)}
                  </span>
                </div>

                {/* Input field */}
                <div>
                  <label className={`block text-[12.5px] font-extrabold tracking-wider uppercase mb-1.5 ${conversionModal.direction === 'CASH_TO_PIX' ? 'text-amber-500' : 'text-cyan-400'}`}>
                    Valor a ser Convertido (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-24 text-white text-xs font-bold font-mono focus:border-slate-600 focus:outline-none"
                      value={conversionModal.amount}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setConversionModal(prev => prev ? { ...prev, amount: masked } : null);
                      }}
                    />
                    {/* Shortcut to convert all */}
                    <button
                      type="button"
                      onClick={() => {
                        const maxVal = conversionModal.direction === 'CASH_TO_PIX' ? expectedPocketCash : expectedPixBalance;
                        setConversionModal(prev => prev ? { ...prev, amount: Math.max(0, maxVal).toFixed(2).replace('.', ',') } : null);
                        playBeep();
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 border rounded py-1 px-2 text-[12px] font-black uppercase transition-all ${
                        conversionModal.direction === 'CASH_TO_PIX' 
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20' 
                          : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20'
                      }`}
                    >
                      Converter Tudo
                    </button>
                  </div>
                </div>

                {/* Simulation block */}
                <div className="bg-slate-955 p-3 rounded-lg border border-slate-850 space-y-2 text-[14px]">
                  <p className="font-bold text-slate-400 uppercase text-[12px] tracking-wider mb-1">Simulação de Saldos pós-conversão:</p>
                  
                  {(() => {
                    const convertValue = parseBRLInput(conversionModal.amount) || 0;
                    const simulatedPocket = conversionModal.direction === 'CASH_TO_PIX' 
                      ? expectedPocketCash - convertValue 
                      : expectedPocketCash + convertValue;
                    const simulatedPix = conversionModal.direction === 'CASH_TO_PIX' 
                      ? expectedPixBalance + convertValue 
                      : expectedPixBalance - convertValue;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-500">💵 No Bolso (Dinheiro):</span>
                          <span className="text-slate-200">
                            R$ {formatDecimalBRL(expectedPocketCash)} ➔ <strong className={simulatedPocket < 0 ? 'text-rose-455' : 'text-slate-200'}>R$ {formatDecimalBRL(simulatedPocket)}</strong>
                          </span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-500">⚡ Em Conta (Pix):</span>
                          <span className="text-slate-200">
                            R$ {formatDecimalBRL(expectedPixBalance)} ➔ <strong className={simulatedPix < 0 ? 'text-rose-455' : 'text-emerald-400'}>R$ {formatDecimalBRL(simulatedPix)}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {errorMsg && (
                  <div className="bg-rose-950/40 text-rose-455 border border-rose-900/50 p-2 rounded-lg text-center text-[12.5px] font-bold uppercase tracking-wide font-mono animate-pulse">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setConversionModal(null)}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 font-bold py-2 px-3 rounded-lg text-[14px] uppercase border border-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmConversion}
                    className={`w-full font-black py-2 px-3 rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-97 ${
                      conversionModal.direction === 'CASH_TO_PIX' 
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-955' 
                        : 'bg-cyan-500 hover:bg-cyan-600 text-slate-955'
                    }`}
                  >
                    Confirmar Conversão
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

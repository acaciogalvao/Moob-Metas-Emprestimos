/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Plus, Minus, Check, HelpCircle, Delete, Fuel, MessageSquare, MapPin, Calculator, Car, Bike, Clock } from 'lucide-react';
import { PlatformType, TransactionType, PaymentMethod, Shift } from '../types';
import { playBeep, playCashRegister, playErrorBeep } from '../utils/audio';
import { parseBRLInput, maskBRL, maskKM, parseKMInput, maskOdometer, parseOdometerInput, formatOdometer, formatDecimalBRL, calculateExtraValue } from '../utils/format';
import { computeFinancialTotals } from '../utils/financialCalculations';

// Helper to mask fuel price (2 decimal places)
function maskFuelPrice(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  const price = parseFloat(clean) / 100;
  return price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseFuelPrice(input: string): number {
  if (!input) return 0;
  const clean = input.replace(/\D/g, '');
  if (!clean) return 0;
  return parseFloat(clean) / 100;
}

// Helper to mask fuel liters (3 decimal places)
function maskFuelLiters(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  const liters = parseFloat(clean) / 1000;
  return liters.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

function parseFuelLiters(input: string): number {
  if (!input) return 0;
  const clean = input.replace(/\D/g, '');
  if (!clean) return 0;
  return parseFloat(clean) / 1000;
}

// --- IN-PROGRESS FORM DRAFT PERSISTENCE ---
// Keeps whatever the driver has typed but not yet submitted safe across a forced page
// reload (e.g. a mobile browser/PWA dropping the dev HMR socket while backgrounded) or an
// app restart. Without this, switching apps mid-entry silently wiped the calculator, the
// app-offer/passenger fields, description, KM, etc.
const QUICK_REGISTER_DRAFT_KEY = 'moob_quickregister_draft';

interface QuickRegisterDraft {
  txType?: 'IN' | 'OUT' | 'FUEL';
  platform?: PlatformType;
  inType?: 'CORRIDA' | 'CANCELAMENTO';
  paymentMethod?: PaymentMethod | null;
  extraPaymentMethod?: 'PIX' | 'DINHEIRO';
  inputValue?: string;
  expenseCategory?: string;
  customExpenseName?: string;
  fuelPrice?: string;
  fuelLiters?: string;
  fuelOdometerInput?: string;
  km?: string;
  description?: string;
  appOfferInput?: string;
  passengerAppInput?: string;
  tipInput?: string;
}

function loadQuickRegisterDraft(): QuickRegisterDraft {
  try {
    const raw = localStorage.getItem(QUICK_REGISTER_DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveQuickRegisterDraft(draft: QuickRegisterDraft) {
  try {
    localStorage.setItem(QUICK_REGISTER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private mode, quota) — draft persistence is best-effort only.
  }
}

function clearQuickRegisterDraft() {
  try {
    localStorage.removeItem(QUICK_REGISTER_DRAFT_KEY);
  } catch {
    // ignore
  }
}

interface QuickRegisterProps {
  activeShift: Shift | null;
  onAddTransaction: (tx: {
    type: TransactionType;
    platform: PlatformType;
    category: string;
    value: number;
    paymentMethod: PaymentMethod;
    description: string;
    km?: number;
    passengerValue?: number;
    appOfferValue?: number;
    passengerAppValue?: number;
    tipValue?: number;
    extraChargedValue?: number;
    isVirtual?: boolean;
    keypadValue?: number;
    extraPaymentMethod?: 'PIX' | 'DINHEIRO' | 'pix' | 'dinheiro';
    liters?: number;
    pricePerLiter?: number;
    odometer?: number;
  }) => void;
  onOpenShift: (
    initialPixBalance: number, 
    initialCashBalance: number, 
    initialOdometer?: number,
    initialUberBalance?: number,
    initial99Balance?: number,
    initialFuelLiters?: number,
    initialFuelLevel?: string,
    monthlyGoal?: number,
    dailyKmGoal?: number
  ) => void;
  vehicleType?: 'CAR' | 'BIKE';
  lastClosedShiftFaturamento?: number;
  lastClosedShift?: Shift;
  onGoToViagem?: () => void;
  excludeSundays?: boolean;
  onToggleExcludeSundays?: (val: boolean) => void;
  onDraftFuelLitersChange?: (liters: number) => void;
  /** Callback chamado em tempo real com o nível atual do tanque (litros) conforme o motorista digita o
   *  hodômetro no form de abastecimento. Permite que o PainelBordo atualize o ponteiro sem salvar. */
  onLiveFuelLevelChange?: (liters: number | null) => void;
}

export function QuickRegister({ 
  activeShift, 
  onAddTransaction, 
  onOpenShift, 
  vehicleType = 'CAR', 
  lastClosedShiftFaturamento = 0,
  lastClosedShift,
  onGoToViagem,
  excludeSundays: propsExcludeSundays,
  onToggleExcludeSundays,
  onDraftFuelLitersChange,
  onLiveFuelLevelChange
}: QuickRegisterProps) {
  // Local fallback state if not provided as props
  const [localExcludeSundays, setLocalExcludeSundays] = useState<boolean>(() => {
    return localStorage.getItem('moob_caixa_exclude_sundays') === 'true';
  });

  const excludeSundays = propsExcludeSundays !== undefined ? propsExcludeSundays : localExcludeSundays;

  const handleToggleExcludeSundays = (val: boolean) => {
    if (onToggleExcludeSundays) {
      onToggleExcludeSundays(val);
    } else {
      setLocalExcludeSundays(val);
    }
    localStorage.setItem('moob_caixa_exclude_sundays', String(val));
  };

  // Restore any in-progress entry the driver had not yet submitted (survives forced
  // reloads from the mobile HMR-socket-drop issue, app kills, etc.)
  const [initialDraft] = useState<QuickRegisterDraft>(() => loadQuickRegisterDraft());

  // Mode: IN (Entrada/Corrida), OUT (Saída/Despesa) or FUEL (Abastecimento)
  const [txType, setTxType] = useState<'IN' | 'OUT' | 'FUEL'>(initialDraft.txType || 'IN');
  const [platform, setPlatform] = useState<PlatformType>(initialDraft.platform || 'UBER');

  // Campanha: quick calculator-only credit straight to the selected platform's balance
  const [isCampanhaOpen, setIsCampanhaOpen] = useState(false);
  const [campanhaInput, setCampanhaInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initialDraft.paymentMethod ?? null);
  const [extraPaymentMethod, setExtraPaymentMethod] = useState<'PIX' | 'DINHEIRO'>(initialDraft.extraPaymentMethod || 'PIX');
  const [inType, setInType] = useState<'CORRIDA' | 'CANCELAMENTO'>(initialDraft.inType || 'CORRIDA');
  
  // Custom numeric entry (string to support keypad entry like "15.50")
  const [inputValue, setInputValue] = useState<string>(initialDraft.inputValue || '');
  
  // Expenses state
  const [expenseCategory, setExpenseCategory] = useState<string>(initialDraft.expenseCategory || 'ALIMENTACAO');
  const [customExpenseName, setCustomExpenseName] = useState<string>(initialDraft.customExpenseName || '');
  
  // Fuel Supply Calculator States
  const [fuelPrice, setFuelPrice] = useState<string>(initialDraft.fuelPrice || '');
  const [fuelLiters, setFuelLiters] = useState<string>(initialDraft.fuelLiters || '');
  
  // Optional parameters
  const [km, setKm] = useState<string>(initialDraft.km || '');
  const [description, setDescription] = useState<string>(initialDraft.description || '');
  const [appOfferInput, setAppOfferInput] = useState<string>(initialDraft.appOfferInput || '');
  const [passengerAppInput, setPassengerAppInput] = useState<string>(initialDraft.passengerAppInput || '');
  const [tipInput, setTipInput] = useState<string>(initialDraft.tipInput || '');
  const [startingPixBalanceInput, setStartingPixBalanceInput] = useState<string>('');
  const [startingCashBalanceInput, setStartingCashBalanceInput] = useState<string>('');
  const [startingUberBalanceInput, setStartingUberBalanceInput] = useState<string>('');
  const [isStartingUberNegative, setIsStartingUberNegative] = useState<boolean>(false);
  const [starting99BalanceInput, setStarting99BalanceInput] = useState<string>('');
  const [isStarting99Negative, setIsStarting99Negative] = useState<boolean>(false);
  const [startingFuelLevel, setStartingFuelLevel] = useState<'CHEIO' | 'MEIO' | 'RESERVA' | 'CUSTOM'>('CHEIO');
  const [startingFuelLitersInput, setStartingFuelLitersInput] = useState<string>('');
  const [startingMonthlyGoalInput, setStartingMonthlyGoalInput] = useState<string>(() => {
    return localStorage.getItem('moob_caixa_monthly_goal') || '6.000,00';
  });
  const [startingDailyKmGoalInput, setStartingDailyKmGoalInput] = useState<string>(() => {
    return localStorage.getItem('moob_caixa_daily_km_goal') || '150';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);

  // Pre-shift configuration for Tank Capacity and Consumption (KM/L)
  const [openingConsumption, setOpeningConsumption] = useState<string>(() => {
    const stored = localStorage.getItem(vehicleType === 'CAR' ? 'moob_fuel_car_consumption' : 'moob_fuel_moto_consumption');
    return stored ? stored : (vehicleType === 'CAR' ? '12' : '35');
  });

  const [openingCapacity, setOpeningCapacity] = useState<string>(() => {
    const stored = localStorage.getItem(vehicleType === 'CAR' ? 'moob_fuel_car_capacity' : 'moob_fuel_moto_capacity');
    return stored ? stored : (vehicleType === 'CAR' ? '50' : '12');
  });

  useEffect(() => {
    if (!activeShift) {
      const storedCons = localStorage.getItem(vehicleType === 'CAR' ? 'moob_fuel_car_consumption' : 'moob_fuel_moto_consumption');
      setOpeningConsumption(storedCons || (vehicleType === 'CAR' ? '12' : '35'));
      
      const storedCap = localStorage.getItem(vehicleType === 'CAR' ? 'moob_fuel_car_capacity' : 'moob_fuel_moto_capacity');
      setOpeningCapacity(storedCap || (vehicleType === 'CAR' ? '50' : '12'));
    }
  }, [vehicleType, activeShift]);

  // KM Calculator States
  const [isKmCalcOpen, setIsKmCalcOpen] = useState<boolean>(false);
  const [kmCalcMode, setKmCalcMode] = useState<'ODOMETER' | 'FORMULA'>('ODOMETER');
  const [odoInitial, setOdoInitial] = useState<string>('');
  const [odoFinal, setOdoFinal] = useState<string>('');
  const [sumFormula, setSumFormula] = useState<string>('');
  const [startingOdometerInput, setStartingOdometerInput] = useState<string>('');
  const [fuelOdometerInput, setFuelOdometerInput] = useState<string>(initialDraft.fuelOdometerInput || '');

  // KM calculations
  const odoDiff = (() => {
    const start = parseOdometerInput(odoInitial);
    const end = parseOdometerInput(odoFinal);
    if (!isNaN(start) && !isNaN(end)) {
      return Math.max(0, end - start);
    }
    return 0;
  })();

  const formulaSum = (() => {
    if (!sumFormula) return 0;
    const parts = sumFormula.split('+').map(p => parseFloat(p.trim().replace(',', '.')));
    return parts.reduce((acc, curr) => acc + (isNaN(curr) ? 0 : curr), 0);
  })();

  const decimals = platform === 'UBER' ? 2 : 1;

  const formatKM = (val: number) => {
    return val.toFixed(decimals);
  };

  const liveFeeInfo = (() => {
    const offerVal = parseBRLInput(appOfferInput);
    const passengerVal = parseBRLInput(passengerAppInput);
    if (offerVal > 0 && passengerVal > 0) {
      const feeAmount = passengerVal - offerVal;
      const feePercentage = passengerVal > 0 ? (feeAmount / passengerVal) * 100 : 0;
      return {
        feeAmount,
        feePercentage
      };
    }
    return null;
  })();

  // Input Focus
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Auto-reset opening and transaction fields when activeShift becomes null (shift is closed)
  useEffect(() => {
    if (!activeShift) {
      setStartingPixBalanceInput('');
      setStartingCashBalanceInput('');
      setStartingUberBalanceInput('');
      setIsStartingUberNegative(false);
      setStarting99BalanceInput('');
      setIsStarting99Negative(false);
      setStartingOdometerInput('');
      setStartingFuelLevel('CHEIO');
      setStartingFuelLitersInput('');
      setInputValue('');
      setKm('');
      setDescription('');
      setAppOfferInput('');
      setPassengerAppInput('');
      setTipInput('');
      setCustomExpenseName('');
      setFuelPrice('');
      setFuelLiters('');
      setOdoInitial('');
      setOdoFinal('');
      setSumFormula('');
      clearQuickRegisterDraft();
    }
  }, [activeShift]);

  // Persist the in-progress entry so it survives a forced reload (mobile HMR socket drop,
  // OS killing a backgrounded PWA, etc.) instead of silently wiping what was typed.
  // Debounced to avoid hammering localStorage on every keystroke.
  useEffect(() => {
    const draft: QuickRegisterDraft = {
      txType, platform, inType, paymentMethod, extraPaymentMethod,
      inputValue, expenseCategory, customExpenseName, fuelPrice, fuelLiters,
      fuelOdometerInput, km, description, appOfferInput, passengerAppInput, tipInput,
    };
    const timer = setTimeout(() => saveQuickRegisterDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [
    txType, platform, inType, paymentMethod, extraPaymentMethod,
    inputValue, expenseCategory, customExpenseName, fuelPrice, fuelLiters,
    fuelOdometerInput, km, description, appOfferInput, passengerAppInput, tipInput,
  ]);

  // Flush the draft immediately when the tab/app is about to be backgrounded or closed,
  // so the 300ms debounce window can't lose the last keystroke right before a reload/kill.
  useEffect(() => {
    const flush = () => {
      saveQuickRegisterDraft({
        txType, platform, inType, paymentMethod, extraPaymentMethod,
        inputValue, expenseCategory, customExpenseName, fuelPrice, fuelLiters,
        fuelOdometerInput, km, description, appOfferInput, passengerAppInput, tipInput,
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [
    txType, platform, inType, paymentMethod, extraPaymentMethod,
    inputValue, expenseCategory, customExpenseName, fuelPrice, fuelLiters,
    fuelOdometerInput, km, description, appOfferInput, passengerAppInput, tipInput,
  ]);

  // Capacity calculations for reactive fuel selection
  const carCapacity = (() => {
    const v = localStorage.getItem('moob_fuel_car_capacity');
    return v ? parseFloat(v) : 50;
  })();
  const motoCapacity = (() => {
    const v = localStorage.getItem('moob_fuel_moto_capacity');
    return v ? parseFloat(v) : 12;
  })();
  const activeCapacity = activeShift 
    ? (vehicleType === 'CAR' ? carCapacity : motoCapacity) 
    : (parseFloat(openingCapacity.replace(',', '.')) || (vehicleType === 'CAR' ? 50 : 12));

  const carConsumption = (() => {
    const v = localStorage.getItem('moob_fuel_car_consumption');
    return v ? parseFloat(v) : 12;
  })();
  const motoConsumption = (() => {
    const v = localStorage.getItem('moob_fuel_moto_consumption');
    return v ? parseFloat(v) : 35;
  })();
  const activeConsumption = activeShift 
    ? (vehicleType === 'CAR' ? carConsumption : motoConsumption) 
    : (parseFloat(openingConsumption.replace(',', '.')) || (vehicleType === 'CAR' ? 12 : 35));

  // --- INTER-SHIFT ODOMETER & FUEL CALCULATION ---
  // Calcula combustível restante e quanto falta para encher o tanque ao abrir novo caixa
  const interShiftMetrics = (() => {
    if (!lastClosedShift) return null;
    const prevFinalOdo = lastClosedShift.finalOdometer;
    const prevFinalFuelLiters = lastClosedShift.finalFuelLiters;
    if (!prevFinalFuelLiters || prevFinalFuelLiters <= 0) return { prevFinalOdo, prevFinalFuelLiters: undefined };

    const avgKmL = parseFloat(openingConsumption.replace(',', '.')) || (vehicleType === 'CAR' ? 12 : 35);
    const capacity = parseFloat(openingCapacity.replace(',', '.')) || (vehicleType === 'CAR' ? 50 : 12);
    const newOdo = parseOdometerInput(startingOdometerInput);
    const hasNewOdo = !isNaN(newOdo) && newOdo > 0;

    // km rodados entre o fechamento e a abertura do novo caixa
    const kmBetween = (prevFinalOdo && hasNewOdo && newOdo > prevFinalOdo)
      ? newOdo - prevFinalOdo : null;

    // combustível consumido entre os caixas (pelo km percorrido)
    const fuelConsumedBetween = (kmBetween !== null && avgKmL > 0)
      ? kmBetween / avgKmL : null;

    // litros restantes no tanque agora (sem abastecer)
    const litersNow = fuelConsumedBetween !== null
      ? Math.max(0, prevFinalFuelLiters - fuelConsumedBetween)
      : prevFinalFuelLiters; // sem novo hodômetro: usa o valor do fechamento

    // litros necessários para encher o tanque
    const litersToFill = Math.max(0, capacity - litersNow);

    return {
      prevFinalOdo,
      prevFinalFuelLiters,
      kmBetween,
      fuelConsumedBetween,
      litersNow,
      litersToFill,
      capacity,
      avgKmL,
    };
  })();

  const realTimeFuelCalc = (() => {
    if (!activeShift || !activeShift.initialOdometer) return null;
    const initialOdo = activeShift.initialOdometer;
    const currentOdo = parseOdometerInput(fuelOdometerInput);
    const distance = currentOdo > initialOdo ? (currentOdo - initialOdo) : 0;
    
    const litersConsumed = activeConsumption > 0 && distance > 0 ? (distance / activeConsumption) : 0;

    // Soma todos os abastecimentos já registrados neste turno para corrigir o nível atual do tanque
    const previousRefuelLiters = (activeShift.transactions || [])
      .filter(t => (t.category === 'COMBUSTIVEL' || (t.liters !== undefined && t.liters > 0)) && t.liters && t.liters > 0)
      .reduce((acc, t) => acc + (t.liters || 0), 0);

    const initialFuelLiters = activeShift.initialFuelLiters !== undefined ? activeShift.initialFuelLiters : activeCapacity;
    // Nível antes deste abastecimento = inicial + abastecimentos anteriores - consumido desde início
    const fuelBeforeRefuel = Math.max(0, initialFuelLiters + previousRefuelLiters - litersConsumed);
    const percentBeforeRefuel = (fuelBeforeRefuel / activeCapacity) * 100;
    
    const litersToRefuel = parseFuelLiters(fuelLiters);
    const fuelAfterRefuel = Math.min(activeCapacity, fuelBeforeRefuel + litersToRefuel);
    const percentAfterRefuel = (fuelAfterRefuel / activeCapacity) * 100;

    // km/L total do turno (combustível total consumido = inicial + reabastecimentos - o que sobrou antes deste)
    const totalFuelConsumedEstimate = Math.max(0, initialFuelLiters + previousRefuelLiters - fuelBeforeRefuel);
    const kmPerLTotal = distance > 0 && totalFuelConsumedEstimate > 0
      ? distance / totalFuelConsumedEstimate
      : undefined;

    // KM por plataforma e por fora (para exibir breakdown no auto-fill)
    const kmPorPlataforma = (activeShift.transactions || [])
      .filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual && (t.platform === 'UBER' || t.platform === '99'))
      .reduce((acc, t) => acc + (t.km || 0), 0);
    const kmPorFora = (activeShift.transactions || [])
      .filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual && t.platform === 'PARTICULAR')
      .reduce((acc, t) => acc + (t.km || 0), 0);

    // Find previous odometer reference for partial consumption calculation
    const fuelTxs = activeShift.transactions
      ? activeShift.transactions
          .filter(t => (t.category === 'COMBUSTIVEL' || t.liters !== undefined) && t.odometer !== undefined && t.odometer > 0)
          .sort((a, b) => (a.odometer || 0) - (b.odometer || 0))
      : [];
    
    const lastOdometerRef = fuelTxs.length > 0 ? fuelTxs[fuelTxs.length - 1].odometer : initialOdo;
    const isSinceLastRefuel = fuelTxs.length > 0;
    const actualLegDistance = (currentOdo > 0 && lastOdometerRef !== undefined && currentOdo > lastOdometerRef)
      ? (currentOdo - lastOdometerRef)
      : 0;
    const actualConsumption = (actualLegDistance > 0 && litersToRefuel > 0)
      ? (actualLegDistance / litersToRefuel)
      : undefined;
    
    return {
      initialOdo,
      currentOdo,
      distance,
      litersConsumed,
      initialFuelLiters,
      previousRefuelLiters,
      fuelBeforeRefuel,
      percentBeforeRefuel,
      litersToRefuel,
      fuelAfterRefuel,
      percentAfterRefuel,
      consumption: activeConsumption,
      lastOdometerRef,
      isSinceLastRefuel,
      actualLegDistance,
      actualConsumption,
      kmPerLTotal,
      kmPorPlataforma,
      kmPorFora,
      totalFuelConsumedEstimate
    };
  })();

  useEffect(() => {
    if (startingFuelLevel === 'CHEIO') {
      setStartingFuelLitersInput(maskFuelLiters((activeCapacity * 1000).toFixed(0)));
    } else if (startingFuelLevel === 'MEIO') {
      setStartingFuelLitersInput(maskFuelLiters(((activeCapacity / 2) * 1000).toFixed(0)));
    } else if (startingFuelLevel === 'RESERVA') {
      const reserveVal = vehicleType === 'CAR' ? 7 : 2;
      setStartingFuelLitersInput(maskFuelLiters((reserveVal * 1000).toFixed(0)));
    }
  }, [startingFuelLevel, vehicleType, activeCapacity]);
  
  // --- FUEL CALCULATOR SYNC & HANDLERS ---
  // Synchronize liters when total value or price changes
  useEffect(() => {
    if (txType === 'FUEL' || (expenseCategory === 'COMBUSTIVEL' && txType === 'OUT')) {
      const priceNum = parseFuelPrice(fuelPrice);
      const totalNum = parseInt(inputValue || '0', 10) / 100;
      
      // Only auto-calc liters if the user is NOT focusing the liters input field to prevent jumping while typing
      if (document.activeElement?.getAttribute('name') !== 'fuelLiters') {
        if (priceNum > 0 && totalNum > 0) {
          const calculatedLiters = totalNum / priceNum;
          const litersDigits = Math.round(calculatedLiters * 1000).toString();
          setFuelLiters(maskFuelLiters(litersDigits));
        } else if (totalNum === 0) {
          setFuelLiters('');
        }
      }
    }
  }, [inputValue, fuelPrice, expenseCategory, txType]);


  // Report the liters currently being typed into the refuel field to the parent so the
  // dashboard fuel gauge (ShiftControl) can move its needle live, even before the transaction is saved.
  useEffect(() => {
    if (!onDraftFuelLitersChange) return;
    const isFuelContext = txType === 'FUEL' || (txType === 'OUT' && expenseCategory === 'COMBUSTIVEL');
    onDraftFuelLitersChange(isFuelContext ? parseFuelLiters(fuelLiters) : 0);
  }, [fuelLiters, txType, expenseCategory, onDraftFuelLitersChange]);

  // Envia o nível atual recalculado (fuelBeforeRefuel) para o PainelBordo sempre que o motorista
  // digita o hodômetro no form de abastecimento — assim o ponteiro se move em tempo real.
  useEffect(() => {
    if (!onLiveFuelLevelChange) return;
    const isFuelContext = txType === 'FUEL' || (txType === 'OUT' && expenseCategory === 'COMBUSTIVEL');
    if (isFuelContext && realTimeFuelCalc && fuelOdometerInput) {
      onLiveFuelLevelChange(realTimeFuelCalc.fuelBeforeRefuel);
    } else {
      onLiveFuelLevelChange(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTimeFuelCalc?.fuelBeforeRefuel, fuelOdometerInput, txType, expenseCategory, onLiveFuelLevelChange]);

  // Clear the draft liters when this component unmounts (e.g. tab switch) so the gauge doesn't get stuck.
  useEffect(() => {
    return () => {
      onDraftFuelLitersChange?.(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calcula o hodômetro estimado: inicial + todos os km de plataformas (Uber/99) + corridas por fora (Particular)
  const calcEstimatedOdometer = (): number | null => {
    if (!activeShift || activeShift.initialOdometer === undefined) return null;
    const kmRodados = (activeShift.transactions || [])
      .filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual)
      .reduce((acc, t) => acc + (t.km || 0), 0);
    return activeShift.initialOdometer + kmRodados;
  };

  // Auto-fill the refuel odometer field with (odômetro inicial + km rodados) as soon as the user
  // enters the fuel flow, so they only need to correct it if it differs from the real reading.
  useEffect(() => {
    const isFuelContext = txType === 'FUEL' || (txType === 'OUT' && expenseCategory === 'COMBUSTIVEL');
    if (!isFuelContext || !activeShift || activeShift.initialOdometer === undefined || fuelOdometerInput) return;

    const est = calcEstimatedOdometer();
    if (est !== null) setFuelOdometerInput(formatOdometer(est));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txType, expenseCategory, activeShift]);

  const handleFuelPriceChange = (val: string) => {
    const masked = maskFuelPrice(val);
    setFuelPrice(masked);
    playBeep();

    const priceNum = parseFuelPrice(masked);
    const totalNum = parseInt(inputValue || '0', 10) / 100;
    const litersNum = parseFuelLiters(fuelLiters);

    if (priceNum > 0) {
      if (totalNum > 0) {
        const calculatedLiters = totalNum / priceNum;
        const litersDigits = Math.round(calculatedLiters * 1000).toString();
        setFuelLiters(maskFuelLiters(litersDigits));
      } else if (litersNum > 0) {
        const calculatedTotal = litersNum * priceNum;
        const totalCents = Math.round(calculatedTotal * 100).toString();
        setInputValue(totalCents);
      }
    }
  };

  const handleFuelTotalChange = (val: string) => {
    const centsStr = val.replace(/\D/g, '').replace(/^0+/, '');
    setInputValue(centsStr);
    playBeep();

    const totalNum = parseInt(centsStr || '0', 10) / 100;
    const priceNum = parseFuelPrice(fuelPrice);

    if (priceNum > 0) {
      if (totalNum > 0) {
        const calculatedLiters = totalNum / priceNum;
        const litersDigits = Math.round(calculatedLiters * 1000).toString();
        setFuelLiters(maskFuelLiters(litersDigits));
      } else {
        setFuelLiters('');
      }
    }
  };

  const handleFuelLitersChange = (val: string) => {
    const masked = maskFuelLiters(val);
    setFuelLiters(masked);
    playBeep();

    const litersNum = parseFuelLiters(masked);
    const priceNum = parseFuelPrice(fuelPrice);

    if (priceNum > 0) {
      if (litersNum > 0) {
        const calculatedTotal = litersNum * priceNum;
        const totalCents = Math.round(calculatedTotal * 100).toString();
        setInputValue(totalCents);
      } else {
        setInputValue('');
      }
    }
  };

  // Handle hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeShift) return;

      // While the Campanha modal is open, route keys to it exclusively so the
      // main register keypad/submit flow can't be triggered underneath it.
      if (isCampanhaOpen) {
        if (document.activeElement?.tagName === 'INPUT') return;

        if (e.key === 'Enter') {
          e.preventDefault();
          confirmCampanha();
        }
        if (e.key >= '0' && e.key <= '9') {
          pressCampanhaNum(e.key);
          playBeep();
        }
        if (e.key === 'Backspace') {
          pressCampanhaBackspace();
          playBeep();
        }
        if (e.key === 'Escape') {
          setIsCampanhaOpen(false);
        }
        return;
      }
      
      // If user typing in a text field, don't trigger global hotkeys
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== valueInputRef.current) {
        return;
      }

      // Enter key confirms registration
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSubmit();
      }
      
      // Direct numeric entry for the virtual LCD register when no text field is focused
      if (e.key >= '0' && e.key <= '9') {
        pressNum(e.key);
        playBeep();
      }

      // Backspace removes digit
      if (e.key === 'Backspace') {
        pressBackspace();
        playBeep();
      }

      // Clear with Escape or 'C' / 'c'
      if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        pressClear();
        playErrorBeep();
      }
      
      // Shortcuts
      // 'u' or 'U' set platform Uber
      if ((e.key === 'u' || e.key === 'U') && document.activeElement !== valueInputRef.current) {
        setPlatform('UBER');
        playBeep();
      }
      // 'n' or 'N' set platform 99
      if ((e.key === 'n' || e.key === 'N' || e.key === '9') && document.activeElement !== valueInputRef.current) {
        setPlatform('99');
        playBeep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, txType, platform, paymentMethod, expenseCategory, km, description, activeShift, isCampanhaOpen, campanhaInput]);

  // Keypad numbers (cents accumulation model)
  const pressNum = (num: string) => {
    setInputValue(prev => {
      if (num === '00' && (prev === '' || prev === '0')) {
        return '';
      }
      const next = prev + num;
      if (next.length > 7) return prev; // Limit to 9.999,99 max
      return next.replace(/^0+/, ''); // strip leading zeroes
    });
  };

  const pressBackspace = () => {
    setInputValue(prev => {
      if (prev.length <= 1) return '';
      return prev.slice(0, -1);
    });
  };

  const pressClear = () => {
    setInputValue('');
  };

  // Add fixed amount in Reais
  const addQuickAmount = (amount: number) => {
    const cents = parseInt(inputValue || '0', 10);
    const newCents = cents + (amount * 100);
    setInputValue(newCents.toString());
    playBeep();
  };

  // Campanha keypad (independent from the main entry keypad)
  const pressCampanhaNum = (num: string) => {
    setCampanhaInput(prev => {
      if (num === '00' && (prev === '' || prev === '0')) {
        return '';
      }
      const next = prev + num;
      if (next.length > 7) return prev;
      return next.replace(/^0+/, '');
    });
  };

  const pressCampanhaBackspace = () => {
    setCampanhaInput(prev => (prev.length <= 1 ? '' : prev.slice(0, -1)));
  };

  const pressCampanhaClear = () => {
    setCampanhaInput('');
  };

  const campanhaCents = parseInt(campanhaInput || '0', 10);
  const campanhaValue = campanhaCents / 100;

  const confirmCampanha = () => {
    if (!campanhaValue || campanhaValue <= 0) {
      playErrorBeep();
      return;
    }
    onAddTransaction({
      type: 'IN',
      platform,
      category: 'CAMPANHA',
      value: campanhaValue,
      paymentMethod: 'APP',
      description: `Campanha ${platform === 'UBER' ? 'Uber' : platform === '99' ? '99' : 'Particular'}`,
      isVirtual: false
    });
    playCashRegister();
    setCampanhaInput('');
    setIsCampanhaOpen(false);
  };

  const centsValue = parseInt(inputValue || '0', 10);
  const cleanValue = centsValue / 100;
  const parsedOffer = appOfferInput ? parseBRLInput(appOfferInput) : 0;
  const parsedPassengerApp = passengerAppInput ? parseBRLInput(passengerAppInput) : 0;
  const hasExtra = txType === 'IN' && (platform === 'UBER' || platform === '99') && paymentMethod === 'APP' && cleanValue > 0 && parsedOffer > 0;
  const extraAmount = hasExtra ? calculateExtraValue(cleanValue, parsedOffer, parsedPassengerApp) : 0;

  const triggerSubmit = () => {
    if (txType === 'IN' && inType === 'CORRIDA' && !paymentMethod) {
      playErrorBeep();
      setErrorMsg('Por favor, informe a forma de pagamento da corrida (Pix, Dinheiro ou Direto no App)!');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (txType === 'IN' && inType === 'CANCELAMENTO' && !paymentMethod) {
      playErrorBeep();
      setErrorMsg('Por favor, informe como recebeu a taxa de cancelamento (Pix, Dinheiro ou Direto no App)!');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if ((txType === 'OUT' || txType === 'FUEL') && !paymentMethod) {
      playErrorBeep();
      setErrorMsg(`Por favor, informe a forma de pagamento ${txType === 'FUEL' ? 'do abastecimento' : 'da despesa'} (Pix ou Dinheiro)!`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    // Bloqueia a despesa se não houver saldo suficiente na forma de pagamento escolhida (Pix ou Dinheiro).
    if ((txType === 'OUT' || txType === 'FUEL') && (paymentMethod === 'PIX' || paymentMethod === 'DINHEIRO') && activeShift) {
      const expenseValue = cleanValue;
      if (!isNaN(expenseValue) && expenseValue > 0) {
        const financialTotals = computeFinancialTotals(activeShift, 'REGISTER', []);
        const availableBalance = paymentMethod === 'PIX' ? financialTotals.expectedPixBalance : financialTotals.expectedPocketCash;
        if (expenseValue > availableBalance) {
          playErrorBeep();
          setErrorMsg(`Saldo insuficiente em ${paymentMethod === 'PIX' ? 'Pix' : 'Dinheiro'} (disponível: R$ ${formatDecimalBRL(Math.max(0, availableBalance))}). A despesa não pode ser lançada.`);
          setTimeout(() => setErrorMsg(null), 5000);
          return;
        }
      }
    }

    let finalValue = cleanValue;
    let finalPassengerValue: number | undefined = undefined;
    let appOfferVal: number | undefined = undefined;
    let passengerAppVal: number | undefined = undefined;
    const parsedTip = (txType === 'IN' && inType === 'CORRIDA' && tipInput) ? parseBRLInput(tipInput) : 0;

    if (txType === 'IN' && inType === 'CANCELAMENTO') {
      if (isNaN(cleanValue) || cleanValue <= 0) {
        playErrorBeep();
        setErrorMsg('Favor inserir o valor da taxa de cancelamento.');
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }

      const baseDesc = description.trim() || `Taxa Cancelamento ${platform === 'UBER' ? 'Uber' : platform === '99' ? '99' : 'Particular'}`;

      onAddTransaction({
        type: 'IN',
        platform,
        category: 'CANCELAMENTO',
        value: cleanValue,
        paymentMethod: paymentMethod!,
        description: baseDesc,
        km: km ? parseKMInput(km, decimals) : undefined,
        isVirtual: false
      });

      playCashRegister();
      setInputValue('');
      setKm('');
      setDescription('');
      setAppOfferInput('');
      setPassengerAppInput('');
      setCustomExpenseName('');
      clearQuickRegisterDraft();
      return;
    }



    if (txType === 'IN' && (platform === 'UBER' || platform === '99')) {
      const parsedOffer = appOfferInput ? parseBRLInput(appOfferInput) : 0;
      if (parsedOffer <= 0) {
        playErrorBeep();
        setErrorMsg('Favor preencher o valor que o app mostrou na chamada.');
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }

      const parsedPassengerApp = passengerAppInput ? parseBRLInput(passengerAppInput) : 0;
      if (parsedPassengerApp <= 0) {
        playErrorBeep();
        setErrorMsg('Favor preencher o valor pago pelo passageiro ao aplicativo.');
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }

      appOfferVal = parsedOffer;
      passengerAppVal = parsedPassengerApp;

      let extra = 0;
      if (paymentMethod === 'APP') {
        // Corrida direto no app: o ofertado SEMPRE vai pro saldo do app.
        // O extra = valor digitado na calculadora − valor ofertado (o que o
        // passageiro pagou diretamente ao motorista, fora do app).
        finalValue = parsedOffer;
        extra = extraAmount; // extraAmount = calculateExtraValue(cleanValue, parsedOffer, parsedPassengerApp)
      } else {
        // Não-APP (Pix/Dinheiro/Cartão): motorista recebe diretamente do passageiro.
        // O valor digitado na calculadora é o que foi efetivamente recebido.
        finalValue = cleanValue > 0 ? cleanValue : parsedOffer;
        extra = 0;
      }
      
      finalPassengerValue = parsedPassengerApp;
      const baseDesc = description.trim() || `${platform === 'UBER' ? 'Corrida UberX' : 'Corrida 99Pop'}${km ? ` (${km} KM)` : ''}`;

      onAddTransaction({
        type: txType,
        platform,
        category: 'CORRIDA',
        value: finalValue,
        paymentMethod: paymentMethod,
        description: baseDesc,
        km: km ? parseKMInput(km, decimals) : undefined,
        passengerValue: finalPassengerValue,
        appOfferValue: appOfferVal,
        passengerAppValue: passengerAppVal,
        tipValue: parsedTip > 0 ? parsedTip : undefined,
        keypadValue: cleanValue > 0 ? cleanValue : undefined,
        extraChargedValue: extra,
        extraPaymentMethod: paymentMethod === 'APP' ? extraPaymentMethod : undefined,
        isVirtual: false
      });

      playCashRegister();
      // Reset fields
      setInputValue('');
      setKm('');
      setDescription('');
      setAppOfferInput('');
      setPassengerAppInput('');
      setTipInput('');
      setPaymentMethod(null);
      setCustomExpenseName('');
      clearQuickRegisterDraft();
      return;
    } else {
      if (isNaN(cleanValue) || cleanValue <= 0) {
        playErrorBeep();
        setErrorMsg('Favor inserir um valor maior que R$ 0,00.');
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      finalValue = cleanValue;
      if (txType === 'IN') {
        finalPassengerValue = cleanValue;
      }
    }

    let fuelDetailsSuffix = '';
    let litersVal: number | undefined = undefined;
    let pricePerLiterVal: number | undefined = undefined;

    if (txType === 'FUEL' || (txType === 'OUT' && expenseCategory === 'COMBUSTIVEL')) {
      const priceNum = parseFuelPrice(fuelPrice);
      const litersNum = parseFuelLiters(fuelLiters);
      if (priceNum > 0 && litersNum > 0) {
        fuelDetailsSuffix = ` (${fuelLiters}L a R$ ${fuelPrice}/L)`;
        litersVal = litersNum;
        pricePerLiterVal = priceNum;
      }
    }

    const finalDesc = description.trim() 
      ? (description.trim() + fuelDetailsSuffix)
      : (
        txType === 'IN' 
          ? `${platform === 'UBER' ? 'Corrida UberX' : platform === '99' ? 'Corrida 99Pop' : 'Corrida Particular'}${km ? ` (${km} KM)` : ''}`
          : txType === 'FUEL'
            ? `${vehicleType === 'BIKE' ? 'Abastecimento Moto' : 'Abastecimento Carro'}${fuelDetailsSuffix}`
            : `${customExpenseName.trim() || (expenseCategory === 'COMBUSTIVEL' ? (vehicleType === 'BIKE' ? 'Abastecimento Moto' : 'Abastecimento Carro') : expenseCategory === 'ALIMENTACAO' ? 'Alimentação em Trânsito' : expenseCategory === 'LAVAGEM' ? (vehicleType === 'BIKE' ? 'Lavagem Moto' : 'Ducha Automotiva') : expenseCategory === 'MANUTENCAO' ? (vehicleType === 'BIKE' ? 'Oficina/Peças Moto' : 'Oficina/Peças') : 'Outros Gastos')}${fuelDetailsSuffix}`
      );

    const fuelOdometerVal = ((txType === 'FUEL' || (txType === 'OUT' && expenseCategory === 'COMBUSTIVEL')) && fuelOdometerInput) 
      ? parseOdometerInput(fuelOdometerInput) 
      : undefined;

    onAddTransaction({
      type: txType === 'FUEL' ? 'OUT' : txType,
      platform: (txType === 'OUT' || txType === 'FUEL') ? 'GERAL' : platform,
      category: txType === 'IN' ? 'CORRIDA' : (txType === 'FUEL' ? 'COMBUSTIVEL' : (customExpenseName.trim() || expenseCategory)),
      value: finalValue,
      paymentMethod: paymentMethod || 'DINHEIRO', // Now correctly uses the active paymentMethod state (Pix, Dinheiro, Cartão, App)
      description: finalDesc,
      km: km ? parseKMInput(km, decimals) : undefined,
      passengerValue: finalPassengerValue,
      appOfferValue: appOfferVal,
      passengerAppValue: passengerAppVal,
      tipValue: (txType === 'IN' && inType === 'CORRIDA' && parsedTip > 0) ? parsedTip : undefined,
      liters: litersVal,
      pricePerLiter: pricePerLiterVal,
      odometer: fuelOdometerVal
    });

    // Success sound feed
    if (txType === 'IN') {
      playCashRegister();
    } else {
      playBeep();
    }

    // Reset fields
    setInputValue('');
    setKm('');
    setDescription('');
    setAppOfferInput('');
    setPassengerAppInput('');
    setTipInput('');
    setPaymentMethod(null);
    setCustomExpenseName('');
    setFuelPrice('');
    setFuelLiters('');
    setFuelOdometerInput('');
    clearQuickRegisterDraft();
  };

  if (!activeShift) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center max-w-sm sm:max-w-md mx-auto shadow-lg">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Coins className="w-6 h-6 text-amber-500 animate-pulse" />
        </div>
        <h3 className="text-base font-extrabold text-white mb-1.5 font-sans">Caixa Fechado</h3>
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
          Para iniciar o registro de corridas e o faturamento do seu turno, abra uma nova seção de caixa informando o saldo inicial do seu dia.
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-805 text-left mb-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 tracking-wider uppercase border-b border-slate-805 pb-1.5 flex items-center justify-between">
            <span>Saldos Iniciais do Turno</span>
            <span className="text-[12.5px] font-mono lowercase text-slate-500 font-normal">especifique pix e dinheiro</span>
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[14px] font-extrabold text-amber-500 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>🎯</span> Meta Mensal de Faturamento Real
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-sm font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="6.000,00"
                  value={startingMonthlyGoalInput}
                  onChange={(e) => {
                    const masked = maskBRL(e.target.value);
                    setStartingMonthlyGoalInput(masked);
                    localStorage.setItem('moob_caixa_monthly_goal', masked);
                  }}
                />
              </div>
              <div className="flex items-center justify-between bg-slate-900/40 p-2 rounded-lg border border-slate-800/85 mt-2">
                <div className="flex flex-col text-left">
                  <span className="text-[12.5px] font-bold text-slate-300">Desconsiderar Domingos</span>
                  <span className="text-[11px] text-slate-500 leading-tight">Calcula metas diárias/semanais sem contar domingo</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleExcludeSundays(!excludeSundays)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    excludeSundays ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                      excludeSundays ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {startingMonthlyGoalInput && (() => {
                const numMonthlyGoal = parseBRLInput(startingMonthlyGoalInput) || 0;
                const daysInMonth = excludeSundays ? 26 : 30;
                const daysInWeek = excludeSundays ? 6 : 7;
                const calculatedDailyGoal = numMonthlyGoal / daysInMonth;
                const calculatedWeeklyGoal = calculatedDailyGoal * daysInWeek;
                return (
                  <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850/40 text-[13px] mt-1.5 font-mono">
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-bold">Meta Diária ({daysInMonth}d)</span>
                      <span className="text-emerald-400 font-bold">R$ {formatDecimalBRL(calculatedDailyGoal)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-bold">Meta Semanal ({daysInWeek}d)</span>
                      <span className="text-cyan-400 font-bold">R$ {formatDecimalBRL(calculatedWeeklyGoal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-[14px] font-extrabold text-indigo-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>🛣️</span> Meta Diária de KM Rodados
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                  KM
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-white text-sm font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="150"
                  value={startingDailyKmGoalInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    setStartingDailyKmGoalInput(cleaned);
                    localStorage.setItem('moob_caixa_daily_km_goal', cleaned);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-extrabold text-emerald-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>💵</span> Dinheiro Físico (Troco)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="0,00"
                  value={startingCashBalanceInput}
                  onChange={(e) => {
                    const masked = maskBRL(e.target.value);
                    setStartingCashBalanceInput(masked);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-extrabold text-cyan-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>⚡</span> Saldo Pix Inicial
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="0,00"
                  value={startingPixBalanceInput}
                  onChange={(e) => {
                    const masked = maskBRL(e.target.value);
                    setStartingPixBalanceInput(masked);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-extrabold text-amber-500 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>📟</span> Odômetro Inicial (KM)
              </label>

              {/* Referência do hodômetro final do último caixa */}
              {interShiftMetrics?.prevFinalOdo && (
                <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-1.5 mb-2">
                  <span className="text-[12.5px] text-slate-400 font-bold">🔒 Hodômetro final do último caixa:</span>
                  <span className="text-[13px] font-black text-amber-400 font-mono">{formatOdometer(interShiftMetrics.prevFinalOdo)} km</span>
                </div>
              )}

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-500 font-mono">
                  KM
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: 54120"
                  value={startingOdometerInput}
                  onChange={(e) => {
                    const masked = maskOdometer(e.target.value);
                    setStartingOdometerInput(masked);
                  }}
                />
              </div>
              <span className="text-[12.5px] text-amber-500 font-bold block mt-0.5">* Obrigatório. Permite calcular KM totais e consumo no fechamento.</span>

              {/* Painel inter-turno: litros no tanque e quanto falta para encher */}
              {interShiftMetrics && interShiftMetrics.prevFinalFuelLiters !== undefined && (
                <div className="mt-2 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 space-y-2.5">
                  <p className="text-[11.5px] font-black text-slate-500 uppercase tracking-widest">⛽ Combustível — referência do último caixa</p>

                  {/* Sem abastecer */}
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                    interShiftMetrics.litersNow < 5
                      ? 'bg-rose-950/40 border-rose-800/50'
                      : interShiftMetrics.litersNow < 10
                      ? 'bg-amber-950/40 border-amber-800/50'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}>
                    <span className="text-[13px] font-bold text-slate-300">Se sair sem abastecer</span>
                    <span className={`text-[15px] font-black font-mono ${
                      interShiftMetrics.litersNow < 5 ? 'text-rose-400'
                      : interShiftMetrics.litersNow < 10 ? 'text-amber-400'
                      : 'text-white'
                    }`}>
                      {interShiftMetrics.litersNow.toFixed(2).replace('.', ',')} L
                    </span>
                  </div>

                  {/* Para encher o tanque */}
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-950/30 border border-emerald-800/40">
                    <span className="text-[13px] font-bold text-slate-300">Para encher o tanque</span>
                    <span className="text-[15px] font-black font-mono text-emerald-400">
                      {interShiftMetrics.litersToFill.toFixed(2).replace('.', ',')} L
                    </span>
                  </div>

                  {/* Botão usar estimativa */}
                  <button
                    type="button"
                    onClick={() => {
                      setStartingFuelLevel('CUSTOM');
                      setStartingFuelLitersInput(maskFuelLiters((interShiftMetrics.litersNow * 1000).toFixed(0)));
                      playBeep();
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[12px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all"
                  >
                    Usar {interShiftMetrics.litersNow.toFixed(2).replace('.', ',')} L no campo de combustível
                  </button>
                </div>
              )}
            </div>

            {/* CONFIGURAÇÃO DE CONSUMO E TANQUE (ANTES DE ABRIR O CAIXA) */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
              <div>
                <label className="block text-[14px] font-extrabold text-amber-500 tracking-wider uppercase mb-1 flex items-center gap-1">
                  <span>⛽</span> Tanque ({vehicleType === 'CAR' ? 'Carro' : 'Moto'})
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm font-black font-mono focus:border-amber-500 focus:outline-none"
                    placeholder={vehicleType === 'CAR' ? "50" : "12"}
                    value={openingCapacity}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                      setOpeningCapacity(cleaned);
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-slate-500">
                    Litros
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-extrabold text-amber-500 tracking-wider uppercase mb-1 flex items-center gap-1">
                  <span>⏱️</span> Consumo Médio
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm font-black font-mono focus:border-amber-500 focus:outline-none"
                    placeholder={vehicleType === 'CAR' ? "12" : "35"}
                    value={openingConsumption}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                      setOpeningConsumption(cleaned);
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-slate-500">
                    KM/L
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-extrabold text-amber-500 tracking-wider uppercase mb-1 flex items-center gap-1">
                <span>⛽</span> Combustível no Tanque Inicial
              </label>
              
              <div className="grid grid-cols-4 gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartingFuelLevel('CHEIO');
                    playBeep();
                  }}
                  className={`py-1.5 px-0.5 rounded-md text-[12px] font-black uppercase transition-all border text-center ${
                    startingFuelLevel === 'CHEIO'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Cheio ({activeCapacity}L)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartingFuelLevel('MEIO');
                    playBeep();
                  }}
                  className={`py-1.5 px-0.5 rounded-md text-[12px] font-black uppercase transition-all border text-center ${
                    startingFuelLevel === 'MEIO'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  1/2 ({(activeCapacity / 2).toFixed(1).replace('.', ',')}L)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartingFuelLevel('RESERVA');
                    playBeep();
                  }}
                  className={`py-1.5 px-0.5 rounded-md text-[12px] font-black uppercase transition-all border text-center ${
                    startingFuelLevel === 'RESERVA'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Reserva ({vehicleType === 'CAR' ? '7' : '2'}L)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartingFuelLevel('CUSTOM');
                    setStartingFuelLitersInput('');
                    playBeep();
                  }}
                  className={`py-1.5 px-0.5 rounded-md text-[12px] font-black uppercase transition-all border text-center ${
                    startingFuelLevel === 'CUSTOM'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Digitar
                </button>
              </div>

              {/* Physical Interactive Gauge */}
              {(() => {
                const parsedLiters = startingFuelLitersInput ? parseFuelLiters(startingFuelLitersInput) : 0;
                const fuelPercentage = activeCapacity > 0 ? Math.max(0, Math.min(100, (parsedLiters / activeCapacity) * 100)) : 0;
                
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
                const totalTicks = vehicleType === 'BIKE' ? 7 : (8 * N);

                const allPositions: { value: number; isMajor: boolean; label?: string; percentage: number; angle: number; liters: number }[] = [];
                for (let i = 0; i <= totalTicks; i++) {
                  let percentage = (i / totalTicks) * 100;
                  if (vehicleType === 'BIKE') {
                    percentage = i <= 5 ? (i / 5) * 50 : 50 + ((i - 5) / 2) * 50;
                  }
                  const liters = (percentage / 100) * activeCapacity;
                  
                  if (vehicleType === 'BIKE') {
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
                  playBeep();
                  const targetLiters = (targetPerc / 100) * activeCapacity;
                  
                  let levelName = 'CUSTOM';
                  if (tickIndex === totalTicks) {
                    levelName = 'CHEIO';
                  } else if (vehicleType === 'BIKE' ? tickIndex === 5 : tickIndex === 4 * N) {
                    levelName = 'MEIO';
                  } else if (vehicleType === 'BIKE' ? tickIndex === 2 : tickIndex === N) {
                    levelName = 'RESERVA';
                  }
                  
                  setStartingFuelLevel(levelName as any);
                  const litersDigits = Math.round(targetLiters * 1000).toString();
                  setStartingFuelLitersInput(maskFuelLiters(litersDigits));
                };

                return (
                  <div className="mt-2.5 mb-3 bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex flex-col items-center relative overflow-hidden">
                    {/* Inner glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.03)_0%,transparent_70%)] pointer-events-none" />
                    
                    <div className="w-full flex justify-between items-center text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                      <span className="flex items-center gap-1">
                        <span>⛽</span> Marcador de Combustível ({vehicleType === 'CAR' ? 'Carro' : 'Moto'})
                      </span>
                      <span className="font-mono text-[12.5px] text-slate-300 font-black">
                        {parsedLiters.toFixed(1).replace('.', ',')}L / {activeCapacity.toString().replace('.', ',')}L ({fuelPercentage.toFixed(0)}%)
                      </span>
                    </div>

                    {/* Physical Instrument Gauge (SVG) */}
                    <div className="relative">
                      {vehicleType === 'BIKE' ? (
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
                            const snappedPerc = vehicleType === 'BIKE'
                              ? (tickIndex <= 5 ? (tickIndex / 5) * 50 : 50 + ((tickIndex - 5) / 2) * 50)
                              : (tickIndex / totalTicks) * 100;
                            handleSetFuelTick(tickIndex, snappedPerc);
                          }}
                        >
                          <defs>
                            {/* Dashboard textured plastic plate */}
                            <linearGradient id="motoDashPlate_qr" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#2e3542" />
                              <stop offset="60%" stopColor="#1f242e" />
                              <stop offset="100%" stopColor="#11141b" />
                            </linearGradient>

                            {/* Pivot black textured cap */}
                            <radialGradient id="pivotCap_qr" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                              <stop offset="0%" stopColor="#4b5563" />
                              <stop offset="50%" stopColor="#1f2937" />
                              <stop offset="100%" stopColor="#030712" />
                            </radialGradient>

                            {/* Shiny physical screw radial gradient */}
                            <radialGradient id="screwGrad_qr" cx="35%" cy="35%" r="65%">
                              <stop offset="0%" stopColor="#f1f5f9" />
                              <stop offset="40%" stopColor="#cbd5e1" />
                              <stop offset="85%" stopColor="#64748b" />
                              <stop offset="100%" stopColor="#334155" />
                            </radialGradient>

                            {/* Red glow for warning region */}
                            <radialGradient id="redGlow_qr" cx="64.1%" cy="110%" r="25%">
                              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.25)" />
                              <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                            </radialGradient>
                          </defs>

                          {/* Outer Dashboard cluster body with custom angled cuts */}
                          <path
                            d="M 12 12 L 228 12 C 234 12, 238 18, 236 26 L 226 98 C 224 104, 218 108, 210 108 L 30 108 C 22 108, 16 104, 14 98 L 4 26 C 2 18, 6 12, 12 12 Z"
                            fill="url(#motoDashPlate_qr)"
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
                                  fill="url(#redGlow_qr)"
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
                          <circle cx="185" cy="54" r="23" fill="url(#pivotCap_qr)" stroke="#0f172a" strokeWidth="2.5" className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" />
                          <circle cx="185" cy="54" r="13" fill="#111827" stroke="#374151" strokeWidth="1.5" />
                          
                          {/* Inner dark center pinning screw */}
                          <circle cx="185" cy="54" r="6.5" fill="#030712" />
                          <circle cx="185" cy="54" r="2.5" fill="#1f2937" />

                          {/* Decorative silver screw head on the bottom right */}
                          <circle cx="212" cy="94" r="5.5" fill="url(#screwGrad_qr)" stroke="#111827" strokeWidth="1" />
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
                        // Standard Car Instrument Gauge
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
                            <linearGradient id="carDashPlate_qr" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#2e3542" />
                              <stop offset="60%" stopColor="#1f242e" />
                              <stop offset="100%" stopColor="#11141b" />
                            </linearGradient>
                          </defs>

                          {/* Outer Dashboard cluster body with custom angled cuts */}
                          <path
                            d="M 12 8 L 228 8 C 234 8, 238 14, 238 21 L 238 108 C 238 113, 234 116, 228 116 L 12 116 C 6 116, 2 113, 2 108 L 2 21 C 2 14, 6 8, 12 8 Z"
                            fill="url(#carDashPlate_qr)"
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

                    {/* Adjust needle helper info */}
                    <div className="w-full mt-1.5 text-center">
                      <p className="text-sm text-slate-400 italic leading-none">
                        *Clique diretamente em qualquer um dos {allPositions.length} traços ou nas letras para posicionar o ponteiro!
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] font-extrabold text-slate-500 font-sans tracking-wider">
                  LITROS
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-14 pr-3 text-white text-base font-black font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="0,000"
                  disabled={startingFuelLevel !== 'CUSTOM'}
                  value={startingFuelLitersInput}
                  onChange={(e) => {
                    if (startingFuelLevel === 'CUSTOM') {
                      const masked = maskFuelLiters(e.target.value);
                      setStartingFuelLitersInput(masked);
                    }
                  }}
                />
              </div>
              <span className="text-[12.5px] text-slate-505 italic block mt-0.5 leading-tight">
                {startingFuelLevel === 'CUSTOM' 
                  ? 'Digite a quantidade exata de litros no tanque.' 
                  : 'Calculado automaticamente baseado nas configurações do seu veículo.'}
              </span>

            </div>

            {/* Saldos das Apps / Plataformas (Obrigatório) */}
            <div className="border-t border-slate-805/85 pt-3 mt-1 space-y-3">
              <span className="block text-[12.5px] font-black text-slate-400 uppercase tracking-widest">
                Saldos em Apps / Plataformas (Obrigatório)
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Uber Starting Balance */}
                <div>
                  <label className="block text-[14px] font-bold text-slate-300 tracking-wider uppercase mb-1 flex items-center justify-between">
                    <span className="truncate">⚫ Uber</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsStartingUberNegative(prev => !prev);
                        playBeep();
                      }}
                      className={`text-[12px] px-1 py-0.5 rounded font-black border transition-all shrink-0 ${
                        isStartingUberNegative 
                          ? 'bg-rose-950 text-rose-450 border-rose-900/50' 
                          : 'bg-emerald-950 text-emerald-400 border-emerald-900/50'
                      }`}
                    >
                      {isStartingUberNegative ? 'DEVENDO (-)' : 'POSITIVO (+)'}
                    </button>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-500 font-mono">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-2 text-white text-xs font-black font-mono focus:border-slate-500 focus:outline-none"
                      placeholder="0,00"
                      value={startingUberBalanceInput}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setStartingUberBalanceInput(masked);
                      }}
                    />
                  </div>
                </div>

                {/* 99 Starting Balance */}
                <div>
                  <label className="block text-[14px] font-bold text-slate-300 tracking-wider uppercase mb-1 flex items-center justify-between">
                    <span className="truncate">🟡 99 App</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsStarting99Negative(prev => !prev);
                        playBeep();
                      }}
                      className={`text-[12px] px-1 py-0.5 rounded font-black border transition-all shrink-0 ${
                        isStarting99Negative 
                          ? 'bg-rose-950 text-rose-450 border-rose-900/50' 
                          : 'bg-emerald-950 text-emerald-400 border-emerald-900/50'
                      }`}
                    >
                      {isStarting99Negative ? 'DEVENDO (-)' : 'POSITIVO (+)'}
                    </button>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-500 font-mono">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-2 text-white text-xs font-black font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="0,00"
                      value={starting99BalanceInput}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setStarting99BalanceInput(masked);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-2.5 border-t border-slate-850/80 flex justify-between items-center text-[14px] text-slate-400">
            <span className="font-extrabold text-slate-500">TOTAL COMBINADO:</span>
            <span className="font-black text-amber-500 text-xs font-mono">
              R$ {formatDecimalBRL((parseBRLInput(startingCashBalanceInput || '0') || 0) + (parseBRLInput(startingPixBalanceInput || '0') || 0))}
            </span>
          </div>

          {lastClosedShiftFaturamento > 0 && (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-2 mt-2 text-left">
              <div className="flex justify-between items-center text-[14px] text-slate-400">
                <span className="font-bold">Faturamento Real Anterior:</span>
                <span className="font-bold text-white font-mono">R$ {formatDecimalBRL(lastClosedShiftFaturamento)}</span>
              </div>
              <div className="flex justify-between items-center text-[14px] text-slate-400">
                <span className="font-bold">Valor de Entrada Atual:</span>
                <span className="font-bold text-amber-500 font-mono">
                  R$ {formatDecimalBRL((parseBRLInput(startingCashBalanceInput || '0') || 0) + (parseBRLInput(startingPixBalanceInput || '0') || 0))}
                </span>
              </div>
              
              {(() => {
                const entryVal = (parseBRLInput(startingCashBalanceInput || '0') || 0) + (parseBRLInput(startingPixBalanceInput || '0') || 0);
                const diff = entryVal - lastClosedShiftFaturamento;
                if (diff < 0) {
                  return (
                    <div className="bg-rose-950/20 border border-rose-900/30 rounded-lg p-2 text-[13px] text-rose-400 font-medium leading-relaxed">
                      ⚠️ Entrada menor que o saldo anterior! O sistema registrará um ajuste de 
                      <strong className="text-rose-300 font-bold"> -R$ {formatDecimalBRL(Math.abs(diff))}</strong> no faturamento deste caixa.
                    </div>
                  );
                } else if (diff > 0) {
                  return (
                    <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-2 text-[13px] text-emerald-400 font-medium leading-relaxed">
                      🎉 Entrada maior que o saldo anterior! O sistema acrescentará um ajuste de 
                      <strong className="text-emerald-300 font-bold"> +R$ {formatDecimalBRL(diff)}</strong> no faturamento deste caixa.
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-slate-850/30 border border-slate-750/30 rounded-lg p-2 text-[13px] text-slate-400 font-medium leading-relaxed">
                      ℹ️ Entrada igual ao saldo anterior. O faturamento continuará sem ajustes.
                    </div>
                  );
                }
              })()}
            </div>
          )}

          {openingError && (
            <div className="bg-rose-950/45 border border-rose-900/50 rounded-lg p-2.5 text-[14px] text-rose-455 font-extrabold uppercase font-mono tracking-wider flex items-center gap-1.5 justify-center text-center">
              ⚠️ {openingError}
            </div>
          )}

          <p className="text-[14px] text-slate-505 italic leading-snug">
            * O saldo inicial representa o volume de dinheiro em papel e/ou saldo em Pix que você tem disponível para iniciar o caixa.
          </p>
        </div>

        <button
          onClick={() => {
            const pixVal = startingPixBalanceInput ? (parseBRLInput(startingPixBalanceInput) || 0) : 0;
            const cashVal = startingCashBalanceInput ? (parseBRLInput(startingCashBalanceInput) || 0) : 0;

            if (!startingOdometerInput || startingOdometerInput.trim() === '') {
              setOpeningError("O PREENCHIMENTO DO ODÔMETRO INICIAL É OBRIGATÓRIO");
              return;
            }
            const odoVal = parseOdometerInput(startingOdometerInput);
            if (isNaN(odoVal) || odoVal <= 0) {
              setOpeningError("INFORME UM VALOR VÁLIDO E MAIOR QUE ZERO PARA O ODÔMETRO INICIAL");
              return;
            }

            const uberVal = startingUberBalanceInput 
              ? (parseBRLInput(startingUberBalanceInput) || 0) * (isStartingUberNegative ? -1 : 1) 
              : 0;

            const ninetyNineVal = starting99BalanceInput 
              ? (parseBRLInput(starting99BalanceInput) || 0) * (isStarting99Negative ? -1 : 1) 
              : 0;

            const fuelLitersVal = startingFuelLitersInput ? parseFuelLiters(startingFuelLitersInput) : 0;
            const fuelLevelLabel = startingFuelLevel === 'CHEIO' ? 'Cheio' :
                                   startingFuelLevel === 'MEIO' ? 'Meio Tanque' :
                                   startingFuelLevel === 'RESERVA' ? 'Reserva' : 'Digitado';

            // Save pre-shift configuration
            const parsedCapacity = parseFloat(openingCapacity.replace(',', '.')) || (vehicleType === 'CAR' ? 50 : 12);
            const parsedConsumption = parseFloat(openingConsumption.replace(',', '.')) || (vehicleType === 'CAR' ? 12 : 35);
            localStorage.setItem(vehicleType === 'CAR' ? 'moob_fuel_car_capacity' : 'moob_fuel_moto_capacity', String(parsedCapacity));
            localStorage.setItem(vehicleType === 'CAR' ? 'moob_fuel_car_consumption' : 'moob_fuel_moto_consumption', String(parsedConsumption));

            setOpeningError(null);
            const monthlyGoalVal = parseBRLInput(startingMonthlyGoalInput) || 0;
            const dailyKmGoalVal = startingDailyKmGoalInput ? parseInt(startingDailyKmGoalInput, 10) : undefined;
            onOpenShift(pixVal, cashVal, odoVal, uberVal, ninetyNineVal, fuelLitersVal, fuelLevelLabel, monthlyGoalVal, dailyKmGoalVal);
            playCashRegister();
          }}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-5 rounded-lg shadow-sm transition-all active:scale-97 text-xs uppercase tracking-wider"
        >
          Iniciar Turno (Abrir Caixa)
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
      {/* 1. Scanned Item Screen and Settings (Left side) */}
      <div className="p-4 flex flex-col justify-between border-b border-slate-800">
        <div>
          {/* Header Mode toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg mb-4 border border-slate-800 gap-1">
            <button
              onClick={() => {
                setTxType('IN');
                playBeep();
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[14px] sm:text-xs font-bold transition-all ${
                txType === 'IN'
                  ? 'bg-slate-805 text-white shadow-sm font-extrabold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              ENTRADA (Corrida)
            </button>
            <button
              onClick={() => {
                setTxType('OUT');
                playBeep();
                if (expenseCategory === 'COMBUSTIVEL') {
                  setExpenseCategory('ALIMENTACAO');
                  setCustomExpenseName('');
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[14px] sm:text-xs font-bold transition-all ${
                txType === 'OUT'
                  ? 'bg-slate-805 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minus className="w-3.5 h-3.5 text-rose-500" />
              SAÍDA (Despesa)
            </button>
            <button
              onClick={() => {
                setTxType('FUEL');
                playBeep();
                setExpenseCategory('COMBUSTIVEL');
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[14px] sm:text-xs font-bold transition-all ${
                txType === 'FUEL'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-450" />
              ABASTECER
            </button>
          </div>

          {/* Campanha: quick credit direct to platform balance, calculator only */}
          {(platform === 'UBER' || platform === '99') && (
            <button
              type="button"
              onClick={() => {
                setIsCampanhaOpen(true);
                setCampanhaInput('');
                playBeep();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 mb-4 rounded-md text-[14px] sm:text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <Calculator className="w-3.5 h-3.5" />
              CAMPANHA ({platform === 'UBER' ? 'Uber' : '99'})
            </button>
          )}

          {/* Section: IN / Ride Selection fields */}
          {txType === 'IN' ? (
            <div className="space-y-3.5">
              {/* Platform Selector Buttons */}
              <div>
                <label className="block text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Plataforma Ativa
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* UBER */}
                  <button
                    onClick={() => {
                      setPlatform('UBER');
                      playBeep();
                    }}
                    className={`relative p-2 rounded-xl flex flex-col items-center justify-center transition-all border ${
                      platform === 'UBER'
                        ? 'bg-white border-white text-slate-950 font-black shadow-lg shadow-white/5'
                        : 'bg-slate-800/80 border-slate-700 text-slate-100 font-bold hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black font-sans tracking-wider">UBER</span>
                    <span className="text-[12px] mt-0.5 font-mono uppercase opacity-70">Normal</span>
                    {platform === 'UBER' && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-950 rounded-full" />
                    )}
                  </button>

                  {/* 99 */}
                  <button
                    onClick={() => {
                      setPlatform('99');
                      playBeep();
                    }}
                    className={`relative p-2 rounded-xl flex flex-col items-center justify-center transition-all border ${
                      platform === '99'
                        ? 'bg-amber-500 border-amber-400 text-slate-950 ring-1 ring-amber-400 shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-100 font-bold hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black font-sans tracking-wide">99 APP</span>
                    <span className="text-[12px] mt-0.5 font-mono uppercase opacity-70">Taxas</span>
                    {platform === '99' && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-950 rounded-full" />
                    )}
                  </button>

                  {/* TAXIMETRO / CORRIDA POR FORA */}
                  <button
                    type="button"
                    onClick={() => {
                      playBeep();
                      if (onGoToViagem) {
                        onGoToViagem();
                      }
                    }}
                    className="relative p-2 rounded-xl flex flex-col items-center justify-center transition-all border bg-slate-800/80 border-slate-700 text-amber-400 font-extrabold hover:bg-slate-700 hover:text-amber-300"
                  >
                    <span className="text-xs font-black font-sans tracking-wide flex items-center gap-1">⏱️ TAXÍMETRO</span>
                    <span className="text-[12px] mt-0.5 font-mono uppercase opacity-70 text-slate-300">Corrida por Fora</span>
                  </button>
                </div>
              </div>

              {/* Income Type Selector */}
              <div>
                <label className="block text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Tipo de Recebimento
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setInType('CORRIDA');
                      playBeep();
                    }}
                    className={`py-2 px-1 text-[14px] sm:text-xs font-bold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                      inType === 'CORRIDA'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🚗</span> <span className="text-center">Corrida</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInType('CANCELAMENTO');
                      playBeep();
                    }}
                    className={`py-2 px-1 text-[14px] sm:text-xs font-bold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                      inType === 'CANCELAMENTO'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>❌</span> <span className="text-center">Cancelamento</span>
                  </button>
                </div>
              </div>
            </div>
          ) : txType === 'OUT' ? (
            /* Section: OUT / Expense Selection fields */
            <div className="space-y-3.5">
              {/* Type outflow name */}
              <div>
                <label className="block text-[13px] font-black text-rose-400 uppercase tracking-widest mb-1.5">
                  Nome da Saída (Digite Aqui)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ducha, Almoço, Pedágio..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-black tracking-wide focus:border-rose-500 focus:outline-none"
                  value={customExpenseName}
                  onChange={(e) => setCustomExpenseName(e.target.value)}
                />
              </div>

              {/* Quick suggestions */}
              <div>
                <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Ou selecione uma sugestão rápida:
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { key: 'ALIMENTACAO', label: 'Alimentos', icon: '🍔' },
                    { key: 'LAVAGEM', label: 'Ducha', icon: '🧼' },
                    { key: 'MANUTENCAO', label: 'Oficina', icon: '⚙️' },
                    { key: 'OUTROS', label: 'Outros', icon: '⚠️' },
                  ].map((exp) => (
                    <button
                      key={exp.key}
                      onClick={() => {
                        setExpenseCategory(exp.key);
                        setCustomExpenseName(exp.label);
                        playBeep();
                      }}
                      className={`py-2.5 px-1 rounded-xl text-[14px] font-extrabold border transition-all flex flex-col items-center gap-1.5 shadow-sm ${
                        customExpenseName.toLowerCase() === exp.label.toLowerCase() || (expenseCategory === exp.key && !customExpenseName)
                          ? 'bg-rose-500/20 text-rose-350 border-rose-500 ring-1 ring-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                          : 'bg-slate-800/90 text-slate-100 border-slate-700 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-sm">{exp.icon}</span>
                      <span className="truncate w-full text-center font-sans">{exp.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform association for expense */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-2.5 rounded-xl">
                <span className="text-[13px] font-black text-rose-400 block uppercase tracking-wider">
                  ⚠️ Saída do Saldo Bruto/Geral
                </span>
                <p className="text-[12.5px] text-slate-400 leading-tight mt-1">
                  Todas as despesas são debitadas diretamente do seu saldo bruto/geral (físico/bolso ou conta Pix) e não ficam vinculadas à carteira virtual de nenhuma plataforma.
                </p>
              </div>
            </div>
          ) : (
            /* Section: FUEL / Refueling fields */
            <div className="space-y-3.5">
              {/* CALCULADORA DE ABASTECIMENTO */}
              <div className="bg-slate-900 border border-amber-500/10 p-3.5 rounded-xl space-y-3 shadow-inner">
                <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-[14px] uppercase tracking-wider">
                  <span>⛽</span> CALCULADORA DE ABASTECIMENTO
                </div>

                {/* PREÇO POR LITRO (R$/L) */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Preço por Litro na Bomba (R$/L)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14.5px] font-mono font-bold text-slate-500">
                      R$
                    </span>
                    <input
                      type="text"
                      name="fuelPrice"
                      placeholder="0,000"
                      inputMode="decimal"
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1.5 pl-8 pr-8 text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                      value={fuelPrice}
                      onChange={(e) => handleFuelPriceChange(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-500 font-mono">
                      /L
                    </span>
                  </div>
                </div>

                {/* 2 columns for VALOR A PAGAR and LITROS */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* VALOR A PAGAR (R$) */}
                  <div>
                    <label className="block text-[12px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      Valor a Pagar (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14.5px] font-mono font-bold text-slate-500">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1.5 pl-8 pr-3 text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                        value={(() => {
                          const cents = parseInt(inputValue || '0', 10);
                          return (cents / 100).toFixed(2).replace('.', ',');
                        })()}
                        onChange={(e) => handleFuelTotalChange(e.target.value)}
                      />
                    </div>
                    <span className="text-sm text-slate-500 block mt-1 leading-tight">
                      Calcula litros bilateralmente
                    </span>
                  </div>

                  {/* LITROS */}
                  <div>
                    <label className="block text-[12px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                      Quantidade (Litros)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="fuelLiters"
                        placeholder="0,000"
                        inputMode="decimal"
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1.5 pl-3 pr-6 text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                        value={fuelLiters}
                        onChange={(e) => handleFuelLitersChange(e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[14.5px] font-mono font-bold text-slate-500">
                        L
                      </span>
                    </div>
                    <span className="text-sm text-slate-500 block mt-1 leading-tight">
                      Calcula valor bilateralmente
                    </span>
                  </div>
                </div>

                {/* HODÔMETRO NO ABASTECIMENTO */}
                <div className="border-t border-slate-800/80 pt-3">
                  <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <div className="flex items-center justify-between">
                      <span>Hodômetro no Abastecimento (KM)</span>
                      {activeShift?.initialOdometer !== undefined && (
                        <button
                          type="button"
                          onClick={() => {
                            const est = calcEstimatedOdometer();
                            if (est !== null) setFuelOdometerInput(formatOdometer(est));
                          }}
                          className="text-[11px] text-amber-400 font-bold normal-case hover:text-amber-300 transition-colors flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded"
                        >
                          ↺ Recalcular
                        </button>
                      )}
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: 125.430"
                      inputMode="numeric"
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1.5 pl-3 pr-8 text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none placeholder-slate-700"
                      value={fuelOdometerInput}
                      onChange={(e) => setFuelOdometerInput(maskOdometer(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-500 font-mono">
                      KM
                    </span>
                  </div>
                  {/* Breakdown do hodômetro calculado */}
                  {activeShift?.initialOdometer !== undefined && realTimeFuelCalc && (
                    <div className="mt-1.5 text-[11px] text-slate-500 leading-snug space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 font-mono">Odo. inicial:</span>
                        <span className="text-slate-400 font-mono font-bold">{activeShift.initialOdometer.toLocaleString('pt-BR')} KM</span>
                      </div>
                      {realTimeFuelCalc.kmPorPlataforma > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600 font-mono">+ Plataformas (Uber/99):</span>
                          <span className="text-slate-400 font-mono font-bold">+{realTimeFuelCalc.kmPorPlataforma.toFixed(1)} KM</span>
                        </div>
                      )}
                      {realTimeFuelCalc.kmPorFora > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600 font-mono">+ Corridas por fora:</span>
                          <span className="text-slate-400 font-mono font-bold">+{realTimeFuelCalc.kmPorFora.toFixed(1)} KM</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 pt-0.5 border-t border-slate-800/60">
                        <span className="text-amber-500/70 font-mono font-bold">= Estimado:</span>
                        <span className="text-amber-400 font-mono font-black">{(activeShift.initialOdometer + realTimeFuelCalc.kmPorPlataforma + realTimeFuelCalc.kmPorFora).toLocaleString('pt-BR')} KM</span>
                        <span className="text-slate-600 ml-1">— edite se divergir do marcador real</span>
                      </div>
                    </div>
                  )}
                  {!(activeShift?.initialOdometer !== undefined && realTimeFuelCalc) && (
                    <span className="text-sm text-slate-500 block mt-1 leading-tight">
                      Preenchido automaticamente com hodômetro inicial + km das plataformas + corridas por fora. Edite se o marcador real divergir.
                    </span>
                  )}

                  {/* REAL TIME CALCULATIONS & DYNAMIC GAUGE */}
                  {realTimeFuelCalc && (
                    <div className="mt-3 bg-slate-950/70 p-3 rounded-xl border border-slate-850 space-y-2.5">
                      <div className="flex items-center justify-between text-[12px] font-extrabold text-slate-400">
                        <span>CÁLCULO EM TEMPO REAL</span>
                        <span className="text-[12px] text-amber-500 font-mono font-bold">ESTIMADO: {realTimeFuelCalc.consumption} KM/L</span>
                      </div>

                      {/* Total km/L do turno inteiro */}
                      {realTimeFuelCalc.kmPerLTotal !== undefined && (
                        <div className="bg-emerald-500/8 border border-emerald-500/25 p-2.5 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">🏁 Consumo Real do Turno</span>
                              <span className="text-[11px] text-slate-500 leading-none">
                                {realTimeFuelCalc.distance.toFixed(1)} KM ÷ {realTimeFuelCalc.totalFuelConsumedEstimate.toFixed(2).replace('.', ',')} L consumidos
                              </span>
                            </div>
                            <span className="text-white font-mono font-black text-[16px]">
                              {realTimeFuelCalc.kmPerLTotal.toFixed(1).replace('.', ',')}
                              <span className="text-emerald-400 text-[11px] font-bold ml-0.5">KM/L</span>
                            </span>
                          </div>
                          {realTimeFuelCalc.previousRefuelLiters > 0 && (
                            <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                              Inclui <strong className="text-white font-mono">{realTimeFuelCalc.previousRefuelLiters.toFixed(2).replace('.', ',')} L</strong> de abastecimentos anteriores neste turno.
                            </p>
                          )}
                        </div>
                      )}

                      {realTimeFuelCalc.actualConsumption !== undefined && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-amber-400 font-extrabold uppercase tracking-wider text-[12px] flex items-center gap-1">
                              <span>⛽</span> Consumo Parcial Real:
                            </span>
                            <span className="text-white font-mono font-black text-[13px]">
                              {realTimeFuelCalc.actualConsumption.toFixed(1).replace('.', ',')} KM/L
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-400 leading-tight">
                            Seu veículo rodou <strong className="text-white font-mono">{realTimeFuelCalc.actualLegDistance.toFixed(1)} KM</strong> com <strong className="text-white font-mono">{realTimeFuelCalc.litersToRefuel.toFixed(3).replace('.', ',')} L</strong> desde o {realTimeFuelCalc.isSinceLastRefuel ? 'abastecimento anterior' : 'início do turno'} (<strong className="text-white font-mono">{realTimeFuelCalc.lastOdometerRef} KM</strong>).
                          </p>
                        </div>
                      )}

                      {realTimeFuelCalc.currentOdo > 0 && realTimeFuelCalc.distance > 0 ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850">
                            <span className="text-[14.5px] text-slate-500 block uppercase font-bold">Rodou</span>
                            <span className="text-white font-mono font-extrabold text-[14.5px]">{realTimeFuelCalc.distance.toFixed(1)} KM</span>
                            <span className="text-[14.5px] text-slate-500 block mt-0.5 leading-none">Desde {realTimeFuelCalc.initialOdo} KM</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850 flex flex-col justify-between">
                            <div>
                              <span className="text-[14.5px] text-slate-500 block uppercase font-bold">Consumiu</span>
                              <span className="text-amber-450 font-mono font-black text-[14.5px]">
                                {realTimeFuelCalc.litersConsumed.toFixed(3).replace('.', ',')} L
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const roundedLitersStr = realTimeFuelCalc.litersConsumed.toFixed(3).replace('.', ',');
                                handleFuelLitersChange(roundedLitersStr);
                              }}
                              className="mt-1.5 w-full py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded text-[14.5px] font-black uppercase transition-all"
                            >
                              Copiar Litros
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-500 italic leading-snug bg-slate-900/40 p-2 rounded-lg border border-slate-850">
                          ℹ️ Digite o hodômetro atual para calcular a distância e os litros consumidos desde a abertura ({realTimeFuelCalc.initialOdo} KM).
                        </div>
                      )}

                      {/* Dynamic fuel gauge */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between text-[12px] font-black uppercase text-slate-400">
                          <span className="flex items-center gap-1">
                            <span>📊</span> Ponteiro do Tanque
                          </span>
                          <span className="font-mono text-white text-[13px]">
                            {realTimeFuelCalc.percentAfterRefuel.toFixed(0)}% ({realTimeFuelCalc.fuelAfterRefuel.toFixed(1)} L)
                          </span>
                        </div>

                        {/* Progress tank bar segment */}
                        <div className="relative h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850 flex">
                          {/* Reserve Zone (0-15%) */}
                          <div className="absolute left-0 top-0 h-full w-[15%] bg-red-500/10 border-r border-red-500/20 z-10" />
                          
                          {/* Level BEFORE refuel */}
                          <div 
                            className="h-full bg-slate-700 transition-all duration-300"
                            style={{ width: `${Math.min(100, realTimeFuelCalc.percentBeforeRefuel)}%` }}
                          />
                          
                          {/* Fuel added in this refuel */}
                          <div 
                            className="h-full bg-emerald-500/80 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            style={{ 
                              width: `${Math.min(100 - realTimeFuelCalc.percentBeforeRefuel, Math.max(0, realTimeFuelCalc.percentAfterRefuel - realTimeFuelCalc.percentBeforeRefuel))}%` 
                            }}
                          />
                        </div>

                        {/* Indicators under bar */}
                        <div className="flex items-center justify-between text-sm font-bold text-slate-500 leading-none">
                          <span className="text-rose-500 font-extrabold">E (Reserva)</span>
                          <span>Antes: {realTimeFuelCalc.fuelBeforeRefuel.toFixed(1)}L</span>
                          {realTimeFuelCalc.litersToRefuel > 0 && (
                            <span className="text-emerald-400 font-black">+{realTimeFuelCalc.litersToRefuel.toFixed(1)}L abastecido</span>
                          )}
                          <span className="text-emerald-500 font-extrabold">F (Cheio)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Platform association for expense */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-2.5 rounded-xl">
                <span className="text-[13px] font-black text-amber-500 block uppercase tracking-wider">
                  ⚠️ Abastecimento do Saldo Bruto/Geral
                </span>
                <p className="text-[12.5px] text-slate-400 leading-tight mt-1">
                  Todos os abastecimentos são debitados diretamente do seu saldo bruto/geral (físico/bolso ou conta Pix) e não ficam vinculados à carteira virtual de nenhuma plataforma.
                </p>
              </div>
            </div>
          )}

          {/* Unified Payment/Receipt Method */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-805/85">
            <label className="flex items-center justify-between text-[13px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>Forma de {txType === 'IN' ? 'Recebimento' : 'Pagamento'}</span>
              {((txType === 'IN' && inType === 'CORRIDA') || txType === 'OUT' || txType === 'FUEL') && (
                <span className={`text-[10.5px] px-2 py-0.5 rounded font-mono ${
                  !paymentMethod 
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 animate-pulse' 
                    : 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20'
                }`}>
                  {!paymentMethod ? '* Obrigatório' : 'Selecionado ✓'}
                </span>
              )}
            </label>
            
            <>
              <div className={`grid ${txType === 'IN' && platform !== 'PARTICULAR' ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                {[
                  { key: 'PIX', label: 'Pix', emoji: '⚡' },
                  { key: 'DINHEIRO', label: 'Dinheiro', emoji: '💵' },
                  ...(txType === 'IN' && platform !== 'PARTICULAR' ? [{ key: 'APP', label: 'Direto no App', emoji: '📱' }] : []),
                ].map((pay) => (
                  <button
                    key={pay.key}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(pay.key as PaymentMethod);
                      playBeep();
                    }}
                    className={`py-2.5 px-1.5 rounded-xl text-center text-xs font-extrabold border transition-all flex flex-col items-center gap-1.5 shadow-sm ${
                      paymentMethod === pay.key
                        ? txType === 'IN' 
                          ? 'bg-emerald-550/20 text-emerald-350 border-emerald-500 ring-1 ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'bg-rose-550/20 text-rose-350 border-rose-500 ring-1 ring-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                        : 'bg-slate-800/90 text-slate-100 border-slate-700 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-sm">{pay.emoji}</span>
                    <span className="text-[12.5px] leading-tight font-sans">{pay.label}</span>
                  </button>
                ))}
              </div>
              {txType === 'IN' && inType === 'CANCELAMENTO' && paymentMethod === 'APP' && (
                <div className="mt-2.5 p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
                  <span className="text-amber-500 text-base shrink-0">📱</span>
                  <p className="text-[12.5px] text-slate-400 leading-relaxed">
                    A taxa entra diretamente na sua carteira virtual da plataforma <strong className="text-amber-500">{platform === 'UBER' ? 'Uber' : platform === '99' ? '99' : 'Particular'}</strong> e não no caixa físico.
                  </p>
                </div>
              )}
              {txType === 'IN' && inType === 'CANCELAMENTO' && (paymentMethod === 'PIX' || paymentMethod === 'DINHEIRO') && (
                <div className="mt-2.5 p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
                  <span className="text-emerald-400 text-base shrink-0">{paymentMethod === 'PIX' ? '⚡' : '💵'}</span>
                  <p className="text-[12.5px] text-slate-400 leading-relaxed">
                    A taxa foi recebida direto do passageiro e entra no seu saldo de <strong className="text-emerald-400">{paymentMethod === 'PIX' ? 'Pix' : 'Dinheiro'}</strong>, não na carteira virtual da plataforma.
                  </p>
                </div>
              )}
              {paymentMethod === 'APP' && txType === 'IN' && inType === 'CORRIDA' && (
                <div className="mt-2.5 p-2 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-[14px] font-bold text-amber-500 block uppercase">💰 Valor extra cobrado por fora</span>
                    <p className="text-[12.5px] text-slate-400 leading-tight mt-0.5">
                      O ofertado vai pro saldo do app. O extra digitado na calculadora vai para:
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 self-stretch sm:sm:flex-initial">
                    <button
                      type="button"
                      onClick={() => { setExtraPaymentMethod('PIX'); playBeep(); }}
                      className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-[14px] font-black uppercase border transition-all flex items-center justify-center gap-1 ${
                        extraPaymentMethod === 'PIX'
                          ? 'bg-emerald-550/20 text-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ⚡ Pix
                    </button>
                    <button
                      type="button"
                      onClick={() => { setExtraPaymentMethod('DINHEIRO'); playBeep(); }}
                      className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-[14px] font-black uppercase border transition-all flex items-center justify-center gap-1 ${
                        extraPaymentMethod === 'DINHEIRO'
                          ? 'bg-emerald-550/20 text-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      💵 Dinheiro
                    </button>
                  </div>
                </div>
              )}
            </>
          </div>

          {/* Collapsible details (KM run / custom notes) */}
          {txType === 'IN' ? (
            <div className={`mt-4 pt-3.5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 ${
              (platform === 'UBER' || platform === '99') && inType === 'CORRIDA' 
                ? 'lg:grid-cols-5 md:grid-cols-3' 
                : inType === 'CORRIDA' 
                  ? 'md:grid-cols-3' 
                  : 'md:grid-cols-2'
            } gap-2.5`}>
              {(platform === 'UBER' || platform === '99') && inType === 'CORRIDA' ? (
                <>
                  <div>
                    <label className="flex items-center gap-1 text-[12.5px] font-black text-amber-500 uppercase tracking-widest mb-1.5" title="Valor líquido da chamada ofertada pelo app">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      Valor Chamada (Do App)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 15,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none"
                      value={appOfferInput}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setAppOfferInput(masked);
                      }}
                    />
                    <span className="text-[12px] text-slate-500 block mt-1 font-mono leading-tight">
                      Ganho da corrida pelo app
                    </span>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[12.5px] font-black text-emerald-450 uppercase tracking-widest mb-1.5" title="Valor bruto pago pelo passageiro à plataforma">
                      <Coins className="w-3.5 h-3.5 text-emerald-450" />
                      Passageiro Pago ao App
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 20,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none"
                      value={passengerAppInput}
                      onChange={(e) => {
                        const masked = maskBRL(e.target.value);
                        setPassengerAppInput(masked);
                      }}
                    />
                    
                    {liveFeeInfo && (
                      <span className="text-[12.5px] text-rose-450 font-bold block mt-1.5 font-mono leading-tight bg-rose-500/5 p-1.5 rounded border border-rose-950/20">
                        📉 Taxa do App: <strong>{liveFeeInfo.feePercentage.toFixed(1)}%</strong> <span className="text-[12px] font-normal text-slate-500">(Retido: R$ {formatDecimalBRL(liveFeeInfo.feeAmount)})</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                inType === 'CORRIDA' ? null : (
                  <div className="text-slate-500 text-[14px] flex items-center justify-center h-full italic border border-slate-850/60 rounded-lg bg-slate-950/20 p-2 text-center">
                    Sem taxas de app para corrida particular
                  </div>
                )
              )}

              {inType === 'CORRIDA' && (
                <div>
                  <label className="flex items-center gap-1 text-[12.5px] font-black text-emerald-400 uppercase tracking-widest mb-1.5" title="Valor extra de gorjeta/caixinha recebida nesta corrida">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    Gorjeta / Caixinha
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5,00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none"
                    value={tipInput}
                    onChange={(e) => {
                      const masked = maskBRL(e.target.value);
                      setTipInput(masked);
                    }}
                  />
                  <span className="text-[12px] text-slate-500 block mt-1 font-mono leading-tight">
                    Recebida direto no saldo do app
                  </span>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="flex items-center gap-1 text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    Quilometragem (KM)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsKmCalcOpen(true);
                      playBeep();
                    }}
                    className="flex items-center gap-0.5 text-[12px] font-bold text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-1 py-0.5 rounded border border-amber-500/20"
                  >
                    <Calculator className="w-2 h-2" />
                    Calcular
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={platform === 'UBER' ? "Ex: 8,50" : "Ex: 8,5"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none"
                  value={km}
                  onChange={(e) => {
                    const masked = maskKM(e.target.value, decimals);
                    setKm(masked);
                  }}
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  <MessageSquare className="w-3 h-3 text-slate-500" />
                  Descrição / Notas
                </label>
                <input
                  type="text"
                  placeholder="Ex: Paulista até Pinheiros"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm focus:border-slate-600 focus:outline-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          ) : (
            txType !== 'FUEL' && (
              <div className="mt-4 pt-3.5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="flex items-center gap-1 text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      Quilometragem (KM)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsKmCalcOpen(true);
                        playBeep();
                      }}
                      className="flex items-center gap-0.5 text-[12.5px] font-black text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20"
                    >
                      <Calculator className="w-2.5 h-2.5" />
                      Calcular KM
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={platform === 'UBER' ? "Ex: 8,50" : "Ex: 8,5"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none"
                    value={km}
                    onChange={(e) => {
                      const masked = maskKM(e.target.value, decimals);
                      setKm(masked);
                    }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[12.5px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                    <MessageSquare className="w-3 h-3 text-slate-500" />
                    Descrição / Notas
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ducha expressa Posto"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm focus:border-slate-600 focus:outline-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )
          )}
        </div>

        {/* Hotkey Reminder footer */}
        <div className="mt-4 pt-2 border-t border-slate-800 text-[12.5px] text-slate-500 font-mono hidden md:flex items-center gap-3">
          <span>💡 [Enter] Registrar</span>
          <span>[U] Uber</span>
          <span>[9/N] 99 App</span>
        </div>
      </div>

      {/* 2. Supermarket virtual keypad input registry (Right side) */}
      <div className="p-4 bg-slate-950/45 flex flex-col justify-between select-none">
        <div>
          {/* Virtual Display LCD screen */}
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-lg text-right flex flex-col justify-between mb-3 shadow-inner relative overflow-hidden">
            {/* Glowing screen effect */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-slate-400/5 blur-xl rounded-full" />
            
            <div className="flex justify-between items-center text-[12.5px] font-bold text-slate-500 uppercase font-mono mb-1">
              <span>{txType === 'IN' ? (inType === 'CANCELAMENTO' ? 'TAXA DE CANCELAMENTO' : 'FATURAMENTO DA CORRIDA') : 'DESPESA TOTAL'}</span>
              <span className={`px-2 py-0.2 rounded text-[12px] ${
                txType === 'IN' 
                  ? (platform === '99' ? 'bg-amber-500/10 text-amber-500' : 'bg-white/10 text-white border border-slate-800')
                  : 'bg-rose-500/10 text-rose-450 border border-rose-950/45'
              }`}>
                {txType === 'IN' ? (inType === 'CANCELAMENTO' ? 'CANCELAMENTO' : platform) : 'SAÍDA'}
              </span>
            </div>
            
            <div className="text-[14px] text-slate-500 font-mono font-bold">R$</div>
            <div className="text-2xl font-black font-mono tracking-tight text-white scrollbar-none overflow-x-auto whitespace-nowrap">
              {(() => {
                const cents = parseInt(inputValue || '0', 10);
                return (cents / 100).toFixed(2).replace('.', ',');
              })()}
            </div>
            {txType === 'IN' && inType === 'CANCELAMENTO' && (
              <span className="text-sm text-amber-500 font-bold block leading-none text-right mt-1 font-mono">
                {paymentMethod === 'APP'
                  ? "Taxa que entra direto no saldo do app"
                  : paymentMethod === 'PIX' || paymentMethod === 'DINHEIRO'
                    ? `Taxa recebida do passageiro (Entrada em ${paymentMethod === 'PIX' ? 'Pix' : 'Dinheiro'})`
                    : "Taxa de cancelamento"}
              </span>
            )}
            {txType === 'IN' && inType === 'CORRIDA' && (platform === 'UBER' || platform === '99') && (
              <span className="text-sm text-amber-500 font-bold block leading-none text-right mt-1 font-mono">
                {paymentMethod === 'APP' 
                  ? "Faturamento que entra no saldo do app (Valor líquido da chamada)" 
                  : "Valor cobrado/recebido de fato do passageiro (Entrada em Pix/Dinheiro/Cartão)"}
              </span>
            )}

            {errorMsg && (
              <div className="absolute inset-0 bg-slate-900 border border-slate-800 text-rose-400 flex items-center justify-center text-center p-3 text-[14px] font-extrabold uppercase font-mono tracking-wider animate-pulse z-10">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {/* Quick value addition nodes (like scanned items shortcuts) */}
          <div className="grid grid-cols-4 gap-1.5 mb-3 bg-slate-900/40 p-1.5 rounded-lg border border-slate-800/60">
            {[6, 10, 15, 20, 25, 30, 45, 60].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => addQuickAmount(val)}
                className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 py-1 text-[14px] font-bold font-mono rounded transition-all border border-slate-800"
              >
                +{val}
              </button>
            ))}
          </div>

          {/* The Physical Keypad */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00'].map((keyItem) => (
              <button
                key={keyItem}
                type="button"
                onClick={() => {
                  pressNum(keyItem);
                  playBeep();
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-lg py-3 rounded-xl font-extrabold font-mono active:scale-95 transition-all flex items-center justify-center border border-slate-700 shadow-md"
              >
                {keyItem}
              </button>
            ))}
            
            {/* Delete/Backspace */}
            <button
              type="button"
              onClick={() => {
                pressBackspace();
                playBeep();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-amber-500 py-3 rounded-xl flex items-center justify-center active:scale-95 transition-all border border-slate-700 shadow-md"
              aria-label="Apagar dígito"
            >
              <Delete className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Clear Key */}
          <button
            type="button"
            onClick={() => {
              pressClear();
              playErrorBeep();
            }}
            className="w-full bg-slate-800 hover:bg-rose-500/20 border border-slate-700 text-rose-450 font-black py-2 rounded-xl text-[14px] font-mono uppercase tracking-widest transition-all mb-3.5 shadow-sm"
          >
            Limpar Valor [C]
          </button>
        </div>

        {/* Large scan checkout submit button */}
        <button
          onClick={triggerSubmit}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-97 transition-all shadow-md font-black text-xs uppercase tracking-wider ${
            txType === 'IN'
              ? (platform === '99' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10' 
                  : 'bg-white hover:bg-slate-105 text-slate-950 shadow-white/5')
              : txType === 'FUEL'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/10'
          }`}
        >
          <Check className="w-4.5 h-4.5 stroke-[2.5]" />
          Registrar {txType === 'IN' ? 'Ganho' : txType === 'FUEL' ? 'Abastecimento' : 'Despesa'} (Enter)
        </button>
      </div>

      <AnimatePresence>
        {isKmCalcOpen && (
          <motion.div
            key="km-calculator-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full overflow-hidden shadow-2xl relative flex flex-col"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Calculator className="w-4 h-4" />
                  <h3 className="text-sm font-black uppercase tracking-wider">Calculadora de KM</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKmCalcOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 bg-slate-950 p-1 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setKmCalcMode('ODOMETER')}
                  className={`py-1.5 text-[14px] uppercase font-black tracking-wider rounded-md transition-all ${
                    kmCalcMode === 'ODOMETER'
                      ? 'bg-slate-900 text-amber-500 border border-slate-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📟 Odômetro
                </button>
                <button
                  type="button"
                  onClick={() => setKmCalcMode('FORMULA')}
                  className={`py-1.5 text-[14px] uppercase font-black tracking-wider rounded-md transition-all ${
                    kmCalcMode === 'FORMULA'
                      ? 'bg-slate-900 text-amber-500 border border-slate-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ➕ Somar Trechos
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3.5">
                {kmCalcMode === 'ODOMETER' ? (
                  <div className="space-y-3">
                    <p className="text-[14px] text-slate-450 italic leading-snug">
                      Insira o odômetro do painel antes e depois da corrida para obter a distância exata.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[12px] font-bold text-slate-500 uppercase mb-1">
                          Odômetro Inicial (KM)
                        </label>
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="decimal"
                          placeholder="Ex: 54.120"
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-2.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                          value={odoInitial}
                          onChange={(e) => setOdoInitial(maskOdometer(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-bold text-slate-500 uppercase mb-1">
                          Odômetro Final (KM)
                        </label>
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="decimal"
                          placeholder="Ex: 54.132"
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-2.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                          value={odoFinal}
                          onChange={(e) => setOdoFinal(maskOdometer(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-805 flex flex-col items-center justify-center">
                      <span className="text-[12px] text-slate-505 font-bold uppercase tracking-wider">Distância Calculada</span>
                      <p className="text-lg font-black font-mono text-emerald-400 mt-1">
                        {odoDiff > 0 ? `${formatKM(odoDiff)} KM` : '0,0 KM'}
                      </p>
                      {parseOdometerInput(odoFinal) < parseOdometerInput(odoInitial) && (
                        <span className="text-[12px] text-rose-455 font-bold mt-1 text-center font-sans">
                          * Odômetro final menor que o inicial!
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[14px] text-slate-455 italic leading-snug">
                      Escreva ou toque para somar vários trechos de corridas (ex: 4.5 + 8 + 3.2)
                    </p>
                    
                    <div>
                      <label className="block text-[12px] font-bold text-slate-500 uppercase mb-1">
                        Soma de Trajetos (KM)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 5.4 + 1.2"
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-2.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                        value={sumFormula}
                        onChange={(e) => setSumFormula(e.target.value.replace(/[^0-9.+, ]/g, ''))}
                      />
                    </div>

                    {/* Fast increment buttons */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 5, 10, 15].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setSumFormula(prev => {
                              const trimmed = prev.trim();
                              if (!trimmed) return `${val}`;
                              if (trimmed.endsWith('+')) return `${trimmed} ${val}`;
                              return `${trimmed} + ${val}`;
                            });
                            playBeep();
                          }}
                          className="py-1 px-1 bg-slate-950/40 hover:bg-slate-950 hover:text-white border border-slate-800 rounded text-[13px] font-mono text-slate-400 font-bold transition-all"
                        >
                          +{val} KM
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1 px-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSumFormula(prev => {
                            const trimmed = prev.trim();
                            if (trimmed.endsWith('+') || !trimmed) return prev;
                            return `${trimmed} + `;
                          });
                          playBeep();
                        }}
                        className="py-1 bg-slate-950/80 border border-slate-800 rounded text-xs text-amber-500 font-black font-mono hover:bg-slate-950 focus:outline-none"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSumFormula('');
                          playBeep();
                        }}
                        className="py-1 bg-slate-950/80 border border-slate-800 rounded text-xs text-rose-500 font-black hover:bg-slate-950 focus:outline-none"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSumFormula(prev => {
                            const trimmed = prev.trim();
                            if (!trimmed) return '';
                            // Remove last character/operand or last value group
                            const parts = trimmed.split(' ');
                            if (parts.length > 1) {
                              parts.pop();
                              return parts.join(' ');
                            }
                            return '';
                          });
                          playBeep();
                        }}
                        className="py-1 bg-slate-950/80 border border-slate-800 rounded text-xs text-slate-450 hover:bg-slate-950 focus:outline-none"
                      >
                        Apagar
                      </button>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-805 flex flex-col items-center justify-center">
                      <span className="text-[12px] text-slate-505 font-bold uppercase tracking-wider">Distância Somada</span>
                      <p className="text-lg font-black font-mono text-emerald-400 mt-1">
                        {formulaSum > 0 ? `${formatKM(formulaSum)} KM` : '0,0 KM'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKmCalcOpen(false)}
                  className="py-1.5 px-3 bg-slate-950/80 hover:bg-slate-950 hover:text-slate-200 border border-slate-800 text-[14px] font-bold rounded-lg text-slate-400 transition-all uppercase tracking-wide focus:outline-none"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalResult = kmCalcMode === 'ODOMETER' ? odoDiff : formulaSum;
                    setKm(finalResult > 0 ? formatKM(finalResult) : '');
                    setIsKmCalcOpen(false);
                    playCashRegister();
                  }}
                  className="py-1.5 px-4 bg-amber-500 hover:bg-amber-600 text-[14.5px] font-black rounded-lg text-slate-950 transition-all uppercase tracking-wide flex items-center gap-1 shadow focus:outline-none"
                >
                  <Check className="w-3.5 h-3.5" />
                  Aplicar Distância
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCampanhaOpen && (
          <motion.div
            key="campanha-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full overflow-hidden shadow-2xl relative flex flex-col"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Calculator className="w-4 h-4" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Campanha &middot; {platform === 'UBER' ? 'Uber' : platform === '99' ? '99' : 'Particular'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCampanhaOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>

              <div className="p-4">
                <p className="text-[13px] text-slate-450 italic leading-snug mb-3">
                  O valor digitado será creditado direto no saldo da plataforma selecionada.
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3 flex items-center justify-between">
                  <span className="text-[14px] text-slate-500 font-mono font-bold">R$</span>
                  <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                    {campanhaValue.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00'].map((keyItem) => (
                    <button
                      key={keyItem}
                      type="button"
                      onClick={() => {
                        pressCampanhaNum(keyItem);
                        playBeep();
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-lg py-3 rounded-xl font-extrabold font-mono active:scale-95 transition-all flex items-center justify-center border border-slate-700 shadow-md"
                    >
                      {keyItem}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      pressCampanhaBackspace();
                      playBeep();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-500 py-3 rounded-xl flex items-center justify-center active:scale-95 transition-all border border-slate-700 shadow-md"
                    aria-label="Apagar dígito"
                  >
                    <Delete className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    pressCampanhaClear();
                    playErrorBeep();
                  }}
                  className="w-full bg-slate-800 hover:bg-rose-500/20 border border-slate-700 text-rose-450 font-black py-2 rounded-xl text-[14px] font-mono uppercase tracking-widest transition-all mb-3.5 shadow-sm"
                >
                  Limpar Valor
                </button>

                <button
                  type="button"
                  onClick={confirmCampanha}
                  className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-97 transition-all shadow-md font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10"
                >
                  <Check className="w-4.5 h-4.5 stroke-[2.5]" />
                  Creditar na Plataforma
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

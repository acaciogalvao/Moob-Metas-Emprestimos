/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a numeric value into Brazilian Real (BRL) currency string.
 * Example: 1250.5 -> "R$ 1.250,50"
 */
export function formatBRL(val: number): string {
  if (isNaN(val) || val === undefined || val === null) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

/**
 * Normalizes a user typed input string replacing decimal comma with dot.
 * This is crucial for properly parsing numbers entered with Brazilian keyboard or masked style.
 */
export function parseBRLInput(input: string): number {
  if (!input) return 0;
  // Strip everything except numbers
  const clean = input.replace(/\D/g, '');
  if (!clean) return 0;
  // Divide by 100 to get correct decimal value (cents progressive model)
  return parseFloat(clean) / 100;
}

/**
 * Formats a raw input string (digits only) into a Brazilian Real (BRL) string with cents progressive shift.
 * e.g., "100" -> "1,00", "10000" -> "100,00"
 */
export function maskBRL(value: string): string {
  // Extract only digits
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue) return '0,00';
  
  const centsValue = parseFloat(cleanValue) / 100;
  
  return centsValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formats a raw input string (digits only) into a kilometer string with dynamic decimal places.
 * e.g., "85" -> "8.5" with 1 decimal, or "85" -> "0.85" with 2 decimals.
 * Uses dot as requested by the user.
 */
export function maskKM(value: string, decimals: number = 1): string {
  // Extract only digits
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue) return '';
  
  const factor = Math.pow(10, decimals);
  const val = parseFloat(cleanValue) / factor;
  
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false
  });
}

/**
 * Normalizes a user typed kilometer string into a floating point number.
 */
export function parseKMInput(input: string, decimals: number = 1): number {
  if (!input) return 0;
  const clean = input.replace(/\D/g, '');
  if (!clean) return 0;
  const factor = Math.pow(10, decimals);
  return parseFloat(clean) / factor;
}

/**
 * Formats odometer as up to 5 digits for KM (thousands separated with dot) and the 6th digit for meters (separated with comma).
 * Max length is 6 digits.
 * e.g., "12345" -> "12.345", "123456" -> "12.345,6"
 */
export function maskOdometer(value: string): string {
  let clean = value.replace(/\D/g, '');
  if (clean.length > 6) {
    clean = clean.slice(0, 6);
  }
  if (!clean) return '';
  
  if (clean.length === 6) {
    const kmStr = clean.slice(0, 5);
    const meterStr = clean.slice(5);
    const kmNum = parseInt(kmStr, 10);
    return `${kmNum.toLocaleString('pt-BR')},${meterStr}`;
  } else {
    const kmNum = parseInt(clean, 10);
    return kmNum.toLocaleString('pt-BR');
  }
}

/**
 * Parses masked odometer values back to number (with a decimal part if it has 6 digits).
 */
export function parseOdometerInput(input: string): number {
  if (!input) return 0;
  const clean = input.replace(/\D/g, '');
  if (!clean) return 0;
  
  if (clean.length === 6) {
    const kmStr = clean.slice(0, 5);
    const meterStr = clean.slice(5);
    return parseFloat(`${kmStr}.${meterStr}`);
  } else {
    return parseInt(clean, 10);
  }
}

/**
 * Formats a numeric odometer value into the user requested Brazilian representation:
 * up to 5 digits for KM (thousands separated with dot) and the 6th digit for meters (separated with comma).
 * Examples:
 * 12345.6 -> "12.345,6"
 * 12345 -> "12.345"
 * 12.5 -> "12,5"
 */
export function formatOdometer(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return '';
  
  const parts = val.toFixed(1).split('.');
  const kmPart = parseInt(parts[0], 10);
  const meterPart = parseInt(parts[1], 10);
  
  const formattedKM = kmPart.toLocaleString('pt-BR');
  if (meterPart > 0 || val % 1 !== 0) {
    return `${formattedKM},${meterPart}`;
  }
  return formattedKM;
}

/**
 * Formats a raw dial string into a Brazilian phone mask: (XX) XXXXX-XXXX
 */
export function maskPhone(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  
  if (clean.length <= 2) {
    return `(${clean}`;
  }
  if (clean.length <= 6) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  }
  if (clean.length <= 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}

/**
 * Normalizes phone number into raw digits with international standard (e.g. 55 for Brazil)
 */
export function getCleanPhoneDigits(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  
  // If DDD + Number is 10 or 11 digits, prepend 55 (Brazil)
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  return clean;
}

/**
 * Calculates how a ride transaction affects the platform's virtual wallet balance.
 */
export function getPlatformBalanceDelta(tx: {
  type: string;
  platform: string;
  paymentMethod: string;
  value: number;
  passengerValue?: number;
  appOfferValue?: number;
  passengerAppValue?: number;
  extraChargedValue?: number;
  category?: string;
  tipValue?: number;
}): number {
  if (tx.type !== 'IN') return 0;
  if (tx.platform !== 'UBER' && tx.platform !== '99') return 0;

  let delta = 0;

  if (tx.category === 'CANCELAMENTO' || tx.category === 'GORJETA' || tx.category === 'CAMPANHA') {
    delta = tx.value;
  } else {
    const offer = tx.appOfferValue !== undefined ? tx.appOfferValue : tx.value;
    const passenger = tx.passengerAppValue !== undefined ? tx.passengerAppValue : (tx.passengerValue !== undefined ? tx.passengerValue : tx.value);
    const fee = passenger - offer;

    if (tx.paymentMethod === 'APP') {
      // Paid "Direto no App": the value offered by the app (appOfferValue) is credited
      // straight into the platform's virtual wallet (Saldo do App). Any extra amount typed
      // on the calculator beyond the offer is charged separately to Pix/Dinheiro (handled
      // via extraChargedValue/extraPaymentMethod in computeFinancialTotals), not the wallet.
      delta = offer;
    } else {
      // Paid directly to driver in cash/pix/card (driver gets the passenger's money directly)
      // Driver owes the platform fee to the app, so the app fee is deducted from the wallet balance.
      // This will reduce a positive balance, or increase a negative debt.
      delta = -fee;
    }
  }

  // Include ride tip values in the platform balance delta (they are paid in-app)
  if (tx.tipValue !== undefined && tx.tipValue > 0) {
    delta += tx.tipValue;
  }

  return delta;
}

/**
 * Calcula o Faturamento Pós Despesas de uma transação de entrada.
 * Fórmula: Faturamento Pós Despesas =
 *   valor pago pelo passageiro à plataforma (passengerAppValue)
 *   + extra por fora (extraChargedValue — Pix ou dinheiro)
 *   - despesas da plataforma (passengerAppValue - appOfferValue)
 *
 * Simplificado: appOfferValue + extraChargedValue
 */
export function getTransactionNetValue(tx: {
  type: string;
  platform: string;
  paymentMethod: string;
  value: number;
  passengerValue?: number;
  appOfferValue?: number;
  passengerAppValue?: number;
  extraChargedValue?: number;
  keypadValue?: number;
  category?: string;
  tipValue?: number;
}): number {
  if (tx.type !== 'IN') return 0;
  if (tx.category === 'CANCELAMENTO' || tx.category === 'GORJETA' || tx.category === 'CAMPANHA') {
    return tx.value;
  }
  if (tx.platform !== 'UBER' && tx.platform !== '99') {
    return tx.value;
  }

  // Faturamento Pós Despesas = Faturamento Bruto Real da transação (ver getTransactionFaturamentoReal)
  // menos as despesas do turno, aplicado no agregado. Aqui, por transação, é o mesmo valor bruto
  // (ofertado + gorjeta da corrida) — a subtração das despesas é feita na soma total.
  return getTransactionFaturamentoReal(tx);
}

/**
 * Calculates the corrected extra value based on the user's custom formula:
 * extra = (keypad - offer) - (passenger - offer) -> which handles:
 * if passenger > offer: subtract difference from raw extra
 * if passenger < offer: add difference to raw extra
 */
export function calculateExtraValue(
  keypad: number | undefined,
  offer: number | undefined,
  passenger: number | undefined
): number {
  if (keypad === undefined || keypad <= 0) return 0;
  const o = offer || 0;
  const p = passenger || 0;
  
  if (o <= 0) return 0;
  
  // Raw extra is the difference between keypad and offer
  const rawExtra = keypad > o ? (keypad - o) : 0;
  if (rawExtra <= 0) return 0;

  const passengerDiff = p - o;

  let finalExtra = rawExtra;
  if (p > o) {
    finalExtra = rawExtra - passengerDiff;
  } else if (p < o) {
    finalExtra = rawExtra + (o - p);
  }

  return Math.max(0, finalExtra);
}

/**
 * Formats a numeric value into BRL decimal format (using comma for decimals).
 * Example: 1250.5 -> "1.250,50"
 */
export function formatDecimalBRL(val: number): string {
  if (isNaN(val) || val === undefined || val === null) {
    return '0,00';
  }
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calcula o Faturamento Bruto Real de uma transação de entrada.
 * Fórmula: Faturamento Bruto Real = valor total entrado na corrida (tx.value — que já inclui
 * qualquer valor cobrado por fora/extra em Pix ou Dinheiro além do ofertado pelo app) + gorjeta.
 * Conta sempre, sem nenhum desconto, independente da forma de pagamento (Pix/Dinheiro/Cartão/
 * Direto no App) — é exatamente o valor mostrado como "Faturamento Real Entrado (Bruto)" no
 * detalhe do lançamento.
 */
export function getTransactionFaturamentoReal(tx: {
  type: string;
  platform: string;
  paymentMethod?: string;
  value: number;
  passengerValue?: number;
  appOfferValue?: number;
  passengerAppValue?: number;
  category?: string;
  tipValue?: number;
  extraChargedValue?: number;
}): number {
  if (tx.type !== 'IN') return 0;
  if (tx.category === 'CANCELAMENTO' || tx.category === 'GORJETA' || tx.category === 'CAMPANHA') {
    return tx.value;
  }
  if (tx.platform !== 'UBER' && tx.platform !== '99') {
    return tx.value;
  }

  // Gorjeta da corrida sempre conta como faturamento (independente da forma de pagamento da corrida).
  const tip = tx.tipValue && tx.tipValue > 0 ? tx.tipValue : 0;

  // Faturamento Bruto Real = valor total entrado na corrida (já contém o extra cobrado por fora) + gorjeta
  return tx.value + tip;
}




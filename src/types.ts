/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlatformType = 'UBER' | '99' | 'PARTICULAR' | 'GERAL';

export type TransactionType = 'IN' | 'OUT';

// Core payment methods for inputs and outputs:
// - PIX (Pix electronic transfer)
// - DINHEIRO (received directly in cash)
// - CARTAO (card reader machine / debit / credit)
// - APP (paid directly in the app wallet / account balance)
export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'CARTAO' | 'APP' | 'pix' | 'dinheiro';

export interface Transaction {
  id: string;
  timestamp: string;
  type: TransactionType;
  platform: PlatformType;
  category: string;
  value: number; // Gross value
  description?: string;
  paymentMethod: PaymentMethod;
  // Let's add extra details like distance, estimated duration or multiplier if the user wants to add them
  km?: number;
  passengerValue?: number; // Valor pago pelo passageiro (legacy, keep for compatibility)
  appOfferValue?: number; // Valor oferecido pelo aplicativo na chamada
  passengerAppValue?: number; // Valor que o passageiro pagou para o aplicativo
  tipValue?: number; // Valor da gorjeta/caixinha recebida na corrida
  extraChargedValue?: number; // Valor cobrado a mais pelo motorista diretamente ao passageiro
  keypadValue?: number; // Valor digitado na calculadora principal
  extraPaymentMethod?: 'PIX' | 'DINHEIRO' | 'pix' | 'dinheiro'; // Método do valor cobrado a mais por fora
  isVirtual?: boolean; // Se a transação é puramente virtual de controle de aplicativo
  withdrawalFee?: number; // Taxa de saque de saldo do app
  liters?: number; // Quantidade de litros de combustível
  pricePerLiter?: number; // Preço por litro do combustível
  odometer?: number; // Odômetro no momento da transação
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  initialBalance: number; // Saldo Inicial
  initialPixBalance?: number; // Saldo Inicial em Pix
  initialCashBalance?: number; // Saldo Inicial em Dinheiro
  initialUberBalance?: number; // Saldo Inicial na Uber
  initial99Balance?: number; // Saldo Inicial na 99
  status: 'OPEN' | 'CLOSED';
  transactions: Transaction[];
  closingBalanceExpected: number; // calculated expected total balance (initialBalance + Incomes - Exits)
  closingBalanceReal?: number; // actual counted balance by driver
  difference?: number; // closingBalanceReal - closingBalanceExpected
  closingPixReal?: number; // actual counted Pix balance by driver
  differencePix?: number; // closingPixReal - expectedPixBalance
  notes?: string;
  initialOdometer?: number; // Hodômetro Inicial do dia/turno
  finalOdometer?: number; // Hodômetro Final do dia/turno
  totalLitersFueled?: number; // Total de litros abastecidos
  initialFuelLiters?: number; // Litros iniciais no tanque
  initialFuelLevel?: string; // Nível inicial do tanque (Cheio, Meio, Reserva, Custom)
  finalFuelLiters?: number; // Litros finais no tanque ao fechar caixa
  finalFuelLevel?: string; // Nível final do tanque ao fechar caixa
  monthlyGoal?: number; // Meta Mensal de Faturamento Real
  dailyKmGoal?: number; // Meta Diária de KM Rodados
  ajusteSaldoAnterior?: number; // Ajuste do saldo anterior (valor de entrada - saldo anterior)
  saldoAnterior?: number; // Faturamento real do caixa anterior que serviu como referência
}

export interface FinancialSummary {
  earningsUber: number;
  earnings99: number;
  totalEarnings: number; // Total faturado bruto (IN)
  totalExpenses: number; // Total saídas (OUT)
  balance: number; // net change (IN - OUT)
  currentAccountBalance: number; // active cash (Saldo do Caixa: initialBalance + IN - OUT)
  
  // Specific payment method breakdowns
  cashReceived: number;
  cardReceived: number;
  pixReceived: number;
}

export type PeriodFilter = 'HOJE' | 'ONTEM' | 'SETE_DIAS' | 'TRINTA_DIAS' | 'ESTE_MES' | 'TOTAL';

export type DurationUnit = "days" | "weeks" | "months";
export type DeadlineType = "duration" | "dates";
export type GoalType = "individual" | "shared";
export type Frequency = "daily" | "weekly" | "monthly";
export type Payer = "P1" | "P2";

export interface Payment {
  _id: string;
  amount: number;
  method: PaymentMethod;
  payerId: Payer;
  date: string;
}

export interface Goal {
  _id: string;
  type: GoalType;
  category: string;
  interestRate: number;
  itemName: string;
  totalValue: number;
  months: number;
  durationUnit: DurationUnit;
  deadlineType: DeadlineType;
  excludeSundays: boolean;
  startDate: string;
  endDate: string;
  contributionP1: number;
  nameP1: string;
  nameP2: string;
  phoneP1: string;
  phoneP2: string;
  pixKeyP1: string;
  pixKeyP2: string;
  frequencyP1: Frequency;
  frequencyP2: Frequency;
  dueDayP1: number;
  dueDayP2: number;
  savedP1: number;
  savedP2: number;
  payments: Payment[];
  remindersEnabled: boolean;
  applyLateFees?: boolean;
}

export interface CalculationResults {
  startDate: string;
  endDate: string;
  baseTotal: number;
  total: number;
  time: number;
  saved: number;
  sP1: number;
  sP2: number;
  remaining: number;
  progressPercent: number;
  totalP1: number;
  totalP2: number;
  remainingP1: number;
  remainingP2: number;
  actualFreqP1: Frequency;
  actualFreqP2: Frequency;
  baseInstallmentP1: number;
  baseInstallmentP2: number;
  installmentP1: number;
  installmentP2: number;
  monthlyP1: number;
  monthlyP2: number;
  monthlyTotal: number;
  weeklyP1: number;
  weeklyP2: number;
  weeklyTotal: number;
  dailyP1: number;
  dailyP2: number;
  dailyTotal: number;
  totalPeriodsP1: number;
  paidPeriodsCountP1: number;
  totalPeriodsP2: number;
  paidPeriodsCountP2: number;
  chartData: any[];
  isLateP1: boolean;
  isLateP2: boolean;
  daysToNextP1: number;
  daysToNextP2: number;
  latePeriodsCountP1?: number;
  latePeriodsCountP2?: number;
  lateValueP1?: number;
  lateValueP2?: number;
}

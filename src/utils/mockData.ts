/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shift, Transaction } from '../types';

export function getMockShifts(): Shift[] {
  const shifts: Shift[] = [];
  const now = new Date();
  
  // Helper to subtract days
  const subDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  };
  
  // Platform configs
  const platforms = ['UBER', '99'] as const;
  const inCategories = ['CORRIDA', 'GORJETA'];
  const outCategories = ['COMBUSTIVEL', 'ALIMENTACAO', 'LAVAGEM', 'MANUTENCAO', 'OUTROS'];
  
  // Generate 5 days of shifts
  for (let i = 5; i > 0; i--) {
    const shiftDate = subDays(now, i);
    // Opening at 08:30 AM
    const openTime = new Date(shiftDate);
    openTime.setHours(8, 30, 0, 0);
    // Closing at 18:00 PM
    const closeTime = new Date(shiftDate);
    closeTime.setHours(18, 0, 0, 0);
    
    const id = `shift-${i}-${shiftDate.toISOString().split('T')[0]}`;
    const initialBalance = i === 5 ? 50 : 100 + (Math.round(Math.random() * 5) * 10); // starting cash in hand (saldo inicial)
    
    // Transactions
    const transactions: Transaction[] = [];
    
    // Day-of-week variables to create distinct patterns:
    // e.g., i=5 (Monday) might have more 99, i=1 (Friday) might have much higher Uber
    const totalTransactionsCount = 12 + Math.floor(Math.random() * 8);
    let cumulativeOffset = 0;
    
    for (let t = 0; t < totalTransactionsCount; t++) {
      cumulativeOffset += 20 + Math.floor(Math.random() * 40); // add minutes
      const tTime = new Date(openTime);
      tTime.setMinutes(openTime.getMinutes() + cumulativeOffset);
      if (tTime > closeTime) continue;
      
      const isOut = Math.random() < 0.18; // 18% chance of expense
      
      if (isOut) {
        const cat = outCategories[Math.floor(Math.random() * outCategories.length)];
        let val = 0;
        let desc = '';
        const plat = Math.random() < 0.4 ? 'UBER' : (Math.random() < 0.5 ? '99' : 'GERAL');
        
        switch (cat) {
          case 'COMBUSTIVEL':
            val = 80 + Math.floor(Math.random() * 120);
            desc = 'Abastecimento Posto Etanol';
            break;
          case 'ALIMENTACAO':
            val = 18 + Math.floor(Math.random() * 25);
            desc = 'Almoço PF / Refrigerante';
            break;
          case 'LAVAGEM':
            val = 35;
            desc = 'Lavagem rápida do carro';
            break;
          case 'MANUTENCAO':
            val = 40 + Math.floor(Math.random() * 110);
            desc = 'Troca de óleo / Lâmpada farol';
            break;
          default:
            val = 10 + Math.floor(Math.random() * 30);
            desc = 'Compra de água para passageiros';
            break;
        }
        
        transactions.push({
          id: `tx-${id}-${t}`,
          timestamp: tTime.toISOString(),
          type: 'OUT',
          platform: plat,
          category: cat,
          value: val,
          description: desc,
          paymentMethod: 'DINHEIRO'
        });
      } else {
        // INCOME
        const isUber = i % 2 === 0 ? Math.random() < 0.6 : Math.random() < 0.45;
        const platform = isUber ? 'UBER' : '99';
        const isGorjeta = Math.random() < 0.15;
        
        let val = 0;
        let desc = '';
        let cat = 'CORRIDA';
        let km = 3 + Math.floor(Math.random() * 18);
        
        if (isGorjeta) {
          cat = 'GORJETA';
          val = 5 + Math.floor(Math.random() * 15);
          desc = platform === 'UBER' ? 'Gorjeta no App UberX' : 'Gorjeta em dinheiro 99Pop';
        } else {
          // average 2.2 reais per KM
          val = Math.round((km * 2.1 + (platform === '99' ? 4.5 : 5.5)) * 10) / 10;
          desc = platform === 'UBER' 
            ? `Corrida UberX - ${km}km` 
            : `Corrida 99Pop - ${km}km`;
        }
        
        // Randomize payment method for drivers
        // Cash is quite common (about 35% of times), App wallet/Pix 65%
        const randPay = Math.random();
        const paymentMethod = randPay < 0.35 ? 'DINHEIRO' : 'PIX';
        
        transactions.push({
          id: `tx-${id}-${t}`,
          timestamp: tTime.toISOString(),
          type: 'IN',
          platform,
          category: cat,
          value: val,
          description: desc,
          paymentMethod,
          km
        });
      }
    }
    
    // Sort transactions by time
    transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate final expected balance
    const totalIn = transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
    const totalOut = transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
    const expected = initialBalance + totalIn - totalOut;
    
    // Real balance with occasional tiny cash discrepancy of 1, 2 or 5 reais
    const hasDiscrepancy = Math.random() < 0.4;
    const discrepancyVal = hasDiscrepancy ? (Math.random() < 0.5 ? -2 : 5) : 0;
    const closingBalanceReal = Math.round((expected + discrepancyVal) * 100) / 100;
    const difference = Math.round((closingBalanceReal - expected) * 100) / 100;
    
    shifts.push({
      id,
      openedAt: openTime.toISOString(),
      closedAt: closeTime.toISOString(),
      initialBalance,
      status: 'CLOSED',
      transactions,
      closingBalanceExpected: Math.round(expected * 100) / 100,
      closingBalanceReal,
      difference,
      notes: i === 3 ? 'Dia de muita chuva na cidade, faturamento acima da média.' : 'Trânsito pesado na região central à tarde.'
    });
  }
  
  return shifts;
}

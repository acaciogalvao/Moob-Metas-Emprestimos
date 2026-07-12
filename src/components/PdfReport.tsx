/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Printer, X, Ticket, Download, Share2, Send } from 'lucide-react';
import { Shift } from '../types';
import { playBeep } from '../utils/audio';
import { maskPhone, getCleanPhoneDigits, getPlatformBalanceDelta, getTransactionNetValue, formatDecimalBRL, calculateExtraValue, getTransactionFaturamentoReal, formatOdometer } from '../utils/format';

interface PdfReportProps {
  shift: Shift;
  onClose: () => void;
  vehicleType?: 'CAR' | 'BIKE';
  operatorName?: string;
}

export function PdfReport({ shift, onClose, vehicleType = 'CAR', operatorName }: PdfReportProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [whatsAppNum, setWhatsAppNum] = useState<string>(() => localStorage.getItem('moob_caixa_whatsapp') || '');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const rides = shift.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
  const platformRides = rides.filter(t => t.platform === 'UBER' || t.platform === '99');
  const ridesAndCancels = shift.transactions.filter(t => t.type === 'IN' && (t.category === 'CORRIDA' || t.category === 'CANCELAMENTO' || t.category === 'GORJETA' || t.category === 'CAMPANHA') && !t.isVirtual);
  const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
  const expenses = shift.transactions.filter(t => t.type === 'OUT');

  const uberEmoji = vehicleType === 'BIKE' ? '🏍️' : '🚗';
  const ninetyNineEmoji = vehicleType === 'BIKE' ? '🏍️' : '🚖';

  // Method shares based on values entered in the calculator
  const cashIn = allInTransactions.reduce((sum, t) => {
    if (t.paymentMethod === 'DINHEIRO') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'dinheiro')) {
      const extra = t.extraChargedValue !== undefined 
        ? t.extraChargedValue 
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  const pixIn = allInTransactions.reduce((sum, t) => {
    if (t.paymentMethod === 'PIX') {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }
    if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix')) {
      const extra = t.extraChargedValue !== undefined 
        ? t.extraChargedValue 
        : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
      return sum + extra;
    }
    return sum;
  }, 0);

  const appIn = allInTransactions.filter(t => t.paymentMethod === 'APP').reduce((sum, t) => {
    const extra = (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'pix' || t.extraPaymentMethod === 'dinheiro')
      ? (t.extraChargedValue !== undefined 
          ? t.extraChargedValue 
          : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue))
      : 0;
    return sum + (t.value - extra);
  }, 0) + allInTransactions.filter(t => t.category === 'CORRIDA' && t.tipValue !== undefined && t.tipValue > 0).reduce((sum, t) => sum + (t.tipValue || 0), 0);

  const appOut = shift.transactions.filter(t => t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);

  const cancels = shift.transactions.filter(t => t.type === 'IN' && t.category === 'CANCELAMENTO' && !t.isVirtual);
  const totalCancels = cancels.reduce((s, t) => s + t.value, 0);
  const cancelsCount = cancels.length;

  const tips = shift.transactions.filter(t => t.type === 'IN' && t.category === 'GORJETA' && !t.isVirtual);
  const totalTips = tips.reduce((s, t) => s + t.value, 0);
  const tipsCount = tips.length;

  // General statistics
  const totalIn = rides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => {
    const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
    return s + (t.value - fee);
  }, 0);
  const totalOut = expenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);
  const totalNetIn = rides.reduce((s, t) => s + getTransactionNetValue(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => {
    const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
    return s + (t.value - fee);
  }, 0);
  const netEarnings = totalNetIn - totalOut;

  const initialCash = shift.initialCashBalance !== undefined ? shift.initialCashBalance : shift.initialBalance;
  const initialPix = shift.initialPixBalance !== undefined ? shift.initialPixBalance : 0;

  // Platform Share
  const uberIn = rides.filter(t => t.platform === 'UBER').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);
  const ninetyNineIn = rides.filter(t => t.platform === '99').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);

  // Platform KM
  const uberKM = rides.filter(t => t.platform === 'UBER' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const ninetyNineKM = rides.filter(t => t.platform === '99' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
  const particularKM = rides.filter(t => t.platform === 'PARTICULAR' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);

  const uberBalanceDelta = ridesAndCancels.filter(t => t.platform === 'UBER').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const uberWithdrawals = shift.transactions.filter(t => t.platform === 'UBER' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  const uberBalance = (shift.initialUberBalance ?? 0) + uberBalanceDelta - uberWithdrawals;

  const ninetyNineBalanceDelta = ridesAndCancels.filter(t => t.platform === '99').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
  const ninetyNineWithdrawals = shift.transactions.filter(t => t.platform === '99' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
  const ninetyNineBalance = (shift.initial99Balance ?? 0) + ninetyNineBalanceDelta - ninetyNineWithdrawals;

  // Expected Pix balance: Initial Pix + Pix In - Pix Out
  const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((s, t) => s + t.value, 0);
  const expectedPixBalance = initialPix + pixIn - pixOut;

  // Expected Pocket Cash
  const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((s, t) => s + t.value, 0);
  const expectedPocketCash = initialCash + cashIn - cashOut;

  const totalValoresExtras = rides.reduce((s, t) => {
    const pExtra = t.platform === 'PARTICULAR' ? t.value : 0;
    return s + (t.extraChargedValue || 0) + pExtra;
  }, 0);

  // Differences and Real Profit/Loss
  const diffCash = shift.difference || 0;
  const diffPix = shift.differencePix || 0;
  const realProfit = netEarnings + diffCash + diffPix;

  // Odometer & consumption calculations
  const hasOdo = shift.initialOdometer !== undefined || uberKM > 0 || ninetyNineKM > 0;
  const hasBothOdo = shift.initialOdometer !== undefined && shift.finalOdometer !== undefined && shift.finalOdometer >= shift.initialOdometer;
  const kmRun = hasBothOdo && shift.finalOdometer !== undefined && shift.initialOdometer !== undefined ? (shift.finalOdometer - shift.initialOdometer) : 0;

  const initialFuelLiters = shift.initialFuelLiters !== undefined ? shift.initialFuelLiters : 0;
  const finalFuelLiters = shift.finalFuelLiters !== undefined ? shift.finalFuelLiters : 0;
  const totalLitersFueled = shift.totalLitersFueled !== undefined ? shift.totalLitersFueled : 0;
  
  const hasBothFuelLevels = shift.initialFuelLiters !== undefined && shift.finalFuelLiters !== undefined;
  const fuelLitersUsed = hasBothFuelLevels
    ? Math.max(0.001, initialFuelLiters + totalLitersFueled - finalFuelLiters)
    : totalLitersFueled;

  const kmPerL = hasBothOdo && fuelLitersUsed > 0 ? (kmRun / fuelLitersUsed) : undefined;
  const litersPerKm = hasBothOdo && fuelLitersUsed > 0 ? (fuelLitersUsed / kmRun) : undefined;

  // Tank capacity (configured per vehicle type) & how many liters are missing to top off the tank
  const tankCapacity = parseFloat(localStorage.getItem(vehicleType === 'CAR' ? 'moob_fuel_car_capacity' : 'moob_fuel_moto_capacity') || '0');
  const litersToFillTank = shift.finalFuelLiters !== undefined && tankCapacity > 0
    ? Math.max(0, tankCapacity - finalFuelLiters)
    : undefined;

  // Platform App Fees Calculations
  const totalRidesWithPass = rides.filter(t => t.passengerValue !== undefined || t.appOfferValue !== undefined);
  
  const uberRidesWithPass = rides.filter(t => t.platform === 'UBER' && (t.passengerValue !== undefined || t.appOfferValue !== undefined));
  const uberAppOffer = uberRidesWithPass.reduce((s, t) => s + (t.appOfferValue !== undefined ? t.appOfferValue : (t.passengerValue !== undefined && t.passengerValue > t.value ? t.value : t.value)), 0);
  const uberPassengerApp = uberRidesWithPass.reduce((s, t) => s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value)), 0);
  const uberExtraCharged = uberRidesWithPass.reduce((s, t) => s + (t.extraChargedValue || 0), 0);
  const uberAppFees = uberPassengerApp - uberAppOffer;
  const uberAppFeePct = uberPassengerApp > 0 ? (uberAppFees / uberPassengerApp) * 100 : 0;

  const ninetyNineRidesWithPass = rides.filter(t => t.platform === '99' && (t.passengerValue !== undefined || t.appOfferValue !== undefined));
  const ninetyNineAppOffer = ninetyNineRidesWithPass.reduce((s, t) => s + (t.appOfferValue !== undefined ? t.appOfferValue : (t.passengerValue !== undefined && t.passengerValue > t.value ? t.value : t.value)), 0);
  const ninetyNinePassengerApp = ninetyNineRidesWithPass.reduce((s, t) => s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value)), 0);
  const ninetyNineExtraCharged = ninetyNineRidesWithPass.reduce((s, t) => s + (t.extraChargedValue || 0), 0);
  const ninetyNineAppFees = ninetyNinePassengerApp - ninetyNineAppOffer;
  const ninetyNineAppFeePct = ninetyNinePassengerApp > 0 ? (ninetyNineAppFees / ninetyNinePassengerApp) * 100 : 0;

  const totalAppOffer = rides.reduce((s, t) => {
    if (t.platform === 'PARTICULAR') return s;
    const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
    return s + offer;
  }, 0);
  const totalPassengerApp = rides.reduce((s, t) => {
    if (t.platform === 'PARTICULAR') return s;
    return s + (t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value));
  }, 0);
  const totalExtraCharged = rides.reduce((s, t) => {
    if (t.platform === 'PARTICULAR') return s;
    return s + (t.extraChargedValue || 0);
  }, 0);
  const totalAppFees = totalPassengerApp - totalAppOffer;
  const totalAppFeePct = totalPassengerApp > 0 ? (totalAppFees / totalPassengerApp) * 100 : 0;
  const totalGrossPass = totalPassengerApp + totalExtraCharged;

  const ridesWithKm = rides.filter(t => t.km !== undefined && t.km > 0);
  const totalKmRunForAvg = ridesWithKm.reduce((acc, t) => acc + (t.km || 0), 0);
  const averageValuePerKm = totalKmRunForAvg > 0 ? ridesWithKm.reduce((acc, t) => acc + t.value, 0) / totalKmRunForAvg : 0;

  const ridesWithAppFees = rides.filter(t => t.appOfferValue !== undefined && t.passengerAppValue !== undefined && t.passengerAppValue > 0);
  const totalPassengerAppVal = ridesWithAppFees.reduce((acc, t) => acc + (t.passengerAppValue || 0), 0);
  const totalAppOfferVal = ridesWithAppFees.reduce((acc, t) => acc + (t.appOfferValue || 0), 0);
  const averageAppFeePct = totalPassengerAppVal > 0 ? ((totalPassengerAppVal - totalAppOfferVal) / totalPassengerAppVal) * 100 : 0;

  // Format dates
  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    playBeep();
    
    // Create a print style on-the-fly to hide main apps and center receipt
    const style = document.createElement('style');
    style.id = 'print-style-helper';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #printable-receipt-area, #printable-receipt-area * {
          visibility: visible !important;
        }
        #printable-receipt-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          background: white !important;
          color: black !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    window.print();
    
    // Clean up printing style
    setTimeout(() => {
      const el = document.getElementById('print-style-helper');
      if (el) el.remove();
    }, 500);
  };

  const handleDownloadHTML = () => {
    playBeep();
    const title = `Recibo_Turno__${shift.id.slice(-8).toUpperCase()}`;
    const txRows = shift.transactions.map(t => {
      const date = new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const tipText = t.tipValue && t.tipValue > 0 
        ? `<div style="font-size: 10px; color: #10b981; font-weight: normal; text-align: right;">+ R$ ${formatDecimalBRL(t.tipValue)} (gorjeta)</div>` 
        : '';

      const isRide = t.type === 'IN' && (t.platform === 'UBER' || t.platform === '99');
      const extra = t.extraChargedValue || 0;
      const gorjeta = t.tipValue || 0;
      const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - extra - gorjeta);
      const passenger = t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : offer);
      const appFee = passenger - offer;
      const appFeePct = passenger > 0 ? (appFee / passenger) * 100 : 0;

      const rideDetailText = isRide 
        ? `<div style="font-size: 9px; color: #555; padding-left: 10px; text-align: left; margin-top: 1px; font-family: monospace; line-height: 1.25;">
            Ofertado: R$ ${formatDecimalBRL(offer)} | 
            Pass. Pago: R$ ${formatDecimalBRL(passenger)} | 
            Extra: +R$ ${formatDecimalBRL(extra)} | 
            Gorjeta: +R$ ${formatDecimalBRL(gorjeta)} | 
            Taxa Retida: R$ ${formatDecimalBRL(appFee)} (${appFeePct.toFixed(1)}%)
           </div>`
        : '';

      return `
      <div style="border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between;">
          <span>${date} ${t.platform} ${t.type === 'IN' ? '+' : '-'} ${t.category}</span>
          <div style="text-align: right;">
            <span style="font-weight: bold;">R$ ${formatDecimalBRL(t.value)}</span>
            ${tipText}
          </div>
        </div>
        ${rideDetailText}
      </div>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .receipt {
      background: white;
      width: 100%;
      max-width: 320px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      padding: 20px;
      box-sizing: border-box;
      border: 1px solid #ddd;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .mb-1 { margin-bottom: 4px; }
    .mt-1 { margin-top: 4px; }
    .my-2 { margin: 12px 0; }
    .border-double { border-top: 3px double #333; border-bottom: 3px double #333; height: 4px; }
    .border-dashed { border-top: 1px dashed #666; margin: 8px 0; }
    .flex-between { display: flex; justify-content: space-between; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-lg { font-size: 18px; }
    .btn-print {
      display: block;
      width: 100%;
      max-width: 320px;
      background-color: #f59e0b;
      color: #000;
      font-weight: bold;
      border: none;
      padding: 12px;
      margin: 15px auto 0 auto;
      cursor: pointer;
      text-transform: uppercase;
      border-radius: 6px;
      text-align: center;
      font-family: inherit;
    }
    .tip-box {
      background-color: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 6px;
      padding: 10px;
      max-width: 300px;
      font-size: 10px;
      color: #b45309;
      margin-bottom: 12px;
      text-align: center;
    }
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; border: none; max-width: 100%; }
      .btn-print, .tip-box { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="tip-box">
    <strong>💡 Dica do Caixa Moob:</strong> Pressione o botão amarelo abaixo para imprimir no papel ou salvar como PDF perfeitamente.
  </div>

  <div class="receipt">
    <h4 class="text-center font-bold uppercase mb-1">SISTEMA DE AUDITORIA PARA APLICATIVO UBER & 99</h4>
    <p class="text-center text-xs font-bold" style="margin: 6px 0;">CUPOM DE FECHAMENTO DE TURNO</p>
    
    <div class="border-double my-2"></div>
    
    <div class="text-xs text-left" style="line-height: 1.4;">
      <p><span class="font-bold">TURNO ID:</span> CAIXA-${shift.id.slice(-8).toUpperCase()}</p>
      ${operatorName ? `<p><span class="font-bold">OPERADOR:</span> ${operatorName.toUpperCase()}</p>` : ''}
      <p><span class="font-bold">SITUAÇÃO:</span> ${shift.status === 'CLOSED' ? 'CONCLUÍDO E ARQUIVADO' : 'EM OPERATIVO'}</p>
      <p><span class="font-bold">ABERTURA:</span> ${formatDateTime(shift.openedAt)}</p>
      ${shift.closedAt ? `<p><span class="font-bold">FECHAMENTO:</span> ${formatDateTime(shift.closedAt)}</p>` : ''}
    </div>
    
    <div class="border-dashed"></div>
    
    <div class="text-xs text-left" style="line-height: 1.4;">
      <div class="flex-between">
        <span>SALDO INICIAL FUNDO:</span>
        <span>R$ ${formatDecimalBRL(shift.initialBalance)}</span>
      </div>
      ${shift.initialCashBalance !== undefined || shift.initialPixBalance !== undefined ? `
      <div class="flex-between" style="font-size: 8.5px; color: #666; padding-left: 6px;">
        <span>💵 Dinheiro: R$ ${formatDecimalBRL(initialCash)} | ⚡ Pix: R$ ${formatDecimalBRL(initialPix)}</span>
      </div>
      ` : ''}
      <div class="flex-between font-bold">
        <span>UBER (${rides.filter(t => t.platform === 'UBER').length} CORRIDAS):</span>
        <span>R$ ${formatDecimalBRL(uberIn)} <span style="font-size: 8.5px; font-weight: normal; color: #0284c7;">(${uberKM.toFixed(2)} KM)</span></span>
      </div>
      <div class="flex-between font-bold">
        <span>99 APP (${rides.filter(t => t.platform === '99').length} CORRIDAS):</span>
        <span>R$ ${formatDecimalBRL(ninetyNineIn)} <span style="font-size: 8.5px; font-weight: normal; color: #0284c7;">(${ninetyNineKM.toFixed(2)} KM)</span></span>
      </div>
      <div class="flex-between" style="color: #666;">
        <span>(-) GASTOS REGISTRADOS:</span>
        <span>-R$ ${formatDecimalBRL(totalOut)}</span>
      </div>
    </div>
    
    <div class="border-dashed"></div>
    
    <div class="text-xs flex-between" style="color: #444; margin-bottom: 2px;">
      <span>LUCRO LÍQUIDO ESTIMADO:</span>
      <span>R$ ${formatDecimalBRL(netEarnings)}</span>
    </div>
    
    ${shift.closedAt ? `
    <div class="text-xs flex-between" style="color: #666; margin-bottom: 2px;">
      <span>Quebra Dinheiro (Física):</span>
      <span style="color: ${diffCash < 0 ? '#dc2626' : diffCash > 0 ? '#15803d' : '#666'}">${diffCash > 0 ? '+' : ''}R$ ${formatDecimalBRL(diffCash)}</span>
    </div>
    <div class="text-xs flex-between" style="color: #666; margin-bottom: 2px;">
      <span>Quebra Pix (Conta):</span>
      <span style="color: ${diffPix < 0 ? '#dc2626' : diffPix > 0 ? '#0891b2' : '#666'}">${diffPix > 0 ? '+' : ''}R$ ${formatDecimalBRL(diffPix)}</span>
    </div>
    <div class="text-sm font-bold flex-between" style="background-color: #f3f4f6; padding: 4px; border-radius: 3px; margin-top: 4px; border: 1px solid #e5e7eb;">
      <span>LUCRO REAL EFETIVO:</span>
      <span style="color: ${realProfit >= 0 ? '#15803d' : '#dc2626'}">R$ ${formatDecimalBRL(realProfit)}</span>
    </div>
    ` : `
    <div class="text-sm font-bold flex-between">
      <span>LUCRO LÍQUIDO PERÍODO:</span>
      <span>R$ ${formatDecimalBRL(netEarnings)}</span>
    </div>
    `}
    
    <div class="border-dashed"></div>
    
    <div class="text-xs text-left" style="line-height: 1.4; color: #555;">
      <p class="font-bold" style="color: #222; margin: 4px 0 2px 0;">DETALHAMENTO DE ENTRADAS:</p>
      <div class="flex-between">
        <span>- Dinheiro (Bolso):</span>
        <span>R$ ${formatDecimalBRL(cashIn)}</span>
      </div>
      <div class="flex-between">
        <span>- Pix:</span>
        <span>R$ ${formatDecimalBRL(pixIn)}</span>
      </div>
      <div class="flex-between">
        <span>- Direto no App (Faturamento):</span>
        <span>R$ ${formatDecimalBRL(appIn)}</span>
      </div>
      ${totalCancels > 0 ? `
      <div class="flex-between" style="color: #b45309; font-weight: bold;">
        <span>- Taxas de Cancelamento:</span>
        <span>R$ ${formatDecimalBRL(totalCancels)} (${cancelsCount}x)</span>
      </div>
      ` : ''}
      ${totalTips > 0 ? `
      <div class="flex-between" style="color: #059669; font-weight: bold;">
        <span>- Gorjetas / Caixinhas:</span>
        <span>R$ ${formatDecimalBRL(totalTips)} (${tipsCount}x)</span>
      </div>
      ` : ''}
    </div>
    
    ${totalRidesWithPass.length > 0 ? `
    <div class="border-dashed"></div>
    <div class="text-xs text-left" style="line-height: 1.4; color: #555;">
      <p class="font-bold" style="color: #222; margin: 4px 0 2px 0;">AUDITORIA DE TAXAS DOS APPS:</p>
      <div class="flex-between">
        <span>Oferecido na Chamada (Apps):</span>
        <span>R$ ${formatDecimalBRL(totalAppOffer)}</span>
      </div>
      <div class="flex-between">
        <span>Passag. Pago Plataforma:</span>
        <span>R$ ${formatDecimalBRL(totalPassengerApp)}</span>
      </div>
      <div class="flex-between">
        <span>Total Cobrado a Mais:</span>
        <span>R$ ${formatDecimalBRL(totalExtraCharged)}</span>
      </div>
      <div class="flex-between font-bold" style="color: #dc2626; border-bottom: 1px dotted #ccc; padding-bottom: 2px;">
        <span>Total Retido p/ Plataformas:</span>
        <span>R$ ${formatDecimalBRL(totalAppFees)} (${totalAppFeePct.toFixed(1)}%)</span>
      </div>
      <div class="flex-between font-bold" style="color: ${totalExtraCharged - totalAppFees >= 0 ? '#15803d' : '#dc2626'}; margin-top: 3.5px; font-size: 10.5px;">
        <span>Balanço (Extra vs Taxas):</span>
        <span>R$ ${formatDecimalBRL(totalExtraCharged - totalAppFees)} (${totalExtraCharged - totalAppFees >= 0 ? 'LUCRO' : 'PREJUÍZO'})</span>
      </div>
      
      ${uberRidesWithPass.length > 0 ? `
      <div class="flex-between" style="font-size: 10px; color: #666; padding-left: 6px; margin-top: 2px;">
        <span>• Uber (Oferecido/Pago/Extra):</span>
        <span>R$ ${formatDecimalBRL(uberAppOffer)} / R$ ${formatDecimalBRL(uberPassengerApp)} / +R$ ${formatDecimalBRL(uberExtraCharged)} (Taxa: ${uberAppFeePct.toFixed(1)}%)</span>
      </div>
      ` : ''}
      
      ${ninetyNineRidesWithPass.length > 0 ? `
      <div class="flex-between" style="font-size: 10px; color: #666; padding-left: 6px;">
        <span>• 99 App (Oferecido/Pago/Extra):</span>
        <span>R$ ${formatDecimalBRL(ninetyNineAppOffer)} / R$ ${formatDecimalBRL(ninetyNinePassengerApp)} / +R$ ${formatDecimalBRL(ninetyNineExtraCharged)} (Taxa: ${ninetyNineAppFeePct.toFixed(1)}%)</span>
      </div>
      ` : ''}

      ${platformRides.length > 0 ? `
      <div style="margin-top: 6px; border-top: 1px dotted #ccc; padding-top: 4px;">
        <p class="font-bold" style="color: #333; margin: 2px 0 3px 0; font-size: 9.5px;">DETALHAMENTO INDIVIDUAL DE CORRIDAS:</p>
        ${platformRides.map((t, idx) => {
          const extra = t.extraChargedValue || 0;
          const gorjeta = t.tipValue || 0;
          const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - extra - gorjeta);
          const passenger = t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : offer);
          const appFee = passenger - offer;
          const appFeePct = passenger > 0 ? (appFee / passenger) * 100 : 0;
          return `
          <div style="font-size: 8.5px; color: #555; border-bottom: 1px dashed #eee; padding-bottom: 2px; margin-bottom: 2px; font-family: monospace;">
            <div class="flex-between" style="font-weight: bold; color: #333;">
              <span>#${platformRides.length - idx} ${t.platform} (${new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
              <span>Total: R$ ${formatDecimalBRL(t.value)}</span>
            </div>
            <div style="padding-left: 4px; color: #666; line-height: 1.25;">
              Ofertado: R$ ${formatDecimalBRL(offer)} | 
              Pass. Pago: R$ ${formatDecimalBRL(passenger)} | 
              Extra: +R$ ${formatDecimalBRL(extra)} | 
              Gorjeta: +R$ ${formatDecimalBRL(gorjeta)} | 
              Taxa Retida: R$ ${formatDecimalBRL(appFee)} (${appFeePct.toFixed(1)}%)
            </div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${shift.closedAt ? `
    <div class="border-dashed"></div>
    <div class="text-xs text-left" style="line-height: 1.4; background-color: #fafafa; padding: 6px; border: 1px solid #eee; border-radius: 4px;">
      <div class="flex-between">
        <span>Dinheiro Bolso Esperado:</span>
        <span>R$ ${formatDecimalBRL(expectedPocketCash)}</span>
      </div>
      <div class="flex-between font-bold">
        <span>Dinheiro Bolso Informado:</span>
        <span>R$ ${formatDecimalBRL(shift.closingBalanceReal || 0)}</span>
      </div>
      ${shift.difference !== 0 ? `
      <div class="flex-between font-bold" style="color: ${shift.difference && shift.difference < 0 ? '#dc2626' : '#15803d'};">
        <span>Quebra de Dinheiro:</span>
        <span>R$ ${formatDecimalBRL(shift.difference || 0)} (${shift.difference && shift.difference < 0 ? 'FALTA' : 'SOBRA'})</span>
      </div>
      ` : ''}

      <div class="flex-between" style="border-top: 1px dashed #eee; padding-top: 4px; margin-top: 4px;">
        <span>Saldo Pix Esperado:</span>
        <span>R$ ${formatDecimalBRL(expectedPixBalance)}</span>
      </div>
      <div class="flex-between font-bold">
        <span>Saldo Pix Informado:</span>
        <span>R$ ${formatDecimalBRL(shift.closingPixReal || 0)}</span>
      </div>
      ${shift.differencePix !== undefined && shift.differencePix !== 0 ? `
      <div class="flex-between font-bold" style="color: ${shift.differencePix < 0 ? '#dc2626' : '#15803d'};">
        <span>Quebra de Pix:</span>
        <span>R$ ${formatDecimalBRL(shift.differencePix)} (${shift.differencePix < 0 ? 'FALTA' : 'SOBRA'})</span>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${hasOdo ? `
    <div class="border-dashed"></div>
    <div class="text-xs text-left" style="line-height: 1.4; background-color: #fafafa; padding: 6px; border: 1px solid #eee; border-radius: 4px; margin-top: 6px;">
      <p class="font-bold" style="margin: 0 0 4px 0; font-size: 10px;">📊 CONTROLE DE QUILOMETRAGEM (KM):</p>
      
      <div class="flex-between">
        <span>Odômetro Inicial:</span>
        <span>${shift.initialOdometer !== undefined ? formatOdometer(shift.initialOdometer) + ' KM' : 'Não informado'}</span>
      </div>
      ${shift.initialFuelLiters !== undefined ? `
      <div class="flex-between" style="color: #4b5563;">
        <span>Tanque Inicial (Abertura):</span>
        <span>${shift.initialFuelLiters.toFixed(3).replace('.', ',')} L (${shift.initialFuelLevel || 'Cheio'})</span>
      </div>
      ` : ''}
      <div class="flex-between">
        <span>Odômetro Final (Saída):</span>
        <span>${shift.finalOdometer !== undefined ? formatOdometer(shift.finalOdometer) + ' KM' : 'Não informado'}</span>
      </div>
      
      ${hasBothOdo ? `
      <div class="flex-between font-bold" style="border-bottom: 1px dotted #ccc; padding-bottom: 2px; margin-bottom: 2px;">
        <span>Distância Total (Odômetro):</span>
        <span>${kmRun.toFixed(2)} KM</span>
      </div>
      ` : ''}

      <div class="flex-between" style="color: #4b5563;">
        <span>- KM na Plataforma Uber:</span>
        <span>${uberKM.toFixed(2)} KM</span>
      </div>
      <div class="flex-between" style="color: #4b5563;">
        <span>- KM na Plataforma 99:</span>
        <span>${ninetyNineKM.toFixed(2)} KM</span>
      </div>
      <div class="flex-between" style="color: #4b5563;">
        <span>- KM Fora das Plataformas (Part.):</span>
        <span>${particularKM.toFixed(2)} KM</span>
      </div>
      
      ${shift.totalLitersFueled !== undefined && shift.totalLitersFueled > 0 ? `
      <div class="flex-between" style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
        <span>Combustível Abastecido:</span>
        <span>${shift.totalLitersFueled.toString()} L</span>
      </div>
      ` : ''}
      ${kmPerL !== undefined ? `
      <div class="flex-between font-bold" style="color: #b45309;">
        <span>Eficiência (KM/L):</span>
        <span>${kmPerL.toFixed(2)} km/L</span>
      </div>
      ` : ''}
      ${litersPerKm !== undefined ? `
      <div class="flex-between" style="font-size: 10px; color: #666;">
        <span>Litro por KM (L/KM):</span>
        <span>${litersPerKm.toFixed(4)} L/km</span>
      </div>
      ` : ''}
      ${litersToFillTank !== undefined ? `
      <div class="flex-between font-bold" style="color: #0e7490; margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
        <span>Faltam p/ Completar Tanque:</span>
        <span>${litersToFillTank.toFixed(2).replace('.', ',')} L (de ${tankCapacity.toFixed(0)} L)</span>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="border-double my-2"></div>
    
    <p class="text-center font-bold" style="font-size: 9px; color: #666; margin: 4px 0;">REGISTROS DETALHADOS DE CAIXA</p>
    
    <div style="font-size: 9px; line-height: 1.4;">
      ${txRows}
    </div>
    
    ${shift.notes ? `
    <div class="text-xs text-left" style="font-style: italic; color: #555; margin-top: 8px; padding-top: 4px; border-top: 1px dotted #ccc;">
      Observações: ${shift.notes}
    </div>
    ` : ''}
    
    <div style="margin: 15px 0 10px 0; text-align: center; color: #aaa;">
      <span style="letter-spacing: 2px; font-weight: bold;">|||| | | ||| | || ||||| | | ||||</span><br>
      <span style="font-size: 8px;">SISTEMA_CAIXA_99UBER_2026_BR</span>
    </div>
    
    <p class="text-center text-xs" style="font-style: italic; color: #666; margin-top: 8px;">Obrigado por dirigir com segurança! Feche o vidro e boa viagem.</p>
  </div>
  
  <button class="btn-print" onclick="window.print()">Imprimir Cupom / Salvar PDF</button>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getFormattedText = () => {
    const cashOutInCash = expenses.filter(e => e.paymentMethod === 'DINHEIRO').reduce((s, e) => s + e.value, 0);
    const expectedPocket = initialCash + cashIn - cashOutInCash;
    const initialBreakdownStr = shift.initialCashBalance !== undefined || shift.initialPixBalance !== undefined 
      ? ` (Dinheiro R$ ${formatDecimalBRL(initialCash)} | Pix R$ ${formatDecimalBRL(initialPix)})`
      : '';

    const odoSectionText = hasOdo
      ? `\n📊 *CONTROLE DE QUILOMETRAGEM (KM):*
• Hodômetro Inicial: ${shift.initialOdometer !== undefined ? formatOdometer(shift.initialOdometer) + ' KM' : 'Não informado'}${shift.initialFuelLiters !== undefined ? `\n• Tanque Inicial (Abertura): ${shift.initialFuelLiters.toFixed(3).replace('.', ',')} L (${shift.initialFuelLevel || 'Cheio'})` : ''}
• Hodômetro Final (Saída): ${shift.finalOdometer !== undefined ? formatOdometer(shift.finalOdometer) + ' KM' : 'Não informado'}${shift.finalFuelLiters !== undefined ? `\n• Tanque Final (Fechamento): ${shift.finalFuelLiters.toFixed(3).replace('.', ',')} L (${shift.finalFuelLevel || 'Meio Tanque'})` : ''}
${hasBothOdo ? `• Distância Total (Odômetro): ${kmRun.toFixed(2)} KM\n` : ''}• KM na Plataforma Uber: ${uberKM.toFixed(2)} KM
• KM na Plataforma 99: ${ninetyNineKM.toFixed(2)} KM
• KM Fora das Plataformas: ${particularKM.toFixed(2)} KM${shift.totalLitersFueled !== undefined && shift.totalLitersFueled > 0 ? `\n• Combustível Abastecido: ${shift.totalLitersFueled.toString()} L` : ''}${hasBothFuelLevels ? `\n• Combustível Consumido (Total): ${fuelLitersUsed.toFixed(3).replace('.', ',')} L` : ''}${kmPerL !== undefined ? `\n• Eficiência (KM/L): ${kmPerL.toFixed(2)} km/L` : ''}${litersPerKm !== undefined ? `\n• Consumo por KM: ${litersPerKm.toFixed(4)} L/km` : ''}${litersToFillTank !== undefined ? `\n• Faltam p/ Completar Tanque: ${litersToFillTank.toFixed(2).replace('.', ',')} L (de ${tankCapacity.toFixed(0)} L)` : ''}
----------------------------------------`
      : '';

    const feesSectionText = totalRidesWithPass.length > 0
      ? `\n📱 *AUDITORIA DE TAXAS DOS APPS:*
• Valor Oferecido na Chamada: R$ ${formatDecimalBRL(totalAppOffer)}
• Passag. Pago p/ Plataforma: R$ ${formatDecimalBRL(totalPassengerApp)}
• Valor Cobrado a Mais (Teu): R$ ${formatDecimalBRL(totalExtraCharged)}
• Retido p/ Plataformas: R$ ${formatDecimalBRL(totalAppFees)} (${totalAppFeePct.toFixed(1)}%)
${uberAppOffer > 0 ? `• UberX (Oferecido/Pago/Extra): R$ ${formatDecimalBRL(uberAppOffer)} / R$ ${formatDecimalBRL(uberPassengerApp)} / +R$ ${formatDecimalBRL(uberExtraCharged)} (Taxa: ${uberAppFeePct.toFixed(1)}%)\n` : ''}${ninetyNineAppOffer > 0 ? `• 99 Pop (Oferecido/Pago/Extra): R$ ${formatDecimalBRL(ninetyNineAppOffer)} / R$ ${formatDecimalBRL(ninetyNinePassengerApp)} / +R$ ${formatDecimalBRL(ninetyNineExtraCharged)} (Taxa: ${ninetyNineAppFeePct.toFixed(1)}%)\n` : ''}----------------------------------------`
      : '';

    return `*📋 FECHAMENTO DE TURNO - CAIXA MOOB*
*CAIXA_#${shift.id.toUpperCase().split('-').pop()}*

----------------------------------------
🗓️ *Início:* ${formatDateTime(shift.openedAt)}
🏁 *Término:* ${formatDateTime(shift.closedAt)}
----------------------------------------
${odoSectionText}
${feesSectionText}

*📊 BALANÇO FINANCEIRO:*
💵 *Fundo Inicial:* R$ ${formatDecimalBRL(shift.initialBalance)}${initialBreakdownStr}
${uberEmoji} *Uber (${rides.filter(t => t.platform === 'UBER').length} corridas):* R$ ${formatDecimalBRL(uberIn)} [${uberKM.toFixed(2)} KM]
${ninetyNineEmoji} *99 App (${rides.filter(t => t.platform === '99').length} corridas):* R$ ${formatDecimalBRL(ninetyNineIn)} [${ninetyNineKM.toFixed(2)} KM]
• Saídas/Gastos: -R$ ${formatDecimalBRL(totalOut)}

💎 *Lucro Líquido Estimado:* R$ ${formatDecimalBRL(netEarnings)} (Faturamento - Gastos)
${shift.closedAt ? `
⚠️ *AUDITORIA DE QUEBRAS / DIFERENÇAS:*
• Quebra de Dinheiro: R$ ${formatDecimalBRL(diffCash)} (${diffCash < 0 ? 'FALTA/PREJUÍZO' : diffCash > 0 ? 'SOBRA/LUCRO' : 'SEM QUEBRA'})
• Quebra de Pix: R$ ${formatDecimalBRL(diffPix)} (${diffPix < 0 ? 'FALTA/PREJUÍZO' : diffPix > 0 ? 'SOBRA/LUCRO' : 'SEM QUEBRA'})

🔥 *LUCRO REAL EFETIVO:* R$ ${formatDecimalBRL(realProfit)}` : ''}

${shift.initialUberBalance !== undefined || shift.initial99Balance !== undefined ? `📱 *SALDOS DE PLATAFORMAS:*
${shift.initialUberBalance !== undefined ? `• Uber: ${uberBalance >= 0 ? '+' : ''}R$ ${formatDecimalBRL(uberBalance)} (Inic: R$ ${formatDecimalBRL(shift.initialUberBalance)} | Delta: ${uberBalanceDelta >= 0 ? '+' : ''}R$ ${formatDecimalBRL(uberBalanceDelta)})` : ''}
${shift.initial99Balance !== undefined ? `• 99 App: ${ninetyNineBalance >= 0 ? '+' : ''}R$ ${formatDecimalBRL(ninetyNineBalance)} (Inic: R$ ${formatDecimalBRL(shift.initial99Balance)} | Delta: ${ninetyNineBalanceDelta >= 0 ? '+' : ''}R$ ${formatDecimalBRL(ninetyNineBalanceDelta)})` : ''}
-----------------------------------------` : ''}

*💵 FLUXO DE DINHEIRO FÍSICO (Bolso):*
• Dinheiro Físico Esperado: R$ ${formatDecimalBRL(expectedPocket)}
• Dinheiro Físico Informado: R$ ${formatDecimalBRL(shift.closingBalanceReal || 0)}
${shift.difference !== 0 ? `• *Quebra de Dinheiro:* R$ ${formatDecimalBRL(shift.difference || 0)} (${shift.difference && shift.difference < 0 ? 'FALTA' : 'SOBRA'})` : '• *Situação Dinheiro:* Perfeito (Sem quebras)'}

*⚡ FLUXO DE SALDO PIX (Conta):*
• Saldo Pix Esperado: R$ ${formatDecimalBRL(expectedPixBalance)}
• Saldo Pix Informado: R$ ${formatDecimalBRL(shift.closingPixReal || 0)}
${shift.differencePix !== undefined && shift.differencePix !== 0 ? `• *Quebra de Pix:* R$ ${formatDecimalBRL(shift.differencePix)} (${shift.differencePix < 0 ? 'FALTA' : 'SOBRA'})` : '• *Situação Pix:* Perfeito (Sem quebras)'}

*📝 LANÇAMENTOS DIÁRIOS:*
${shift.transactions.map(t => `- ${new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} [${t.platform}] ${t.type === 'IN' ? '+' : '-'} R$ ${formatDecimalBRL(t.value)} (${t.category})`).join('\n')}

_Obrigado por dirigir com segurança!_`;
  };

  const handleCopyText = () => {
    playBeep();
    const formattedText = getFormattedText();
    navigator.clipboard.writeText(formattedText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xs flex flex-col p-4 z-50 overflow-y-auto font-sans shadow-2xl">
      <div className="w-full flex flex-col gap-5 bg-slate-900 border border-slate-850 p-4 rounded-xl">
        {/* Left column: Action controls and quick summary */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <span className="flex items-center gap-1.5 text-white font-extrabold text-xs uppercase tracking-wide">
                <Ticket className="w-4 h-4 text-amber-500" />
                Emissor de PDF / Recibo
              </span>
              <button 
                onClick={onClose}
                className="text-slate-500 hover:text-white p-1 rounded-md bg-slate-950/45 border border-slate-805 hover:bg-slate-805 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5 mt-4">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-805">
                <span className="text-[12px] uppercase font-extrabold text-slate-505 tracking-wider">Número do Turno</span>
                <p className="text-xs font-black text-slate-205 mt-0.5 font-mono">
                  CAIXA_#{shift.id.toUpperCase().split('-').pop()}
                </p>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Gerado pelo sistema automotivo de caixa supermercado.
                </p>
              </div>

              <div className="space-y-1.5 text-[14.5px] font-mono">
                <div className="flex justify-between py-0.5 border-b border-slate-850">
                  <span className="text-slate-500 font-sans">Início:</span>
                  <span className="text-slate-350 font-medium">{formatDateTime(shift.openedAt)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850">
                  <span className="text-slate-500 font-sans">Término:</span>
                  <span className="text-slate-350 font-medium">{formatDateTime(shift.closedAt)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850">
                  <span className="text-slate-500 font-sans">Corridas:</span>
                  <span className="text-slate-305 font-bold font-mono">
                    {rides.length} <span className="text-[13px] text-slate-400 font-normal font-sans">(U: {rides.filter(t => t.platform === 'UBER').length} • 99: {rides.filter(t => t.platform === '99').length})</span>
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850">
                  <span className="text-slate-500 font-sans">Despesas:</span>
                  <span className="text-slate-300 font-bold font-sans">{expenses.length}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850">
                  <span className="text-slate-500 font-sans">Saldo Inicial:</span>
                  <div className="text-right">
                    <span className="text-slate-200">R$ {formatDecimalBRL(shift.initialBalance)}</span>
                    {(shift.initialCashBalance !== undefined || shift.initialPixBalance !== undefined) && (
                      <div className="text-[12px] text-slate-500 font-mono mt-0.5">
                        💵 R$ {formatDecimalBRL(shift.initialCashBalance || 0)} | ⚡ R$ {formatDecimalBRL(shift.initialPixBalance || 0)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850 text-emerald-400 font-semibold">
                  <span className="font-sans">Bruto Corridas:</span>
                  <span>R$ {formatDecimalBRL(totalIn)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-850 text-rose-455 font-semibold">
                  <span className="font-sans">Saídas/Custos:</span>
                  <span>R$ {formatDecimalBRL(totalOut)}</span>
                </div>
                {shift.closedAt && (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-[14px]">
                      <span className="text-slate-500 font-sans">Dinheiro Esperado / Contado:</span>
                      <span className="text-slate-200 font-mono">R$ {formatDecimalBRL(expectedPocketCash)} / R$ {formatDecimalBRL(shift.closingBalanceReal || 0)}</span>
                    </div>
                    {shift.difference !== undefined && shift.difference !== 0 && (
                      <div className={`flex justify-between py-0.5 border-b border-slate-850 font-black ${shift.difference < 0 ? 'text-rose-455' : 'text-emerald-450'}`}>
                        <span className="font-sans text-[14px]">Dif. Dinheiro:</span>
                        <span className="font-mono">R$ {formatDecimalBRL(shift.difference)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-[14px]">
                      <span className="text-slate-500 font-sans">Saldo Pix Esperado / Contado:</span>
                      <span className="text-slate-200 font-mono">R$ {formatDecimalBRL(expectedPixBalance)} / R$ {formatDecimalBRL(shift.closingPixReal || 0)}</span>
                    </div>
                    {shift.differencePix !== undefined && shift.differencePix !== 0 && (
                      <div className={`flex justify-between py-0.5 border-b border-slate-850 font-black ${shift.differencePix < 0 ? 'text-rose-455' : 'text-cyan-400'}`}>
                        <span className="font-sans text-[14px]">Dif. Pix:</span>
                        <span className="font-mono">R$ {formatDecimalBRL(shift.differencePix)}</span>
                      </div>
                    )}
                  </>
                )}
                {hasOdo && (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-slate-500 text-[14px]">
                      <span className="font-sans">Odômetro Inic. / Final:</span>
                      <span>{shift.initialOdometer !== undefined ? formatOdometer(shift.initialOdometer) : '---'} / {shift.finalOdometer !== undefined ? formatOdometer(shift.finalOdometer) : '---'} KM</span>
                    </div>
                    {hasBothOdo && (
                      <div className="flex justify-between py-0.5 border-b border-slate-850 text-amber-500 font-semibold">
                        <span className="font-sans font-medium">Distância Rodada:</span>
                        <span>{kmRun.toFixed(2)} KM</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-[14px] text-slate-400">
                      <span className="font-sans">KM Uber:</span>
                      <span>{uberKM.toFixed(2)} KM</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-[14px] text-slate-400">
                      <span className="font-sans">KM 99:</span>
                      <span>{ninetyNineKM.toFixed(2)} KM</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-850 text-[14px] text-slate-400">
                      <span className="font-sans">KM Particular:</span>
                      <span>{particularKM.toFixed(2)} KM</span>
                    </div>
                    {kmPerL !== undefined && (
                      <div className="flex justify-between py-0.5 border-b border-slate-850 text-amber-400 font-semibold font-sans">
                        <span className="font-medium">Média Consumo:</span>
                        <span>{kmPerL.toFixed(2)} km/L</span>
                      </div>
                    )}
                    {litersPerKm !== undefined && (
                      <div className="flex justify-between py-0.5 border-b border-slate-850 text-slate-500 text-[14px] font-sans">
                        <span>Consumo L/KM:</span>
                        <span>{litersPerKm.toFixed(4)} L/km</span>
                      </div>
                    )}
                  </>
                )}

                {/* Auditoria de Taxas block in left sidebar */}
                {totalRidesWithPass.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-850/80 space-y-2">
                    <span className="text-[12.5px] uppercase font-bold text-slate-400 block tracking-wider">
                      📱 Auditoria de Taxas Cobradas:
                    </span>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 space-y-1.5 text-[14px] font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Valor Oferecido na Chamada:</span>
                        <span className="text-slate-300 font-bold">R$ {formatDecimalBRL(totalAppOffer)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Passageiro Pago Plataforma:</span>
                        <span className="text-white font-bold">R$ {formatDecimalBRL(totalPassengerApp)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Valor Cobrado a Mais:</span>
                        <span className="text-amber-400 font-bold">+ R$ {formatDecimalBRL(totalExtraCharged)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 border-t border-dashed border-slate-900 pt-1.5">
                        <span>Retido pelas Plataformas:</span>
                        <span className="text-rose-455 font-bold">R$ {formatDecimalBRL(totalAppFees)} ({totalAppFeePct.toFixed(1)}%)</span>
                      </div>
                      
                      {uberRidesWithPass.length > 0 && (
                        <div className="flex flex-col text-[12.5px] text-slate-500 border-t border-slate-900 pt-1.5 mt-1 space-y-0.5">
                          <span className="text-slate-400 font-semibold">• UberX:</span>
                          <div className="flex justify-between pl-2">
                            <span>Oferecido / Pago / Extra:</span>
                            <span>R$ {formatDecimalBRL(uberAppOffer)} / R$ {formatDecimalBRL(uberPassengerApp)} / +R$ {formatDecimalBRL(uberExtraCharged)}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                            <span>Taxa Retida:</span>
                            <span className="text-rose-400">{uberAppFeePct.toFixed(1)}% (R$ {formatDecimalBRL(uberAppFees)})</span>
                          </div>
                        </div>
                      )}
                      
                      {ninetyNineRidesWithPass.length > 0 && (
                        <div className="flex flex-col text-[12.5px] text-slate-500 pt-1 mt-1 space-y-0.5">
                          <span className="text-slate-400 font-semibold">• 99 Pop:</span>
                          <div className="flex justify-between pl-2">
                            <span>Oferecido / Pago / Extra:</span>
                            <span>R$ {formatDecimalBRL(ninetyNineAppOffer)} / R$ {formatDecimalBRL(ninetyNinePassengerApp)} / +R$ {formatDecimalBRL(ninetyNineExtraCharged)}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                            <span>Taxa Retida:</span>
                            <span className="text-rose-400">{ninetyNineAppFeePct.toFixed(1)}% (R$ {formatDecimalBRL(ninetyNineAppFees)})</span>
                          </div>
                        </div>
                      )}

                      {/* DETALHAMENTO INDIVIDUAL DAS CORRIDAS NO PDF PREVIEW SIDEBAR */}
                      <div className="border-t border-slate-900 pt-2 mt-2 space-y-1.5">
                        <span className="text-slate-400 font-bold text-[12px] uppercase block">📋 Detalhamento Individual:</span>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 text-[11px] font-mono divide-y divide-slate-900/60">
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
                              <div key={t.id} className="pt-1.5 first:pt-0 space-y-0.5">
                                <div className="flex justify-between font-bold text-[11.5px]">
                                  <span className={platformColor}>#{platformRides.length - idx} {platformName} ({timeStr})</span>
                                  <span className="text-slate-300">R$ {formatDecimalBRL(t.value)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 text-[10.5px] text-slate-500 pl-1.5 border-l border-slate-900">
                                  <div className="flex justify-between"><span>Ofertado:</span><strong className="text-slate-400">R$ {formatDecimalBRL(offer)}</strong></div>
                                  <div className="flex justify-between"><span>Passag. Pago:</span><strong className="text-slate-400">R$ {formatDecimalBRL(passenger)}</strong></div>
                                  <div className="flex justify-between"><span>Extra:</span><strong className="text-emerald-500">+R$ {formatDecimalBRL(extra)}</strong></div>
                                  <div className="flex justify-between"><span>Gorjeta:</span><strong className="text-teal-500">+R$ {formatDecimalBRL(gorjeta)}</strong></div>
                                  <div className="flex justify-between col-span-2 text-[10px] border-t border-slate-900/40 mt-0.5 pt-0.5">
                                    <span>Taxa Retida:</span>
                                    <span className={appFee > 0 ? 'text-rose-400 font-bold' : appFee < 0 ? 'text-emerald-400' : 'text-slate-500'}>
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
                )}

                {/* Saldos de Plataformas no PDF */}
                {(shift.initialUberBalance !== undefined || shift.initial99Balance !== undefined) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-850">
                    <span className="text-[12.5px] uppercase font-bold text-slate-400 block tracking-wider mb-1.5">
                      📱 Saldos de Aplicativos na Sessão:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[12.5px] font-mono">
                      <div className="bg-slate-950 p-2 rounded border border-slate-850 flex flex-col justify-between">
                        <div>
                          <div className="text-slate-500 text-sm uppercase font-bold mb-0.5">⚫ Uber</div>
                          <div className={`font-black ${uberBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                            {uberBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(uberBalance)}
                          </div>
                        </div>
                        <div className="text-[14.5px] text-slate-500 mt-1 border-t border-slate-900 pt-1 space-y-0.5 leading-none">
                          <div className="flex justify-between"><span>Inic:</span><span>R$ {formatDecimalBRL(shift.initialUberBalance || 0)}</span></div>
                          <div className="flex justify-between text-cyan-400"><span>Delta:</span><span>{uberBalanceDelta >= 0 ? '+' : ''}R$ {formatDecimalBRL(uberBalanceDelta)}</span></div>
                          <div className="flex justify-between text-cyan-400 font-bold border-t border-slate-900 pt-0.5 mt-0.5"><span>KM:</span><span>{uberKM.toFixed(2)} km</span></div>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-850 flex flex-col justify-between">
                        <div>
                          <div className="text-slate-500 text-sm uppercase font-bold mb-0.5">🟡 99 App</div>
                          <div className={`font-black ${ninetyNineBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                            {ninetyNineBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(ninetyNineBalance)}
                          </div>
                        </div>
                        <div className="text-[14.5px] text-slate-500 mt-1 border-t border-slate-900 pt-1 space-y-0.5 leading-none">
                          <div className="flex justify-between"><span>Inic:</span><span>R$ {formatDecimalBRL(shift.initial99Balance || 0)}</span></div>
                          <div className="flex justify-between text-cyan-400"><span>Delta:</span><span>{ninetyNineBalanceDelta >= 0 ? '+' : ''}R$ {formatDecimalBRL(ninetyNineBalanceDelta)}</span></div>
                          <div className="flex justify-between text-cyan-400 font-bold border-t border-slate-900 pt-0.5 mt-0.5"><span>KM:</span><span>{ninetyNineKM.toFixed(2)} km</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-2 font-sans">
            <button
              onClick={handleDownloadHTML}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2 px-3 rounded-lg text-[14px] uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-97"
            >
              <Download className="w-4 h-4" />
              Baixar Simulação Impressão (HTML)
            </button>
            
            <button
              onClick={handleCopyText}
              className={`w-full py-2 px-3 rounded-lg text-[14px] uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 active:scale-97 font-extrabold ${
                copiedSuccess 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' 
                  : 'bg-slate-950 hover:bg-slate-805 text-emerald-400 border-slate-800'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              {copiedSuccess ? '✅ Copiado com Sucesso!' : 'Copiar Texto p/ WhatsApp ou Térmica'}
            </button>

            {/* WhatsApp Integration Panel */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[12px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Enviar via WhatsApp Direct
                </label>
                <span className="text-sm text-slate-500 font-mono">Fica salvo</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-white text-xs font-bold font-mono focus:border-amber-500 focus:outline-none flex-grow min-w-0"
                  placeholder="(00) 00000-0000"
                  value={whatsAppNum}
                  onChange={(e) => {
                    const masked = maskPhone(e.target.value);
                    setWhatsAppNum(masked);
                    localStorage.setItem('moob_caixa_whatsapp', masked);
                  }}
                />
                
                <a
                  href={`https://api.whatsapp.com/send?phone=${getCleanPhoneDigits(whatsAppNum)}&text=${encodeURIComponent(getFormattedText())}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => playBeep()}
                  className={`font-black px-4 py-1.5 rounded-lg text-[14px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-97 shrink-0 text-slate-950 ${
                    whatsAppNum.replace(/\D/g, '').length >= 10
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-slate-800 text-slate-500 pointer-events-none'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  Mandar
                </a>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-1.5 px-3 rounded-lg text-[13px] uppercase tracking-wider transition-all border border-slate-805 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Forçar Impressora Padrão ( window.print )
            </button>

            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-805 text-[13px] text-slate-450 leading-relaxed">
              💡 <strong>Dica de Impressão:</strong> Devido a limites de segurança do navegador no visualizador de desenvolvimento (iframe), o botão padrão de impressão pode falhar. Utilize <strong>"Baixar Simulação Impressão"</strong> para baixar o arquivo e abrir no seu navegador para imprimir livremente!
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-950 hover:bg-slate-805 text-slate-400 font-bold py-2 px-3 rounded-lg text-[14px] uppercase border border-slate-850/80"
            >
              Fechar Guia
            </button>
          </div>
        </div>

        {/* Right column: Physical receipts rendering viewport */}
        <div className="bg-slate-950 p-4 rounded-xl flex items-center justify-center overflow-x-auto">
          {/* Simulated Paper Thermal Receipt Container */}
          <div 
            ref={printAreaRef}
            id="printable-receipt-area"
            className="w-full max-w-[310px] bg-white text-slate-950 px-5 py-6 rounded shadow-2xl font-mono text-center select-all border border-slate-250"
            style={{ minHeight: '400px' }}
          >
            {/* Scissor cuts outline */}
            <div className="text-[12.5px] text-zinc-400 border-b border-dashed border-zinc-200 pb-1.5 mb-3 leading-none no-print select-none">
              ✂️ CUPOFÉ FILIPE TÉRMICO
            </div>

            {/* Header */}
            <h4 className="text-xs font-black uppercase tracking-tight leading-none mb-1">
              SISTEMA DE AUDITORIA PARA APLICATIVO UBER & 99
            </h4>
            <p className="text-[12.5px] text-zinc-650 mt-1 font-bold">
              CUPOM DE FECHAMENTO DE TURNO
            </p>
            
            {/* Double Separation Line */}
            <div className="border-t border-zinc-800 border-double my-2" />

            {/* Shift metadata */}
            <div className="text-[12.5px] text-left space-y-0.5 my-1.5 leading-snug">
              <p><span className="font-bold">TURNO ID:</span> CAIXA-{shift.id.slice(-8).toUpperCase()}</p>
              {operatorName && <p><span className="font-bold">OPERADOR:</span> {operatorName.toUpperCase()}</p>}
              <p><span className="font-bold">SITUAÇÃO:</span> {shift.status === 'CLOSED' ? 'CONCLUÍDO E ARQUIVADO' : 'EM OPERATIVO'}</p>
              <p><span className="font-bold">ABERTURA:</span> {formatDateTime(shift.openedAt)}</p>
              {shift.closedAt && <p><span className="font-bold">FECHAMENTO:</span> {formatDateTime(shift.closedAt)}</p>}
            </div>

            {/* Platform metrics */}
            <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[12.5px] space-y-0.5">
              <div className="flex justify-between">
                <span>SALDO INICIAL FUNDO:</span>
                <span>R$ {formatDecimalBRL(shift.initialBalance)}</span>
              </div>
              {(shift.initialCashBalance !== undefined || shift.initialPixBalance !== undefined) && (
                <div className="flex justify-between text-sm text-zinc-500 pl-2">
                  <span>- Dinheiro: R$ {formatDecimalBRL(initialCash)} | Pix: R$ {formatDecimalBRL(initialPix)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-zinc-950">
                <span>UBER ({rides.filter(t => t.platform === 'UBER').length} CORRIDAS):</span>
                <span>R$ {formatDecimalBRL(uberIn)} <span className="text-[12px] text-cyan-600 font-mono font-medium">({uberKM.toFixed(2)} KM)</span></span>
              </div>
              <div className="flex justify-between font-bold text-zinc-950">
                <span>99 APP ({rides.filter(t => t.platform === '99').length} CORRIDAS):</span>
                <span>R$ {formatDecimalBRL(ninetyNineIn)} <span className="text-[12px] text-cyan-600 font-mono font-medium">({ninetyNineKM.toFixed(2)} KM)</span></span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>(-) GASTOS REGISTRADOS:</span>
                <span>-R$ {formatDecimalBRL(totalOut)}</span>
              </div>
              {(shift.initialUberBalance !== undefined || shift.initial99Balance !== undefined) && (
                <div className="border-t border-dashed border-zinc-300 my-1.5 pt-1.5 space-y-0.5 text-[12px] text-zinc-600">
                  <div className="text-zinc-700 font-bold mb-0.5 uppercase">📱 SALDOS EM PLATAFORMAS:</div>
                  {shift.initialUberBalance !== undefined && (
                    <div className="flex justify-between pl-1">
                      <span>• SALDO UBER:</span>
                      <span className="font-bold text-zinc-900">{uberBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(uberBalance)}</span>
                    </div>
                  )}
                  {shift.initial99Balance !== undefined && (
                    <div className="flex justify-between pl-1">
                      <span>• SALDO 99 APP:</span>
                      <span className="font-bold text-zinc-900">{ninetyNineBalance >= 0 ? '+' : ''}R$ {formatDecimalBRL(ninetyNineBalance)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[14px] font-black space-y-1">
              <div className="flex justify-between text-zinc-700">
                <span>LUCRO LÍQUIDO ESTIMADO:</span>
                <span>R$ {formatDecimalBRL(netEarnings)}</span>
              </div>
              {shift.closedAt && (
                <>
                  <div className="flex justify-between text-zinc-650 font-normal text-[12.5px] leading-tight">
                    <span>- Diferença Dinheiro (Bolso):</span>
                    <span className={diffCash < 0 ? 'text-red-600 font-bold' : diffCash > 0 ? 'text-emerald-700 font-bold' : 'text-zinc-500'}>
                      {diffCash > 0 ? '+' : ''}R$ {formatDecimalBRL(diffCash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-650 font-normal text-[12.5px] leading-tight">
                    <span>- Diferença Pix (Conta):</span>
                    <span className={diffPix < 0 ? 'text-red-600 font-bold' : diffPix > 0 ? 'text-cyan-700 font-bold' : 'text-zinc-500'}>
                      {diffPix > 0 ? '+' : ''}R$ {formatDecimalBRL(diffPix)}
                    </span>
                  </div>
                  <div className={`flex justify-between border-t border-dotted border-zinc-300 pt-1 text-[14.5px] font-black ${realProfit >= 0 ? 'text-emerald-800' : 'text-red-750'}`}>
                    <span>LUCRO REAL EFETIVO:</span>
                    <span>R$ {formatDecimalBRL(realProfit)}</span>
                  </div>
                </>
              )}
              <p className="text-[14.5px] text-zinc-500 font-normal mt-0.5 font-sans leading-none">
                * O Lucro Real Efetivo desconta faltas ou soma sobras constatadas no fechamento de caixa de dinheiro e Pix.
              </p>
            </div>

            {/* Performance metrics breakdown */}
            <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[12px] space-y-0.5 text-zinc-600">
              <p className="font-bold text-zinc-800">MÉTRICAS DE DESEMPENHO:</p>
              <div className="flex justify-between">
                <span>- Média Retenção Apps:</span>
                <span className="font-bold text-zinc-900">{averageAppFeePct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>- Valor Médio/KM:</span>
                <span className="font-bold text-zinc-900">R$ {formatDecimalBRL(averageValuePerKm)}/km</span>
              </div>
            </div>

            {/* Payments breakdown */}
            <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[12px] space-y-0.5 text-zinc-600">
              <p className="font-bold text-zinc-800">DETALHAMENTO DE ENTRADAS:</p>
              <div className="flex justify-between">
                <span>- Dinheiro (Bolso):</span>
                <span>R$ {formatDecimalBRL(cashIn)}</span>
              </div>
              <div className="flex justify-between">
                <span>- Pix:</span>
                <span>R$ {formatDecimalBRL(pixIn)}</span>
              </div>
              <div className="flex justify-between">
                <span>- Direto no App (Faturamento):</span>
                <span>R$ {formatDecimalBRL(appIn)}</span>
              </div>
              {totalCancels > 0 && (
                <div className="flex justify-between font-bold text-amber-700">
                  <span>- Taxas de Cancelamento:</span>
                  <span>R$ {formatDecimalBRL(totalCancels)} ({cancelsCount}x)</span>
                </div>
              )}
              {totalTips > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>- Gorjetas / Caixinhas:</span>
                  <span>R$ {formatDecimalBRL(totalTips)} ({tipsCount}x)</span>
                </div>
              )}
            </div>

            {/* Audit / Drawer safety */}
            {shift.closedAt && (
              <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[12.5px] space-y-0.5 bg-zinc-50 p-1.5 rounded border border-zinc-200">
                <div className="flex justify-between text-zinc-650">
                  <span>Dinheiro Bolso Esperado:</span>
                  <span>R$ {formatDecimalBRL(expectedPocketCash)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-950">
                  <span>Dinheiro Bolso Informado:</span>
                  <span>R$ {formatDecimalBRL(shift.closingBalanceReal || 0)}</span>
                </div>
                {shift.difference !== 0 && (
                  <div className={`flex justify-between font-black ${shift.difference && shift.difference < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    <span>Quebra de Dinheiro:</span>
                    <span>R$ {formatDecimalBRL(shift.difference || 0)} ({shift.difference && shift.difference < 0 ? 'FALTA' : 'SOBRA'})</span>
                  </div>
                )}

                <div className="flex justify-between text-zinc-650 border-t border-dotted border-zinc-300 pt-1 mt-1">
                  <span>Saldo Pix Esperado:</span>
                  <span>R$ {formatDecimalBRL(expectedPixBalance)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-950">
                  <span>Saldo Pix Informado:</span>
                  <span>R$ {formatDecimalBRL(shift.closingPixReal || 0)}</span>
                </div>
                {shift.differencePix !== undefined && shift.differencePix !== 0 && (
                  <div className={`flex justify-between font-black ${shift.differencePix < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    <span>Quebra de Pix:</span>
                    <span>R$ {formatDecimalBRL(shift.differencePix)} ({shift.differencePix < 0 ? 'FALTA' : 'SOBRA'})</span>
                  </div>
                )}
              </div>
            )}

            {/* Odometer metrics block */}
            {hasOdo && (
              <div className="border-t border-dashed border-zinc-400 my-1.5 pt-1.5 text-left text-[12.5px] space-y-0.5 bg-zinc-50 p-1.5 rounded border border-zinc-200">
                <p className="font-bold text-zinc-800 uppercase text-[12px] tracking-wider mb-0.5">📊 Controle de Quilometragem (KM):</p>
                <div className="flex justify-between">
                  <span>Odômetro Inicial:</span>
                  <span>{shift.initialOdometer !== undefined ? `${formatOdometer(shift.initialOdometer)} KM` : 'Não informado'}</span>
                </div>
                {shift.initialFuelLiters !== undefined && (
                  <div className="flex justify-between text-zinc-650">
                    <span>Tanque Inicial (Abertura):</span>
                    <span>{shift.initialFuelLiters.toFixed(3).replace('.', ',')} L ({shift.initialFuelLevel || 'Cheio'})</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Odômetro Final (Saída):</span>
                  <span>{shift.finalOdometer !== undefined ? `${formatOdometer(shift.finalOdometer)} KM` : 'Não informado'}</span>
                </div>
                {shift.finalFuelLiters !== undefined && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Tanque Final (Fechamento):</span>
                    <span>{shift.finalFuelLiters.toFixed(3).replace('.', ',')} L ({shift.finalFuelLevel || 'Meio Tanque'})</span>
                  </div>
                )}
                
                {hasBothOdo && (
                  <div className="flex justify-between font-bold text-zinc-950 border-b border-dotted border-zinc-300 pb-1 mb-1">
                    <span>Distância Total (Odômetro):</span>
                    <span>{kmRun.toFixed(2)} KM</span>
                  </div>
                )}

                <div className="flex justify-between text-zinc-650 pl-2 text-[12px]">
                  <span>- KM na Plataforma Uber:</span>
                  <span>{uberKM.toFixed(2)} KM</span>
                </div>
                <div className="flex justify-between text-zinc-650 pl-2 text-[12px]">
                  <span>- KM na Plataforma 99:</span>
                  <span>{ninetyNineKM.toFixed(2)} KM</span>
                </div>
                <div className="flex justify-between text-zinc-650 pl-2 text-[12px]">
                  <span>- KM Fora das Plataformas:</span>
                  <span>{particularKM.toFixed(2)} KM</span>
                </div>

                {shift.totalLitersFueled !== undefined && shift.totalLitersFueled > 0 && (
                  <div className="flex justify-between text-zinc-650 mt-1 pt-1 border-t border-dashed border-zinc-200">
                    <span>Combustível Abastecido:</span>
                    <span>{shift.totalLitersFueled.toString()} L</span>
                  </div>
                )}
                {hasBothFuelLevels && (
                  <div className="flex justify-between font-semibold text-zinc-700">
                    <span>Combustível Consumido (Total):</span>
                    <span>{fuelLitersUsed.toFixed(3).replace('.', ',')} L</span>
                  </div>
                )}
                {kmPerL !== undefined && (
                  <div className="flex justify-between font-bold text-amber-700">
                    <span>Média Consumo (KM/L):</span>
                    <span>{kmPerL.toFixed(2)} km/L</span>
                  </div>
                )}
                {litersPerKm !== undefined && (
                  <div className="flex justify-between text-[12px] text-zinc-500">
                    <span>Média Litro por KM:</span>
                    <span>{litersPerKm.toFixed(4)} L/km</span>
                  </div>
                )}
                {litersToFillTank !== undefined && (
                  <div className="flex justify-between font-bold text-cyan-700 mt-1 pt-1 border-t border-dashed border-zinc-200">
                    <span>Faltam p/ Completar Tanque:</span>
                    <span>{litersToFillTank.toFixed(2).replace('.', ',')} L (de {tankCapacity.toFixed(0)} L)</span>
                  </div>
                )}
              </div>
            )}

            {/* Scanned items detailed lists (Supermarket aesthetic) */}
            <div className="border-t border-zinc-800 my-2" />
            <span className="text-sm uppercase tracking-wide text-zinc-500 block mb-1.5 leading-none">
              REGISTROS DETALHADOS DE CAIXA
            </span>

            <div className="text-[12px] text-left space-y-1 leading-snug max-h-[150px] overflow-y-auto no-print pr-0.5">
              {shift.transactions.map((t) => {
                const dateStr = new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isRide = t.type === 'IN' && (t.platform === 'UBER' || t.platform === '99');
                return (
                  <div key={t.id} className="border-b border-zinc-100 pb-1 last:border-0 font-mono">
                    <div className="flex justify-between text-[12px]">
                      <span className="truncate w-32 font-bold text-zinc-800">
                        {dateStr} {t.platform.slice(0, 3)} {t.type === 'IN' ? '+' : '-'} {t.description?.replace(/Corrida|99Pop|UberX/g, '').trim() || t.category}
                      </span>
                      <span className="font-bold text-right">
                        R$ {formatDecimalBRL(t.value)}
                        {t.tipValue !== undefined && t.tipValue > 0 && (
                          <span className="text-[10px] text-emerald-600 block leading-none mt-0.5">
                            + R$ {formatDecimalBRL(t.tipValue)} (gorjeta)
                          </span>
                        )}
                      </span>
                    </div>
                    {isRide && (() => {
                      const extra = t.extraChargedValue || 0;
                      const gorjeta = t.tipValue || 0;
                      const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - extra - gorjeta);
                      const passenger = t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : offer);
                      const appFee = passenger - offer;
                      const appFeePct = passenger > 0 ? (appFee / passenger) * 100 : 0;
                      return (
                        <div className="text-[11px] text-zinc-500 pl-2 leading-tight mt-1 border-l border-zinc-200">
                          <div>Ofertado: R$ {formatDecimalBRL(offer)} | Pass. Pago: R$ {formatDecimalBRL(passenger)}</div>
                          <div>Extra: +R$ {formatDecimalBRL(extra)} | Gorjeta: +R$ {formatDecimalBRL(gorjeta)}</div>
                          <div className="text-[10.5px] text-zinc-400">Taxa Retida: R$ {formatDecimalBRL(appFee)} ({appFeePct.toFixed(1)}%)</div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Custom note of closed */}
            {shift.notes && (
              <div className="text-[12px] italic text-left text-zinc-550 mt-2 pt-1 border-t border-dotted border-zinc-350">
                Observações: {shift.notes}
              </div>
            )}

            {/* Vintage style thermal barcode */}
            <div className="my-4 flex flex-col items-center justify-center select-none pointer-events-none gap-0.5">
              <span className="block font-bold tracking-[2px] text-xs text-zinc-400">
                |||| | | ||| | || ||||| | | ||||
              </span>
              <span className="text-sm text-zinc-450 font-mono">
                SISTEMA_CAIXA_99UBER_2026_BR
              </span>
            </div>

            <div className="text-[12px] text-zinc-500 italic leading-snug pb-1">
              Obrigado por dirigir com segurança! Feche o vidro e boa viagem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

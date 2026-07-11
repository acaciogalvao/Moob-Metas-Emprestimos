/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, SlidersHorizontal, AlertTriangle, Eye, X, Coins, TrendingUp, MapPin, Calendar, Clock, Info, ArrowUpRight, ArrowDownRight, Trash2
} from 'lucide-react';
import { Transaction, PlatformType, PeriodFilter, PaymentMethod } from '../types';
import { playBeep } from '../utils/audio';
import { formatDecimalBRL, getTransactionFaturamentoReal } from '../utils/format';

interface HistoryListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  periodFilter: PeriodFilter;
  onSetPeriodFilter: (filter: PeriodFilter) => void;
  vehicleType?: 'CAR' | 'BIKE';
}

export function HistoryList({ 
  transactions, 
  onDeleteTransaction, 
  periodFilter, 
  onSetPeriodFilter,
  vehicleType = 'CAR'
}: HistoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [sortBy, setSortBy] = useState<'TIME_DESC' | 'TIME_ASC' | 'VALUE_DESC'>('TIME_DESC');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const carConsumption = parseFloat(localStorage.getItem('moob_fuel_car_consumption') || '12');
  const motoConsumption = parseFloat(localStorage.getItem('moob_fuel_moto_consumption') || '35');
  const activeConsumption = vehicleType === 'BIKE' ? motoConsumption : carConsumption;

  const fuelTxs = transactions.filter(t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || t.pricePerLiter !== undefined) && t.pricePerLiter !== undefined && t.pricePerLiter > 0);
  const averagePricePerLiter = fuelTxs.length > 0 
    ? fuelTxs.reduce((sum, t) => sum + (t.pricePerLiter || 0), 0) / fuelTxs.length 
    : 5.89; // fallback standard price per liter

  const periodOptions: { key: PeriodFilter; label: string }[] = [
    { key: 'HOJE', label: 'Hoje' },
    { key: 'ONTEM', label: 'Ontem' },
    { key: 'SETE_DIAS', label: '7 Dias' },
    { key: 'TRINTA_DIAS', label: '30 Dias' },
    { key: 'ESTE_MES', label: 'Este Mês' },
    { key: 'TOTAL', label: 'Completo' },
  ];

  const getCategoryDetails = (category: string, type: 'IN' | 'OUT') => {
    if (type === 'IN') {
      switch (category) {
        case 'GORJETA':
          return { emoji: '🥳', color: 'bg-emerald-500/10 text-emerald-400', name: 'Gorjeta' };
        case 'CANCELAMENTO':
          return { emoji: '❌', color: 'bg-rose-500/10 text-rose-455', name: 'Cancelamento' };
        default:
          return { 
            emoji: vehicleType === 'BIKE' ? '🏍️' : '🚗', 
            color: 'bg-slate-500/15 text-slate-300', 
            name: 'Corrida' 
          };
      }
    } else {
      switch (category) {
        case 'COMBUSTIVEL':
          return { emoji: '⛽', color: 'bg-red-500/15 text-red-400', name: 'Combustível' };
        case 'ALIMENTACAO':
          return { emoji: '🍔', color: 'bg-amber-500/15 text-amber-500', name: 'Alimentação' };
        case 'LAVAGEM':
          return { emoji: '🧼', color: 'bg-teal-500/15 text-teal-400', name: 'Filtro/Ducha' };
        case 'MANUTENCAO':
          return { emoji: '⚙️', color: 'bg-slate-700/20 text-slate-350', name: 'Gerais' };
        default:
          return { emoji: '⚠️', color: 'bg-rose-500/10 text-rose-455', name: 'Outros' };
      }
    }
  };

  const getPaymentBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'DINHEIRO':
        return { label: 'DINHEIRO', style: 'text-emerald-400 bg-emerald-500/5 border-emerald-990/30' };
      case 'CARTAO':
        return { label: 'CARTÃO', style: 'text-slate-355 bg-slate-950 border-slate-805/85' };
      case 'APP':
        return { label: 'DIRETO APP 📱', style: 'text-amber-500 bg-amber-950 border-amber-900/30 font-medium' };
      default:
        return { label: 'PIX', style: 'text-cyan-400 bg-cyan-550/5 border-cyan-990/30' };
    }
  };

  const filteredTransactions = transactions
    .filter(t => {
      if (selectedPlatform !== 'ALL' && t.platform !== selectedPlatform) return false;
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;
      if (searchTerm.trim() !== '') {
        const rawText = (t.description || '').toLowerCase() + ' ' + t.category.toLowerCase();
        if (!rawText.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'VALUE_DESC') {
        return b.value - a.value;
      } else if (sortBy === 'TIME_ASC') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

  const selectedInSum = filteredTransactions.filter(t => t.type === 'IN').reduce((s, t) => {
    return s + getTransactionFaturamentoReal(t);
  }, 0);
  const selectedOutSum = filteredTransactions.filter(t => t.type === 'OUT').reduce((s, t) => s + t.value, 0);
  
  const selectedKMTravelled = filteredTransactions
    .filter(t => t.km !== undefined)
    .reduce((s, t) => s + (t.km || 0), 0);
    
  const profitPerKM = selectedKMTravelled > 0 ? selectedInSum / selectedKMTravelled : 0;

  // Kilometers split by platform based on filtered transactions
  const uberKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === 'UBER' && t.km !== undefined)
    .reduce((s, t) => s + (t.km || 0), 0);
  const uberInWithKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === 'UBER' && t.km !== undefined && t.km > 0);
  const uberKMRevenue = uberKM > 0 
    ? uberInWithKM.reduce((s, t) => {
        return s + getTransactionFaturamentoReal(t);
      }, 0) / uberKM 
    : 0;

  const ninetyNineKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === '99' && t.km !== undefined)
    .reduce((s, t) => s + (t.km || 0), 0);
  const ninetyNineInWithKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === '99' && t.km !== undefined && t.km > 0);
  const ninetyNineKMRevenue = ninetyNineKM > 0 
    ? ninetyNineInWithKM.reduce((s, t) => {
        return s + getTransactionFaturamentoReal(t);
      }, 0) / ninetyNineKM 
    : 0;

  const particularKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === 'PARTICULAR' && t.km !== undefined)
    .reduce((s, t) => s + (t.km || 0), 0);
  const particularInWithKM = filteredTransactions
    .filter(t => t.type === 'IN' && t.platform === 'PARTICULAR' && t.km !== undefined && t.km > 0);
  const particularKMRevenue = particularKM > 0 
    ? particularInWithKM.reduce((s, t) => s + t.value, 0) / particularKM 
    : 0;

  const totalKM = uberKM + ninetyNineKM + particularKM;
  const totalInWithKMVal = [
    ...uberInWithKM, 
    ...ninetyNineInWithKM, 
    ...particularInWithKM
  ].reduce((s, t) => s + t.value, 0);
  const totalKMRevenue = totalKM > 0 ? totalInWithKMVal / totalKM : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-4" id="transaction-history-panel">
      {/* Filters Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            Movimentação Detalhada
          </h3>
          <p className="text-[14px] text-slate-400">Auditoria de todas as corridas e saídas operacionais.</p>
        </div>

        {/* Period Filters Tab List */}
        <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg w-full md:w-auto border border-slate-805">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onSetPeriodFilter(opt.key);
                playBeep();
              }}
              className={`flex-1 md:flex-none px-2 py-1 rounded text-[14px] font-bold font-sans tracking-wide transition-all ${
                periodFilter === opt.key
                  ? 'bg-slate-804 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Search and secondary selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Seek Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição..."
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg py-1.5 pl-8.5 pr-3 text-[14.5px] focus:border-slate-700 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Type: All, In, Out */}
        <select
          className="bg-slate-950 border border-slate-800 text-slate-350 text-[14.5px] rounded-lg py-1.5 px-2 focus:border-slate-700 focus:outline-none cursor-pointer"
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value as any);
            playBeep();
          }}
        >
          <option value="ALL">🔍 Todas Operações (Corrida/Despesa)</option>
          <option value="IN">💰 Somente Entradas (Ganhos)</option>
          <option value="OUT">⛽ Somente Saídas (Gastos/Combustível)</option>
        </select>

        {/* Filter Platform: All, Uber, 99 */}
        <select
          className="bg-slate-950 border border-slate-800 text-slate-355 text-[14.5px] rounded-lg py-1.5 px-2 focus:border-slate-700 focus:outline-none cursor-pointer"
          value={selectedPlatform}
          onChange={(e) => {
            setSelectedPlatform(e.target.value as any);
            playBeep();
          }}
        >
          <option value="ALL">📱 Todos (Uber, 99 & Part.)</option>
          <option value="UBER">⚫ Apenas Uber</option>
          <option value="99">🟡 Apenas 99 App</option>
          <option value="PARTICULAR">🚙 Apenas Por Fora (Particular)</option>
        </select>

        {/* Sort selector */}
        <select
          className="bg-slate-950 border border-slate-800 text-slate-355 text-[14.5px] rounded-lg py-1.5 px-2 focus:border-slate-700 focus:outline-none cursor-pointer"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as any);
            playBeep();
          }}
        >
          <option value="TIME_DESC">⏰ Recentes Primeiro</option>
          <option value="TIME_ASC">⏳ Antigas Primeiro</option>
          <option value="VALUE_DESC">💎 Lançamentos Mais Altos</option>
        </select>
      </div>

      {/* Period Analytics Insight helper card */}
      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-805 grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[14px]">
        <div className="border-r border-slate-900 last:border-0">
          <span className="text-[12px] uppercase font-extrabold text-slate-500 block">Filtro Ativo</span>
          <span className="text-[14.5px] font-bold text-white truncate inline-block max-w-full">
            {periodOptions.find(o => o.key === periodFilter)?.label}
          </span>
        </div>
        <div className="border-r border-slate-900 last:border-0 pl-1.5">
          <span className="text-[12px] uppercase font-extrabold text-slate-500 block">Faturamento Bruto</span>
          <span className="text-[14.5px] font-bold font-mono text-emerald-400">
            R$ {formatDecimalBRL(selectedInSum)}
          </span>
        </div>
        <div className="border-r border-slate-900 last:border-0 pl-1.5">
          <span className="text-[12px] uppercase font-extrabold text-slate-500 block">Despesa Acumulada</span>
          <span className="text-[14.5px] font-bold font-mono text-rose-455">
            R$ {formatDecimalBRL(selectedOutSum)}
          </span>
        </div>
        <div className="pl-1.5">
          <span className="text-[12px] uppercase font-extrabold text-slate-500 block">Eficiência KM</span>
          <span className="text-[14.5px] font-bold font-mono text-cyan-400">
            {profitPerKM > 0 ? `R$ ${formatDecimalBRL(profitPerKM)}/km` : 'Sem KM em mãos'}
          </span>
        </div>
      </div>

      {/* KM metrics split by app */}
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
        <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
          <span className="text-[14px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🛣️</span> Quilometragem Separada por Aplicativo
          </span>
          <span className="text-[12.5px] font-mono text-slate-500">Filtrado por: {periodOptions.find(o => o.key === periodFilter)?.label}</span>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* UBER KM */}
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[12px] uppercase font-bold text-slate-500 mb-1">
              <span>Uber</span>
              <span className="text-white bg-slate-800 px-1 rounded text-[14.5px] font-mono">UBER</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-white font-mono">{uberKM.toFixed(2)} KM</span>
              <span className="text-[12.5px] text-cyan-400 font-bold font-mono" title="Eficiência Média por KM">
                {uberKMRevenue > 0 ? `R$ ${formatDecimalBRL(uberKMRevenue)}/km` : 'R$ 0,00/km'}
              </span>
            </div>
          </div>

          {/* 99 APP KM */}
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[12px] uppercase font-bold text-slate-500 mb-1">
              <span>99 App</span>
              <span className="text-slate-950 bg-amber-500 px-1 rounded text-[14.5px] font-mono font-extrabold">99</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-amber-500 font-mono">{ninetyNineKM.toFixed(2)} KM</span>
              <span className="text-[12.5px] text-cyan-400 font-bold font-mono" title="Eficiência Média por KM">
                {ninetyNineKMRevenue > 0 ? `R$ ${formatDecimalBRL(ninetyNineKMRevenue)}/km` : 'R$ 0,00/km'}
              </span>
            </div>
          </div>

          {/* PARTICULAR KM */}
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[12px] uppercase font-bold text-slate-500 mb-1">
              <span>Particular / Por Fora</span>
              <span className="text-indigo-400 bg-indigo-950 border border-indigo-900 px-1 rounded text-[14.5px] font-mono font-bold">PART.</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-indigo-400 font-mono">{particularKM.toFixed(2)} KM</span>
              <span className="text-[12.5px] text-cyan-400 font-bold font-mono" title="Eficiência Média por KM">
                {particularKMRevenue > 0 ? `R$ ${formatDecimalBRL(particularKMRevenue)}/km` : 'R$ 0,00/km'}
              </span>
            </div>
          </div>

          {/* TOTAL KM */}
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[12px] uppercase font-bold text-slate-500 mb-1">
              <span>Total Acumulado</span>
              <span className="text-emerald-400 bg-emerald-950/40 px-1 rounded text-[14.5px] font-mono font-bold">GERAL</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-black text-emerald-400 font-mono">{totalKM.toFixed(2)} KM</span>
              <span className="text-[12.5px] text-cyan-400 font-black font-mono" title="Eficiência Média Global por KM">
                {totalKMRevenue > 0 ? `R$ ${formatDecimalBRL(totalKMRevenue)}/km` : 'R$ 0,00/km'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Table List */}
      <div className="overflow-x-auto rounded-lg border border-slate-850 bg-slate-950/60 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-thin">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <AlertTriangle className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
            <p className="text-xs font-semibold">Nenhum lançamento corresponde ao filtro.</p>
            <p className="text-[14px] text-slate-650 mt-0.5">Insira novas corridas usando a checkout ou altere os filtros.</p>
          </div>
        ) : (
          <table className="w-full text-left text-[14.5px] text-slate-300">
            <thead className="bg-slate-950 text-slate-505 font-mono border-b border-slate-850 uppercase text-[12px] tracking-wider sticky top-0 z-10 shrink-0">
              <tr>
                <th className="py-2 px-3">Op</th>
                <th className="py-2 px-3">Plataforma</th>
                <th className="py-2 px-3">Descrição e Categoria</th>
                <th className="py-2 px-3 text-center">KM</th>
                <th className="py-2 px-3 text-right">Método</th>
                <th className="py-2 px-3 text-right">Oferta App</th>
                <th className="py-2 px-3 text-right font-semibold">Pago Passageiro</th>
                <th className="py-2 px-3 text-right">Valor Recebido</th>
                <th className="py-2 px-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 border-b border-slate-900">
              {(() => {
                // Extraído como função para reuso em flat e agrupado
                const renderRow = (tx: typeof filteredTransactions[0]) => {
                  const { emoji, color, name } = getCategoryDetails(tx.category, tx.type);
                  const payBadge = getPaymentBadge(tx.paymentMethod);
                  const isIncome = tx.type === 'IN';
                  return (
                  <tr 
                    key={tx.id} 
                    onClick={() => {
                      setSelectedTx(tx);
                      playBeep();
                    }}
                    className="hover:bg-slate-805/45 transition-all font-mono cursor-pointer"
                  >
                    {/* Typo Badge */}
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded ${color} text-xs`}>
                        {emoji}
                      </span>
                    </td>

                    {/* Platform name */}
                    <td className="py-2 px-3 font-bold font-sans">
                      {tx.platform === 'UBER' ? (
                        <span className="text-slate-200 border border-slate-800 bg-slate-950 px-1.5 py-0.5 rounded text-[12px] font-mono">
                          UBER
                        </span>
                      ) : tx.platform === '99' ? (
                        <span className="text-amber-500 border border-amber-900/40 bg-amber-500/5 px-1.5 py-0.5 rounded text-[12px] font-mono">
                          99 APP
                        </span>
                      ) : tx.platform === 'PARTICULAR' ? (
                        <span className="text-indigo-400 border border-indigo-900/35 bg-indigo-550/5 px-1.5 py-0.5 rounded text-[12px] font-mono">
                          POR FORA
                        </span>
                      ) : (
                        <span className="text-slate-500 border border-slate-850 bg-slate-950 px-1.5 py-0.5 rounded text-[12px] font-mono">
                          GERAL
                        </span>
                      )}
                    </td>

                    {/* Desc and categorization */}
                    <td className="py-2 px-3 font-sans">
                      <p className="font-bold text-white mb-0.5 max-w-[200px] truncate leading-tight">
                        {tx.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[12px] text-slate-500 font-mono capitalize">
                          {name}
                        </span>
                        {tx.tipValue !== undefined && tx.tipValue > 0 && (
                          <span className="text-[12px] text-emerald-400 font-extrabold bg-emerald-950/45 border border-emerald-900/30 px-1 py-0.2 rounded font-sans flex items-center gap-0.5">
                            🥳 Gorjeta: R$ {formatDecimalBRL(tx.tipValue)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* KM */}
                    <td className="py-2 px-3 text-center font-mono text-xs">
                      {tx.km ? (
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span className="text-white font-extrabold">{tx.km.toString()} KM</span>
                          {tx.type === 'IN' && tx.km > 0 && (
                            <div className="flex flex-col gap-1 items-center mt-0.5">
                              <span className="text-[12.5px] text-cyan-450 font-bold bg-cyan-950/45 px-1 py-0.2 rounded border border-cyan-900/30">
                                R$ {formatDecimalBRL(tx.value / tx.km)}/km
                              </span>
                              <span className="text-[12px] text-amber-500 font-bold bg-amber-950/30 px-1 py-0.2 rounded border border-amber-900/20 flex items-center gap-0.5" title="Combustível estimado gasto nesta corrida">
                                ⛽ {((tx.km || 0) / activeConsumption).toFixed(2).replace('.', ',')} L
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Payment Method */}
                    <td className="py-2 px-3 text-right">
                      {tx.type === 'IN' ? (
                        <span className={`text-[12px] border px-1.5 py-0.5 rounded font-mono ${payBadge.style}`}>
                          {payBadge.label}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-650 border border-slate-900 px-1.5 py-0.5 rounded font-mono">DESPESA</span>
                      )}
                    </td>

                    {/* Oferta App */}
                    <td className="py-2 px-3 text-right text-slate-400 font-medium font-mono">
                      {isIncome ? (
                        tx.appOfferValue !== undefined ? (
                          `R$ ${formatDecimalBRL(tx.appOfferValue)}`
                        ) : (
                          '-'
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Pago Passageiro */}
                    <td className="py-2 px-3 text-right text-slate-400 font-medium font-mono">
                      {isIncome ? (
                        <>
                          {tx.passengerAppValue !== undefined ? (
                            `R$ ${formatDecimalBRL(tx.passengerAppValue)}`
                          ) : tx.passengerValue !== undefined ? (
                            `R$ ${formatDecimalBRL(tx.passengerValue)}`
                          ) : (
                            `R$ ${formatDecimalBRL(tx.value)}`
                          )}
                          {tx.tipValue !== undefined && tx.tipValue > 0 && (
                            <div className="text-[11px] text-emerald-500 font-bold" title="Gorjeta Paga">
                              + R$ {formatDecimalBRL(tx.tipValue)} (gorjeta)
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Final net value */}
                    <td className={`py-2 px-3 text-right font-black font-mono text-slate-100 ${
                      isIncome ? 'text-emerald-400' : 'text-rose-455'
                    }`}>
                      {isIncome ? '+' : '-'} R$ {formatDecimalBRL(tx.value)}
                      {isIncome && tx.tipValue !== undefined && tx.tipValue > 0 && (
                        <div className="text-[11px] text-amber-450 font-extrabold" title="Gorjeta Recebida">
                          + R$ {formatDecimalBRL(tx.tipValue)} (gorjeta)
                        </div>
                      )}
                    </td>

                    {/* Actions button */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTx(tx);
                            playBeep();
                          }}
                          className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded transition-all border border-slate-800/80"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTransaction(tx.id);
                          }}
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-900/50 text-rose-400 hover:text-white rounded transition-all border border-rose-950/40"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                };

                // Agrupamento por data apenas em ordenação cronológica
                const useGroups = sortBy === 'TIME_DESC' || sortBy === 'TIME_ASC';
                if (!useGroups) return filteredTransactions.map(renderRow);

                const _groups: Array<{dateKey: string; dateLabel: string; txs: typeof filteredTransactions; totalIn: number; totalOut: number}> = [];
                const _gMap = new Map<string, typeof _groups[0]>();
                filteredTransactions.forEach(tx => {
                  const d = new Date(tx.timestamp);
                  const dateKey = d.toLocaleDateString('pt-BR');
                  const dateLabel = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                  if (!_gMap.has(dateKey)) { const g = { dateKey, dateLabel, txs: [] as typeof filteredTransactions, totalIn: 0, totalOut: 0 }; _gMap.set(dateKey, g); _groups.push(g); }
                  const g = _gMap.get(dateKey)!;
                  g.txs.push(tx);
                  if (tx.type === 'IN') g.totalIn += tx.value; else g.totalOut += tx.value;
                });
                return _groups.flatMap(group => [
                  <tr key={`dh-${group.dateKey}`} className="bg-slate-900/80 sticky top-[33px] z-[5] select-none">
                    <td colSpan={9} className="py-1.5 px-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] font-extrabold text-slate-300 uppercase tracking-wide">{group.dateLabel}</span>
                        <div className="flex items-center gap-3 text-[12px] font-mono">
                          {group.totalIn > 0 && <span className="text-emerald-400 font-bold">+R$ {formatDecimalBRL(group.totalIn)}</span>}
                          {group.totalOut > 0 && <span className="text-rose-400 font-bold">−R$ {formatDecimalBRL(group.totalOut)}</span>}
                          <span className="text-slate-600 text-[11px]">{group.txs.length} lanç.</span>
                        </div>
                      </div>
                    </td>
                  </tr>,
                  ...group.txs.map(renderRow)
                ]);
              })()}
            </tbody>
          </table>
        )}
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
                      : 'bg-rose-500/10 text-rose-455 border-rose-950/60'
                  }`}>
                    {selectedTx.type === 'IN' ? 'Entrada / Corrida' : 'Saída / Despesa'}
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
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
              <div className="p-5 space-y-4.5 max-h-[75vh] overflow-y-auto scrollbar-thin">
                {/* Platform info card */}
                <div className="bg-slate-900/40 border border-slate-850/80 rounded-xl p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex items-center justify-center font-bold text-[12px]"></span>
                    <span className="text-slate-400 font-medium">Plataforma Atribuída:</span>
                  </div>
                  <div>
                    {selectedTx.platform === 'UBER' ? (
                      <span className="bg-white text-slate-955 font-black font-mono text-[12.5px] py-1 px-3 rounded-full border border-slate-700">UBER</span>
                    ) : selectedTx.platform === '99' ? (
                      <span className="bg-amber-500 text-slate-955 font-black font-mono text-[12.5px] py-1 px-3 rounded-full">99 APP</span>
                    ) : selectedTx.platform === 'PARTICULAR' ? (
                      <span className="bg-indigo-600 text-white font-black font-mono text-[12.5px] py-1 px-3 rounded-full shadow-sm shadow-indigo-500/10">POR FORA</span>
                    ) : (
                      <span className="bg-slate-800 text-slate-300 font-bold font-mono text-[12.5px] py-1 px-3 rounded-full uppercase">GERAL</span>
                    )}
                  </div>
                </div>

                {/* Main Details and Values list */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Data do Registro:
                    </span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {new Date(selectedTx.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      Descrição / Nota:
                    </span>
                    <span className="font-semibold text-white tracking-wide max-w-[210px] truncate text-right">
                      {selectedTx.description || 'Nenhum detalhe inserido'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-slate-500" />
                      Forma de Recebimento:
                    </span>
                    <span className="font-bold text-slate-200">
                      {selectedTx.paymentMethod || 'PIX'}
                    </span>
                  </div>

                  {selectedTx.km !== undefined && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        Quilômetros Rodados:
                      </span>
                      <span className="font-black text-amber-500 font-mono">
                        {selectedTx.km.toString()} KM
                      </span>
                    </div>
                  )}

                  {selectedTx.km !== undefined && selectedTx.type === 'IN' && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>⛽</span> Combustível Gasto Estimado:
                      </span>
                      <span className="font-black text-amber-500 font-mono">
                        {((selectedTx.km || 0) / activeConsumption).toFixed(2).replace('.', ',')} L
                      </span>
                    </div>
                  )}
                </div>

                {/* SPECIFIC PROFIT CALCULATOR & DETAILED VALUE BREAKDOWNS for RIDE (IN) */}
                {selectedTx.type === 'IN' ? (
                  <div className="bg-slate-900/60 border border-slate-805 p-4 rounded-xl space-y-3 font-mono">
                    <h4 className="text-[13px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      DRE / Balanço da Corrida (Faturamento)
                    </h4>
                    
                    <div className="space-y-1.5 text-xs">
                      {/* 1. Faturamento Total Real */}
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-800/60">
                        <span className="text-slate-350 font-bold">Faturamento Real Entrado (Bruto):</span>
                        <span className="font-extrabold text-emerald-400 text-sm">
                          R$ {formatDecimalBRL(selectedTx.value)}
                        </span>
                      </div>

                      {(selectedTx.platform === 'UBER' || selectedTx.platform === '99') ? (() => {
                        const extra = selectedTx.extraChargedValue || 0;
                        const gorjeta = selectedTx.tipValue || 0;
                        const offer = selectedTx.appOfferValue !== undefined ? selectedTx.appOfferValue : (selectedTx.value - extra - gorjeta);
                        const passenger = selectedTx.passengerAppValue !== undefined ? selectedTx.passengerAppValue : (selectedTx.passengerValue !== undefined ? selectedTx.passengerValue : offer);
                        const appFee = passenger - offer;
                        const appFeePct = passenger > 0 ? (appFee / passenger) * 100 : 0;
                        return (
                          <>
                            {/* Auditoria de Taxas block */}
                            <div className="border border-amber-900/30 bg-amber-950/40 p-2.5 rounded-lg space-y-1.5 my-2">
                              <div className="text-[11.5px] font-black text-amber-500 uppercase tracking-widest border-b border-slate-800 pb-1 mb-1">
                                📱 Auditoria de Taxas da Corrida
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Valor Ofertado na Chamada (App):</span>
                                <span className="font-bold text-slate-300">R$ {formatDecimalBRL(offer)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Passageiro Pago à Plataforma:</span>
                                <span className="font-bold text-slate-200">R$ {formatDecimalBRL(passenger)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs border-t border-slate-800/50 mt-1 pt-1.5">
                                <span className="text-slate-400 font-sans">Comissão Retida p/ App:</span>
                                <span className={appFee > 0 ? 'text-rose-400 font-bold' : appFee < 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                  R$ {formatDecimalBRL(appFee)} ({appFeePct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>

                            {/* Extra Charged by driver */}
                            {extra > 0 && (
                              <div className="flex justify-between items-center pt-1 text-xs">
                                <span className="text-slate-400">(+) Cobrado por Fora (Extra):</span>
                                <span className="font-bold text-emerald-400">
                                  + R$ {formatDecimalBRL(extra)}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })() : (
                        <>
                          {/* Non-platform or generic rides fallback */}
                          <div className="flex justify-between items-center pt-1 text-xs">
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

                      {/* KM rodado metrics */}
                      {selectedTx.km !== undefined && selectedTx.km > 0 && (
                        <div className="border-t border-dashed border-slate-800 pt-2 mt-1 space-y-1.5 text-[14.5px]">
                          {/* Valor recebido por KM rodado */}
                          <div className="flex justify-between text-slate-400">
                            <span>Faturamento por KM:</span>
                            <span className="font-semibold text-slate-300">R$ {formatDecimalBRL(selectedTx.value / selectedTx.km)} / km</span>
                          </div>

                          {/* Consumo real do veículo */}
                          <div className="flex justify-between text-cyan-400">
                            <span>Consumo Real do Veículo:</span>
                            <span className="font-mono font-bold">{typeof activeConsumption === 'number' ? activeConsumption.toFixed(2).replace('.', ',') : activeConsumption} km/L ({vehicleType === 'BIKE' ? '🏍️ Moto' : '🚗 Carro'})</span>
                          </div>

                          {/* Combustível Gasto Real */}
                          <div className="flex justify-between text-slate-400">
                            <span>Combustível Gasto na Corrida:</span>
                            <span className="font-mono text-amber-500 font-bold">{(selectedTx.km / activeConsumption).toFixed(3).replace('.', ',')} L</span>
                          </div>

                          <div className="flex justify-between text-slate-400">
                            <span>Preço Médio do Litro (Shift):</span>
                            <span className="font-mono text-slate-300">R$ {formatDecimalBRL(averagePricePerLiter)}/L</span>
                          </div>

                          {/* Lucro operacional real */}
                          <div className="flex justify-between text-rose-500 border-t border-dotted border-slate-800 pt-2 mt-1">
                            <span>(-) Custo Real do Combustível:</span>
                            <span>- R$ {formatDecimalBRL((selectedTx.km / activeConsumption) * averagePricePerLiter)}</span>
                          </div>
                          
                          <div className="flex justify-between text-xs font-black text-emerald-450 pt-1.5 border-t border-slate-800">
                            <span>SALDO OPERACIONAL RESTANTE (REAL):</span>
                            <span className="text-sm bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black">
                              R$ {formatDecimalBRL(selectedTx.value - (selectedTx.km / activeConsumption) * averagePricePerLiter)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pro tip or disclaimer */}
                    <div className="text-[12.5px] text-slate-500 font-sans leading-relaxed pt-1.5 border-t border-slate-850 border-dashed">
                      💡 <strong>Métrica de Combustível Real:</strong> Calculada com base no consumo configurado para seu veículo (<strong>{typeof activeConsumption === 'number' ? activeConsumption.toFixed(2).replace('.', ',') : activeConsumption} km/L</strong>) e preço médio real de abastecimentos de <strong>R$ {formatDecimalBRL(averagePricePerLiter)}/L</strong>.
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
                          <span className="font-extrabold text-cyan-400">{selectedTx.liters.toFixed(3).replace('.', ',')} L</span>
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
                        const txRefuels = transactions
                          .filter(t => (t.category === 'COMBUSTIVEL' || t.liters !== undefined) && t.odometer !== undefined && t.odometer > 0)
                          .sort((a, b) => (a.odometer || 0) - (b.odometer || 0));
                        const txIndex = txRefuels.findIndex(t => t.id === selectedTx.id);
                        const previousOdo = txIndex > 0 ? txRefuels[txIndex - 1].odometer : undefined;
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
                                O veículo rodou <strong className="text-white">{distCovered} KM</strong> com <strong className="text-white">{selectedTx.liters?.toFixed(3).replace('.', ',')} L</strong> desde o abastecimento anterior registrado (<strong className="text-white">{previousOdo} KM</strong>).
                              </p>
                            </div>
                          );
                        }
                        return (
                          <p className="text-[12px] font-sans text-slate-500 leading-relaxed bg-slate-950/45 p-2 rounded-lg border border-slate-850/80 mt-1">
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
    </div>
  );
}

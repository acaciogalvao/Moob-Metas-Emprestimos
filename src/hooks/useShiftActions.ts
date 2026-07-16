/**
 * useShiftActions.ts — All action handlers extracted from App.tsx.
 */

import React from 'react';
import { Shift, Transaction } from '../types';
import { formatDecimalBRL, getTransactionFaturamentoReal, calculateExtraValue } from '../utils/format';
import { playBeep } from '../utils/audio';
import { ConfirmDialogState } from './useConfirmDialog';

// ─── Funções puras extraídas ──────────────────────────────────────────────────

/** Arredonda para 2 casas decimais, eliminando erros de ponto flutuante. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Recalcula o saldo esperado de fechamento a partir das transações.
 * Extrai lógica duplicada de handleAddTransaction e executeDeleteTransaction.
 */
function computeExpectedBalance(txs: Transaction[], initialBalance: number): number {
  const totalIn  = txs.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
  const totalOut = txs.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
  return roundCents(initialBalance + totalIn - totalOut);
}

type PaymentChannel = 'DINHEIRO' | 'PIX';

/**
 * Calcula o saldo esperado em um canal de pagamento (Dinheiro ou Pix) para um
 * turno. Unifica a lógica antes duplicada em getExpectedPocketCashForShift e
 * getExpectedPixBalanceForShift.
 */
function getExpectedChannelBalance(shift: Shift, channel: PaymentChannel): number {
  const allIn   = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
  const allOut  = shift.transactions.filter(t => t.type === 'OUT');

  const channelIn = allIn.reduce((sum, t) => {
    if (t.category === 'GORJETA') return sum;

    // Pagamento direto no canal (Dinheiro ou Pix)
    if (t.paymentMethod === channel) {
      const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
      return sum + (t.value - fee);
    }

    // Corrida no app com extra no canal (ex: cobrou diferença em Dinheiro)
    if (t.paymentMethod === 'APP') {
      const extraMethod = (t.extraPaymentMethod ?? '').toUpperCase() as PaymentChannel;
      if (extraMethod === channel) {
        const extra = t.extraChargedValue !== undefined
          ? t.extraChargedValue
          : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
        return sum + extra;
      }
    }

    return sum;
  }, 0);

  const channelOut = allOut
    .filter(t => t.paymentMethod === channel)
    .reduce((acc, t) => acc + t.value, 0);

  const initialChannelBalance = channel === 'DINHEIRO'
    ? (shift.initialCashBalance !== undefined ? shift.initialCashBalance : shift.initialBalance)
    : (shift.initialPixBalance  !== undefined ? shift.initialPixBalance  : 0);

  return roundCents(initialChannelBalance + channelIn - channelOut);
}

interface UseShiftActionsParams {
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  saveToLocalStorage: (newShifts: Shift[]) => void;
  queueCloudSync?: (newShifts: Shift[]) => void;
  setDriverName: (name: string) => void;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  setSelectedShiftForReport: (shift: Shift | null) => void;
  activeShift: Shift | null;
}

export function useShiftActions({
  shifts,
  setShifts,
  saveToLocalStorage,
  queueCloudSync,
  setDriverName,
  setConfirmDialog,
  setSelectedShiftForReport,
  activeShift,
}: UseShiftActionsParams) {

  const handleChangeDriverName = (newName: string) => {
    setDriverName(newName);
    localStorage.setItem('moob_caixa_driver_name', newName);
  };

  const handleOpenShift = (
    initialPixBalance: number,
    initialCashBalance: number,
    initialOdometer?: number,
    initialUberBalance?: number,
    initial99Balance?: number,
    initialFuelLiters?: number,
    initialFuelLevel?: string,
    monthlyGoal?: number,
    dailyKmGoal?: number
  ) => {
    const closedOldShifts = shifts.map(s => {
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });

    const lastClosedShift = shifts
      .filter(s => s.status === 'CLOSED')
      .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null;

    let previousFaturamentoReal = 0;
    if (lastClosedShift) {
      const shiftRides = lastClosedShift.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
      const shiftInflows = lastClosedShift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);

      const shiftBruto = shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) +
                         shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);

      previousFaturamentoReal = shiftBruto;
    }

    const totalBalance = initialPixBalance + initialCashBalance;
    const ajuste = lastClosedShift ? (totalBalance - previousFaturamentoReal) : 0;

    const newShift: Shift = {
      id: `shift-${Date.now()}-${new Date().toISOString().split('T')[0]}`,
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialBalance: totalBalance,
      initialPixBalance,
      initialCashBalance,
      initialUberBalance,
      initial99Balance,
      status: 'OPEN',
      transactions: [],
      closingBalanceExpected: totalBalance,
      initialOdometer: initialOdometer !== undefined && !isNaN(initialOdometer) ? initialOdometer : undefined,
      initialFuelLiters: initialFuelLiters !== undefined && !isNaN(initialFuelLiters) ? initialFuelLiters : undefined,
      initialFuelLevel,
      monthlyGoal: monthlyGoal !== undefined && !isNaN(monthlyGoal) ? monthlyGoal : undefined,
      dailyKmGoal: dailyKmGoal !== undefined && !isNaN(dailyKmGoal) ? dailyKmGoal : undefined,
      ajusteSaldoAnterior: ajuste,
      saldoAnterior: lastClosedShift ? previousFaturamentoReal : undefined
    };

    saveToLocalStorage([newShift, ...closedOldShifts]);
  };

  const handleAddTransaction = (tx: Omit<Transaction, 'id' | 'timestamp'> | Omit<Transaction, 'id' | 'timestamp'>[]) => {
    if (!activeShift) return;

    const txsArray = Array.isArray(tx) ? tx : [tx];

    setShifts(prevShifts => {
      const updated = prevShifts.map(s => {
        if (s.id === activeShift.id) {
          const newTxs: Transaction[] = txsArray.map((t, idx) => ({
            id: `tx-${Date.now()}-${idx}-${Math.round(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...t
          }));

          const trans = [...s.transactions, ...newTxs];

          return {
            ...s,
            transactions: trans,
            closingBalanceExpected: computeExpectedBalance(trans, s.initialBalance),
          };
        }
        return s;
      });

      localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));
      queueCloudSync?.(updated);
      return updated;
    });
  };

  const handleUpdateActiveShift = (updatedFields: Partial<Shift>) => {
    if (!activeShift) return;
    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return { ...s, ...updatedFields };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  const executeDeleteTransaction = (txId: string) => {
    const updatedShifts = shifts.map(s => {
      const matchTx = s.transactions.some(t => t.id === txId);
      if (matchTx) {
        const remaining = s.transactions.filter(t => t.id !== txId);
        return {
          ...s,
          transactions: remaining,
          closingBalanceExpected: computeExpectedBalance(remaining, s.initialBalance),
        };
      }
      return s;
    });

    saveToLocalStorage(updatedShifts);
    setConfirmDialog(null);
  };

  const handleDeleteTransaction = (txId: string) => {
    let value = 0;
    for (const s of shifts) {
      const found = s.transactions.find(t => t.id === txId);
      if (found) {
        value = found.value;
        break;
      }
    }

    setConfirmDialog({
      title: 'Excluir Lançamento?',
      message: `Tem certeza de que deseja excluir permanentemente o lançamento no valor de R$ ${formatDecimalBRL(value)}? Esta ação não poderá ser desfeita.`,
      confirmText: 'Confirmar Exclusão',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => executeDeleteTransaction(txId)
    });
  };

  const handleCloseShift = (
    closingBalanceReal: number,
    closingPixReal: number,
    notes: string,
    finalOdometer?: number,
    totalLitersFueled?: number,
    finalFuelLiters?: number,
    finalFuelLevel?: string
  ) => {
    if (!activeShift) return;

    const expectedPocketCash = getExpectedChannelBalance(activeShift, 'DINHEIRO');
    const diff               = roundCents(closingBalanceReal - expectedPocketCash);

    const expectedPixBalance = getExpectedChannelBalance(activeShift, 'PIX');
    const diffPix            = roundCents(closingPixReal - expectedPixBalance);

    const closed: Shift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      status: 'CLOSED' as const,
      closingBalanceReal,
      difference: diff,
      closingPixReal,
      differencePix: diffPix,
      notes: notes.trim() || undefined,
      finalOdometer: finalOdometer !== undefined && !isNaN(finalOdometer) ? finalOdometer : undefined,
      totalLitersFueled: totalLitersFueled !== undefined && !isNaN(totalLitersFueled) ? totalLitersFueled : undefined,
      finalFuelLiters: finalFuelLiters !== undefined && !isNaN(finalFuelLiters) ? finalFuelLiters : undefined,
      finalFuelLevel: finalFuelLevel || undefined
    };

    setTimeout(() => setSelectedShiftForReport(closed), 200);

    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return closed;
      }
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  const executeDeleteHistoryShift = async (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));

    try {
      const response = await fetch(`/moob-api/shifts/${shiftId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        console.log(`[Sync-Offline-First] Turno ${shiftId} excluído do banco de dados com sucesso.`);
      } else {
        console.warn(`[Sync-Offline-First] Falha ao excluir turno ${shiftId} no servidor.`);
      }
    } catch (err) {
      console.warn("[Sync-Offline-First] Erro ao excluir turno do banco de dados:", err);
    }

    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: updated })
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Erro na sincronização pós-exclusão");
    })
    .then(data => {
      if (Array.isArray(data)) {
        setShifts(data);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify(data));
      }
    })
    .catch(err => {
      console.warn("[Sync-Offline-First] Falha ao sincronizar após exclusão:", err);
    });

    setConfirmDialog(null);
  };

  const handleDeleteHistoryShift = (shiftId: string) => {
    setConfirmDialog({
      title: 'Excluir Turno do Histórico?',
      message: 'Tem certeza de que deseja expurgar e deletar permanentemente as estatísticas e todos os lançamentos desse turno? É uma ação irreversível.',
      confirmText: 'Excluir Definitivamente',
      cancelText: 'Manter Turno',
      isDanger: true,
      onConfirm: () => executeDeleteHistoryShift(shiftId)
    });
  };

  const handleFactoryReset = () => {
    setConfirmDialog({
      title: 'Resetar Sistema / Banco de Dados?',
      message: 'Esta ação irá limpar absolutamente todas as estatísticas, faturamentos, cadastros e saídas do seu dispositivo para retornar ao estado original de simulação limpa. Deseja prosseguir?',
      confirmText: 'Sim, Resetar Tudo',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        const closedShifts = shifts.filter(s => s.status === 'CLOSED');
        saveToLocalStorage(closedShifts);
        setConfirmDialog(null);
        playBeep();
      }
    });
  };

  return {
    handleChangeDriverName,
    handleOpenShift,
    handleAddTransaction,
    handleUpdateActiveShift,
    handleDeleteTransaction,
    handleCloseShift,
    handleDeleteHistoryShift,
    handleFactoryReset,
  };
}

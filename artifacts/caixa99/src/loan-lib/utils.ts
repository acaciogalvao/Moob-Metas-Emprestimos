/**
 * Módulo de utilitários (utils.ts).
 * Funções auxiliares vitais e reutilizáveis: formatação de moeda (BRL),
 * labels numéricas e textuais, mensagens motivacionais e máscaras de inputs.
 */
import React from "react";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const getFreqLabel = (freq: string) => {
  if (freq === "daily") return "Por dia";
  if (freq === "weekly") return "Por semana";
  return "Por mês";
};

export const getMotivationalMessage = (percent: number) => {
  if (percent === 0)
    return "Toda grande jornada começa com o primeiro passo. Vamos lá!";
  if (percent < 25) return "Bom começo! O importante é manter a consistência.";
  if (percent < 50) return "Quase na metade! Vocês estão indo super bem.";
  if (percent < 75)
    return "Passamos da metade! O sonho está cada vez mais perto.";
  if (percent < 100) return "Falta muito pouco! Reta final para a conquista.";
  return "🎉 Parabéns! Vocês alcançaram a meta juntos! Que venham os próximos sonhos!";
};

export const formatPaidSequence = (paid: number, total: number) => {
  const current = paid + 1;
  const maxTotal = Math.max(total, current);
  return `${String(current).padStart(2, "0")}/${String(maxTotal).padStart(2, "0")}`;
};

export const handleCurrencyChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string) => void,
) => {
  const digits = e.target.value.replace(/\D/g, "");
  if (!digits) {
    setter("");
    return;
  }
  const numericValue = Number(digits) / 100;
  setter(numericValue.toString());
};

export const parseLocalDate = (dateString: string | number | Date | null | undefined): Date => {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return new Date(dateString);
  if (typeof dateString === 'number') return new Date(dateString);
  
  if (typeof dateString === 'string') {
    const cleanStr = dateString.split('T')[0];
    if (cleanStr.length === 10 && cleanStr.includes('-')) {
        const [year, month, day] = cleanStr.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed in Date constructor, this ensures local timezone
    }
  }
  return new Date(dateString);
};

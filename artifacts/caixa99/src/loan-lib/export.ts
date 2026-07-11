/**
 * Módulo de exportação (export.ts).
 * Fornece a função `generateExportText` que cria uma mensagem formatada
 * (com emojis e destalhes da dívida/meta) para compartilhamento em apps
 * de mensagens (ex: WhatsApp).
 */
import { CalculationResults, GoalType } from "../types";
import { formatCurrency, formatPaidSequence, getFreqLabel } from "../loan-lib/utils";

interface ExportTextParams {
  category: string;
  goalType: GoalType;
  itemName: string;
  nameP1: string;
  nameP2: string;
  contributionP1: string;
  contributionP2: number;
  results: CalculationResults;
}

export const generateExportText = ({
  category,
  goalType,
  itemName,
  nameP1,
  nameP2,
  contributionP1,
  contributionP2,
  results,
}: ExportTextParams): string => {
  let text = "";

  if (category === "loan") {
    text = `
🔔 *LEMBRETE DE EMPRÉSTIMO*

Passando para atualizar o status do empréstimo: *${itemName || "Empréstimo"}*

🏦 *Valor Original (Sem Juros):* ${formatCurrency(results.baseTotal)}
💰 *Valor Total (Com Juros):* ${formatCurrency(results.total)}
✅ *Já foi pago:* ${formatCurrency(results.saved)}
📉 *Falta pagar:* ${formatCurrency(results.remaining)}
`;
    if (goalType === "shared") {
      text += `
👥 *Resumo por Pessoa:*
👤 *${nameP1}:* ${results.isLateP1 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Já quitou: ${formatCurrency(results.sP1)}
   - Parcela Atual: ${formatPaidSequence(results.paidPeriodsCountP1, results.totalPeriodsP1)}
   - Resta pagar: ${formatCurrency(results.remainingP1)}

👤 *${nameP2}:* ${results.isLateP2 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Já quitou: ${formatCurrency(results.sP2)}
   - Parcela Atual: ${formatPaidSequence(results.paidPeriodsCountP2, results.totalPeriodsP2)}
   - Resta pagar: ${formatCurrency(results.remainingP2)}

📆 _Por favor, não se esqueçam do pagamento da parcela atual!_
`;
    } else {
      text += `
👤 *Titular:* ${nameP1} ${results.isLateP1 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Parcela Atual: ${formatPaidSequence(results.paidPeriodsCountP1, results.totalPeriodsP1)}
   - Valor da Parcela: ${formatCurrency(results.installmentP1)} (${getFreqLabel(results.actualFreqP1).toLowerCase()})
   - Resta pagar: ${formatCurrency(results.remainingP1)}

📆 _Por favor, lembre-se do pagamento da parcela atual!_
`;
    }
  } else {
    text = `
🎯 *LEMBRETE DA META*

Passando para atualizar o progresso da ${goalType === "individual" ? "minha meta" : "nossa meta"}: *${itemName || "Sem nome"}*

💰 *Objetivo de Valor:* ${formatCurrency(results.total)}
✅ *Já Guardado:* ${formatCurrency(results.saved)} (${results.progressPercent.toFixed(1)}%)
📉 *Falta:* ${formatCurrency(results.remaining)}
`;

    if (goalType === "shared") {
      text += `
📊 *Resumo Individual:*
👤 *${nameP1} (${contributionP1}%):* ${results.isLateP1 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Já guardou: ${formatCurrency(results.sP1)}
   - Guardar na vez: ${formatCurrency(results.installmentP1)} ${getFreqLabel(results.actualFreqP1).toLowerCase()}
   - Resta: ${formatCurrency(results.remainingP1)}

👤 *${nameP2} (${contributionP2}%):* ${results.isLateP2 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Já guardou: ${formatCurrency(results.sP2)}
   - Guardar na vez: ${formatCurrency(results.installmentP2)} ${getFreqLabel(results.actualFreqP2).toLowerCase()}
   - Resta: ${formatCurrency(results.remainingP2)}

Bora conquistar esse objetivo juntos! ❤️💪`;
    } else {
      text += `
👤 *Meu Resumo:* ${results.isLateP1 ? "⚠️ ATRASADO" : "✅ EM DIA"}
   - Guardar na vez: ${formatCurrency(results.installmentP1)} ${getFreqLabel(results.actualFreqP1).toLowerCase()}

Bora conquistar! 💪`;
    }
  }

  return text.trim();
};

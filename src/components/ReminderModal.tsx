/**
 * Componente ReminderModal.
 * Modal para gerenciar configurações de lembretes da meta/empréstimo,
 * bem como exportar/compartilhar o texto resumido via WhatsApp ou cópia.
 */
import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, MessageCircle } from "lucide-react";

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalType: "individual" | "shared";
  category: string;
  nameP1: string;
  nameP2: string;
  phoneP1: string;
  phoneP2: string;
  summaryText: string;
  showToast: (text: string, type?: "success" | "error") => void;
}

export function ReminderModal({
  isOpen,
  onClose,
  goalType,
  category,
  nameP1,
  nameP2,
  phoneP1,
  phoneP2,
  summaryText,
  showToast,
}: ReminderModalProps) {
  if (!isOpen) return null;

  const handleSend = (phone: string, text: string) => {
    const encodedText = encodeURIComponent(text);
    const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
    if (cleanPhone) {
      window.open(
        `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodedText}`,
        "_blank",
      );
    } else {
      window.open(
        `https://api.whatsapp.com/send?text=${encodedText}`,
        "_blank",
      );
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText).then(() => {
      showToast("Texto do lembrete copiado!", "success");
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 border-0">
        <CardHeader className="bg-gradient-to-br from-amber-500 to-amber-700 p-6">
          <CardTitle className="text-white flex items-center gap-2 text-xl">
            <Share2 className="w-5 h-5 text-amber-200" /> Enviar Lembrete
          </CardTitle>
          <CardDescription className="text-amber-100 mt-1">
            Relembre o pessoal sobre{" "}
            {category === "loan"
              ? "esta parcela do empréstimo"
              : "esta contribuição da meta"}
            . Escolha o destinatário:
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-white space-y-3">
          {/* P1 Button */}
          <Button
            onClick={() => handleSend(phoneP1, summaryText)}
            className="w-full bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 flex justify-start h-auto p-4 rounded-2xl relative shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mr-4 group-hover:bg-emerald-500 transition-colors">
              <MessageCircle className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-left font-normal flex-1">
              <span className="block font-bold text-slate-900 group-hover:text-emerald-800">
                Enviar para {nameP1}
              </span>
              <span className="text-xs text-slate-500">
                {phoneP1
                  ? `WhatsApp: ${phoneP1}`
                  : "Nenhum WhatsApp cadastrado. Abrirá lista de contatos."}
              </span>
            </div>
          </Button>

          {/* P2 Button (if shared) */}
          {goalType === "shared" && (
            <Button
              onClick={() => handleSend(phoneP2, summaryText)}
              className="w-full bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 flex justify-start h-auto p-4 rounded-2xl relative shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mr-4 group-hover:bg-emerald-500 transition-colors">
                <MessageCircle className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left font-normal flex-1">
                <span className="block font-bold text-slate-900 group-hover:text-emerald-800">
                  Enviar para {nameP2}
                </span>
                <span className="text-xs text-slate-500">
                  {phoneP2
                    ? `WhatsApp: ${phoneP2}`
                    : "Nenhum WhatsApp cadastrado. Abrirá lista de contatos."}
                </span>
              </div>
            </Button>
          )}

          {/* General Copy Button */}
          <Button
            onClick={handleCopy}
            className="w-full bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 flex justify-start h-auto p-4 rounded-2xl relative shadow-sm transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mr-4">
              <Copy className="w-5 h-5 text-slate-600" />
            </div>
            <div className="text-left font-normal flex-1">
              <span className="block font-bold text-slate-900">
                Copiar Texto do Lembrete
              </span>
              <span className="text-xs text-slate-500">
                Copia o resumo para colar em outro app
              </span>
            </div>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-100 bg-slate-50 p-4">
          <Button
            variant="ghost"
            className="w-full rounded-2xl h-12 text-slate-500 hover:bg-slate-200/50"
            onClick={onClose}
          >
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

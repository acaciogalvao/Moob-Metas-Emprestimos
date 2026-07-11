import { useState } from "react";
import { X, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EarlySettlementModalProps {
  onClose: () => void;
  remaining: number;
  totalValue: number;
  savedAmount: number;
  formatCurrency: (v: number) => string;
  nameP1: string;
  nameP2: string;
  goalType: "individual" | "shared";
  onConfirm: (amountP1: number, amountP2: number) => Promise<void>;
}

export function EarlySettlementModal({
  onClose,
  remaining,
  totalValue,
  savedAmount,
  formatCurrency,
  nameP1,
  nameP2,
  goalType,
  onConfirm,
}: EarlySettlementModalProps) {
  const [discount, setDiscount] = useState("0");
  const [payer, setPayer] = useState<"P1" | "P2" | "both">("P1");
  const [loading, setLoading] = useState(false);

  const discountNum = Math.min(100, Math.max(0, Number(discount) || 0));
  const settlementAmount = remaining * (1 - discountNum / 100);
  const savings = remaining - settlementAmount;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let amtP1 = 0;
      let amtP2 = 0;
      if (payer === "P1" || payer === "both") amtP1 = goalType === "shared" && payer === "both" ? settlementAmount / 2 : settlementAmount;
      if (payer === "P2" || payer === "both") amtP2 = goalType === "shared" && payer === "both" ? settlementAmount / 2 : settlementAmount;
      if (payer === "P1") { amtP1 = settlementAmount; amtP2 = 0; }
      if (payer === "P2") { amtP1 = 0; amtP2 = settlementAmount; }
      await onConfirm(amtP1, amtP2);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4">
      <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Quitação Antecipada
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-3 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Total do empréstimo</p>
              <p className="font-bold text-white">{formatCurrency(totalValue)}</p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-3 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Já pago</p>
              <p className="font-bold text-emerald-400">{formatCurrency(savedAmount)}</p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-4 rounded-xl text-center border border-amber-500/20">
            <p className="text-xs text-amber-400 mb-1 font-bold uppercase tracking-widest">Saldo restante</p>
            <p className="text-2xl font-black text-white">{formatCurrency(remaining)}</p>
          </div>

          {/* Discount */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Desconto negociado (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
            />
          </div>

          {discountNum > 0 && (
            <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md-subtle p-3 rounded-xl text-center border border-emerald-500/20">
              <p className="text-xs text-emerald-400 mb-1">Você economiza: {formatCurrency(savings)}</p>
              <p className="text-lg font-black text-emerald-400">
                Valor a pagar: {formatCurrency(settlementAmount)}
              </p>
            </div>
          )}

          {/* Payer */}
          {goalType === "shared" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quem está quitando</label>
              <div className="grid grid-cols-3 gap-2">
                {([["P1", nameP1], ["P2", nameP2], ["both", "Ambos"]] as [string, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setPayer(v as any)}
                    className={`py-2 rounded-xl text-sm font-semibold transition-colors ${payer === v ? "bg-amber-500 text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Isso registrará o pagamento e encerrará o empréstimo. Confirme apenas se o dinheiro já foi recebido.</p>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-300 hover:bg-white/5 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || settlementAmount <= 0}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              {loading ? "Registrando..." : `Quitar ${formatCurrency(settlementAmount)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

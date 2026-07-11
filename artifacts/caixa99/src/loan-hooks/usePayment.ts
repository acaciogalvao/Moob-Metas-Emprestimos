/**
 * Hook usePayment.
 * Gerencia a lógica do modal de geração de Pix, verificação do status
 * e tratamentos de pagamentos manuais. Conecta-se ao backend via API.
 */
import { useState, useEffect } from "react";

interface UsePaymentProps {
  currentGoalId: string;
  pixKeyP1: string;
  pixKeyP2: string;
  nameP1: string;
  nameP2: string;
  showToast: (text: string, type?: "success" | "error") => void;
  onPaymentSuccess: () => void;
}

export const usePayment = ({
  currentGoalId,
  pixKeyP1,
  pixKeyP2,
  nameP1,
  nameP2,
  showToast,
  onPaymentSuccess,
}: UsePaymentProps) => {
  const [showPixModal, setShowPixModal] = useState(false);
  const [currentPayer, setCurrentPayer] = useState<"P1" | "P2">("P1");
  const [pixAmount, setPixAmount] = useState("");
  const [pixCode, setPixCode] = useState("");
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState("");
  const [isManualPayment, setIsManualPayment] = useState(true);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "comprovante">("pix");
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  useEffect(() => {
    if (!pixAmount || Number(pixAmount) <= 0) {
      setPixCode("");
      setQrCodeBase64("");
      setIsGeneratingPix(false);
    }
  }, [pixAmount]);

  useEffect(() => {
    if (!paymentId || !showPixModal || paymentSuccess) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/moob-api/check-payment/${paymentId}`);
        const data = await res.json();
        if (data.status === "approved") {
          setPaymentSuccess(true);
          onPaymentSuccess();

          setTimeout(() => {
            setShowPixModal(false);
            setPaymentSuccess(false);
            setPixCode("");
            setQrCodeBase64("");
            setPixAmount("");
            setPaymentId(null);
          }, 2000);
        }
      } catch (e: any) {
        if (e.message === "Failed to fetch") return;
        console.error("Erro ao verificar status do pagamento:", e);
      }
    }, 3000); // Verifica a cada 3 segundos

    return () => clearInterval(interval);
  }, [paymentId, showPixModal, paymentSuccess, onPaymentSuccess]);

  const handleGeneratePix = async () => {
    if (!currentGoalId) {
      showToast("Por favor, salve os dados antes de gerar um Pix.");
      return;
    }
    const amount = Number(pixAmount);
    if (amount <= 0) return;

    setIsGeneratingPix(true);
    try {
      const activePixKey = currentPayer === "P1" ? pixKeyP1 : pixKeyP2;

      let response;
      if (activePixKey) {
        // Opção 1: Chave PIX direta do parceiro cadastrada
        response = await fetch("/moob-api/generate-static-pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            pixKey: activePixKey,
            merchantName: currentPayer === "P1" ? nameP1 : nameP2,
          }),
        });

        setPaymentId(null);
        setIsManualPayment(true);
      } else {
        // Opção 2: API de pagamentos (Mercado Pago)
        response = await fetch("/moob-api/create-pix-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            goalId: currentGoalId,
            payerId: currentPayer,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok || data.error) {
        showToast(
          `Erro ao gerar Pix: ${data.error || "Erro desconhecido"}`,
          "error",
        );
        return;
      }

      if (data.pixCode) {
        setPixCode(data.pixCode);
      }
      if (data.qrCodeBase64) {
        setQrCodeBase64(data.qrCodeBase64);
      }
      if (data.paymentId) {
        setPaymentId(data.paymentId);
      }
      if (data.isMock !== undefined && !activePixKey) {
        setIsManualPayment(data.isMock);
      }
    } catch (error) {
      console.error("Erro ao gerar PIX:", error);
      showToast("Falha ao comunicar com o servidor de pagamentos.", "error");
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!currentGoalId || isConfirmingPayment) {
      if (!currentGoalId)
        showToast("Por favor, salve os dados antes de registrar um pagamento.");
      return;
    }
    const amount = Number(pixAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Informe um valor de pagamento válido.");
      return;
    }

    setIsConfirmingPayment(true);
    try {
      const res = await fetch("/moob-api/manual-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          goalId: currentGoalId,
          payerId: currentPayer,
          method: paymentMethod === "comprovante" ? "pix" : paymentMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar no servidor");
      }

      setPaymentSuccess(true);
      onPaymentSuccess();

      setTimeout(() => {
        setShowPixModal(false);
        setPaymentSuccess(false);
        setPixCode("");
        setQrCodeBase64("");
        setPixAmount("");
        setPaymentId(null);
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao registrar pagamento manual:", error);
      showToast(error.message || "Erro de conexão ao salvar pagamento.", "error");
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);

  const handleVerifyReceipt = async (base64Image: string) => {
    if (!currentGoalId || isVerifyingReceipt) {
      if (!currentGoalId)
        showToast("Por favor, salve os dados antes de verificar o comprovante.");
      return;
    }
    const amount = Number(pixAmount);
    if (!amount || amount <= 0) {
      showToast("Informe o valor antes de anexar o comprovante.");
      return;
    }

    setIsVerifyingReceipt(true);
    try {
      const payerName = currentPayer === "P1" ? nameP1 : nameP2;
      const res = await fetch("/moob-api/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          expectedAmount: amount,
          expectedPayer: payerName
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.isValid) {
        showToast(`Comprovante inválido: ${data.reason || "Não foi possível confirmar o pagamento."}`, "error");
        return;
      }

      showToast("Comprovante verificado com IA com sucesso!", "success");
      await handleConfirmPayment();
    } catch (error) {
      console.error("Erro ao verificar comprovante:", error);
      showToast("Erro ao verificar comprovante com o servidor.", "error");
    } finally {
      setIsVerifyingReceipt(false);
    }
  };

  const copyPixCode = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    showPixModal,
    setShowPixModal,
    currentPayer,
    setCurrentPayer,
    pixAmount,
    setPixAmount,
    pixCode,
    setPixCode,
    isGeneratingPix,
    copied,
    paymentSuccess,
    qrCodeBase64,
    isManualPayment,
    setIsManualPayment,
    paymentMethod,
    setPaymentMethod,
    isConfirmingPayment,
    handleGeneratePix,
    handleConfirmPayment,
    copyPixCode,
    isVerifyingReceipt,
    handleVerifyReceipt,
  };
};

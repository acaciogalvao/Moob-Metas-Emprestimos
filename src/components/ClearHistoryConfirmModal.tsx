/**
 * Componente ClearHistoryConfirmModal.
 * Modal de confirmação exibido quando o usuário deseja limpar 
 * o histórico de pagamentos de uma meta ou empréstimo.
 */
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ClearHistoryConfirmModalProps {
  showClearHistoryConfirm: boolean;
  setShowClearHistoryConfirm: (show: boolean) => void;
  confirmClearHistory: () => void;
}

export function ClearHistoryConfirmModal({
  showClearHistoryConfirm,
  setShowClearHistoryConfirm,
  confirmClearHistory,
}: ClearHistoryConfirmModalProps) {
  if (!showClearHistoryConfirm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">
            Excluir Histórico
          </CardTitle>
          <CardDescription>
            Tem certeza que deseja excluir todo o histórico de pagamentos desta
            meta? Os valores guardados serão zerados.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setShowClearHistoryConfirm(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={confirmClearHistory}
          >
            Excluir Tudo
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

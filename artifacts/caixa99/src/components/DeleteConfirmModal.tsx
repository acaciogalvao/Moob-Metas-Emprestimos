/**
 * Componente DeleteConfirmModal.
 * Modal de confirmação para a exclusão definitiva de uma meta 
 * ou empréstimo do sistema.
 */
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DeleteConfirmModalProps {
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  confirmDeleteGoal: () => void;
}

export function DeleteConfirmModal({
  showDeleteConfirm,
  setShowDeleteConfirm,
  confirmDeleteGoal,
}: DeleteConfirmModalProps) {
  if (!showDeleteConfirm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Excluir Meta</CardTitle>
          <CardDescription>
            Tem certeza que deseja excluir esta meta? Esta ação não pode ser
            desfeita.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={confirmDeleteGoal}
          >
            Excluir
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

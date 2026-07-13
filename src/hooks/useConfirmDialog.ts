/**
 * useConfirmDialog.ts — Hook for confirm dialog state management.
 */

import { useState } from 'react';

export interface ConfirmDialogState {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  return { confirmDialog, setConfirmDialog };
}

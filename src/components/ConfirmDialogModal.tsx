/**
 * ConfirmDialogModal.tsx — Reusable confirm dialog modal.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playBeep } from '../utils/audio';

interface ConfirmDialogModalProps {
  confirmDialog: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null;
  onClose: () => void;
}

export function ConfirmDialogModal({ confirmDialog, onClose }: ConfirmDialogModalProps) {
  return (
    <AnimatePresence>
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4 z-[9999] font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="max-w-md w-full bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className={`p-2 rounded-lg shrink-0 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-500'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  playBeep();
                  onClose();
                }}
                className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[14px] font-bold uppercase border border-slate-800 transition-colors"
              >
                {confirmDialog.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  playBeep();
                  confirmDialog.onConfirm();
                }}
                className={`px-3.5 py-1.5 text-slate-950 font-extrabold rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-95 ${
                  confirmDialog.isDanger
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                {confirmDialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

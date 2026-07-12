/**
 * DbConfigModal.tsx — Database configuration modal component.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, X } from 'lucide-react';
import { playBeep } from '../utils/audio';

interface DbStatus {
  connected: boolean;
  metaConnected: boolean;
  customUri: string;
  customMetaUri: string;
  activeUriMasked: string;
  activeMetaUriMasked: string;
  usingDefaultFallback: boolean;
  usingDefaultMetaFallback: boolean;
}

interface DbConfigModalProps {
  showDbConfigModal: boolean;
  onClose: () => void;
  dbStatus: DbStatus | null;
  newDbUri: string;
  onSetNewDbUri: (val: string) => void;
  newDbMetaUri: string;
  onSetNewDbMetaUri: (val: string) => void;
  dbConfigSaving: boolean;
  dbConfigMessage: { text: string; isError: boolean } | null;
  onSaveDbUri: (e: React.FormEvent) => void;
  onManualSync: () => void;
  onClearFields: () => void;
}

export function DbConfigModal({
  showDbConfigModal,
  onClose,
  dbStatus,
  newDbUri,
  onSetNewDbUri,
  newDbMetaUri,
  onSetNewDbMetaUri,
  dbConfigSaving,
  dbConfigMessage,
  onSaveDbUri,
  onManualSync,
  onClearFields,
}: DbConfigModalProps) {
  return (
    <AnimatePresence>
      {showDbConfigModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="max-w-md w-full bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Configuração do Banco de Dados
                  </h3>
                  <p className="text-[14px] text-slate-400">Personalize seu banco de dados na nuvem</p>
                </div>
              </div>
              <button
                onClick={() => {
                  playBeep();
                  onClose();
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto max-h-[75vh] pr-1">
              <p className="text-[14px] text-slate-400 leading-normal bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
                Aqui você pode configurar a conexão do banco de dados na nuvem (Atlas) para o sistema completo (Caixa, Metas e Empréstimos estão unificados em um único banco).
              </p>

              <form onSubmit={onSaveDbUri} className="space-y-4">
                {/* SEÇÃO ÚNICA: BANCO DE DADOS UNIFICADO */}
                <div className="border border-slate-800/60 bg-slate-950/30 p-3 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-amber-500 block uppercase font-black tracking-wider">
                      Banco de Dados Unificado (Caixa, Metas e Empréstimos)
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase ${
                      dbStatus?.connected
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50 animate-pulse'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      {dbStatus?.connected ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Active Connection String is hidden for privacy as requested */}
                  <div className="space-y-1">
                    <label className="text-[13px] text-slate-400 uppercase font-bold tracking-wider block">
                      Personalizar String de Conexão Única (MongoDB)
                    </label>
                    <input
                      type="password"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[14.5px] text-slate-200 focus:border-amber-500 focus:outline-none placeholder-slate-650"
                      placeholder="••••••••••••••••••••••••••••••••••••••••"
                      value={newDbUri}
                      onChange={(e) => onSetNewDbUri(e.target.value)}
                      disabled={dbConfigSaving}
                    />
                    <span className="text-[12px] text-slate-500 block leading-tight mt-0.5">
                      Por segurança, a string de conexão está totalmente protegida e oculta contra olhares curiosos.
                    </span>
                  </div>
                </div>

                {/* SINCRONIZAÇÃO DE BANCO LOCAL → CLOUD */}
                <div className="border border-amber-500/30 bg-amber-500/5 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[14px] text-amber-500 block uppercase font-black tracking-wider">
                        Sincronizar Banco Local → Nuvem
                      </span>
                      <span className="text-[12px] text-slate-400 block leading-tight mt-0.5">
                        Caso tenha dados guardados localmente neste dispositivo, envie-os agora para salvar nos seus bancos na nuvem de forma segura.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onManualSync}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-[13px] uppercase transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      disabled={dbConfigSaving}
                    >
                      Sincronizar Já
                    </button>
                  </div>
                </div>

                {dbConfigMessage && (
                  <div className={`p-2.5 rounded-lg border text-[14px] ${
                    dbConfigMessage.isError
                      ? 'bg-rose-950/30 border-rose-900/50 text-rose-400'
                      : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                  }`}>
                    {dbConfigMessage.text}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onClearFields}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[14px] font-bold uppercase border border-slate-800 transition-colors cursor-pointer"
                    disabled={dbConfigSaving}
                  >
                    Limpar Campos
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-[14px] uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                    disabled={dbConfigSaving}
                  >
                    {dbConfigSaving ? 'Salvando...' : 'Salvar e Conectar'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * BackupManager.tsx — Exportar/importar todos os dados do app em JSON.
 */

import React, { useRef, useState } from 'react';
import { Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { playBeep, playErrorBeep } from '../utils/audio';

export function BackupManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  function handleExport() {
    playBeep();
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith('moob_')) {
        const raw = localStorage.getItem(key)!;
        try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
      }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `moobfinance_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('success');
    setStatusMsg('Backup exportado com sucesso!');
    setTimeout(() => setStatus('idle'), 3000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        const keys = Object.keys(data).filter(k => k.startsWith('moob_'));
        if (keys.length === 0) throw new Error('Nenhuma chave moob_ encontrada');
        keys.forEach(key => {
          const val = data[key];
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        });
        playBeep();
        setStatus('success');
        setStatusMsg(`${keys.length} chave(s) restaurada(s). Recarregando…`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: unknown) {
        playErrorBeep();
        setStatus('error');
        setStatusMsg('Arquivo inválido ou corrompido.');
        setTimeout(() => setStatus('idle'), 4000);
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
          <Download className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Backup de Dados</p>
          <p className="text-[11px] text-slate-400">Exporte ou importe todo o histórico do app</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar JSON
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors active:scale-95"
        >
          <Upload className="w-3.5 h-3.5" />
          Importar JSON
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {status !== 'idle' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
          status === 'success' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
        }`}>
          {status === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          }
          {statusMsg}
        </div>
      )}

      <p className="text-[10.5px] text-slate-600 text-center">
        O arquivo JSON contém todos os turnos, despesas e configurações salvas localmente.
      </p>
    </div>
  );
}

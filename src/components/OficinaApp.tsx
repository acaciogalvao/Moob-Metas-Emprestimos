/**
 * OficinaApp.tsx — Controle de manutenção preventiva (troca de óleo, pastilha de freio etc.)
 * Registra cada manutenção como despesa OUT/MANUTENCAO no caixa ativo (saldo devedor).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wrench, Plus, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Trash2, Clock, Gauge, DollarSign, X } from 'lucide-react';
import { Shift } from '../types';
import { playBeep, playErrorBeep } from '../utils/audio';
import { maskBRL, parseBRLInput, maskOdometer, parseOdometerInput, formatOdometer } from '../utils/format';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MaintenanceTypeConfig {
  id: string;
  name: string;
  emoji: string;
  defaultKmInterval: number;  // km entre trocas sugerido
  defaultAlertKm: number;     // alertar quando restar X km
}

export interface MaintenanceRecord {
  id: string;
  typeId: string;
  date: string;          // ISO
  odometer: number;      // hodômetro no momento da troca
  cost: number;          // valor pago (centavos? não — reais)
  notes?: string;
  kmInterval: number;    // intervalo configurado neste registro
}

export interface MaintenanceSettings {
  typeId: string;
  kmInterval: number;
  alertKm: number;
}

// ─── Tipos de manutenção disponíveis ─────────────────────────────────────────

const MAINTENANCE_TYPES: MaintenanceTypeConfig[] = [
  {
    id: 'oleo',
    name: 'Troca de Óleo',
    emoji: '🛢️',
    defaultKmInterval: 3000,
    defaultAlertKm: 300,
  },
  {
    id: 'pastilha',
    name: 'Pastilha de Freio',
    emoji: '🔧',
    defaultKmInterval: 15000,
    defaultAlertKm: 1500,
  },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

const RECORDS_KEY      = 'moob_oficina_records';
const SETTINGS_KEY     = 'moob_oficina_settings';
const CUSTOM_TYPES_KEY = 'moob_oficina_custom_types';

function loadRecords(): MaintenanceRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecords(records: MaintenanceRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadSettings(): MaintenanceSettings[] {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSettings(settings: MaintenanceSettings[]) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadCustomTypes(): MaintenanceTypeConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomTypes(types: MaintenanceTypeConfig[]) {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types));
}

function getSettingsFor(typeId: string, allSettings: MaintenanceSettings[], allTypes: MaintenanceTypeConfig[]): MaintenanceSettings {
  const found = allSettings.find(s => s.typeId === typeId);
  const def = allTypes.find(t => t.id === typeId);
  return found ?? { typeId, kmInterval: def?.defaultKmInterval ?? 5000, alertKm: def?.defaultAlertKm ?? 500 };
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateId() {
  return `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface OficinaAppProps {
  activeShift?: Shift | null;
  shifts?: Shift[];
  onAddTransaction?: (tx: {
    type: 'IN' | 'OUT';
    platform: 'GERAL';
    category: string;
    value: number;
    paymentMethod: 'DINHEIRO';
    description: string;
  }) => void;
}

export function OficinaApp({ activeShift, shifts = [], onAddTransaction }: OficinaAppProps) {
  const [records, setRecords] = useState<MaintenanceRecord[]>(loadRecords);
  const [settings, setSettings] = useState<MaintenanceSettings[]>(loadSettings);
  const [customTypes, setCustomTypes] = useState<MaintenanceTypeConfig[]>(loadCustomTypes);

  // Form state
  const [registeringType, setRegisteringType] = useState<string | null>(null);
  const [formOdo, setFormOdo] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formKmInterval, setFormKmInterval] = useState('');

  // History visibility per type
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  // Settings panel
  const [editingSettings, setEditingSettings] = useState<string | null>(null);
  const [settingsKmInterval, setSettingsKmInterval] = useState('');
  const [settingsAlertKm, setSettingsAlertKm] = useState('');

  // Nova categoria modal
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeEmoji, setNewTypeEmoji] = useState('🔩');
  const [newTypeKm, setNewTypeKm] = useState('5000');
  const [newTypeAlert, setNewTypeAlert] = useState('500');

  // Persist records/settings/customTypes whenever they change
  useEffect(() => { saveRecords(records); }, [records]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveCustomTypes(customTypes); }, [customTypes]);

  // Tipos disponíveis = padrão + personalizados
  const allTypes = [...MAINTENANCE_TYPES, ...customTypes];

  // Current odometer estimate
  const currentOdometer = useCallback((): number | null => {
    if (activeShift?.initialOdometer) {
      const kmFromRides = (activeShift.transactions || [])
        .filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.km && !t.isVirtual)
        .reduce((s, t) => s + (t.km || 0), 0);
      // Also check fuel transactions with odometer
      const fuelOdos = (activeShift.transactions || [])
        .filter(t => t.odometer && t.odometer > activeShift.initialOdometer!)
        .map(t => t.odometer!);
      const maxFuelOdo = fuelOdos.length > 0 ? Math.max(...fuelOdos) : null;
      const fromRides = activeShift.initialOdometer + kmFromRides;
      return maxFuelOdo ? Math.max(fromRides, maxFuelOdo) : fromRides;
    }
    // Fallback: last closed shift's final odometer
    const closed = [...shifts].filter(s => s.status === 'CLOSED' && s.finalOdometer).sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
    return closed[0]?.finalOdometer ?? null;
  }, [activeShift, shifts]);

  // ── Helpers por tipo ─────────────────────────────────────────────────────

  function lastRecordFor(typeId: string): MaintenanceRecord | null {
    const recs = records.filter(r => r.typeId === typeId).sort((a, b) => b.odometer - a.odometer);
    return recs[0] ?? null;
  }

  function kmUntilNext(typeId: string): number | null {
    const last = lastRecordFor(typeId);
    const odo = currentOdometer();
    if (!last || odo === null) return null;
    const nextAt = last.odometer + last.kmInterval;
    return nextAt - odo;
  }

  function statusFor(typeId: string): 'ok' | 'alert' | 'due' | 'unknown' {
    const remaining = kmUntilNext(typeId);
    if (remaining === null) return 'unknown';
    const cfg = getSettingsFor(typeId, settings, allTypes);
    if (remaining <= 0) return 'due';
    if (remaining <= cfg.alertKm) return 'alert';
    return 'ok';
  }

  // ── Registrar manutenção ─────────────────────────────────────────────────

  function openRegisterForm(typeId: string) {
    playBeep();
    const odo = currentOdometer();
    const cfg = getSettingsFor(typeId, settings, allTypes);
    setFormOdo(odo ? formatOdometer(odo) : '');
    setFormCost('');
    setFormNotes('');
    setFormKmInterval(String(cfg.kmInterval));
    setRegisteringType(typeId);
  }

  function handleRegister() {
    if (!registeringType) return;
    const odo = parseOdometerInput(formOdo);
    const cost = parseBRLInput(formCost);
    const interval = parseInt(formKmInterval, 10) || getSettingsFor(registeringType, settings, allTypes).kmInterval;

    if (!odo || odo <= 0) { playErrorBeep(); return; }

    const typeName = allTypes.find(t => t.id === registeringType)?.name ?? 'Manutenção';

    // Adicionar despesa no caixa ativo
    if (onAddTransaction && cost > 0) {
      onAddTransaction({
        type: 'OUT',
        platform: 'GERAL',
        category: 'MANUTENCAO',
        value: cost,
        paymentMethod: 'DINHEIRO',
        description: `${typeName}${formNotes ? ` — ${formNotes}` : ''}`,
      });
    }

    const record: MaintenanceRecord = {
      id: generateId(),
      typeId: registeringType,
      date: new Date().toISOString(),
      odometer: odo,
      cost,
      notes: formNotes || undefined,
      kmInterval: interval,
    };

    setRecords(prev => [...prev, record]);
    playBeep();
    setRegisteringType(null);
  }

  // ── Salvar configurações ─────────────────────────────────────────────────

  function handleSaveSettings(typeId: string) {
    const interval = parseInt(settingsKmInterval, 10);
    const alert = parseInt(settingsAlertKm, 10);
    if (!interval || !alert) { playErrorBeep(); return; }
    setSettings(prev => {
      const filtered = prev.filter(s => s.typeId !== typeId);
      return [...filtered, { typeId, kmInterval: interval, alertKm: alert }];
    });
    playBeep();
    setEditingSettings(null);
  }

  // ── Deletar registro ─────────────────────────────────────────────────────

  function handleDeleteRecord(id: string) {
    playBeep();
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const odo = currentOdometer();

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
          <Wrench className="w-4.5 h-4.5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Oficina</h2>
          <p className="text-xs text-slate-400">Manutenção preventiva da moto</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {odo !== null && (
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
              <Gauge className="w-3 h-3 text-slate-400" />
              <span className="text-xs font-mono text-slate-300">{formatOdometer(odo)} km</span>
            </div>
          )}
          <button
            onClick={() => { playBeep(); setShowAddType(true); setNewTypeName(''); setNewTypeEmoji('🔩'); setNewTypeKm('5000'); setNewTypeAlert('500'); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 text-xs font-bold transition-colors"
            title="Adicionar nova categoria de manutenção"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Alerta de caixa fechado */}
      {!activeShift && onAddTransaction && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">Sem caixa aberto — a despesa não será lançada no saldo. Abra um caixa para registrar o gasto.</p>
        </div>
      )}

      {/* Cards por tipo de manutenção */}
      {allTypes.map(type => {
        const cfg = getSettingsFor(type.id, settings, allTypes);
        const isCustom = !MAINTENANCE_TYPES.some(t => t.id === type.id);
        const last = lastRecordFor(type.id);
        const remaining = kmUntilNext(type.id);
        const status = statusFor(type.id);
        const typeRecords = records.filter(r => r.typeId === type.id).sort((a, b) => b.odometer - a.odometer);
        const isExpanded = expandedHistory[type.id];
        const nextAt = last ? last.odometer + last.kmInterval : null;

        const statusColor = status === 'due' ? 'red' : status === 'alert' ? 'amber' : status === 'ok' ? 'emerald' : 'slate';
        const progressPct = last && odo !== null
          ? Math.min(100, Math.max(0, ((odo - last.odometer) / last.kmInterval) * 100))
          : 0;

        return (
          <div
            key={type.id}
            className={`rounded-2xl border bg-slate-900/70 backdrop-blur-sm overflow-hidden ${
              status === 'due' ? 'border-red-500/50' :
              status === 'alert' ? 'border-amber-500/40' :
              'border-slate-800/80'
            }`}
          >
            {/* Status banner */}
            {(status === 'due' || status === 'alert') && (
              <div className={`px-4 py-2 flex items-center gap-2 ${
                status === 'due' ? 'bg-red-500/15' : 'bg-amber-500/10'
              }`}>
                <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${status === 'due' ? 'text-red-400' : 'text-amber-400'}`} />
                <p className={`text-xs font-semibold ${status === 'due' ? 'text-red-300' : 'text-amber-300'}`}>
                  {status === 'due'
                    ? `${type.name} ATRASADA! Passou ${Math.abs(remaining!).toFixed(0)} km do limite.`
                    : `Faltam apenas ${remaining!.toFixed(0)} km para ${type.name.toLowerCase()}.`
                  }
                </p>
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Título + botão */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{type.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{type.name}</p>
                    <p className="text-xs text-slate-400">a cada {cfg.kmInterval.toLocaleString('pt-BR')} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCustom && (
                    <button
                      onClick={() => {
                        playBeep();
                        setCustomTypes(prev => prev.filter(t => t.id !== type.id));
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                      title="Remover categoria"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      playBeep();
                      setEditingSettings(editingSettings === type.id ? null : type.id);
                      setSettingsKmInterval(String(cfg.kmInterval));
                      setSettingsAlertKm(String(cfg.alertKm));
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    title="Configurar intervalo"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => openRegisterForm(type.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar
                  </button>
                </div>
              </div>

              {/* Painel de configurações */}
              <AnimatePresence>
                {editingSettings === type.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700/40"
                  >
                    <p className="text-xs font-semibold text-slate-300">⚙️ Configurar {type.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Intervalo (km)</label>
                        <input
                          type="number"
                          value={settingsKmInterval}
                          onChange={e => setSettingsKmInterval(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                          placeholder="ex: 3000"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Alertar com X km antes</label>
                        <input
                          type="number"
                          value={settingsAlertKm}
                          onChange={e => setSettingsAlertKm(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                          placeholder="ex: 300"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveSettings(type.id)}
                        className="flex-1 py-1.5 rounded-lg bg-orange-500 text-slate-950 text-xs font-bold"
                      >Salvar</button>
                      <button
                        onClick={() => { playBeep(); setEditingSettings(null); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs"
                      >Cancelar</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Barra de progresso */}
              {last && (
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === 'due' ? 'bg-red-500' :
                        status === 'alert' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{formatOdometer(last.odometer)} km (última troca)</span>
                    <span>{nextAt ? `${formatOdometer(nextAt)} km (próxima)` : ''}</span>
                  </div>
                </div>
              )}

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-2">
                {/* Status */}
                <div className={`rounded-xl p-2.5 text-center border ${
                  status === 'due' ? 'bg-red-500/10 border-red-500/30' :
                  status === 'alert' ? 'bg-amber-500/10 border-amber-500/30' :
                  status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  'bg-slate-800/50 border-slate-700/40'
                }`}>
                  {status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" /> :
                   status === 'due' || status === 'alert' ? <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${status === 'due' ? 'text-red-400' : 'text-amber-400'}`} /> :
                   <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />}
                  <p className={`text-xs font-bold ${
                    status === 'due' ? 'text-red-300' : status === 'alert' ? 'text-amber-300' : status === 'ok' ? 'text-emerald-300' : 'text-slate-400'
                  }`}>
                    {status === 'due' ? 'Atrasada' : status === 'alert' ? 'Atenção' : status === 'ok' ? 'Em dia' : 'Sem dado'}
                  </p>
                </div>

                {/* Km restantes */}
                <div className="rounded-xl p-2.5 text-center bg-slate-800/50 border border-slate-700/40">
                  <p className={`text-base font-black font-mono ${
                    status === 'due' ? 'text-red-400' : status === 'alert' ? 'text-amber-400' : 'text-white'
                  }`}>
                    {remaining !== null ? `${Math.abs(remaining).toFixed(0)}` : '--'}
                  </p>
                  <p className="text-xs text-slate-400">{remaining !== null && remaining < 0 ? 'km atrasada' : 'km restantes'}</p>
                </div>

                {/* Último custo */}
                <div className="rounded-xl p-2.5 text-center bg-slate-800/50 border border-slate-700/40">
                  <p className="text-base font-black text-white">
                    {last?.cost ? formatBRL(last.cost) : '--'}
                  </p>
                  <p className="text-xs text-slate-400">último gasto</p>
                </div>
              </div>

              {/* Histórico */}
              {typeRecords.length > 0 && (
                <div>
                  <button
                    onClick={() => { playBeep(); setExpandedHistory(h => ({ ...h, [type.id]: !h[type.id] })); }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {typeRecords.length} registro{typeRecords.length > 1 ? 's' : ''} anteriores
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-1.5 overflow-hidden"
                      >
                        {typeRecords.map(rec => (
                          <div key={rec.id} className="flex items-center gap-2 bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-700/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-white">{formatOdometer(rec.odometer)} km</span>
                                <span className="text-xs text-slate-500">{formatDate(rec.date)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {rec.cost > 0 && (
                                  <span className="text-xs text-red-400 font-semibold">{formatBRL(rec.cost)}</span>
                                )}
                                {rec.notes && <span className="text-xs text-slate-400 truncate">{rec.notes}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {!last && (
                <div className="text-center py-2">
                  <p className="text-xs text-slate-500">Nenhum registro ainda. Registre a última troca para começar o monitoramento.</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Modal: Nova Categoria */}
      <AnimatePresence>
        {showAddType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { playBeep(); setShowAddType(false); } }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700/70 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-bold text-white">Nova Categoria de Manutenção</p>
                <button onClick={() => { playBeep(); setShowAddType(false); }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-[56px_1fr] gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block font-semibold">Emoji</label>
                    <input
                      type="text"
                      value={newTypeEmoji}
                      onChange={e => setNewTypeEmoji(e.target.value)}
                      maxLength={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5 text-lg text-center focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block font-semibold">Nome *</label>
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={e => setNewTypeName(e.target.value)}
                      placeholder="ex: Filtro de Ar"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block font-semibold">Intervalo (km) *</label>
                    <input
                      type="number"
                      value={newTypeKm}
                      onChange={e => setNewTypeKm(e.target.value)}
                      placeholder="5000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block font-semibold">Alertar X km antes</label>
                    <input
                      type="number"
                      value={newTypeAlert}
                      onChange={e => setNewTypeAlert(e.target.value)}
                      placeholder="500"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { playBeep(); setShowAddType(false); }}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700"
                  >Cancelar</button>
                  <button
                    onClick={() => {
                      if (!newTypeName.trim()) { playErrorBeep(); return; }
                      const interval = parseInt(newTypeKm, 10) || 5000;
                      const alert = parseInt(newTypeAlert, 10) || 500;
                      const newType: MaintenanceTypeConfig = {
                        id: `custom_${Date.now()}`,
                        name: newTypeName.trim(),
                        emoji: newTypeEmoji || '🔩',
                        defaultKmInterval: interval,
                        defaultAlertKm: alert,
                      };
                      setCustomTypes(prev => [...prev, newType]);
                      playBeep();
                      setShowAddType(false);
                    }}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-black transition-colors"
                  >✓ Criar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de registro */}
      <AnimatePresence>
        {registeringType && (() => {
          const type = allTypes.find(t => t.id === registeringType)!;
          const cfg = getSettingsFor(registeringType, settings, allTypes);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={e => { if (e.target === e.currentTarget) { playBeep(); setRegisteringType(null); } }}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700/70 shadow-2xl overflow-hidden"
              >
                {/* Header do modal */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{type.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-white">Registrar {type.name}</p>
                      {!activeShift && (
                        <p className="text-xs text-amber-400">Sem caixa aberto — gasto não será lançado</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { playBeep(); setRegisteringType(null); }} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Hodômetro */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Hodômetro atual (km) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formOdo}
                      onChange={e => setFormOdo(maskOdometer(e.target.value))}
                      placeholder="ex: 12.500"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono"
                      autoFocus
                    />
                    {odo !== null && (
                      <button
                        onClick={() => setFormOdo(formatOdometer(odo))}
                        className="mt-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        ↑ Usar estimado: {formatOdometer(odo)} km
                      </button>
                    )}
                  </div>

                  {/* Custo */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold">
                      Valor pago{activeShift ? ' (será lançado no caixa)' : ''}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCost}
                        onChange={e => setFormCost(maskBRL(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Próxima troca (intervalo) */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Próxima troca em (km)</label>
                    <input
                      type="number"
                      value={formKmInterval}
                      onChange={e => setFormKmInterval(e.target.value)}
                      placeholder={String(cfg.kmInterval)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Padrão configurado: {cfg.kmInterval.toLocaleString('pt-BR')} km</p>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Observações (opcional)</label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="ex: Oficina do João, óleo 10W40..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { playBeep(); setRegisteringType(null); }}
                      className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRegister}
                      className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-black transition-colors active:scale-[0.98]"
                    >
                      ✓ Confirmar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

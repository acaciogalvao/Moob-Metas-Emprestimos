/**
 * useShiftPersistence.ts — Hook for shift state persistence (localStorage + API sync).
 *
 * Estratégia revisada "DB-First com fallback Offline":
 *  - No carregamento inicial, o banco de dados MongoDB é a FONTE DE VERDADE.
 *    O app faz um GET /moob-api/shifts/ e usa os dados do banco imediatamente.
 *  - O localStorage é o fallback quando o servidor está offline/iniciando,
 *    garantindo que o app continue funcionando sem rede.
 *  - Merge inteligente: para cada turno, vence quem tiver mais transações.
 *    Turnos que só existem localmente são sincronizados para o banco.
 *  - Toda ação do usuário (abrir caixa, lançamento, fechar) dispara um POST
 *    imediato para o banco + grava no localStorage — nunca perde dados.
 *  - Heartbeat a cada 2 s: persiste localStorage; sync com backoff exponencial
 *    (2 s → 4 s → 8 s → … → 30 s) em caso de falha — evita spam de rede.
 *  - Mutex isSyncingRef previne requisições simultâneas.
 *  - beforeunload/visibilitychange: flush garantido antes de sair/fechar.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shift } from '../types';

const SHIFTS_KEY      = 'moob_caixa_shifts';
const PENDING_SYNC_KEY = 'moob_caixa_pending_sync';

// Intervalos em ms
const LOCAL_PERSIST_MS  = 2_000;   // flush localStorage
const SYNC_BACKOFF_INIT = 2_000;   // primeiro retry de sync após falha
const SYNC_BACKOFF_MAX  = 30_000;  // teto do backoff exponencial

export function useShiftPersistence() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('Motorista Parceiro');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isLoadingFromServer, setIsLoadingFromServer] = useState<boolean>(true);

  // Refs sempre com o valor mais atual — usados pelo heartbeat e listeners de
  // unload/online que não podem depender de closures antigas.
  const shiftsRef         = useRef<Shift[]>([]);
  const lastPersistedRef  = useRef<string>('');
  const pendingSyncRef    = useRef<boolean>(false);
  const isSyncingRef      = useRef<boolean>(false);

  // Backoff exponencial para sync em caso de falha
  const retryDelayRef     = useRef<number>(SYNC_BACKOFF_INIT);
  const nextSyncAtRef     = useRef<number>(0); // timestamp do próximo attempt

  useEffect(() => { shiftsRef.current = shifts; }, [shifts]);

  // ── Grava local imediatamente (nunca depende de rede) ────────────────────
  const persistLocal = useCallback((data: Shift[]) => {
    const serialized = JSON.stringify(data);
    if (serialized === lastPersistedRef.current) return;
    lastPersistedRef.current = serialized;
    localStorage.setItem(SHIFTS_KEY, serialized);
  }, []);

  // ── Registra falha e calcula próximo attempt com backoff ─────────────────
  const recordSyncFailure = useCallback(() => {
    pendingSyncRef.current = true;
    localStorage.setItem(PENDING_SYNC_KEY, 'true');
    const delay = Math.min(retryDelayRef.current * 2, SYNC_BACKOFF_MAX);
    retryDelayRef.current = delay;
    nextSyncAtRef.current = Date.now() + delay;
    console.warn(`[Sync] Falha — próximo retry em ${delay / 1000}s`);
  }, []);

  // ── Registra sucesso e reseta backoff ─────────────────────────────────────
  const recordSyncSuccess = useCallback(() => {
    pendingSyncRef.current = false;
    localStorage.setItem(PENDING_SYNC_KEY, 'false');
    retryDelayRef.current = SYNC_BACKOFF_INIT;
    nextSyncAtRef.current = 0;
  }, []);

  // ── Envia mudanças para o banco (upsert em lote) ─────────────────────────
  // Usado APENAS para salvar alterações do usuário — não para o carregamento
  // inicial. Isso evita sobrescrever dados mais novos do banco com dados
  // desatualizados do localStorage.
  const syncToCloud = useCallback((data: Shift[], { silent = true }: { silent?: boolean } = {}) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    fetch('/moob-api/shifts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shifts: data }),
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Erro de conexão');
      })
      .then(resData => {
        recordSyncSuccess();
        if (Array.isArray(resData)) {
          setShifts(resData);
          persistLocal(resData);
          shiftsRef.current = resData;
        }
        if (!silent) console.log('[Sync] Sincronização concluída com sucesso!');
      })
      .catch(err => {
        recordSyncFailure();
        console.warn('[Sync] Sem internet ou banco indisponível — modo offline:', err);
      })
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [persistLocal, recordSyncSuccess, recordSyncFailure]);

  // ── Carregamento inicial: banco é a fonte de verdade ─────────────────────
  const loadFromServer = useCallback(async (localShifts: Shift[]) => {
    try {
      const res = await fetch('/moob-api/shifts/');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dbShifts: Shift[] = await res.json();
      if (!Array.isArray(dbShifts)) throw new Error('Resposta inválida');

      const dbMap    = new Map(dbShifts.map(s => [s.id, s]));
      const localMap = new Map(localShifts.map(s => [s.id, s]));
      const merged: Shift[] = [];

      for (const dbShift of dbShifts) {
        const local      = localMap.get(dbShift.id);
        const dbTxCount  = dbShift.transactions?.length ?? 0;
        const localTxCount = local?.transactions?.length ?? 0;
        merged.push(localTxCount > dbTxCount ? local! : dbShift);
      }

      const localOnly = localShifts.filter(s => !dbMap.has(s.id));
      for (const s of localOnly) merged.push(s);

      merged.sort((a, b) =>
        new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
      );

      setShifts(merged);
      persistLocal(merged);
      shiftsRef.current = merged;

      if (localOnly.length > 0) syncToCloud(merged, { silent: true });

      recordSyncSuccess();
      console.log(`[Sync] Boot concluído — ${merged.length} turno(s) restaurado(s).`);
    } catch (err) {
      pendingSyncRef.current = localShifts.length > 0;
      if (localShifts.length > 0) {
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
        nextSyncAtRef.current = Date.now() + SYNC_BACKOFF_INIT;
      }
      console.warn('[Sync] Servidor indisponível no boot — usando dados locais.', err);
    } finally {
      setIsLoadingFromServer(false);
    }
  }, [persistLocal, syncToCloud, recordSyncSuccess]);

  // ── Efeito de montagem ────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Relógio em tempo real
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // 2. Preferências do usuário
    const savedName    = localStorage.getItem('moob_caixa_driver_name');
    const savedVehicle = localStorage.getItem('moob_caixa_vehicle_type');
    if (savedName) setDriverName(savedName);
    if (savedVehicle === 'CAR' || savedVehicle === 'BIKE') setVehicleType(savedVehicle);

    // 3. Lê localStorage como fallback imediato
    const savedShifts = localStorage.getItem(SHIFTS_KEY);
    let localShifts: Shift[] = [];
    if (savedShifts) {
      try {
        localShifts = JSON.parse(savedShifts);
        setShifts(localShifts);
        shiftsRef.current    = localShifts;
        lastPersistedRef.current = savedShifts;
      } catch (e) {
        console.error('Falha ao restaurar dados locais:', e);
      }
    }

    pendingSyncRef.current = localStorage.getItem(PENDING_SYNC_KEY) === 'true';
    if (pendingSyncRef.current) {
      nextSyncAtRef.current = Date.now() + SYNC_BACKOFF_INIT;
    }

    // 4. Fonte de verdade: banco de dados
    loadFromServer(localShifts);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detecção de online/offline ────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      retryDelayRef.current = SYNC_BACKOFF_INIT; // reseta backoff ao voltar online
      nextSyncAtRef.current = 0;
      console.log('[Sync] Conexão restaurada — sincronizando dados locais...');
      loadFromServer(shiftsRef.current);
    };
    const handleOffline = () => {
      setIsOnline(false);
      pendingSyncRef.current = true;
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
      console.warn('[Sync] Sem internet — modo offline ativo.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadFromServer]);

  // ── Heartbeat: persiste local a cada 2 s e retenta sync com backoff ───────
  useEffect(() => {
    const heartbeat = setInterval(() => {
      // Sempre persiste localStorage (operação barata)
      persistLocal(shiftsRef.current);

      // Sync só quando: há pendência, está online, não está sincronizando,
      // e o backoff delay já passou
      if (
        pendingSyncRef.current &&
        navigator.onLine &&
        !isSyncingRef.current &&
        Date.now() >= nextSyncAtRef.current
      ) {
        syncToCloud(shiftsRef.current, { silent: true });
      }
    }, LOCAL_PERSIST_MS);

    return () => clearInterval(heartbeat);
  }, [persistLocal, syncToCloud]);

  // ── Flush garantido ao esconder a aba / fechar / trocar de app ───────────
  useEffect(() => {
    const flush = () => persistLocal(shiftsRef.current);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [persistLocal]);

  // ── API pública ──────────────────────────────────────────────────────────
  const saveToLocalStorage = (newShifts: Shift[]) => {
    setShifts(newShifts);
    persistLocal(newShifts);
    // Ação do usuário → sync imediato e reseta backoff
    retryDelayRef.current = SYNC_BACKOFF_INIT;
    nextSyncAtRef.current = 0;
    syncToCloud(newShifts, { silent: true });
  };

  const queueCloudSync = useCallback((data: Shift[]) => {
    persistLocal(data);
    retryDelayRef.current = SYNC_BACKOFF_INIT;
    nextSyncAtRef.current = 0;
    syncToCloud(data, { silent: true });
  }, [persistLocal, syncToCloud]);

  return {
    shifts,
    setShifts,
    currentTime,
    driverName,
    setDriverName,
    vehicleType,
    setVehicleType,
    saveToLocalStorage,
    queueCloudSync,
    isOnline,
    isLoadingFromServer,
  };
}

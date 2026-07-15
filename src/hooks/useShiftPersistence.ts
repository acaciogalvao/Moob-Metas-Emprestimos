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
 *  - Heartbeat a cada 500ms: mantém localStorage atualizado e retenta sync
 *    pendente quando a internet volta (offline-first para uso contínuo).
 *  - beforeunload/visibilitychange: flush garantido antes de sair/fechar.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shift } from '../types';

const SHIFTS_KEY = 'moob_caixa_shifts';
const PENDING_SYNC_KEY = 'moob_caixa_pending_sync';
const HEARTBEAT_MS = 500;

export function useShiftPersistence() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('Motorista Parceiro');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isLoadingFromServer, setIsLoadingFromServer] = useState<boolean>(true);

  // Refs sempre com o valor mais atual — usados pelo heartbeat e pelos
  // listeners de unload/online, que não podem depender de closures antigas.
  const shiftsRef = useRef<Shift[]>([]);
  const lastPersistedRef = useRef<string>('');
  const pendingSyncRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => { shiftsRef.current = shifts; }, [shifts]);

  // ── Grava local imediatamente (nunca depende de rede) ────────────────────
  const persistLocal = useCallback((data: Shift[]) => {
    const serialized = JSON.stringify(data);
    if (serialized === lastPersistedRef.current) return;
    lastPersistedRef.current = serialized;
    localStorage.setItem(SHIFTS_KEY, serialized);
  }, []);

  // ── Envia mudanças para o banco (upsert em lote) ─────────────────────────
  // Usado APENAS para salvar alterações do usuário — não para o carregamento
  // inicial. Isso evita sobrescrever dados mais novos do banco com dados
  // desatualizados do localStorage.
  const syncToCloud = useCallback((data: Shift[], { silent = true }: { silent?: boolean } = {}) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: data })
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Erro de conexão");
      })
      .then(resData => {
        pendingSyncRef.current = false;
        localStorage.setItem(PENDING_SYNC_KEY, 'false');
        if (Array.isArray(resData)) {
          setShifts(resData);
          persistLocal(resData);
          shiftsRef.current = resData;
        }
        if (!silent) {
          console.log("[Sync] Sincronização concluída com sucesso!");
        }
      })
      .catch(err => {
        pendingSyncRef.current = true;
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
        console.warn("[Sync] Sem internet ou banco indisponível — modo offline:", err);
      })
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [persistLocal]);

  // ── Carregamento inicial: banco é a fonte de verdade ─────────────────────
  // Faz GET /moob-api/shifts/ e mescla com dados locais usando a regra:
  // "quem tiver mais transações no turno aberto vence; turnos só-locais
  // são mantidos e sincronizados para o banco".
  const loadFromServer = useCallback(async (localShifts: Shift[]) => {
    try {
      const res = await fetch('/moob-api/shifts/');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dbShifts: Shift[] = await res.json();
      if (!Array.isArray(dbShifts)) throw new Error('Resposta inválida');

      // Mescla: banco é a fonte primária
      const dbMap = new Map(dbShifts.map(s => [s.id, s]));
      const localMap = new Map(localShifts.map(s => [s.id, s]));
      const merged: Shift[] = [];

      // Para cada turno do banco: usa local se local tiver mais transações
      for (const dbShift of dbShifts) {
        const local = localMap.get(dbShift.id);
        const dbTxCount = dbShift.transactions?.length ?? 0;
        const localTxCount = local?.transactions?.length ?? 0;
        merged.push(localTxCount > dbTxCount ? local! : dbShift);
      }

      // Adiciona turnos que só existem localmente (ainda não sincronizados)
      const localOnly = localShifts.filter(s => !dbMap.has(s.id));
      for (const s of localOnly) merged.push(s);

      // Ordena por data de abertura (mais recente primeiro)
      merged.sort((a, b) =>
        new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
      );

      setShifts(merged);
      persistLocal(merged);
      shiftsRef.current = merged;

      // Se há turnos só-locais, sobe para o banco
      if (localOnly.length > 0) {
        syncToCloud(merged, { silent: true });
      }

      pendingSyncRef.current = false;
      localStorage.setItem(PENDING_SYNC_KEY, 'false');
      console.log(`[Sync] Carregamento inicial do banco concluído — ${merged.length} turno(s) restaurado(s).`);

    } catch (err) {
      // Servidor offline ou iniciando: usa dados do localStorage
      pendingSyncRef.current = localShifts.length > 0;
      if (localShifts.length > 0) {
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
      }
      console.warn('[Sync] Servidor indisponível no boot — usando dados locais. Retry automático ativo.', err);
    } finally {
      setIsLoadingFromServer(false);
    }
  }, [persistLocal, syncToCloud]);

  // ── Efeito de montagem ────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Relógio em tempo real
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // 2. Lê preferências do usuário
    const savedName = localStorage.getItem('moob_caixa_driver_name');
    const savedVehicle = localStorage.getItem('moob_caixa_vehicle_type');
    if (savedName) setDriverName(savedName);
    if (savedVehicle === 'CAR' || savedVehicle === 'BIKE') setVehicleType(savedVehicle);

    // 3. Lê localStorage como fallback imediato (mostra dados locais enquanto
    //    o banco carrega, evitando flash de tela vazia)
    const savedShifts = localStorage.getItem(SHIFTS_KEY);
    let localShifts: Shift[] = [];
    if (savedShifts) {
      try {
        localShifts = JSON.parse(savedShifts);
        setShifts(localShifts);
        shiftsRef.current = localShifts;
        lastPersistedRef.current = savedShifts;
      } catch (e) {
        console.error('Falha ao restaurar dados locais:', e);
      }
    }

    pendingSyncRef.current = localStorage.getItem(PENDING_SYNC_KEY) === 'true';

    // 4. Busca do banco (fonte de verdade) — substitui/mescla com os dados locais
    loadFromServer(localShifts);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detecção de online/offline ────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Sync] Conexão restaurada — sincronizando dados locais...');
      // Ao voltar online: faz o carregamento completo do banco para garantir
      // que qualquer dado adicionado em outra sessão seja trazido.
      loadFromServer(shiftsRef.current);
    };
    const handleOffline = () => {
      setIsOnline(false);
      pendingSyncRef.current = true;
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
      console.warn('[Sync] Sem internet — modo offline ativo. Dados salvos localmente.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadFromServer]);

  // ── Heartbeat: persiste local a cada 500ms e retenta sync pendente ────────
  useEffect(() => {
    const heartbeat = setInterval(() => {
      persistLocal(shiftsRef.current);
      if (pendingSyncRef.current && navigator.onLine && !isSyncingRef.current) {
        syncToCloud(shiftsRef.current, { silent: true });
      }
    }, HEARTBEAT_MS);
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
  // Salva localmente + sobe para o banco. Chamado por toda ação do usuário.
  const saveToLocalStorage = (newShifts: Shift[]) => {
    setShifts(newShifts);
    persistLocal(newShifts);
    syncToCloud(newShifts, { silent: true });
  };

  // Grava local imediatamente e agenda sync em segundo plano.
  // Usado por ações que atualizam `shifts` via updater funcional.
  const queueCloudSync = useCallback((data: Shift[]) => {
    persistLocal(data);
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

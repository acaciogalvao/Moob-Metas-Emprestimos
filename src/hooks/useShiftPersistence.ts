/**
 * useShiftPersistence.ts — Hook for shift state persistence (localStorage + API sync).
 *
 * Estratégia "Offline-First automática":
 *  - Toda alteração é gravada IMEDIATAMENTE no localStorage (nunca depende da rede).
 *  - Em paralelo, tenta sincronizar com o MongoDB Atlas em segundo plano.
 *  - Se estiver sem internet, os dados continuam sendo salvos localmente e uma
 *    flag de "sincronização pendente" fica marcada.
 *  - Assim que a internet volta (evento 'online' do navegador), o sistema
 *    automaticamente reenvia os dados locais mais recentes para a nuvem.
 *  - Um "heartbeat" a cada 500ms garante que o estado atual em memória nunca
 *    fique fora de sincronia com o localStorage — mesmo que a página seja
 *    atualizada (F5) ou feche de repente, nada do que já está em tela se perde.
 *  - `beforeunload`/`visibilitychange` forçam um flush final antes de sair.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shift } from '../types';

const SHIFTS_KEY = 'moob_caixa_shifts';
const PENDING_SYNC_KEY = 'moob_caixa_pending_sync';
const HEARTBEAT_MS = 500; // grava o estado atual a cada meio segundo, como pedido

export function useShiftPersistence() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('Motorista Parceiro');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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
    if (serialized === lastPersistedRef.current) return; // evita gravação redundante
    lastPersistedRef.current = serialized;
    localStorage.setItem(SHIFTS_KEY, serialized);
  }, []);

  // ── Tenta sincronizar com a nuvem; marca pendência se falhar ─────────────
  const syncToCloud = useCallback((data: Shift[], { silent = true }: { silent?: boolean } = {}) => {
    if (isSyncingRef.current) return; // evita disparos simultâneos
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
        }
        if (!silent) {
          console.log("[Sync-Offline-First] Sincronização de turnos concluída com sucesso!");
        }
      })
      .catch(err => {
        pendingSyncRef.current = true;
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
        console.warn("[Sync-Offline-First] Sem internet ou banco indisponível — modo offline assumiu, dados mantidos localmente:", err);
      })
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [persistLocal]);

  useEffect(() => {
    // 1. Live Ticker Realtime clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // 2. Load Local Storage
    const savedShifts = localStorage.getItem(SHIFTS_KEY);
    const savedName = localStorage.getItem('moob_caixa_driver_name');
    const savedVehicle = localStorage.getItem('moob_caixa_vehicle_type');

    if (savedName) setDriverName(savedName);
    if (savedVehicle === 'CAR' || savedVehicle === 'BIKE') setVehicleType(savedVehicle);

    let initialShifts: Shift[] = [];
    if (savedShifts) {
      try {
        initialShifts = JSON.parse(savedShifts);
        setShifts(initialShifts);
        lastPersistedRef.current = savedShifts;
      } catch (e) {
        console.error('Falha ao restaurar dados históricos local:', e);
        setShifts([]);
        persistLocal([]);
      }
    } else {
      // First boot: start completely empty (começar do zero)
      setShifts([]);
      persistLocal([]);
    }

    pendingSyncRef.current = localStorage.getItem(PENDING_SYNC_KEY) === 'true';

    // 3. Sincronização inicial em lote com o MongoDB Atlas (assume automaticamente
    //    o modo offline se não houver rede — sem travar a interface)
    syncToCloud(initialShifts, { silent: false });

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detecção automática de online/offline ────────────────────────────────
  // Quando a internet cai, o sistema simplesmente continua gravando local
  // (já é o comportamento padrão). Quando a internet volta, reenviamos
  // automaticamente os dados locais mais recentes para retomar o modo online
  // já atualizado — sem qualquer ação manual do usuário.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Sync-Offline-First] Internet de volta — retomando modo online e sincronizando dados locais...');
      syncToCloud(shiftsRef.current, { silent: false });
    };
    const handleOffline = () => {
      setIsOnline(false);
      pendingSyncRef.current = true;
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
      console.warn('[Sync-Offline-First] Internet perdida — modo offline assumiu automaticamente. Os dados continuam sendo salvos no aparelho.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncToCloud]);

  // ── Heartbeat: garante persistência local a cada 500ms ───────────────────
  // Rede de segurança contra perda de dados se a página atualizar (F5) ou o
  // app for encerrado de repente enquanto roda em segundo plano.
  useEffect(() => {
    const heartbeat = setInterval(() => {
      persistLocal(shiftsRef.current);
      // Se havia sincronização pendente (ficou offline) e a rede voltou sem
      // disparar o evento 'online' (comum em PWAs/segundo plano), tenta de novo.
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

  // Sync to database — chamado por toda ação do usuário (mantém compatibilidade
  // com o restante do app, que já grava local de forma síncrona e imediata).
  const saveToLocalStorage = (newShifts: Shift[]) => {
    setShifts(newShifts);
    persistLocal(newShifts);
    syncToCloud(newShifts, { silent: true });
  };

  // Grava local imediatamente e agenda sincronização em segundo plano — usado
  // por ações que já atualizam `shifts` via updater funcional (ex.: adicionar
  // lançamento) e só precisam garantir que a nuvem também fique consistente.
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
  };
}

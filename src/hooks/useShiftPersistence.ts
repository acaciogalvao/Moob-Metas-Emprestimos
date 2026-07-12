/**
 * useShiftPersistence.ts — Hook for shift state persistence (localStorage + API sync).
 */

import { useState, useEffect } from 'react';
import { Shift } from '../types';

export function useShiftPersistence() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('Motorista Parceiro');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');

  useEffect(() => {
    // 1. Live Ticker Realtime clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // 2. Load Local Storage
    const savedShifts = localStorage.getItem('moob_caixa_shifts');
    const savedName = localStorage.getItem('moob_caixa_driver_name');
    const savedVehicle = localStorage.getItem('moob_caixa_vehicle_type');

    if (savedName) setDriverName(savedName);
    if (savedVehicle === 'CAR' || savedVehicle === 'BIKE') setVehicleType(savedVehicle);

    let initialShifts: Shift[] = [];
    if (savedShifts) {
      try {
        initialShifts = JSON.parse(savedShifts);
        setShifts(initialShifts);
      } catch (e) {
        console.error('Falha ao restaurar dados históricos local:', e);
        setShifts([]);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify([]));
      }
    } else {
      // First boot: start completely empty (começar do zero)
      setShifts([]);
      localStorage.setItem('moob_caixa_shifts', JSON.stringify([]));
    }

    // 3. Sincronização inicial em lote com o MongoDB Atlas
    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: initialShifts })
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Servidor offline");
    })
    .then(data => {
      if (Array.isArray(data)) {
        setShifts(data);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify(data));
        console.log("[Sync-Offline-First] Sincronização de turnos concluída com sucesso!");
      }
    })
    .catch(err => {
      console.warn("[Sync-Offline-First] Banco de dados em nuvem offline. Usando dados locais:", err);
    });

    return () => clearInterval(timer);
  }, []);

  // Sync to database
  const saveToLocalStorage = (newShifts: Shift[]) => {
    setShifts(newShifts);
    localStorage.setItem('moob_caixa_shifts', JSON.stringify(newShifts));

    // Sincroniza em segundo plano com o MongoDB Atlas
    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: newShifts })
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Erro de conexão");
    })
    .then(data => {
      if (Array.isArray(data)) {
        setShifts(data);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify(data));
      }
    })
    .catch(err => {
      console.warn("[Sync-Offline-First] Erro ao salvar na nuvem, mantido localmente:", err);
    });
  };

  return {
    shifts,
    setShifts,
    currentTime,
    driverName,
    setDriverName,
    vehicleType,
    setVehicleType,
    saveToLocalStorage,
  };
}

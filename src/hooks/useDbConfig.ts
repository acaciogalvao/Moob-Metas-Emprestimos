/**
 * useDbConfig.ts — Hook for database configuration modal state and actions.
 */

import React, { useState, useEffect } from 'react';
import { Shift } from '../types';
import { playBeep, playCashRegister } from '../utils/audio';

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

export function useDbConfig(
  shifts: Shift[],
  setShifts: (shifts: Shift[]) => void
) {
  const [showDbConfigModal, setShowDbConfigModal] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [newDbUri, setNewDbUri] = useState("");
  const [newDbMetaUri, setNewDbMetaUri] = useState("");
  const [dbConfigSaving, setDbConfigSaving] = useState(false);
  const [dbConfigMessage, setDbConfigMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchDbStatus = () => {
    fetch("/moob-api/config/db-status")
      .then(res => res.json())
      .then(data => {
        setDbStatus(data);
        setNewDbUri(data.customUri || "");
        setNewDbMetaUri(data.customMetaUri || "");
      })
      .catch(err => {
        console.error("Erro ao carregar status do banco de dados:", err);
      });
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  const handleSaveDbUri = (e: React.FormEvent) => {
    e.preventDefault();
    setDbConfigSaving(true);
    setDbConfigMessage(null);

    fetch("/moob-api/config/db-uri", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri: newDbUri, metaUri: newDbMetaUri })
    })
      .then(res => res.json())
      .then(data => {
        setDbConfigSaving(false);
        if (data.success) {
          setDbStatus({
            connected: data.connected,
            metaConnected: data.metaConnected,
            customUri: data.customUri,
            customMetaUri: data.customMetaUri,
            activeUriMasked: data.activeUriMasked,
            activeMetaUriMasked: data.activeMetaUriMasked,
            usingDefaultFallback: !data.customUri,
            usingDefaultMetaFallback: !data.customMetaUri
          });

          let syncMsg = "";
          if (data.syncResult) {
            const { shiftsSynced, metasSynced, loansSynced, goalsSynced } = data.syncResult;
            syncMsg = ` Sincronizados: ${shiftsSynced} turnos, ${metasSynced} metas, ${loansSynced} empréstimos.`;
          }

          setDbConfigMessage({
            text: data.message + syncMsg,
            isError: !data.connected && !data.metaConnected
          });
          
          if (data.connected || data.metaConnected) {
            playCashRegister();
            // Re-sync with newly configured DB
            fetch("/moob-api/shifts/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shifts })
            })
            .then(res => res.ok ? res.json() : null)
            .then(synced => {
              if (synced && Array.isArray(synced)) {
                setShifts(synced);
                localStorage.setItem('moob_caixa_shifts', JSON.stringify(synced));
              }
            })
            .catch(err => console.warn("Erro ao ressincronizar:", err));
          } else {
            playBeep();
          }
        } else {
          setDbConfigMessage({
            text: data.message || "Erro desconhecido ao salvar configuração.",
            isError: true
          });
          playBeep();
        }
      })
      .catch(err => {
        setDbConfigSaving(false);
        setDbConfigMessage({
          text: "Erro de rede ao conectar com o servidor.",
          isError: true
        });
        playBeep();
      });
  };

  const handleManualSync = () => {
    setDbConfigSaving(true);
    setDbConfigMessage(null);
    playBeep();

    fetch("/moob-api/config/db-sync", {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => {
        setDbConfigSaving(false);
        if (data.success) {
          playCashRegister();
          let syncMsg = "";
          if (data.syncResult) {
            const { shiftsSynced, metasSynced, loansSynced, goalsSynced } = data.syncResult;
            syncMsg = ` Sincronizados: ${shiftsSynced} turnos, ${metasSynced} metas, ${loansSynced} empréstimos.`;
          }
          setDbConfigMessage({
            text: data.message + syncMsg,
            isError: false
          });

          // Recarrega turnos do estado
          fetch("/moob-api/shifts")
            .then(res => res.json())
            .then(shiftsData => {
              if (Array.isArray(shiftsData)) {
                setShifts(shiftsData);
                localStorage.setItem('moob_caixa_shifts', JSON.stringify(shiftsData));
              }
            })
            .catch(err => console.warn("Erro ao recarregar turnos:", err));

        } else {
          setDbConfigMessage({
            text: data.message || "Erro ao sincronizar.",
            isError: true
          });
          playBeep();
        }
      })
      .catch(err => {
        setDbConfigSaving(false);
        setDbConfigMessage({
          text: "Erro ao tentar sincronizar os bancos de dados.",
          isError: true
        });
        playBeep();
      });
  };

  return {
    showDbConfigModal,
    setShowDbConfigModal,
    dbStatus,
    newDbUri,
    setNewDbUri,
    newDbMetaUri,
    setNewDbMetaUri,
    dbConfigSaving,
    dbConfigMessage,
    setDbConfigMessage,
    fetchDbStatus,
    handleSaveDbUri,
    handleManualSync,
  };
}

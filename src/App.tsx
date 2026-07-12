/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Coins, AppWindow, PiggyBank, BarChart3, Clock, AlertCircle, 
  RotateCcw, Sliders, Navigation, RefreshCw, Milestone, Landmark, Info, Target,
  Car, Bike, History, FolderArchive, Trash2, Eye, X, Database, Fuel, Download
} from 'lucide-react';

import { Shift, Transaction, PlatformType, TransactionType, PaymentMethod, PeriodFilter } from './types';
import { getMockShifts } from './utils/mockData';
import { QuickRegister } from './components/QuickRegister';
import { ShiftControl } from './components/ShiftControl';
import { HistoryList } from './components/HistoryList';
import { Charts } from './components/Charts';
import { PdfReport } from './components/PdfReport';
import { TripTracker } from './components/TripTracker';
import { LoanSystemApp } from './components/LoanSystemApp';
import { playBeep, playCashRegister } from './utils/audio';
import { formatBRL, getTransactionNetValue, formatDecimalBRL, calculateExtraValue, getTransactionFaturamentoReal, getPlatformBalanceDelta } from './utils/format';

export default function App() {
  // --- STATE ---
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<Shift | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TOTAL');
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'ANALYTICS'>(() => {
    return (localStorage.getItem('moob_active_tab') as 'REGISTER' | 'ANALYTICS') || 'REGISTER';
  });
  const [systemTab, setSystemTab] = useState<'caixa' | 'historico' | 'viagem' | 'metas'>(() => {
    return (localStorage.getItem('moob_system_tab') as 'caixa' | 'historico' | 'viagem' | 'metas') || 'caixa';
  });

  useEffect(() => {
    localStorage.setItem('moob_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('moob_system_tab', systemTab);
  }, [systemTab]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('Motorista Parceiro');
  const [showWelcomeMsg, setShowWelcomeMsg] = useState(false);
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');
  const [isSpeedometerActive, setIsSpeedometerActive] = useState<boolean>(() => {
    return localStorage.getItem('moob_speedometer_active') === 'true';
  });
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [speedSimCount, setSpeedSimCount] = useState<number>(0);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const [excludeSundays, setExcludeSundays] = useState<boolean>(() => {
    return localStorage.getItem('moob_caixa_exclude_sundays') === 'true';
  });
  // Liters currently being typed into the refuel field (not yet saved) — drives the live dashboard gauge needle.
  const [draftFuelLiters, setDraftFuelLiters] = useState<number>(0);

  // --- PWA INSTALL STATE & HOOK ---
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
      console.log('[PWA] Evento beforeinstallprompt capturado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] Usuário aceitou instalar o aplicativo.');
          setPwaPrompt(null);
        } else {
          console.log('[PWA] Usuário cancelou a instalação.');
        }
      });
    }
  };

  // --- GLOBAL SCREEN WAKE LOCK STATE & HOOK ---
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [wakeLockEnabled, setWakeLockEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('moob_wake_lock_enabled') === 'true';
    }
    return false;
  });
  const wakeLockRef = useRef<any>(null);
  const wakeLockEnabledRef = useRef<boolean>(false);

  // Sync ref
  useEffect(() => {
    wakeLockEnabledRef.current = wakeLockEnabled;
  }, [wakeLockEnabled]);

  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setIsWakeLockActive(true);
          console.log('[WakeLock] Screen Wake Lock acquired successfully');
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[WakeLock] Screen Wake Lock was released by the browser');
            wakeLockRef.current = null;
            setIsWakeLockActive(false);
          });
        }
      } catch (err) {
        console.warn('[WakeLock] Wake Lock request failed:', err);
        setIsWakeLockActive(false);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        console.log('[WakeLock] Screen Wake Lock released manually');
      } catch (err) {
        console.error('[WakeLock] Wake Lock release error:', err);
      }
    }
  };

  // Attempt to lock screen on mount, touch, and visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockEnabledRef.current) {
        await requestWakeLock();
      }
    };

    const handleInteraction = async () => {
      if (wakeLockEnabledRef.current && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    // If enabled initially, request lock
    if (wakeLockEnabled) {
      requestWakeLock();
    }

    // Event listeners to handle user interaction and visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      releaseWakeLock();
    };
  }, []);

  // --- GOALS AND LOANS PROGRESS STATE ---
  const [goalsList, setGoalsList] = useState<any[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);

  const fetchGoalsList = (silent = false) => {
    if (!silent) {
      setIsLoadingGoals(true);
    }
    try {
      const cached = localStorage.getItem("offline_goalsList");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setGoalsList(parsed);
        }
      }
    } catch (e) {
      console.warn("Erro ao ler cache de metas:", e);
    }

    fetch("/moob-api/goals")
      .then(res => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        return null;
      })
      .then(data => {
        if (data && Array.isArray(data)) {
          setGoalsList(data);
          localStorage.setItem("offline_goalsList", JSON.stringify(data));
        }
      })
      .catch(err => {
        console.warn("Erro ao sincronizar metas do servidor:", err);
      })
      .finally(() => {
        if (!silent) {
          setIsLoadingGoals(false);
        }
      });
  };

  useEffect(() => {
    fetchGoalsList(false);
    const interval = setInterval(() => {
      fetchGoalsList(true); // silent background sync
    }, 15000); // sync every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (systemTab === 'caixa') {
      fetchGoalsList(false);
    }
  }, [systemTab]);

  // --- DATABASE CONFIG STATE ---
  const [showDbConfigModal, setShowDbConfigModal] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    metaConnected: boolean;
    customUri: string;
    customMetaUri: string;
    activeUriMasked: string;
    activeMetaUriMasked: string;
    usingDefaultFallback: boolean;
    usingDefaultMetaFallback: boolean;
  } | null>(null);
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
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const currentSpeedRef = useRef<number>(0);
  const speedHistoryRef = useRef<number[]>([]);
  const speedSimCountRef = useRef<number>(0);

  // Sync values with their mutable references
  useEffect(() => {
    currentSpeedRef.current = currentSpeed;
  }, [currentSpeed]);

  useEffect(() => {
    speedSimCountRef.current = speedSimCount;
  }, [speedSimCount]);

  // --- GPS GEOLOCATION VELOCITY TRACKING ---
  useEffect(() => {
    if (!isSpeedometerActive) {
      setCurrentSpeed(0);
      lastPositionRef.current = null;
      return;
    }

    // Haversine formula to manually calculate distance in meters as fallback
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000; // Earth's radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      speedHistoryRef.current = [];
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;
          const now = position.timestamp || Date.now();

          let rawSpeedKmh = 0;
          const gpsSpeed = position.coords.speed; // in m/s

          // 1 & 3. Calculate speed (prefer GPS native or fallback to Haversine speed formula)
          if (gpsSpeed !== null && gpsSpeed !== undefined && gpsSpeed >= 0) {
            rawSpeedKmh = gpsSpeed * 3.6;
          } else if (lastPositionRef.current) {
            const prev = lastPositionRef.current;
            const distance = getDistance(prev.lat, prev.lng, lat, lng);
            const timeDiffSec = (now - prev.timestamp) / 1000;

            // Speed (m/s) = Distance (meters) / Time (seconds). Multiply by 3.6 for km/h.
            if (timeDiffSec > 0.5 && timeDiffSec < 15 && distance > 0.5) {
              const calculatedSpeedMs = distance / timeDiffSec;
              rawSpeedKmh = calculatedSpeedMs * 3.6;
            } else {
              rawSpeedKmh = currentSpeedRef.current;
            }
          }

          // 4. Filter the signal (O MAIS IMPORTANTE)
          // - Standstill check (speed < 1.5 km/h is noise)
          if (rawSpeedKmh < 1.5) {
            rawSpeedKmh = 0;
          }

          // - Ignore spikes: discard speeds above 200 km/h (ruído)
          if (rawSpeedKmh > 200) {
            rawSpeedKmh = currentSpeedRef.current; // Keep previous stable speed
          }

          // - Moving Average (Média Móvel): last 4 readings (perfect compromise between delay and smoothness)
          const history = speedHistoryRef.current;
          history.push(rawSpeedKmh);
          if (history.length > 4) {
            history.shift();
          }
          const sum = history.reduce((acc, val) => acc + val, 0);
          const smoothedSpeedKmh = Math.round(sum / history.length);

          setCurrentSpeed(smoothedSpeedKmh);
          currentSpeedRef.current = smoothedSpeedKmh; // Update the ref immediately

          // Draw directly to the canvas in the background thread callback to bypass React background-tab throttling
          const canvas = canvasRef.current;
          if (canvas && isSpeedometerActive) {
            const speeds = [0, 24, 48, 72, 95, 120];
            const simCount = speedSimCountRef.current;
            const displaySpeed = simCount > 0 ? speeds[simCount % speeds.length] : smoothedSpeedKmh;
            const isSimulated = simCount > 0;
            drawSpeedometerCanvas(canvas, displaySpeed, isSimulated);
          }

          // Save coordinates as anchor point for next interval calculation, provided accuracy is solid
          if (accuracy < 50) {
            lastPositionRef.current = { lat, lng, timestamp: now };
          }
        },
        (error) => {
          console.warn('Speedometer geolocation warning:', error.message);
          // Only drop to zero on permanent/critical permission errors, preserve speed on minor GPS timeouts
          if (error.code !== error.TIMEOUT) {
            setCurrentSpeed(0);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 2000, // High frequency 1-2s updates (FusedLocationProviderClient / CLLocationManager equivalent)
          maximumAge: 0,
        }
      );
    } else {
      console.warn('Geolocation is not supported by this browser.');
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isSpeedometerActive]);

  const handleToggleSpeedometer = () => {
    const newState = !isSpeedometerActive;
    setIsSpeedometerActive(newState);
    localStorage.setItem('moob_speedometer_active', String(newState));
    if (!newState) {
      setSpeedSimCount(0);
      lastPositionRef.current = null;
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    }
    playBeep();
  };

  // Helper to draw a modern speedometer on canvas for PiP streaming
  const drawSpeedometerCanvas = (canvas: HTMLCanvasElement, speed: number, isSimulated: boolean) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background color (matching app twilight style)
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Center coordinates
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 16;

    // Draw dark background track circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 10;
    ctx.stroke();

    // Draw active progress arc based on speed (up to 120 km/h)
    const speedRatio = Math.min(speed / 120, 1);
    if (speedRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -0.5 * Math.PI, (speedRatio * 2 - 0.5) * Math.PI);
      
      // Speed-dependent theme colors
      let speedColor = '#10b981'; // emerald-500
      if (speed > 90) {
        speedColor = '#ef4444'; // red-500
      } else if (speed > 60) {
        speedColor = '#f59e0b'; // amber-500
      }
      ctx.strokeStyle = speedColor;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Draw Speed Text value
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(speed.toString(), centerX, centerY - 6);

    // Draw Unit (km/h)
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('km/h', centerX, centerY + 22);

    // Status label with a blinking indicator dot to force canvas stream frame updates in background
    const isBlinkOn = Math.floor(Date.now() / 500) % 2 === 0;
    if (isSimulated) {
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.font = '900 8px sans-serif';
      ctx.fillText('TESTANDO', centerX - 4, centerY - radius + 22);

      // Blinking simulation dot
      ctx.beginPath();
      ctx.arc(centerX + 30, centerY - radius + 22, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = isBlinkOn ? '#fbbf24' : '#78350f'; // amber-400 : amber-900
      ctx.fill();
    } else {
      ctx.fillStyle = '#34d399'; // emerald-400
      ctx.font = '900 8px sans-serif';
      ctx.fillText('GPS ATIVO', centerX - 4, centerY - radius + 22);

      // Blinking GPS active dot
      ctx.beginPath();
      ctx.arc(centerX + 30, centerY - radius + 22, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = isBlinkOn ? '#34d399' : '#064e3b'; // emerald-400 : emerald-950
      ctx.fill();
    }
  };

  // Synchronize canvas drawing whenever speed changes (for active foreground updates)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && isSpeedometerActive) {
      const speeds = [0, 24, 48, 72, 95, 120];
      const displaySpeed = speedSimCount > 0 ? speeds[speedSimCount % speeds.length] : currentSpeed;
      const isSimulated = speedSimCount > 0;
      drawSpeedometerCanvas(canvas, displaySpeed, isSimulated);
    }
  }, [currentSpeed, speedSimCount, isSpeedometerActive]);

  // Robust background interval repaint loop to guarantee continuous canvas updates even when the app/tab is in the background
  useEffect(() => {
    if (!isSpeedometerActive) return;

    const intervalId = setInterval(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const speeds = [0, 24, 48, 72, 95, 120];
        const simCount = speedSimCountRef.current;
        const displaySpeed = simCount > 0 ? speeds[simCount % speeds.length] : currentSpeedRef.current;
        const isSimulated = simCount > 0;
        drawSpeedometerCanvas(canvas, displaySpeed, isSimulated);
      }
    }, 500); // Repaint every 500ms (will automatically throttle to 1000ms in background, which is perfect to keep the stream alive and prevent freezing)

    return () => clearInterval(intervalId);
  }, [isSpeedometerActive]);

  // Picture-in-Picture toggle handler for background overlay
  const handleEnablePip = async () => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const speeds = [0, 24, 48, 72, 95, 120];
      const displaySpeed = speedSimCount > 0 ? speeds[speedSimCount % speeds.length] : currentSpeed;
      const isSimulated = speedSimCount > 0;

      // Draw initial frame
      drawSpeedometerCanvas(canvas, displaySpeed, isSimulated);

      // Bind canvas stream to video element
      if (!video.srcObject) {
        const stream = canvas.captureStream(10); // 10 FPS
        video.srcObject = stream;
        await video.play();
      }

      if (document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPipActive(false);
        } else {
          await video.requestPictureInPicture();
          setIsPipActive(true);
          
          video.addEventListener('leavepictureinpicture', () => {
            setIsPipActive(false);
          }, { once: true });
        }
      } else {
        alert('O modo sobreposição (Picture-in-Picture) não é suportado pelo seu navegador.');
      }
    } catch (err) {
      console.error('Falha ao alternar modo sobreposição:', err);
    }
  };

  // Reusable custom confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  // --- PERSISTENCE & INITIAL SEEDING ---
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

  // --- CORE GETTERS & ANALYTICAL MATHS ---
  const activeShift = shifts.find(s => s.status === 'OPEN') || null;

  // Derive ALL transactions across historical selection matching selected period filter
  const allFilteredTransactions = (() => {
    // Collect all transactions first
    let list: Transaction[] = [];
    shifts.forEach(s => {
      list.push(...s.transactions);
    });

    // Date checker boundary
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return list.filter(t => {
      const tDate = new Date(t.timestamp);
      
      switch (periodFilter) {
        case 'HOJE':
          return tDate >= startOfToday;
        case 'ONTEM':
          return tDate >= startOfYesterday && tDate <= endOfYesterday;
        case 'SETE_DIAS':
          return tDate >= sevenDaysAgo;
        case 'TRINTA_DIAS':
          return tDate >= thirtyDaysAgo;
        case 'ESTE_MES':
          return tDate >= startOfThisMonth;
        case 'TOTAL':
        default:
          return true;
      }
    });
  })();

  // Refueling suggestions based on odometer and autonomy
  const refuelMetrics = React.useMemo(() => {
    // 1. Get closed shifts with valid odometer readings (final >= initial)
    const shiftsWithOdo = shifts.filter(s => 
      s.status === 'CLOSED' && 
      s.initialOdometer !== undefined && 
      s.finalOdometer !== undefined && 
      s.finalOdometer >= s.initialOdometer
    );

    // 2. Determine KM driven: check if there is an active shift
    const activeShift = shifts.find(s => s.status === 'OPEN');
    let kmDriven = 0;
    let isCurrentShift = false;

    if (activeShift) {
      isCurrentShift = true;
      const activeRidesWithKm = activeShift.transactions.filter(
        t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual
      );
      kmDriven = activeRidesWithKm.reduce((sum, t) => sum + (t.km || 0), 0);
    } else {
      // Fallback: Average KM driven per shift based on closed shifts
      if (shiftsWithOdo.length > 0) {
        const totalKm = shiftsWithOdo.reduce((sum, s) => {
          const kmRun = (s.finalOdometer || 0) - (s.initialOdometer || 0);
          return sum + kmRun;
        }, 0);
        kmDriven = totalKm / shiftsWithOdo.length;
      } else {
        // Fallback: search for any active transactions with KM run inside active shift or historical shifts
        const allRidesWithKm = shifts.flatMap(s => s.transactions).filter(
          t => t.type === 'IN' && t.category === 'CORRIDA' && t.km !== undefined && !t.isVirtual
        );
        if (allRidesWithKm.length > 0) {
          const totalKmFromTx = allRidesWithKm.reduce((sum, t) => sum + (t.km || 0), 0);
          const uniqueShifts = new Set(shifts.map(s => s.id)).size || 1;
          kmDriven = totalKmFromTx / uniqueShifts;
        }
      }
    }

    const hasKmData = kmDriven > 0;
    // Fallback daily distance averages if no real records exist yet
    if (kmDriven <= 0 && !isCurrentShift) {
      kmDriven = vehicleType === 'CAR' ? 120 : 80;
    }

    // 3. Average Autonomy (km/L)
    // Try to compute from shifts that have both odometer AND liters fueled
    const shiftKmPerLArray = shiftsWithOdo
      .map(s => {
        const kmRun = (s.finalOdometer || 0) - (s.initialOdometer || 0);
        return s.totalLitersFueled && s.totalLitersFueled > 0 ? (kmRun / s.totalLitersFueled) : null;
      })
      .filter((v): v is number => v !== null && v > 0);

    let avgAutonomy = 0;
    if (shiftKmPerLArray.length > 0) {
      avgAutonomy = shiftKmPerLArray.reduce((s, v) => s + v, 0) / shiftKmPerLArray.length;
    } else {
      // Fallback: read configured consumption from local storage or standard defaults
      const carConsumption = parseFloat(localStorage.getItem('moob_fuel_car_consumption') || '12');
      const motoConsumption = parseFloat(localStorage.getItem('moob_fuel_moto_consumption') || '35');
      avgAutonomy = vehicleType === 'CAR' ? carConsumption : motoConsumption;
    }

    if (avgAutonomy <= 0) {
      avgAutonomy = vehicleType === 'CAR' ? 12 : 35;
    }

    // 4. Average Price per Liter
    const fuelTransactions = shifts.flatMap(s => s.transactions).filter(
      t => t.type === 'OUT' && (t.category === 'COMBUSTIVEL' || t.category === 'combustivel' || (t.liters !== undefined && t.liters > 0)) && t.pricePerLiter && t.pricePerLiter > 0
    );
    let avgPricePerLiter = 5.50; // default standard BRL gasoline price
    if (fuelTransactions.length > 0) {
      const validPrices = fuelTransactions.map(t => t.pricePerLiter || 0).filter(p => p > 0);
      if (validPrices.length > 0) {
        avgPricePerLiter = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;
      }
    }

    // 5. Recommended Liters to cover or replenish
    const recommendedLiters = kmDriven / avgAutonomy;
    const estimatedCost = recommendedLiters * avgPricePerLiter;

    return {
      kmDriven,
      avgAutonomy,
      recommendedLiters,
      estimatedCost,
      avgPricePerLiter,
      hasKmData,
      shiftsWithOdoCount: shiftsWithOdo.length,
      isCurrentShift
    };
  }, [shifts, vehicleType]);

  // Calculated totals of matches
  const financialTotals = (() => {
    const activeTx = activeShift 
      ? activeShift.transactions 
      : (activeTab === 'REGISTER' ? [] : allFilteredTransactions);
    const rides = activeTx.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
    const allInTransactions = activeTx.filter(t => t.type === 'IN' && !t.isVirtual);
    const expenses = activeTx.filter(t => t.type === 'OUT');

    const uberKM = rides.filter(t => t.platform === 'UBER' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
    const ninetyNineKM = rides.filter(t => t.platform === '99' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
    const particularKM = rides.filter(t => t.platform === 'PARTICULAR' && t.km !== undefined).reduce((s, t) => s + (t.km || 0), 0);
    const totalKM = uberKM + ninetyNineKM + particularKM;

    const rawIn = rides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
    const rawOut = expenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);

    // Valor pago pelo passageiro ao app + Extra por fora (sem gorjetas)
    const passageiroMaisExtra = rides.reduce((s, t) => {
      if (t.platform === 'PARTICULAR') return s + t.value;
      const paidToApp = t.passengerAppValue !== undefined ? t.passengerAppValue : (t.passengerValue !== undefined ? t.passengerValue : t.value);
      return s + paidToApp + (t.extraChargedValue || 0);
    }, 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'GORJETA' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);

    const uberIn = rides.filter(t => t.platform === 'UBER').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);
    const ninetyNineIn = rides.filter(t => t.platform === '99').reduce((s, t) => s + getTransactionFaturamentoReal(t), 0);

    const cashIn = allInTransactions.reduce((sum, t) => {
      if (t.paymentMethod === 'DINHEIRO') {
        const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
        return sum + (t.value - fee);
      }
      if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'dinheiro')) {
        const extra = t.extraChargedValue !== undefined 
          ? t.extraChargedValue 
          : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
        return sum + extra;
      }
      return sum;
    }, 0);

    const pixIn = allInTransactions.reduce((sum, t) => {
      if (t.paymentMethod === 'PIX') {
        const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
        return sum + (t.value - fee);
      }
      if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix')) {
        const extra = t.extraChargedValue !== undefined 
          ? t.extraChargedValue 
          : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
        return sum + extra;
      }
      return sum;
    }, 0);

    const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((s, t) => s + t.value, 0);
    const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((s, t) => s + t.value, 0);
    const rawReceivedIn = cashIn + pixIn;

    const totalInitialBalance = activeShift ? (activeShift.initialBalance || 0) : 0;
    const initialCash = activeShift ? (activeShift.initialCashBalance !== undefined ? activeShift.initialCashBalance : activeShift.initialBalance) : 0;
    const initialPix = activeShift ? (activeShift.initialPixBalance !== undefined ? activeShift.initialPixBalance : 0) : 0;

    const expectedPocketCash = initialCash + cashIn - cashOut;
    const expectedPixBalance = initialPix + pixIn - pixOut;
    
    const ridesAndCancels = activeTx.filter(t => t.type === 'IN' && (t.category === 'CORRIDA' || t.category === 'CANCELAMENTO' || t.category === 'GORJETA' || t.category === 'CAMPANHA') && !t.isVirtual);
    
    const uberBalanceDelta = ridesAndCancels.filter(t => t.platform === 'UBER').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
    const uberWithdrawals = activeTx.filter(t => t.platform === 'UBER' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
    const uberBalance = activeShift ? ((activeShift.initialUberBalance ?? 0) + uberBalanceDelta - uberWithdrawals) : 0;

    const ninetyNineBalanceDelta = ridesAndCancels.filter(t => t.platform === '99').reduce((s, t) => s + getPlatformBalanceDelta(t), 0);
    const ninetyNineWithdrawals = activeTx.filter(t => t.platform === '99' && t.category === 'SAQUE_APP').reduce((s, t) => s + t.value, 0);
    const ninetyNineBalance = activeShift ? ((activeShift.initial99Balance ?? 0) + ninetyNineBalanceDelta - ninetyNineWithdrawals) : 0;

    const saldosPlataformas = uberBalance + ninetyNineBalance;

    const valoresExtrasUber = rides.filter(t => t.platform === 'UBER').reduce((s, t) => s + (t.extraChargedValue || 0), 0);
    const valoresExtras99 = rides.filter(t => t.platform === '99').reduce((s, t) => s + (t.extraChargedValue || 0), 0);
    const valoresExtrasParticular = rides.filter(t => t.platform === 'PARTICULAR').reduce((s, t) => s + t.value, 0);
    const totalValoresExtras = valoresExtrasUber + valoresExtras99 + valoresExtrasParticular;

    const expectedGeral = rawIn - rawOut;

    const totalNetIn = rides.reduce((s, t) => s + getTransactionNetValue(t), 0) + allInTransactions.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
    const saldoLiquido = totalNetIn - rawOut;

    const totalValoresOfertados = rides.reduce((s, t) => {
      if (t.platform === 'PARTICULAR') return s;
      const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
      return s + offer;
    }, 0);

    const valoresOfertadosUber = rides.filter(t => t.platform === 'UBER').reduce((s, t) => {
      const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
      return s + offer;
    }, 0);

    const valoresOfertados99 = rides.filter(t => t.platform === '99').reduce((s, t) => {
      const offer = t.appOfferValue !== undefined ? t.appOfferValue : (t.value - (t.extraChargedValue || 0));
      return s + offer;
    }, 0);

    const cancels = activeTx.filter(t => t.type === 'IN' && t.category === 'CANCELAMENTO' && !t.isVirtual);
    const totalCancels = cancels.reduce((s, t) => s + t.value, 0);
    const cancelsCount = cancels.length;

    const tips = activeTx.filter(t => t.type === 'IN' && t.category === 'GORJETA' && !t.isVirtual);
    const totalIndependentTips = tips.reduce((s, t) => s + t.value, 0);
    const independentTipsCount = tips.length;

    const rideTips = activeTx.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && t.tipValue && t.tipValue > 0 && !t.isVirtual);
    const totalRideTips = rideTips.reduce((s, t) => s + (t.tipValue || 0), 0);
    const rideTipsCount = rideTips.length;

    const totalTips = totalIndependentTips + totalRideTips;
    const tipsCount = independentTipsCount + rideTipsCount;

    return {
      faturamentoBruto: rawIn + (activeShift?.ajusteSaldoAnterior || 0),
      faturamentoInflows: rawIn,
      passageiroMaisExtra,
      despesasTotais: rawOut,
      saldoLiquido: saldoLiquido,
      avgRide: rides.length > 0 ? rawIn / rides.length : 0,
      ridesCount: rides.length,
      expensesCount: expenses.length,
      uberPercent: rawIn > 0 ? (uberIn / rawIn) * 100 : 0,
      ninetyNinePercent: rawIn > 0 ? (ninetyNineIn / rawIn) * 100 : 0,
      cashFares: cashIn,
      cashExpenses: cashOut,
      uberRidesCount: rides.filter(t => t.platform === 'UBER').length,
      ninetyNineRidesCount: rides.filter(t => t.platform === '99').length,
      saldoInicialPeriodo: totalInitialBalance,
      saldoGeral: expectedGeral,
      saldosPlataformas,
      totalValoresOfertados,
      valoresOfertadosUber,
      valoresOfertados99,
      totalValoresExtras,
      valoresExtrasUber,
      valoresExtras99,
      valoresExtrasParticular,
      totalCancels,
      cancelsCount,
      totalTips,
      tipsCount,
      expectedPocketCash,
      expectedPixBalance,
      uberBalance,
      ninetyNineBalance,
      uberKM,
      ninetyNineKM,
      particularKM,
      totalKM
    };
  })();

  // Faturamento Pós Despesas = valor ofertado pela app + extra por fora - despesas operacionais
  // (= saldoLiquido: Sum(getTransactionNetValue) + entradas não-corrida - saídas)
  const faturamentoPosDespesas = financialTotals.saldoLiquido;

  const monthlyGoalMath = (() => {
    const currentMonthlyGoal = activeShift?.monthlyGoal || parseFloat((localStorage.getItem('moob_caixa_monthly_goal') || '6.000,00').replace(/\./g, '').replace(',', '.')) || 6000;
    const daysInMonth = excludeSundays ? 26 : 30;
    const daysInWeek = excludeSundays ? 6 : 7;
    const dailyGoal = currentMonthlyGoal / daysInMonth;
    const weeklyGoal = dailyGoal * daysInWeek;

    // Sum faturamento bruto for all shifts in the current calendar month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const accumulatedMonthlyFaturamento = shifts.reduce((total, shift) => {
      const openedDate = new Date(shift.openedAt);
      if (openedDate.getFullYear() === currentYear && openedDate.getMonth() === currentMonth) {
        const shiftRides = shift.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
        const shiftInflows = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
        const shiftExpenses = shift.transactions.filter(t => t.type === 'OUT');
        
        // Usa getTransactionNetValue (appOfferValue + extra) para consistência com faturamentoPosDespesas
        const shiftNetIn = shiftRides.reduce((s, t) => s + getTransactionNetValue(t), 0)
          + shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
        
        const shiftOut = shiftExpenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);
        const shiftAdjustment = shift.ajusteSaldoAnterior || 0;
        
        return total + (shiftNetIn - shiftOut) + shiftAdjustment;
      }
      return total;
    }, 0);

    const activeShiftFaturamento = activeShift ? financialTotals.faturamentoBruto : 0;
    // Acumula todos os caixas do mês atual (pós despesas = netIn - out)
    const totalMonthFaturamento = accumulatedMonthlyFaturamento;
    const faltaParaMeta = Math.max(0, currentMonthlyGoal - totalMonthFaturamento);

    const progressPct = currentMonthlyGoal > 0 ? (totalMonthFaturamento / currentMonthlyGoal) * 100 : 0;

    const activeExpenses = activeShift ? (financialTotals?.despesasTotais || 0) : 0;
    const dailyGoalWithExpenses = dailyGoal;
    const weeklyGoalWithExpenses = weeklyGoal;

    return {
      monthlyGoal: currentMonthlyGoal,
      dailyGoal,
      weeklyGoal,
      dailyGoalWithExpenses,
      weeklyGoalWithExpenses,
      activeExpenses,
      accumulatedMonthlyFaturamento: totalMonthFaturamento,
      faltaParaMeta,
      progressPct,
      activeShiftFaturamento
    };
  })();

  // --- ACTIONS ---

  // Find last closed shift faturamento real
  const lastClosedShiftRef = shifts
    .filter(s => s.status === 'CLOSED')
    .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null;

  let lastClosedShiftFaturamento = 0;
  if (lastClosedShiftRef) {
    const shiftRides = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
    const shiftInflows = lastClosedShiftRef.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
    const shiftExpenses = lastClosedShiftRef.transactions.filter(t => t.type === 'OUT');
    
    const shiftBruto = shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + 
                       shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
    const shiftOut = shiftExpenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);
    
    lastClosedShiftFaturamento = shiftBruto;
  }

  // Update driver name
  const handleChangeDriverName = (newName: string) => {
    setDriverName(newName);
    localStorage.setItem('moob_caixa_driver_name', newName);
  };

  // Open Shift
  const handleOpenShift = (
    initialPixBalance: number, 
    initialCashBalance: number, 
    initialOdometer?: number,
    initialUberBalance?: number,
    initial99Balance?: number,
    initialFuelLiters?: number,
    initialFuelLevel?: string,
    monthlyGoal?: number,
    dailyKmGoal?: number
  ) => {
    // Close any other open shifts first to avoid conflicts
    const closedOldShifts = shifts.map(s => {
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });

    // Find last closed shift faturamento real
    const lastClosedShift = shifts
      .filter(s => s.status === 'CLOSED')
      .sort((a, b) => new Date(b.closedAt || '').getTime() - new Date(a.closedAt || '').getTime())[0] || null;

    let previousFaturamentoReal = 0;
    if (lastClosedShift) {
      const shiftRides = lastClosedShift.transactions.filter(t => t.type === 'IN' && t.category === 'CORRIDA' && !t.isVirtual);
      const shiftInflows = lastClosedShift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const shiftExpenses = lastClosedShift.transactions.filter(t => t.type === 'OUT');
      
      const shiftBruto = shiftRides.reduce((s, t) => s + getTransactionFaturamentoReal(t), 0) + 
                         shiftInflows.filter(t => t.category !== 'CORRIDA' && t.category !== 'CAMBIO_PIX' && t.category !== 'CAMPANHA').reduce((s, t) => s + t.value, 0);
      
      const shiftOut = shiftExpenses.filter(t => t.category !== 'CAMBIO_PIX').reduce((s, t) => s + t.value, 0);
      
      previousFaturamentoReal = shiftBruto;
    }

    const totalBalance = initialPixBalance + initialCashBalance;
    const ajuste = lastClosedShift ? (totalBalance - previousFaturamentoReal) : 0;

    const newShift: Shift = {
      id: `shift-${Date.now()}-${new Date().toISOString().split('T')[0]}`,
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialBalance: totalBalance,
      initialPixBalance,
      initialCashBalance,
      initialUberBalance,
      initial99Balance,
      status: 'OPEN',
      transactions: [],
      closingBalanceExpected: totalBalance,
      initialOdometer: initialOdometer !== undefined && !isNaN(initialOdometer) ? initialOdometer : undefined,
      initialFuelLiters: initialFuelLiters !== undefined && !isNaN(initialFuelLiters) ? initialFuelLiters : undefined,
      initialFuelLevel,
      monthlyGoal: monthlyGoal !== undefined && !isNaN(monthlyGoal) ? monthlyGoal : undefined,
      dailyKmGoal: dailyKmGoal !== undefined && !isNaN(dailyKmGoal) ? dailyKmGoal : undefined,
      ajusteSaldoAnterior: ajuste,
      saldoAnterior: lastClosedShift ? previousFaturamentoReal : undefined
    };

    saveToLocalStorage([newShift, ...closedOldShifts]);
  };

  // Add Transaction to Active Shift
  const handleAddTransaction = (tx: Omit<Transaction, 'id' | 'timestamp'> | Omit<Transaction, 'id' | 'timestamp'>[]) => {
    if (!activeShift) return;

    const txsArray = Array.isArray(tx) ? tx : [tx];

    setShifts(prevShifts => {
      const updated = prevShifts.map(s => {
        if (s.id === activeShift.id) {
          const newTxs: Transaction[] = txsArray.map((t, idx) => ({
            id: `tx-${Date.now()}-${idx}-${Math.round(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...t
          }));

          const trans = [...s.transactions, ...newTxs];
          
          // Compute expected Closing Balance
          const totalIn = trans.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
          const totalOut = trans.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
          const expected = s.initialBalance + totalIn - totalOut;

          return {
            ...s,
            transactions: trans,
            closingBalanceExpected: Math.round(expected * 100) / 100
          };
        }
        return s;
      });

      localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));
      return updated;
    });
  };

  // Update active shift general fields
  const handleUpdateActiveShift = (updatedFields: Partial<Shift>) => {
    if (!activeShift) return;
    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return { ...s, ...updatedFields };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  // Actual execute delete transaction from Active or history
  const executeDeleteTransaction = (txId: string) => {
    const updatedShifts = shifts.map(s => {
      const matchTx = s.transactions.some(t => t.id === txId);
      if (matchTx) {
        const remaining = s.transactions.filter(t => t.id !== txId);
        
        // Recompute expected math
        const totalIn = remaining.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.value, 0);
        const totalOut = remaining.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.value, 0);
        const expected = s.initialBalance + totalIn - totalOut;

        return {
          ...s,
          transactions: remaining,
          closingBalanceExpected: Math.round(expected * 100) / 100
        };
      }
      return s;
    });

    saveToLocalStorage(updatedShifts);
    setConfirmDialog(null);
  };

  // Intercept Delete Transaction to show beautiful dialog
  const handleDeleteTransaction = (txId: string) => {
    let value = 0;
    for (const s of shifts) {
      const found = s.transactions.find(t => t.id === txId);
      if (found) {
        value = found.value;
        break;
      }
    }

    setConfirmDialog({
      title: 'Excluir Lançamento?',
      message: `Tem certeza de que deseja excluir permanentemente o lançamento no valor de R$ ${formatDecimalBRL(value)}? Esta ação não poderá ser desfeita.`,
      confirmText: 'Confirmar Exclusão',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => executeDeleteTransaction(txId)
    });
  };

  // Close Active Shift
  const handleCloseShift = (
    closingBalanceReal: number, 
    closingPixReal: number, 
    notes: string, 
    finalOdometer?: number, 
    totalLitersFueled?: number,
    finalFuelLiters?: number,
    finalFuelLevel?: string
  ) => {
    if (!activeShift) return;

    const getExpectedPocketCashForShift = (shift: Shift) => {
      const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const expenses = shift.transactions.filter(t => t.type === 'OUT');
      const cashIn = allInTransactions.reduce((sum, t) => {
        if (t.paymentMethod === 'DINHEIRO') {
          const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
          return sum + (t.value - fee);
        }
        if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'DINHEIRO' || t.extraPaymentMethod === 'dinheiro')) {
          const extra = t.extraChargedValue !== undefined 
            ? t.extraChargedValue 
            : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
          return sum + extra;
        }
        return sum;
      }, 0);
      const cashOut = expenses.filter(t => t.paymentMethod === 'DINHEIRO').reduce((acc, t) => acc + t.value, 0);
      const initialCash = shift.initialCashBalance !== undefined ? shift.initialCashBalance : shift.initialBalance;
      return initialCash + cashIn - cashOut;
    };

    const getExpectedPixBalanceForShift = (shift: Shift) => {
      const allInTransactions = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
      const expenses = shift.transactions.filter(t => t.type === 'OUT');
      const pixIn = allInTransactions.reduce((sum, t) => {
        if (t.paymentMethod === 'PIX') {
          const fee = t.category === 'SAQUE_APP' ? (t.withdrawalFee || 0) : 0;
          return sum + (t.value - fee);
        }
        if (t.paymentMethod === 'APP' && (t.extraPaymentMethod === 'PIX' || t.extraPaymentMethod === 'pix')) {
          const extra = t.extraChargedValue !== undefined 
            ? t.extraChargedValue 
            : calculateExtraValue(t.keypadValue, t.appOfferValue, t.passengerAppValue);
          return sum + extra;
        }
        return sum;
      }, 0);
      const pixOut = expenses.filter(t => t.paymentMethod === 'PIX').reduce((acc, t) => acc + t.value, 0);
      const initialPix = shift.initialPixBalance !== undefined ? shift.initialPixBalance : 0;
      return initialPix + pixIn - pixOut;
    };

    const expectedPocketCash = getExpectedPocketCashForShift(activeShift);
    const diff = Math.round((closingBalanceReal - expectedPocketCash) * 100) / 100;

    const expectedPixBalance = getExpectedPixBalanceForShift(activeShift);
    const diffPix = Math.round((closingPixReal - expectedPixBalance) * 100) / 100;

    const closed: Shift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      status: 'CLOSED' as const,
      closingBalanceReal,
      difference: diff,
      closingPixReal,
      differencePix: diffPix,
      notes: notes.trim() || undefined,
      finalOdometer: finalOdometer !== undefined && !isNaN(finalOdometer) ? finalOdometer : undefined,
      totalLitersFueled: totalLitersFueled !== undefined && !isNaN(totalLitersFueled) ? totalLitersFueled : undefined,
      finalFuelLiters: finalFuelLiters !== undefined && !isNaN(finalFuelLiters) ? finalFuelLiters : undefined,
      finalFuelLevel: finalFuelLevel || undefined
    };

    // Auto focus and select newly closed shift receipt modal!
    setTimeout(() => setSelectedShiftForReport(closed), 200);

    // Update the shifts array with the closed shift and force ALL other shifts to be CLOSED (no other active shifts)
    const updatedShifts = shifts.map(s => {
      if (s.id === activeShift.id) {
        return closed;
      }
      if (s.status === 'OPEN') {
        return { ...s, status: 'CLOSED' as const, closedAt: s.closedAt || new Date().toISOString() };
      }
      return s;
    });
    saveToLocalStorage(updatedShifts);
  };

  // Actual execute Delete old complete Shift from historical logs
  const executeDeleteHistoryShift = async (shiftId: string) => {
    // 1. Update client-side local state and localStorage immediately for instant UI feedback
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    localStorage.setItem('moob_caixa_shifts', JSON.stringify(updated));

    // 2. Delete from cloud database (MongoDB Atlas)
    try {
      const response = await fetch(`/moob-api/shifts/${shiftId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        console.log(`[Sync-Offline-First] Turno ${shiftId} excluído do banco de dados com sucesso.`);
      } else {
        console.warn(`[Sync-Offline-First] Falha ao excluir turno ${shiftId} no servidor.`);
      }
    } catch (err) {
      console.warn("[Sync-Offline-First] Erro ao excluir turno do banco de dados:", err);
    }

    // 3. Trigger backend sync of remaining shifts to ensure database is perfectly synchronized
    fetch("/moob-api/shifts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts: updated })
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Erro na sincronização pós-exclusão");
    })
    .then(data => {
      if (Array.isArray(data)) {
        setShifts(data);
        localStorage.setItem('moob_caixa_shifts', JSON.stringify(data));
      }
    })
    .catch(err => {
      console.warn("[Sync-Offline-First] Falha ao sincronizar após exclusão:", err);
    });

    setConfirmDialog(null);
  };

  // Intercept Delete Shift
  const handleDeleteHistoryShift = (shiftId: string) => {
    setConfirmDialog({
      title: 'Excluir Turno do Histórico?',
      message: 'Tem certeza de que deseja expurgar e deletar permanentemente as estatísticas e todos os lançamentos desse turno? É uma ação irreversível.',
      confirmText: 'Excluir Definitivamente',
      cancelText: 'Manter Turno',
      isDanger: true,
      onConfirm: () => executeDeleteHistoryShift(shiftId)
    });
  };

  // Complete factory reset (wipe database back to original clean or mock state)
  const handleFactoryReset = () => {
    setConfirmDialog({
      title: 'Resetar Sistema / Banco de Dados?',
      message: 'Esta ação irá limpar absolutamente todas as estatísticas, faturamentos, cadastros e saídas do seu dispositivo para retornar ao estado original de simulação limpa. Deseja prosseguir?',
      confirmText: 'Sim, Resetar Tudo',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        // Keep ONLY closed shifts (caixas fechados)
        const closedShifts = shifts.filter(s => s.status === 'CLOSED');
        saveToLocalStorage(closedShifts);
        setConfirmDialog(null);
        playBeep();
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 select-none relative overflow-x-hidden w-full max-w-[480px] mx-auto flex flex-col shadow-2xl md:border-x md:border-slate-800/60 md:shadow-amber-500/5">
      
      {/* 1. TOP NAVBAR / CASHIER TICKER */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 px-3.5 py-2 sticky top-0 z-40 shadow-md backdrop-blur-md">
        <div className="w-full flex items-center justify-between gap-2.5">
          
          {/* Barcode scanner style brand banner */}
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 text-slate-950 font-black p-1.5 rounded-lg shadow-sm flex items-center justify-center shrink-0">
              <Milestone className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-tight uppercase text-amber-400 font-sans">
                  MoobFinance
                </h1>
                <span className="text-[12px] uppercase font-mono font-black bg-slate-850 text-slate-450 px-1 py-0.2 rounded border border-slate-750 shrink-0">
                  Móbile
                </span>
              </div>
              <div className="text-[13px] text-slate-400 flex items-center gap-1 mt-0.5 min-w-0">
                <span className="font-semibold text-slate-500 shrink-0">Operador:</span>
                <input
                  type="text"
                  className="bg-transparent border-b border-dashed border-slate-700 text-slate-200 focus:border-white focus:outline-none focus:ring-0 px-0.5 py-0 w-20 font-bold truncate text-[14px]"
                  value={driverName}
                  onChange={(e) => handleChangeDriverName(e.target.value)}
                  placeholder="Sem nome"
                  title="Clique para editar seu apelido de operador"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Selector Segmented Control */}
          <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => {
                setVehicleType('CAR');
                localStorage.setItem('moob_caixa_vehicle_type', 'CAR');
                playBeep();
              }}
              title="Trabalhando de Carro"
              className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                vehicleType === 'CAR'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setVehicleType('BIKE');
                localStorage.setItem('moob_caixa_vehicle_type', 'BIKE');
                playBeep();
              }}
              title="Trabalhando de Moto"
              className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                vehicleType === 'BIKE'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Global Screen Wake Lock (Tela Sempre Ativa) */}
          <button
            onClick={async () => {
              playBeep();
              const newEnabled = !wakeLockEnabled;
              setWakeLockEnabled(newEnabled);
              localStorage.setItem('moob_wake_lock_enabled', String(newEnabled));
              if (newEnabled) {
                await requestWakeLock();
              } else {
                await releaseWakeLock();
              }
            }}
            title={isWakeLockActive ? "Tela Sempre Ativa: Ativada" : "Tela Sempre Ativa: Desativada (Clique para Ativar)"}
            className={`p-1.5 sm:p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              isWakeLockActive 
                ? 'border-emerald-500/35 bg-emerald-950/15 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-950/30 shadow-lg shadow-emerald-500/5' 
                : 'border-slate-800 bg-slate-950/75 hover:border-amber-500/50 hover:bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Eye className={`w-3.5 h-3.5 ${isWakeLockActive ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-[14px] font-black uppercase font-sans hidden lg:inline">
              {isWakeLockActive ? 'Tela Ativa' : 'Manter Tela Ativa'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${isWakeLockActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          </button>

          {/* Configuração de Banco para Termux / Multi-dispositivo */}
          <button
            onClick={() => {
              playBeep();
              fetchDbStatus();
              setDbConfigMessage(null);
              setShowDbConfigModal(true);
            }}
            title="Configurar Banco de Dados (Termux / MongoDB Atlas)"
            className={`p-1.5 sm:p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              dbStatus?.connected 
                ? 'border-emerald-500/30 bg-emerald-950/10 hover:bg-emerald-950/25 text-emerald-400 hover:border-emerald-500/50' 
                : 'border-slate-800 bg-slate-950/75 hover:border-amber-500/50 hover:bg-slate-900 text-amber-500'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[14px] font-black uppercase font-sans hidden md:inline">
              {dbStatus?.connected ? 'Atlas Ativo' : 'Banco Local'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </button>

          {/* PWA Install Button */}
          {pwaPrompt && (
            <button
              onClick={() => {
                playBeep();
                handleInstallPWA();
              }}
              title="Instalar Aplicativo no Aparelho (PWA)"
              className="p-1.5 sm:p-2 rounded-lg border border-amber-500 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:border-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer animate-pulse"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[14px] font-black uppercase font-sans hidden sm:inline">
                Instalar App
              </span>
            </button>
          )}

          {/* Compact metrics clock */}
          <div className="flex items-center gap-2 bg-slate-950/75 py-1 px-2.5 rounded-lg border border-slate-800/80 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
            <div className="text-right font-mono">
              <span className="text-[14px] font-black text-white block">
                {currentTime || '00:00:00'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main container */}
      <main className="w-full px-3 mt-3.5 space-y-3.5 flex-1 flex flex-col">
        
        {/* UNIFIED SYSTEM TABS (MoobFinance) */}
        <div className="flex bg-slate-900/60 backdrop-blur-md p-1 border border-slate-800/80 rounded-xl w-full items-center justify-between shadow-lg gap-1">
          <button
            onClick={() => { playBeep(); setSystemTab('caixa'); }}
            className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              systemTab === 'caixa'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Caixa
          </button>
          <button
            onClick={() => { playBeep(); setSystemTab('historico'); }}
            className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              systemTab === 'historico'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Caixas Fechados
          </button>
          <button
            onClick={() => { playBeep(); setSystemTab('metas'); }}
            className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              systemTab === 'metas'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Metas & Empréstimo
          </button>
        </div>

        {systemTab === 'historico' ? (
          <motion.div
            key="historico-caixas-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white font-sans tracking-tight flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-amber-500" />
                  Histórico de Caixas Fechados
                </h3>
                <p className="text-[14px] text-slate-400">Aqui você pode visualizar, imprimir relatórios ou gerenciar caixas fechados.</p>
              </div>
              <div className="text-[14px] font-mono text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800 self-start sm:self-auto">
                Total: {shifts.filter(s => s.status === 'CLOSED').length} caixa(s) fechado(s)
              </div>
            </div>

            {shifts.filter(s => s.status === 'CLOSED').length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg bg-slate-950/20">
                <History className="w-8 h-8 text-slate-650 mx-auto mb-2" />
                <p className="text-xs font-semibold">Nenhum caixa histórico registrado ainda.</p>
                <p className="text-[14px] text-slate-650 mt-1">Abra um caixa na aba "Caixa de Corridas" e comece a registrar suas corridas operacionais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shifts.filter(s => s.status === 'CLOSED').map((shift) => {
                  const dateStr = new Date(shift.openedAt).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  });
                  
                  const rides = shift.transactions.filter(t => t.type === 'IN' && !t.isVirtual);
                  const expenses = shift.transactions.filter(t => t.type === 'OUT');
                  const ridesCount = rides.length;
                  const totalIn = rides.reduce((s, t) => s + t.value, 0);
                  const totalOut = expenses.reduce((s, t) => s + t.value, 0);
                  const profit = totalIn - totalOut;

                  const hasOdo = shift.initialOdometer !== undefined && shift.finalOdometer !== undefined && shift.finalOdometer >= shift.initialOdometer;
                  const kmRun = hasOdo && shift.finalOdometer !== undefined && shift.initialOdometer !== undefined ? (shift.finalOdometer - shift.initialOdometer) : 0;
                  const kmPerL = hasOdo && shift.totalLitersFueled && shift.totalLitersFueled > 0 ? (kmRun / shift.totalLitersFueled) : undefined;

                  return (
                    <div 
                      key={shift.id} 
                      className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1 bg-amber-500/10 text-amber-500 rounded text-xs font-bold font-mono">
                            #{shift.id.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-[14px] text-slate-450 font-mono">{dateStr}</span>
                        </div>
                        <span className="text-[13px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          Operador: {driverName || 'Sem nome'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[14px] text-slate-400 font-mono">
                        <div>
                          Corridas: <span className="text-white font-bold">{ridesCount}</span>
                        </div>
                        <div>
                          Gasto total: <span className="text-rose-400 font-semibold">R$ {formatDecimalBRL(totalOut)}</span>
                        </div>
                        {shift.difference !== undefined && shift.difference !== 0 && (
                          <div className="col-span-2">
                            Diferença de Caixa: <span className={`font-bold ${shift.difference < 0 ? 'text-rose-400' : 'text-emerald-450'}`}>R$ {formatDecimalBRL(shift.difference)}</span>
                          </div>
                        )}
                        {hasOdo && (
                          <div className="col-span-2 text-[13px] text-slate-500 mt-1 flex items-center gap-1.5 font-sans">
                            <span className="flex items-center gap-0.5">🛣️ <strong>{kmRun.toFixed(1)} KM rodados</strong></span>
                            {kmPerL !== undefined && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5" title="Consumo Médio">⛽ <strong className="text-amber-500/90">{kmPerL.toFixed(1)} km/L</strong></span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-900 pt-2.5">
                        <div className="text-left">
                          <span className="block text-[12px] font-bold text-slate-500 uppercase">Lucro Líquido</span>
                          <span className="text-xs font-black text-emerald-400 font-mono">
                            R$ {formatDecimalBRL(profit)}
                          </span>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              playBeep();
                              setSelectedShiftForReport(shift);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[14px] text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            Ver Relatório
                          </button>
                          <button
                            onClick={() => handleDeleteHistoryShift(shift.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 bg-slate-900/40 border border-slate-900 hover:border-rose-950 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : systemTab === 'metas' ? (
          <motion.div
            key="metas-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <LoanSystemApp />
          </motion.div>
        ) : systemTab === 'viagem' ? (
          <motion.div
            key="viagem-system"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <TripTracker 
              activeShift={activeShift}
              onAddTransaction={handleAddTransaction}
              vehicleType={vehicleType}
              onGoToCaixa={() => setSystemTab('caixa')}
            />
          </motion.div>
        ) : (
          <>
            {/* WELCOME / TIP MESSAGE CARD */}
        {showWelcomeMsg ? (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md"
          >
            <div className="flex gap-2.5">
              <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg mt-0.5 shrink-0">
                <Info className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Controle de Caixa Profissional Uber & 99 (Alta Densidade)
                </h4>
                <p className="text-[14.5px] text-slate-400 mt-0.5 max-w-4xl leading-relaxed">
                  Fluxo financeiro rápido de faturamento integrado para motoristas de aplicativo. Compare faturamento diário, 
                  gerencie despesas por categoria, audite quebras de dinheiro físico no bolso e emita recibos térmicos em PDF de forma prática.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={handleFactoryReset}
                title="Limpar todos os dados do turno atual para reiniciar do zero"
                className="text-[14px] flex items-center gap-1 font-mono text-slate-400 hover:text-white py-1 px-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all bg-slate-950/40 font-bold"
              >
                <RotateCcw className="w-3 h-3" />
                Resetar
              </button>
              <button 
                onClick={() => setShowWelcomeMsg(false)}
                className="text-[14px] text-slate-350 hover:text-white font-bold bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-all"
              >
                Dispensar
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex justify-end -mt-1.5 -mb-1">
            <button
              onClick={() => setShowWelcomeMsg(true)}
              className="text-[14px] text-amber-500 hover:text-amber-400 font-bold bg-slate-900 border border-slate-800 hover:border-slate-750 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <Info className="w-3.5 h-3.5" />
              Abrir Painel de Instruções
            </button>
          </div>
        )}

        {/* 2. CORE FINANCIAL COUNTERS */}
        <div className="grid grid-cols-2 gap-2" id="dashboard-general-scores">
          {/* Score 1: Faturamento Bruto Real */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-emerald-400 font-bold uppercase tracking-wider block" title="Valores ofertados pelo App">Faturamento Bruto Real</span>
            <div className="mt-1 text-lg font-black font-mono text-emerald-400 tracking-tight leading-normal">
              {formatBRL(financialTotals.totalValoresOfertados)}
            </div>
            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-250 inline-block" />
                  Uber:
                </span>
                <strong className="text-white font-bold">{financialTotals.uberRidesCount} corr.</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  99 App:
                </span>
                <strong className="text-amber-400 font-bold">{financialTotals.ninetyNineRidesCount} corr.</strong>
              </div>
              <div className="text-[11px] text-slate-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
                Valor bruto total entrado no turno
              </div>
            </div>
          </div>

          {/* Score 2: Faturamento Real Pós Despesas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-cyan-400 font-bold uppercase tracking-wider block" title="Valor pago pelo passageiro + Extra - Despesas do turno">Faturamento Pós Despesas</span>
            <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${faturamentoPosDespesas >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {formatBRL(faturamentoPosDespesas)}
            </div>
            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span>Ofertado + Extra:</span>
                <span className="text-emerald-400 font-semibold">R$ {formatDecimalBRL(financialTotals.totalValoresOfertados + financialTotals.totalValoresExtras)}</span>
              </div>
              <div className="flex justify-between text-slate-400 font-sans">
                <span>Despesas op.:</span>
                <span className="text-rose-450 font-bold">-R$ {formatDecimalBRL(financialTotals.despesasTotais)}</span>
              </div>
            </div>
          </div>

          {/* Saldos dos Apps (Uber + 99) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-violet-400 font-bold uppercase tracking-wider block" title="Saldo acumulado nas carteiras digitais dos aplicativos">Saldos dos Apps</span>
            <div className={`mt-1 text-lg font-black font-mono tracking-tight leading-normal ${(financialTotals.uberBalance + financialTotals.ninetyNineBalance) >= 0 ? 'text-violet-400' : 'text-rose-400'}`}>
              {formatBRL(financialTotals.uberBalance + financialTotals.ninetyNineBalance)}
            </div>
            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                <span className={`font-bold ${financialTotals.uberBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.uberBalance)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                <span className={`font-bold ${financialTotals.ninetyNineBalance >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>R$ {formatDecimalBRL(financialTotals.ninetyNineBalance)}</span>
              </div>
              <div className="text-[11px] text-violet-400 font-sans mt-1.5 border-t border-slate-800/40 pt-1">
                Saldo líquido nas carteiras digitais
              </div>
            </div>
          </div>

          {/* Score 3: Lucro Extra */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-amber-400 font-bold uppercase tracking-wider block" title="O que você está ganhando em cima do que o passageiro pagou para a plataforma">Lucro Extra</span>
            <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal">
              {formatBRL(financialTotals.totalValoresExtras)}
            </div>
            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                <span className="font-bold text-white">R$ {formatDecimalBRL(financialTotals.valoresExtrasUber)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                <span className="font-bold text-amber-400">R$ {formatDecimalBRL(financialTotals.valoresExtras99)}</span>
              </div>
              {financialTotals.valoresExtrasParticular > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Particular:</span>
                  <span className="font-bold text-emerald-400">R$ {formatDecimalBRL(financialTotals.valoresExtrasParticular)}</span>
                </div>
              )}
              <div className="flex justify-between text-amber-500 font-bold border-t border-slate-800/40 pt-1.5 mt-0.5">
                <span className="font-sans">Adicional Total:</span>
                <span>+{financialTotals.totalValoresOfertados > 0 ? ((financialTotals.totalValoresExtras / financialTotals.totalValoresOfertados) * 100).toFixed(0) : '0'}%</span>
              </div>
            </div>
          </div>

          {/* Score 5: Progresso da Meta de Faturamento Real (Goal Tracker) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-amber-500 font-bold uppercase tracking-wider block">Progresso Meta</span>
              <span className="text-[12px] text-slate-500 font-mono font-bold">🎯 R$ {formatDecimalBRL(monthlyGoalMath.monthlyGoal)}</span>
            </div>
            <div className="mt-1 text-lg font-black font-mono text-amber-400 tracking-tight leading-normal flex items-center justify-between">
              <div>
                {monthlyGoalMath.progressPct.toFixed(0)}%
                <span className="text-[14px] text-slate-400 font-sans font-normal ml-1">do mês</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !excludeSundays;
                  setExcludeSundays(nextVal);
                  localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
                }}
                className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
                  excludeSundays 
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title={excludeSundays ? "Calculando sem contar domingos" : "Calculando contando domingos"}
              >
                {excludeSundays ? 'Sem Domingos' : 'Com Domingos'}
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-950 rounded-full h-1 mt-1 overflow-hidden">
              <div 
                className="bg-amber-500 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, monthlyGoalMath.progressPct)}%` }}
              />
            </div>

            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-rose-400 font-bold">Falta:</span>
                <strong className={`font-black font-mono ${monthlyGoalMath.faltaParaMeta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {monthlyGoalMath.faltaParaMeta <= 0 ? '✅ Meta atingida!' : `R$ ${formatDecimalBRL(monthlyGoalMath.faltaParaMeta)}`}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Feito:</span>
                <strong className="text-white font-bold">R$ {formatDecimalBRL(monthlyGoalMath.accumulatedMonthlyFaturamento)}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Meta diária:</span>
                <strong className="text-slate-300 font-bold">R$ {formatDecimalBRL(monthlyGoalMath.dailyGoal)}</strong>
              </div>
            </div>
          </div>

          {/* Score 6: Despesas Totais */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-rose-500 font-bold uppercase tracking-wider block">Despesas Totais</span>
            <div className="mt-1 text-lg font-black font-mono text-rose-400 tracking-tight leading-normal">
              {formatBRL(financialTotals.despesasTotais)}
            </div>
            <div className="text-[12px] text-slate-500 mt-2 font-mono leading-none flex flex-col gap-1 border-t border-slate-800/80 pt-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span>Registros:</span>
                <span className="font-bold text-white">{financialTotals.expensesCount} lanç.</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Proporção:</span>
                <span className="text-rose-450 font-bold">-{financialTotals.faturamentoBruto > 0 ? `${Math.round((financialTotals.despesasTotais / financialTotals.faturamentoBruto) * 100)}%` : '0%'}</span>
              </div>
              <span className="text-[11px] text-rose-450 font-sans mt-1">Deduzido do caixa geral</span>
            </div>
          </div>

          {/* Corridas por Plataforma */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-teal-400 font-bold uppercase tracking-wider block">Corridas / Plataforma</span>
            <div className="mt-1 text-lg font-black font-mono text-teal-400 tracking-tight leading-normal">
              {financialTotals.ridesCount} <span className="text-[13px] font-sans font-normal text-slate-500">corridas</span>
            </div>
            <div className="text-[12px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />Uber:</span>
                <span className="text-white font-black">{financialTotals.uberRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.uberPercent.toFixed(0)}%)</span></span>
              </div>
              <div className="flex justify-between items-center text-amber-500">
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />99 App:</span>
                <span className="font-black text-amber-400">{financialTotals.ninetyNineRidesCount} corr. <span className="text-slate-500 font-normal">({financialTotals.ninetyNinePercent.toFixed(0)}%)</span></span>
              </div>
              <div className="flex justify-between items-center text-slate-500 font-sans mt-0.5 border-t border-slate-800/20 pt-0.5">
                <span>Média/corr.:</span>
                <span className="text-slate-300 font-medium font-mono">{formatBRL(financialTotals.avgRide)}</span>
              </div>
            </div>
          </div>

          {/* Score 9: KM Rodados & Fora das Plataformas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:border-slate-750 transition-colors">
            <span className="text-[12.5px] text-indigo-400 font-bold uppercase tracking-wider block" title="Total de quilômetros rodados no turno e o quanto foi fora dos aplicativos">KM Rodados no Turno</span>
            <div className="mt-1 text-lg font-black font-mono text-white tracking-tight leading-normal flex justify-between items-baseline">
              <span>{financialTotals.totalKM.toFixed(1).replace('.', ',')} <span className="text-[13px] font-sans font-normal text-slate-500">KM</span></span>
              {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 ? (
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">
                  Meta: {activeShift.dailyKmGoal} KM
                </span>
              ) : financialTotals.particularKM > 0 ? (
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1 py-0.5 rounded animate-pulse">
                  Por Fora
                </span>
              ) : null}
            </div>

            {activeShift && activeShift.dailyKmGoal !== undefined && activeShift.dailyKmGoal > 0 && (
              <div className="mt-2">
                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (financialTotals.totalKM / activeShift.dailyKmGoal) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10.5px] text-slate-500 mt-1 font-mono">
                  <span>Progresso: {((financialTotals.totalKM / activeShift.dailyKmGoal) * 100).toFixed(0)}%</span>
                  {activeShift.dailyKmGoal - financialTotals.totalKM > 0 ? (
                    <span>Falta: {(activeShift.dailyKmGoal - financialTotals.totalKM).toFixed(1).replace('.', ',')} KM</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">✅ Meta batida!</span>
                  )}
                </div>
              </div>
            )}
            <div className="text-[11.5px] font-bold flex flex-col gap-1 text-slate-350 font-mono mt-1.5 pt-1.5 border-t border-slate-800/40">
              <div className="flex justify-between items-center text-slate-400">
                <span>Uber:</span>
                <span className="text-white">{financialTotals.uberKM.toFixed(1).replace('.', ',')} km</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>99 App:</span>
                <span className="text-amber-500">{financialTotals.ninetyNineKM.toFixed(1).replace('.', ',')} km</span>
              </div>
              <div className="flex justify-between items-center text-indigo-400 border-t border-slate-800/20 pt-1 mt-0.5 font-sans">
                <span className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                  Fora do App:
                </span>
                <span className="font-bold font-mono text-[12px]">{financialTotals.particularKM.toFixed(1).replace('.', ',')} km</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TABS TRIGGER MENU — segmented control nativo */}
        <div className="flex mt-3 bg-slate-900 rounded-xl p-1 gap-1 border border-slate-800/80">
          <button
            onClick={() => { setActiveTab('REGISTER'); playBeep(); }}
            className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
              activeTab === 'REGISTER'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📟 Caixa
          </button>
          <button
            onClick={() => { setActiveTab('ANALYTICS'); playBeep(); }}
            className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg active:scale-[0.97] ${
              activeTab === 'ANALYTICS'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Demonstrativos
          </button>
        </div>

        {/* 4. ACTIVE SUB-COMPONENT VIEWS */}
        <AnimatePresence mode="wait">
          {activeTab === 'REGISTER' ? (
            /* Tab REGISTER: Holds physical input and active Shift statistics side-by-side */
            <motion.div
              key="register-block"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* QuickRegister component (Keypad + Selection) */}
              <div className="lg:col-span-8">
                <QuickRegister 
                  activeShift={activeShift}
                  onAddTransaction={handleAddTransaction}
                  onOpenShift={handleOpenShift}
                  vehicleType={vehicleType}
                  lastClosedShiftFaturamento={lastClosedShiftFaturamento}
                  onGoToViagem={() => setSystemTab('viagem')}
                  excludeSundays={excludeSundays}
                  onToggleExcludeSundays={setExcludeSundays}
                  onDraftFuelLitersChange={setDraftFuelLiters}
                />
              </div>

              {/* ShiftControl panel (Opening/Closing, Live Pocket verification, Historical lists) */}
              <div className="lg:col-span-4 space-y-6">
                <ShiftControl
                  activeShift={activeShift}
                  historicalShifts={shifts.filter(s => s.status === 'CLOSED')}
                  onCloseShift={handleCloseShift}
                  onDeleteHistoryShift={handleDeleteHistoryShift}
                  onSelectShiftForReport={setSelectedShiftForReport}
                  onDeleteTransaction={handleDeleteTransaction}
                  vehicleType={vehicleType}
                  onSetVehicleType={(type) => {
                    setVehicleType(type);
                    localStorage.setItem('moob_caixa_vehicle_type', type);
                  }}
                  onAddTransaction={handleAddTransaction}
                  isSpeedometerActive={isSpeedometerActive}
                  onToggleSpeedometer={handleToggleSpeedometer}
                  onUpdateActiveShift={handleUpdateActiveShift}
                  refuelMetrics={refuelMetrics}
                  draftFuelLiters={draftFuelLiters}
                  excludeSundays={excludeSundays}
                  onToggleExcludeSundays={() => {
                    const nextVal = !excludeSundays;
                    setExcludeSundays(nextVal);
                    localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
                  }}
                />
              </div>
            </motion.div>
          ) : (
            /* Tab ANALYTICS: Holds double-bar, market shares and detailed tables */
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Charts breakdown (Uber vs 99 daily comparison) */}
              <Charts shifts={shifts} transactions={allFilteredTransactions} />

              {/* Comprehensive logs and filtering */}
              <HistoryList 
                transactions={allFilteredTransactions}
                onDeleteTransaction={handleDeleteTransaction}
                periodFilter={periodFilter}
                onSetPeriodFilter={setPeriodFilter}
                vehicleType={vehicleType}
              />
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}

        {/* 5. PDF EMITTAL DIALOG PREVIEW OVERFLOW */}
        <AnimatePresence>
          {selectedShiftForReport && (
            <PdfReport
              shift={selectedShiftForReport}
              onClose={() => setSelectedShiftForReport(null)}
              vehicleType={vehicleType}
              operatorName={driverName}
            />
          )}
        </AnimatePresence>

        {/* 6. BEAUTIFUL CUSTOM DESIGNED CONFIRMATION DIALOG FOR IFRAMES SECURITY */}
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
                      setConfirmDialog(null);
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

        {/* DATABASE SETTINGS MODAL */}
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
                      setShowDbConfigModal(false);
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

                  <form onSubmit={handleSaveDbUri} className="space-y-4">
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
                          onChange={(e) => setNewDbUri(e.target.value)}
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
                          onClick={handleManualSync}
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
                        onClick={() => {
                          playBeep();
                          setNewDbUri("");
                        }}
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

        {/* FLOATING GPS SPEEDOMETER WIDGET */}
        <AnimatePresence>
          {isSpeedometerActive && (
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.1}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              className="fixed bottom-24 right-4 z-[999] cursor-grab active:cursor-grabbing font-sans"
              title="Velocímetro - Toque para simular velocidade"
            >
              {(() => {
                const speeds = [0, 24, 48, 72, 95, 120];
                const displaySpeed = speedSimCount > 0 ? speeds[speedSimCount % speeds.length] : currentSpeed;
                const isSimulated = speedSimCount > 0;

                // Color based on speed
                let colorClass = "border-emerald-500 shadow-emerald-500/40 text-emerald-400";
                let bgClass = "bg-emerald-950/20";
                if (displaySpeed > 90) {
                  colorClass = "border-rose-500 shadow-rose-500/40 text-rose-400 animate-pulse";
                  bgClass = "bg-rose-950/20";
                } else if (displaySpeed > 60) {
                  colorClass = "border-amber-500 shadow-amber-500/40 text-amber-400";
                  bgClass = "bg-amber-950/20";
                }

                return (
                  <div className="relative">
                    {/* Speed Bubble Circle */}
                    <div
                      onClick={() => {
                        playBeep();
                        setSpeedSimCount(prev => prev + 1);
                      }}
                      className={`w-20 h-20 rounded-full bg-slate-950/90 border-2 ${colorClass} ${bgClass} shadow-2xl flex flex-col items-center justify-center backdrop-blur-md select-none transition-all duration-300 hover:scale-105 active:scale-95`}
                    >
                      {/* Speed value */}
                      <span className="text-2xl font-black tracking-tighter leading-none mt-1">
                        {displaySpeed}
                      </span>
                      {/* Unit */}
                      <span className="text-[12px] font-bold uppercase text-slate-400 tracking-wider">
                        km/h
                      </span>

                      {/* Info tiny guide */}
                      <span className="text-[14px] text-slate-500 font-medium absolute bottom-1.5 font-mono">
                        TOQUE P/ TESTAR
                      </span>
                    </div>

                    {/* Simulation badge indicator */}
                    {isSimulated && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[14.5px] font-black font-mono px-1 py-0.2 rounded-md shadow border border-slate-950 uppercase tracking-widest leading-none">
                        SIM
                      </span>
                    )}

                    {/* Close x button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSpeedometer();
                      }}
                      className="absolute -top-1 -left-1 w-5 h-5 bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer"
                      title="Fechar Velocímetro"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* Picture-in-Picture floating toggle to overlay other apps */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnablePip();
                      }}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                        isPipActive 
                          ? 'border-amber-500 text-amber-400 bg-amber-950/20 animate-pulse' 
                          : 'hover:border-amber-500/50 hover:bg-slate-800 text-slate-400'
                      }`}
                      title="Minimizar para Janela Flutuante (Sobrepor outros apps)"
                    >
                      <AppWindow className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden elements for PiP overlay support - styled off-screen so the browser keeps rendering them and captureStream remains active */}
        <canvas 
          ref={canvasRef} 
          width={200} 
          height={200} 
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '200px', height: '200px', pointerEvents: 'none', opacity: 0 }} 
        />
        <video 
          ref={videoRef} 
          muted 
          playsInline 
          style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '200px', height: '200px', pointerEvents: 'none', opacity: 0 }} 
        />
        
      </main>
    </div>
  );
}

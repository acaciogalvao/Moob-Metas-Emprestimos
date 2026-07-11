import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, Play, Square, Plus, Settings, X, Coins, 
  MapPin, RotateCcw, TrendingUp, DollarSign, Clock, Milestone, Sparkles,
  AppWindow
} from 'lucide-react';
import { playBeep, playCashRegister } from '../utils/audio';
import { maskBRL, parseBRLInput, maskKM, parseKMInput } from '../utils/format';

interface TripTrackerProps {
  activeShift: any;
  onAddTransaction?: (tx: any) => void;
  vehicleType?: 'CAR' | 'BIKE';
  onGoToCaixa?: () => void;
}

export function TripTracker({ activeShift, onAddTransaction, vehicleType = 'CAR', onGoToCaixa }: TripTrackerProps) {
  // Settings / Tariff configurations (stored as formatted input strings so they can be completely cleared and masked)
  const [baseFareInput, setBaseFareInput] = useState<string>('4,50');
  const [ratePerKmInput, setRatePerKmInput] = useState<string>('2,10');
  const [ratePerMinInput, setRatePerMinInput] = useState<string>('0,25');

  // Manual / Direct Entry States
  const [activeMode, setActiveMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [directValueInput, setDirectValueInput] = useState<string>('');
  const [directKmInput, setDirectKmInput] = useState<string>('');
  const [directPaymentMethod, setDirectPaymentMethod] = useState<'DINHEIRO' | 'PIX'>('PIX');

  const baseFare = useMemo(() => parseBRLInput(baseFareInput), [baseFareInput]);
  const ratePerKm = useMemo(() => parseBRLInput(ratePerKmInput), [ratePerKmInput]);
  const ratePerMin = useMemo(() => parseBRLInput(ratePerMinInput), [ratePerMinInput]);

  const directValue = useMemo(() => parseBRLInput(directValueInput), [directValueInput]);
  const directKm = useMemo(() => {
    return parseKMInput(directKmInput);
  }, [directKmInput]);

  const handleDirectValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setDirectValueInput('');
    } else {
      const clean = val.replace(/\D/g, '');
      if (clean === '') {
        setDirectValueInput('');
      } else {
        setDirectValueInput(maskBRL(clean));
      }
    }
  };

  const handleDirectKmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskKM(e.target.value);
    setDirectKmInput(masked);
  };

  const handleAddDirectEarnings = () => {
    if (!activeShift) {
      alert('Inicie um caixa de corridas primeiro para poder lançar ganhos!');
      return;
    }
    if (directValue <= 0) {
      alert('Por favor, informe um valor de corrida válido!');
      return;
    }
    if (!onAddTransaction) return;

    playCashRegister();
    onAddTransaction({
      platform: 'PARTICULAR',
      type: 'IN',
      category: 'CORRIDA',
      value: directValue,
      description: `Corrida Particular (Lançamento Direto${directKm > 0 ? ` - ${directKm.toFixed(1).replace('.', ',')} KM` : ''})`,
      paymentMethod: directPaymentMethod,
      km: directKm > 0 ? directKm : undefined,
      isVirtual: false
    });

    alert(`Corrida de ${formatBRL(directValue)} registrada com sucesso como ${directPaymentMethod === 'PIX' ? 'PIX' : 'Dinheiro'}!`);
    
    setDirectValueInput('');
    setDirectKmInput('');
    
    if (onGoToCaixa) {
      onGoToCaixa();
    }
  };

  const handleBaseFareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setBaseFareInput('');
    } else {
      const clean = val.replace(/\D/g, '');
      if (clean === '') {
        setBaseFareInput('');
      } else {
        setBaseFareInput(maskBRL(clean));
      }
    }
  };

  const handleRatePerKmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setRatePerKmInput('');
    } else {
      const clean = val.replace(/\D/g, '');
      if (clean === '') {
        setRatePerKmInput('');
      } else {
        setRatePerKmInput(maskBRL(clean));
      }
    }
  };

  const handleRatePerMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setRatePerMinInput('');
    } else {
      const clean = val.replace(/\D/g, '');
      if (clean === '') {
        setRatePerMinInput('');
      } else {
        setRatePerMinInput(maskBRL(clean));
      }
    }
  };

  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);

  // Real-time Mobile Motion Sensors and GPS Precision states
  const [motionData, setMotionData] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsSignalStrength, setGpsSignalStrength] = useState<'EXCELENTE' | 'BOM' | 'FRACO' | 'SEM_SINAL'>('SEM_SINAL');
  
  // Trip State
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  const [isTripFinished, setIsTripFinished] = useState<boolean>(false);
  const [isHudMode, setIsHudMode] = useState<boolean>(false);
  const [hudMirrored, setHudMirrored] = useState<boolean>(false);
  
  // Accumulated data during trip
  const [tripSeconds, setTripSeconds] = useState<number>(0);
  const [tripDistanceKm, setTripDistanceKm] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [extraFees, setExtraFees] = useState<number>(0);
  
  // Picture-in-Picture & Direct Canvas Speedometer background thread renderer states/refs
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const currentSpeedRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Timestamps
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);

  // Payment Method for the private ride ("corrida por fora")
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<'DINHEIRO' | 'PIX'>('DINHEIRO');

  // Drag handle slider state
  const [dragX, setDragX] = useState<number>(0);
  const sliderWidth = 240; // width of track minus handle
  const sliderThreshold = 180;

  // References
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsCoordsRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock API to prevent device from sleeping in active mode
  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Screen Wake Lock acquired successfully');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Screen Wake Lock released');
      } catch (err) {
        console.error('Wake Lock release error:', err);
      }
    }
  };

  // Re-request wake lock and sync clock delta immediately when coming back to foreground
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isTripActive && startTime) {
        // Correctly calculate total elapsed seconds on wakeup to bypass background throttling
        const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setTripSeconds(elapsedSeconds);
        // Force immediate acquisition of Wake Lock
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTripActive, startTime]);

  // Format monetary value
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Format Duration for Active Screen (MM:SS)
  const formatActiveDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format Duration for Receipt (XhYmZs)
  const formatReceiptDuration = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h${m}m${s}s`;
  };

  // Calculate Real-time fare
  const currentCalculatedFare = useMemo(() => {
    const timeInMin = tripSeconds / 60;
    const distanceCost = tripDistanceKm * ratePerKm;
    const timeCost = timeInMin * ratePerMin;
    const total = (baseFare + distanceCost + timeCost) * surgeMultiplier + extraFees;
    return Math.max(0, total);
  }, [tripSeconds, tripDistanceKm, baseFare, ratePerKm, ratePerMin, surgeMultiplier, extraFees]);

  // Motion sensor handler
  const handleMotionEvent = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity || event.acceleration;
    if (accel) {
      setMotionData({
        x: typeof accel.x === 'number' ? Math.round(accel.x * 100) / 100 : 0,
        y: typeof accel.y === 'number' ? Math.round(accel.y * 100) / 100 : 0,
        z: typeof accel.z === 'number' ? Math.round(accel.z * 100) / 100 : 0,
      });
    }
  };

  // Start Trip (Requests permissions and triggers real sensors)
  const handleStartTrip = async () => {
    playBeep();
    setTripSeconds(0);
    setTripDistanceKm(0);
    setExtraFees(0);
    setCurrentSpeed(0);
    const start = new Date();
    setStartTime(start);
    setEndTime(null);
    setIsTripActive(true);
    setIsTripFinished(false);
    setDragX(0);

    // Request Screen Wake Lock to prevent screen sleep during ride
    await requestWakeLock();

    // Request mobile movement sensors permissions (iOS / modern web browsers)
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener('devicemotion', handleMotionEvent);
        }
      } catch (err) {
        console.warn('Motion sensor access requested but blocked/unsupported:', err);
      }
    } else if (typeof window !== 'undefined') {
      // Android or other standard device browsers
      window.addEventListener('devicemotion', handleMotionEvent);
    }

    // Timer Interval for tracking elapsed time based on precise clock delta
    timerRef.current = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - start.getTime()) / 1000);
      setTripSeconds(elapsedSeconds);
    }, 1000);

    // Real GPS Geolocation Watcher
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      lastGpsCoordsRef.current = null;
      speedHistoryRef.current = [];
      setGpsSignalStrength('SEM_SINAL');

      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, accuracy } = position.coords;
          const now = position.timestamp || Date.now();

          // Set GPS Accuracy and signal strength indicator based on accuracy margin
          setGpsAccuracy(accuracy);
          if (accuracy <= 15) {
            setGpsSignalStrength('EXCELENTE');
          } else if (accuracy <= 35) {
            setGpsSignalStrength('BOM');
          } else {
            setGpsSignalStrength('FRACO');
          }

          let measuredSpeedKmH = 0;

          // Standard velocity from the device GPS chip in meters/second
          if (speed !== null && speed >= 0) {
            measuredSpeedKmH = speed * 3.6;
          }

          let distanceMeters = 0;
          if (lastGpsCoordsRef.current) {
            const prev = lastGpsCoordsRef.current;
            
            // Haversine formula to compute precise displacement in meters between coords
            const R = 6371e3; // Earth radius in meters
            const phi1 = (prev.lat * Math.PI) / 180;
            const phi2 = (latitude * Math.PI) / 180;
            const deltaPhi = ((latitude - prev.lat) * Math.PI) / 180;
            const deltaLambda = ((longitude - prev.lng) * Math.PI) / 180;

            const a =
              Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceMeters = R * c;

            // Fallback speed calculation from delta time & displacement
            if (speed === null || speed === undefined) {
              const timeDiffSec = (now - prev.time) / 1000;
              if (timeDiffSec > 0.5) {
                const calculatedSpeedMs = distanceMeters / timeDiffSec;
                measuredSpeedKmH = calculatedSpeedMs * 3.6;
              }
            }

            // FILTER GPS ACCURACY JITTER & ACCUMULATE DISTANCE:
            // 1. Accuracy must be <= 45 meters (reject highly noisy coordinates).
            // 2. Ignore stationary speed jitter (speed < 1.8 km/h).
            // 3. Reject physical anomalies (speed >= 200 km/h).
            if (accuracy <= 45 && measuredSpeedKmH >= 1.8 && measuredSpeedKmH < 200) {
              if (distanceMeters > 1.2 && distanceMeters < 500) {
                setTripDistanceKm(prevDist => prevDist + (distanceMeters / 1000));
              }
            }
          }

          // FILTER SPEED SIGNAL (O MAIS IMPORTANTE):
          // - Standstill check (speed < 1.5 km/h is noise)
          if (measuredSpeedKmH < 1.5) {
            measuredSpeedKmH = 0;
          }

          // - Ignore spikes: discard speeds above 200 km/h (ruído)
          if (measuredSpeedKmH > 200) {
            measuredSpeedKmH = currentSpeedRef.current;
          }

          // - Moving Average (Média Móvel): last 4 readings (perfect compromise between delay and smoothness)
          const history = speedHistoryRef.current;
          history.push(measuredSpeedKmH);
          if (history.length > 4) {
            history.shift();
          }
          const sum = history.reduce((acc, val) => acc + val, 0);
          const smoothedSpeedKmh = Math.round(sum / history.length);

          // Bound final speed display and save
          const finalSpeed = Math.min(180, smoothedSpeedKmh);
          setCurrentSpeed(finalSpeed);
          currentSpeedRef.current = finalSpeed;
          lastGpsCoordsRef.current = { lat: latitude, lng: longitude, time: now };

          // Direct sync rendering on canvas callback (background thread) to bypass background suspension
          const canvas = canvasRef.current;
          if (canvas) {
            drawSpeedometerCanvas(canvas, finalSpeed);
          }
        },
        (err) => {
          console.warn('Trip Tracker Geolocation Error:', err);
          setGpsSignalStrength('SEM_SINAL');
        },
        { 
          enableHighAccuracy: true, 
          timeout: 2000, // High-frequency 1-2 seconds positioning updates (equivalent to FusedLocationProviderClient/CLLocationManager)
          maximumAge: 0 
        }
      );
    }
  };

  // Finish Trip
  const handleFinishTrip = () => {
    playCashRegister();
    setIsTripActive(false);
    setIsTripFinished(true);
    setEndTime(new Date());

    // Release Screen Wake Lock
    releaseWakeLock();

    // Clear timers, GPS watchers & motion sensors listeners
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', handleMotionEvent);
    }
  };

  // Clean / Reset state
  const handleCloseReceipt = () => {
    playBeep();
    setIsTripFinished(false);
    setIsHudMode(false);
    setHudMirrored(false);
    setTripSeconds(0);
    setTripDistanceKm(0);
    setExtraFees(0);
    setCurrentSpeed(0);
    setStartTime(null);
    setEndTime(null);
  };

  // Add earnings transaction to shift cashier
  const handleAddEarningsToShift = () => {
    if (!activeShift) {
      alert('Inicie um caixa de corridas primeiro para poder lançar ganhos!');
      return;
    }
    if (!onAddTransaction) return;

    playCashRegister();
    onAddTransaction({
      platform: 'PARTICULAR',
      type: 'IN',
      category: 'CORRIDA',
      value: currentCalculatedFare,
      description: `Corrida Particular (Taxímetro - ${tripDistanceKm.toFixed(1)} KM, ${formatActiveDuration(tripSeconds)})`,
      paymentMethod: receiptPaymentMethod,
      km: parseFloat(tripDistanceKm.toFixed(1)),
      isVirtual: false
    });

    alert(`Ganhos de ${formatBRL(currentCalculatedFare)} foram lançados com sucesso no seu caixa de corridas atual como Corrida por Fora (Particular)!`);
    handleCloseReceipt();
    if (onGoToCaixa) {
      onGoToCaixa();
    }
  };

  // Cleanup on unmount
  // Helper to draw a modern speedometer on canvas for PiP streaming (matching app twilight style)
  const drawSpeedometerCanvas = (canvas: HTMLCanvasElement, speed: number) => {
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
    ctx.fillStyle = '#34d399'; // emerald-400
    ctx.font = '900 8px sans-serif';
    ctx.fillText('TAXÍMETRO', centerX - 4, centerY - radius + 22);

    // Blinking GPS active dot
    ctx.beginPath();
    ctx.arc(centerX + 30, centerY - radius + 22, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = isBlinkOn ? '#34d399' : '#064e3b'; // emerald-400 : emerald-950
    ctx.fill();
  };

  // Synchronize canvas drawing whenever speed changes (for active foreground updates)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && isTripActive) {
      drawSpeedometerCanvas(canvas, currentSpeed);
    }
  }, [currentSpeed, isTripActive]);

  // Loop de Repintura de Segurança: continuous background repaint loop to keep video track stream alive
  useEffect(() => {
    if (!isTripActive) return;

    const intervalId = setInterval(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        drawSpeedometerCanvas(canvas, currentSpeedRef.current);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [isTripActive]);

  // Picture-in-Picture toggle handler for background speedometer overlay
  const handleEnablePip = async () => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      // Draw initial frame
      drawSpeedometerCanvas(canvas, currentSpeed);

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
        }
      }
    } catch (err) {
      console.warn('PiP launch error:', err);
    }
  };

  // Monitor leaving PiP to sync active state badge
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLeavePip = () => {
      setIsPipActive(false);
    };

    video.addEventListener('leavepictureinpicture', handleLeavePip);
    return () => {
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, []);

  // Cleanup on unmount & stop
  useEffect(() => {
    if (!isTripActive && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
      setIsPipActive(false);
    }
  }, [isTripActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (gpsWatchIdRef.current !== null) navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      releaseWakeLock();
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="w-full text-slate-200">
      <AnimatePresence mode="wait">
        
        {/* VIEW 1: PRE-TRIP SETUP AND CONFIGURATION */}
        {!isTripActive && !isTripFinished && (
          <motion.div
            key="pretrip-dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2 uppercase">
                  <Navigation className="w-4 h-4 text-amber-500 animate-pulse" />
                  Corrida por Fora / Taxímetro
                </h3>
                <p className="text-[14px] text-slate-400">Rode viagens particulares ou lance valores diretos de corridas.</p>
              </div>
            </div>

            {/* Quick Status info about active shift */}
            {!activeShift && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-2 text-amber-400">
                <span className="text-sm mt-0.5">⚠️</span>
                <p className="text-[13px] leading-relaxed">
                  <strong>Aviso:</strong> Nenhum caixa de corridas está aberto. Você precisará iniciar um caixa para salvar o ganho final no histórico de faturamento.
                </p>
              </div>
            )}

            {/* Mode Selection Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
              <button
                type="button"
                onClick={() => { playBeep(); setActiveMode('AUTO'); }}
                className={`py-2 rounded-lg text-[14px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'AUTO'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Taxímetro GPS
              </button>
              <button
                type="button"
                onClick={() => { playBeep(); setActiveMode('MANUAL'); }}
                className={`py-2 rounded-lg text-[14px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'MANUAL'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Lançamento Direto
              </button>
            </div>

            {/* TAB 1: TAXIMETRO GPS AUTO MODE */}
            {activeMode === 'AUTO' && (
              <div className="space-y-4">
                {/* Settings Card */}
                <div className="bg-slate-950/75 border border-slate-850 p-3.5 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      Tarifas e Configurações
                    </span>
                    
                    {/* Visual indicator of high precision motion sensors */}
                    <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md text-[12px] font-black uppercase text-amber-400 animate-pulse">
                      <span>📍 Sensores Ativos (Sem Simulação)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[12px] font-black uppercase text-slate-500 tracking-widest mb-1">
                        Tarifa Base
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-black text-slate-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={baseFareInput}
                          onChange={handleBaseFareChange}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-1.5 text-[14px] font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-black uppercase text-slate-500 tracking-widest mb-1">
                        Valor por KM
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-black text-slate-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ratePerKmInput}
                          onChange={handleRatePerKmChange}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-1.5 text-[14px] font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-black uppercase text-slate-500 tracking-widest mb-1">
                        Valor por Minuto
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-black text-slate-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ratePerMinInput}
                          onChange={handleRatePerMinChange}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-1.5 text-[14px] font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Surge Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="block text-[12px] font-black uppercase text-slate-500 tracking-widest">
                        Preço Dinâmico (Multiplicador)
                      </span>
                      <span className="text-[14px] font-black font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        {surgeMultiplier.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => { playBeep(); setSurgeMultiplier(val); }}
                          className={`flex-1 py-1 rounded text-[12.5px] font-black tracking-widest transition-all cursor-pointer ${
                            surgeMultiplier === val 
                              ? 'bg-amber-500 text-slate-950 font-black' 
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80'
                          }`}
                        >
                          {val.toFixed(1)}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Launch / Start Button */}
                <button
                  onClick={handleStartTrip}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl transition-all shadow-lg hover:shadow-amber-500/10 uppercase tracking-widest text-[14.5px] flex items-center justify-center gap-2 cursor-pointer border border-amber-400/35"
                >
                  <Play className="w-4 h-4 fill-slate-950 stroke-none" />
                  Iniciar Nova Viagem
                </button>
              </div>
            )}

            {/* TAB 2: MANUAL / DIRECT TRIP ENTRY MODE */}
            {activeMode === 'MANUAL' && (
              <div className="bg-slate-950/75 border border-slate-850 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-slate-500" />
                    Lançamento Direto de Corrida
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Valor (R$) */}
                  <div>
                    <label className="block text-[12px] font-black uppercase text-slate-500 tracking-widest mb-1.5">
                      Valor da Corrida
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={directValueInput}
                        onChange={handleDirectValueChange}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-sm font-bold font-mono text-white focus:outline-none focus:border-amber-500 placeholder-slate-700"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* KM */}
                  <div>
                    <label className="block text-[12px] font-black uppercase text-slate-500 tracking-widest mb-1.5">
                      Distância (KM)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={directKmInput}
                        onChange={handleDirectKmChange}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-sm font-bold font-mono text-white focus:outline-none focus:border-amber-500 placeholder-slate-700"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">KM</span>
                    </div>
                  </div>
                </div>

                {/* Meio de Pagamento */}
                <div className="space-y-1.5">
                  <span className="block text-[12px] font-black uppercase text-slate-500 tracking-widest">
                    Meio de Recebimento
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { playBeep(); setDirectPaymentMethod('DINHEIRO'); }}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        directPaymentMethod === 'DINHEIRO'
                          ? 'bg-amber-500 border-amber-600 text-slate-950 font-black shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      💵 Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => { playBeep(); setDirectPaymentMethod('PIX'); }}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        directPaymentMethod === 'PIX'
                          ? 'bg-amber-500 border-amber-600 text-slate-950 font-black shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      📱 Pix
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleAddDirectEarnings}
                  disabled={directValue <= 0}
                  className={`w-full font-black py-3 rounded-xl transition-all shadow-lg uppercase tracking-widest text-[14.5px] flex items-center justify-center gap-2 border cursor-pointer ${
                    directValue > 0
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border-amber-400/35 shadow-amber-500/10'
                      : 'bg-slate-800 text-slate-500 border-slate-850 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Lançar Corrida Direta
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 2: ACTIVE TRIP DASHBOARD (System Standard Dark Slate / Cockpit design) */}
        {isTripActive && (
          <motion.div
            key="active-trip-cockpit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-gradient-to-b from-slate-950 via-slate-900 to-[#121214] font-sans flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient animated system amber radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08)_0%,transparent_60%)] pointer-events-none" />

            {/* Top Navigation Row */}
            <div className="w-full flex items-center justify-between pt-8 px-4 relative z-10">
              <button
                type="button"
                onClick={() => { playBeep(); setIsHudMode(true); }}
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-black px-3.5 py-2 rounded-xl uppercase tracking-wider cursor-pointer transition-colors"
              >
                📺 Modo Ecrã (HUD)
              </button>

              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg mb-1 animate-bounce">
                  {/* White Arrow Icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 22L12 17L22 22L12 2Z" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-white text-[12px] font-black uppercase tracking-widest leading-none drop-shadow">
                  Navegar
                </span>
              </div>

              <div className="text-emerald-400 bg-slate-950/85 text-[12px] font-black font-mono px-2 py-1.5 rounded-xl border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GPS: {gpsSignalStrength}
              </div>
            </div>

            {/* FULLSCREEN HUD / SCREENSAVER OVERLAY */}
            <AnimatePresence>
              {isHudMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black z-[1050] flex flex-col justify-between p-6 select-none"
                >
                  {/* Top Bar inside HUD Mode */}
                  <div className="flex justify-between items-center z-10">
                    <button
                      type="button"
                      onClick={() => { playBeep(); setHudMirrored(prev => !prev); }}
                      className="bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-850 text-xs font-black px-3.5 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      {hudMirrored ? '🔄 Modo Normal' : '🪞 Espelhar HUD (Windshield)'}
                    </button>
                    
                    <div className="text-emerald-400 bg-zinc-900/90 text-[11px] font-black font-mono px-3 py-2 rounded-xl border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      GPS Ativo
                    </div>

                    <button
                      type="button"
                      onClick={() => { playBeep(); setIsHudMode(false); }}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider cursor-pointer"
                    >
                      Sair do Ecrã
                    </button>
                  </div>

                  {/* Main Display Area, optionally mirrored */}
                  <div className={`flex-1 flex flex-col items-center justify-center gap-6 transition-transform duration-300 ${hudMirrored ? 'scale-x-[-1]' : ''}`}>
                    
                    {/* Giant Digital Speedometer */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline gap-1">
                        <span className="text-8xl sm:text-9xl font-black font-mono tracking-tighter text-white">
                          {currentSpeed}
                        </span>
                        <span className="text-xl sm:text-2xl font-black uppercase text-slate-500 tracking-widest font-sans">
                          km/h
                        </span>
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-emerald-400 font-mono animate-pulse mt-1">
                        Velocímetro em Tempo Real (Via GPS)
                      </span>
                    </div>

                    {/* Giant Current Fare */}
                    <div className="bg-zinc-950/80 border border-zinc-900 rounded-3xl p-5 w-full max-w-sm text-center shadow-2xl flex flex-col items-center">
                      <span className="text-slate-400 text-xs uppercase font-black tracking-widest mb-1">
                        Valor da Corrida
                      </span>
                      <span className="text-emerald-400 text-4xl sm:text-5xl font-black tracking-tight font-mono">
                        {formatBRL(currentCalculatedFare)}
                      </span>
                    </div>

                    {/* Compact Metrics Row */}
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-center">
                      <div className="bg-zinc-950/55 border border-zinc-900 rounded-2xl p-3">
                        <span className="block text-slate-500 text-[10px] uppercase font-black tracking-wider mb-0.5">Distância</span>
                        <span className="text-white text-xl font-black font-mono">
                          {tripDistanceKm.toFixed(1).replace('.', ',')} km
                        </span>
                      </div>
                      <div className="bg-zinc-950/55 border border-zinc-900 rounded-2xl p-3">
                        <span className="block text-slate-500 text-[10px] uppercase font-black tracking-wider mb-0.5">Tempo Total</span>
                        <span className="text-white text-xl font-black font-mono">
                          {formatActiveDuration(tripSeconds)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Footer Screen Awake lock assurance */}
                  <div className="text-center text-slate-500 text-[11px] font-bold uppercase tracking-widest z-10 pb-2">
                    🔒 Tela Sempre Ativa • Prevenção de Bloqueio Ativada
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Value Center Display */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-3.5">
              <div className="flex flex-col items-center justify-center">
                <span className="text-slate-400 text-[14px] uppercase font-black tracking-widest mb-1">
                  Valor atual
                </span>
                
                <h2 className="text-white text-5.5xl sm:text-6xl font-black tracking-tight leading-none drop-shadow-[0_4px_12px_rgba(255,255,255,0.1)]">
                  {formatBRL(currentCalculatedFare)}
                </h2>
              </div>

              {/* Extra row: DINAMICO & + TAXA EXTRA */}
              <div className="flex items-center gap-3 text-white/80 font-bold text-[12.5px] tracking-wider">
                <span className="bg-slate-950/75 border border-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                  ⚡ DINÂMICO: {surgeMultiplier.toFixed(1)}x
                </span>
                
                <button
                  type="button"
                  onClick={() => {
                    playBeep();
                    const valueToAdd = 5; // Adds R$ 5,00 extra fee
                    setExtraFees(prev => prev + valueToAdd);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1 rounded-full font-black uppercase transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-1 border border-emerald-300/30 text-[12.5px]"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  Adicionar Taxa Extra
                </button>
              </div>

              {/* GORGEOUS SYSTEM SPEEDOMETER THAT APPEARS ON MOVEMENT (when speed > 0, matching system design) */}
              <AnimatePresence>
                {currentSpeed > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -10 }}
                    className="flex flex-col items-center justify-center pt-1"
                  >
                    <div className={`w-24 h-24 rounded-full bg-slate-950/95 border-4 shadow-2xl flex flex-col items-center justify-center backdrop-blur-md select-none transition-all duration-300 ${
                      currentSpeed > 80
                        ? 'border-rose-500 shadow-rose-500/40 text-rose-400 animate-pulse'
                        : currentSpeed > 40
                        ? 'border-amber-500 shadow-amber-500/40 text-amber-400'
                        : 'border-emerald-500 shadow-emerald-500/40 text-emerald-400'
                    }`}>
                      <span className="text-3xl font-black tracking-tighter leading-none mt-1">
                        {currentSpeed}
                      </span>
                      <span className="text-[12px] font-bold uppercase text-slate-400 tracking-widest mt-0.5">
                        km/h
                      </span>
                      <span className="text-[14px] text-amber-500 font-black uppercase tracking-widest mt-1 animate-pulse">
                        MOVIMENTO ATIVO
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Separator Line */}
            <div className="px-6">
              <div className="w-full h-[1px] bg-slate-800" />
            </div>

            {/* Secondary Trip Info Row */}
            <div className="px-8 py-5 grid grid-cols-2 gap-4 items-center relative">
              
              {/* Distance accumulated */}
              <div className="text-left">
                <span className="block text-slate-450 text-[12.5px] uppercase font-black tracking-widest mb-0.5">Distância</span>
                <span className="text-white text-2xl font-black font-mono tracking-tighter leading-none">
                  {tripDistanceKm.toFixed(1).replace('.', ',')} km
                </span>
              </div>

              {/* Duration Timer */}
              <div className="text-right">
                <span className="block text-slate-450 text-[12.5px] uppercase font-black tracking-widest mb-0.5">Tempo</span>
                <span className="text-white text-2xl font-black font-mono tracking-tighter leading-none">
                  {formatActiveDuration(tripSeconds)}
                </span>
              </div>

              {/* Real-time Hardware Sensor Monitor */}
              <div className="col-span-2 bg-slate-950/75 border border-slate-850 p-3 rounded-xl space-y-2 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-slate-300 text-[11px] sm:text-[12px] font-black uppercase tracking-wider">
                      Sensores de Movimento e GPS (100% Real)
                    </span>
                  </div>
                  
                  {/* PiP Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnablePip();
                      }}
                      className={`px-2 py-0.5 sm:py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10.5px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-all ${
                        isPipActive ? 'border-amber-500 text-amber-400 bg-amber-950/20 animate-pulse' : ''
                      }`}
                      title="Minimizar Velocímetro para Janela Flutuante (Sobrepor outros apps)"
                    >
                      <AppWindow className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isPipActive ? 'PIP Ativo' : 'PIP Flutuante'}</span>
                    </button>

                    <div className="text-right font-mono">
                      <span className="text-white text-base font-black">
                        {currentSpeed}
                      </span>
                      <span className="text-slate-500 text-[12px] font-bold uppercase ml-1">
                        km/h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hidden canvas & video elements used purely as stream sources for Picture-in-Picture */}
                <canvas 
                  ref={canvasRef} 
                  width={200} 
                  height={200} 
                  className="hidden" 
                />
                <video 
                  ref={videoRef} 
                  muted 
                  playsInline 
                  className="hidden" 
                />

                {/* Subgrid of accelerometer and GPS accuracy stats */}
                <div className="grid grid-cols-2 gap-2 text-[12px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                  <div className="space-y-0.5">
                    <span className="block text-slate-500 uppercase">Acelerômetro Celular</span>
                    <div className="text-white font-bold flex gap-1.5">
                      <span>X: <strong className="text-amber-500 font-bold">{motionData.x}</strong></span>
                      <span>Y: <strong className="text-amber-500 font-bold">{motionData.y}</strong></span>
                      <span>Z: <strong className="text-amber-500 font-bold">{motionData.z}</strong></span>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="block text-slate-500 uppercase">Precisão Satélite</span>
                    <span className="text-white font-bold">
                      {gpsAccuracy !== null ? `± ${gpsAccuracy.toFixed(1)}m (${gpsSignalStrength})` : 'Aguardando GPS...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM SLIDE-TO-FINISH PANEL (Slider handle sliderWidth layout) */}
            <div className="w-full px-6 pb-12 flex flex-col items-center">
              
              <div className="w-full bg-slate-950/50 border border-white/10 rounded-full h-14 p-1 relative flex items-center overflow-hidden">
                
                {/* Text guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span className="text-white/35 font-sans font-black uppercase text-[14px] tracking-widest pl-10 animate-pulse">
                    Deslize para Finalizar
                  </span>
                </div>

                {/* Swipeable Track Progress overlay */}
                <div 
                  className="absolute left-1 top-1 bottom-1 bg-red-500/20 rounded-full pointer-events-none"
                  style={{ width: `${Math.max(48, dragX + 48)}px` }}
                />

                {/* Framer motion draggable slider handle */}
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: sliderWidth }}
                  dragElastic={0}
                  dragMomentum={false}
                  onDrag={(event, info) => {
                    const offset = info?.offset?.x ?? 0;
                    setDragX(offset);
                  }}
                  onDragEnd={(event, info) => {
                    const offset = info?.offset?.x ?? 0;
                    if (offset >= sliderThreshold) {
                      handleFinishTrip();
                    } else {
                      playBeep();
                      setDragX(0);
                    }
                  }}
                  style={{ x: dragX }}
                  animate={dragX === 0 ? { x: 0 } : undefined}
                  className="w-12 h-12 rounded-full bg-white shadow-xl cursor-grab active:cursor-grabbing flex items-center justify-center text-slate-900 font-extrabold z-10 transition-shadow duration-300 hover:shadow-white/20 select-none"
                >
                  {/* Arrow inside button */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-blue-900 animate-pulse">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </motion.div>

              </div>

              {/* Tap backup fallback button for standard compatibility on dev sandbox */}
              <button
                type="button"
                onClick={handleFinishTrip}
                className="mt-3 text-[12px] text-white/40 hover:text-white uppercase font-black font-sans tracking-widest underline decoration-dotted transition-colors cursor-pointer"
              >
                Problemas no arraste? Clique aqui para Finalizar
              </button>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: "Detalhes da viagem" RECEIPT DIALOG (Screenshot 1 design) */}
        {isTripFinished && (
          <motion.div
            key="trip-details-receipt"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[1100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans text-slate-900"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-300 relative flex flex-col justify-between max-h-[90vh]">
              
              {/* Receipt Content Panel */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                
                {/* Header Title */}
                <div className="text-center">
                  <h3 className="text-slate-800 text-lg font-black tracking-tight leading-none">
                    Detalhes da viagem
                  </h3>
                </div>

                {/* Details Section */}
                <div className="space-y-2.5 text-[14.5px] text-slate-600 font-medium">
                  
                  {/* Inicio / Fim */}
                  <div className="flex justify-between items-center">
                    <span>Início</span>
                    <span className="font-mono font-bold text-slate-800">
                      {startTime ? startTime.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '--/--/---- --:--'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Fim</span>
                    <span className="font-mono font-bold text-slate-800">
                      {endTime ? endTime.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '--/--/---- --:--'}
                    </span>
                  </div>

                  {/* Divider Line */}
                  <div className="h-[1px] bg-slate-200" />

                  {/* Distance / Duration */}
                  <div className="flex justify-between items-center">
                    <span>Distância percorrida</span>
                    <span className="font-mono font-black text-slate-800">
                      {tripDistanceKm.toFixed(1).replace('.', ',')}km
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Duração</span>
                    <span className="font-mono font-black text-slate-800">
                      {formatReceiptDuration(tripSeconds)}
                    </span>
                  </div>

                  {/* Divider Line */}
                  <div className="h-[1px] bg-slate-200" />

                  {/* Calculations */}
                  <div className="flex justify-between items-center">
                    <span>Tarifa base</span>
                    <span className="font-mono text-slate-700">
                      {formatBRL(baseFare)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Total - distância</span>
                    <span className="font-mono text-slate-700">
                      {formatBRL(tripDistanceKm * ratePerKm)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Total - tempo</span>
                    <span className="font-mono text-slate-700">
                      {formatBRL((tripSeconds / 60) * ratePerMin)}
                    </span>
                  </div>

                  {extraFees > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Total - taxa extra</span>
                      <span className="font-mono text-emerald-600 font-bold">
                        {formatBRL(extraFees)}
                      </span>
                    </div>
                  )}

                  {surgeMultiplier > 1 && (
                    <div className="flex justify-between items-center">
                      <span>Multiplicador Dinâmico</span>
                      <span className="font-mono text-amber-600 font-black">
                        {surgeMultiplier.toFixed(1)}x
                      </span>
                    </div>
                  )}

                </div>

                {/* Total bold centered */}
                <div className="text-center pt-2 pb-1 border-t border-b border-slate-200">
                  <span className="text-slate-800 text-xl font-extrabold block">
                    Total: {formatBRL(currentCalculatedFare)}
                  </span>
                </div>

                {/* Meio de Pagamento Selector on Receipt */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-2">
                  <span className="block text-[12px] font-black uppercase tracking-wider text-slate-500 text-center">
                    MEIO DE PAGAMENTO (RECEBIMENTO)
                  </span>
                  <div className="flex gap-2 font-bold text-[14px]">
                    <button
                      type="button"
                      onClick={() => { playBeep(); setReceiptPaymentMethod('DINHEIRO'); }}
                      className={`flex-1 py-1.5 rounded-lg transition-all border ${
                        receiptPaymentMethod === 'DINHEIRO'
                          ? 'bg-amber-500 border-amber-600 text-slate-950 font-black shadow-sm'
                          : 'bg-white border-slate-300 text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      💵 Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => { playBeep(); setReceiptPaymentMethod('PIX'); }}
                      className={`flex-1 py-1.5 rounded-lg transition-all border ${
                        receiptPaymentMethod === 'PIX'
                          ? 'bg-amber-500 border-amber-600 text-slate-950 font-black shadow-sm'
                          : 'bg-white border-slate-300 text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      📱 Pix
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE MOCKUP MAP (drawn directly in SVG with a street map style, starting/ending flags and watermark logo) */}
                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
                  <svg className="w-full h-full select-none" viewBox="0 0 300 180" fill="none">
                    {/* Background Soft Grid (representing city roads) */}
                    <rect width="300" height="180" fill="#f1f5f9" />
                    
                    {/* City Block Grid */}
                    <path d="M 0,25 L 300,25 M 0,65 L 300,65 M 0,115 L 300,115 M 0,155 L 300,155" stroke="#e2e8f0" strokeWidth="6" />
                    <path d="M 45,0 L 45,180 M 115,0 L 115,180 M 195,0 L 195,180 M 265,0 L 265,180" stroke="#e2e8f0" strokeWidth="6" />

                    {/* Secondary winding parkways / diagonal lanes */}
                    <path d="M -10,135 C 75,135 150,45 310,45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <path d="M 50,-10 C 120,60 180,110 250,190" fill="none" stroke="#e2e8f0" strokeWidth="8" />

                    {/* Blue dynamic path simulating GPS tracking */}
                    <path 
                      d="M 65,135 Q 115,135 115,90 T 195,45" 
                      fill="none" 
                      stroke="#0284c7" 
                      strokeWidth="4" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="opacity-90"
                    />

                    {/* Start Pin (Green flag) */}
                    <g transform="translate(65, 135)">
                      <circle cx="0" cy="0" r="5" fill="#10b981" stroke="white" strokeWidth="1.5" className="animate-pulse" />
                      <path d="M 0,0 L 0,-12 L 6,-9 L 0,-6" fill="#10b981" stroke="white" strokeWidth="0.8" />
                    </g>

                    {/* Destination Finish Pin (Checkered Racing Flag icon) */}
                    <g transform="translate(195, 45)">
                      {/* Checkered style circular badge */}
                      <circle cx="0" cy="0" r="8" fill="#0f172a" stroke="white" strokeWidth="1.5" />
                      
                      {/* White checkered inner patterns */}
                      <rect x="-4" y="-4" width="4" height="4" fill="white" />
                      <rect x="0" y="0" width="4" height="4" fill="white" />
                      
                      {/* Little flag post line */}
                      <line x1="0" y1="8" x2="0" y2="15" stroke="#475569" strokeWidth="1.5" />
                    </g>

                    {/* Simulated current driver vehicle dot */}
                    <g transform="translate(145, 68)">
                      <circle cx="0" cy="0" r="4" fill="#0284c7" stroke="white" strokeWidth="1" />
                    </g>

                    {/* "Google" Watermark on bottom left (matching screenshot) */}
                    <text x="12" y="168" className="font-sans font-extrabold text-[12px] text-slate-400 opacity-60">
                      Google
                    </text>
                  </svg>
                </div>

              </div>

              {/* Bottom Actions Row */}
              <div className="bg-slate-100 p-4 grid grid-cols-2 gap-3 border-t border-slate-200 font-sans shrink-0">
                <button
                  type="button"
                  onClick={handleCloseReceipt}
                  className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-3 px-4 rounded-xl text-center uppercase tracking-wider text-[14px] active:scale-95 transition-all cursor-pointer border border-slate-300/40"
                >
                  Fechar
                </button>
                
                <button
                  type="button"
                  onClick={handleAddEarningsToShift}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-4 rounded-xl text-center uppercase tracking-wider text-[14px] active:scale-95 transition-all cursor-pointer border border-amber-400/30 shadow-md shadow-amber-500/10"
                >
                  Gerar Recibo
                </button>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

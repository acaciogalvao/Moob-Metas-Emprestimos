/**
 * useSpeedometer.ts — Hook for GPS speedometer, canvas drawing, and Picture-in-Picture.
 */

import { useState, useEffect, useRef } from 'react';
import { playBeep } from '../utils/audio';

export function useSpeedometer(hasOpenShift: boolean, shiftGpsSpeedKmh: number, shiftGpsIsActive: boolean) {
  const [isSpeedometerActive, setIsSpeedometerActive] = useState<boolean>(() => {
    return localStorage.getItem('moob_speedometer_active') === 'true';
  });
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [speedSimCount, setSpeedSimCount] = useState<number>(0);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);

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

  // --- SINCRONIZA velocidade do GPS do turno com o velocímetro flutuante ---
  useEffect(() => {
    if (hasOpenShift && shiftGpsIsActive) {
      setCurrentSpeed(shiftGpsSpeedKmh);
    }
  }, [shiftGpsSpeedKmh, shiftGpsIsActive, hasOpenShift]);

  // --- GPS GEOLOCATION VELOCITY TRACKING ---
  useEffect(() => {
    // Quando o caixa está aberto, o useShiftGPS já gerencia o GPS — evita duplo watcher
    if (!isSpeedometerActive || hasOpenShift) {
      if (!hasOpenShift) {
        setCurrentSpeed(0);
        lastPositionRef.current = null;
      }
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
  }, [isSpeedometerActive, hasOpenShift]);

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

  return {
    isSpeedometerActive,
    currentSpeed,
    speedSimCount,
    setSpeedSimCount,
    isPipActive,
    canvasRef,
    videoRef,
    handleToggleSpeedometer,
    handleEnablePip,
  };
}

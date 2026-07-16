/**
 * audio.ts — Sintetizador de feedback tátil via Web Audio API
 *
 * Estratégia de pool:
 *  - AudioBuffers pré-renderizados na RAM (PCM já calculado)
 *  - BufferSourceNode é barato de criar — sem overhead de oscilador por chamada
 *  - warmUpAudio() inicializa contexto e pré-renderiza todos os buffers
 *    → deve ser chamado no primeiro gesto do usuário para latência zero
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// ─── Pool de buffers pré-renderizados ────────────────────────────────────────

let beepBuffer:  AudioBuffer | null = null;
let cashBuffer:  AudioBuffer | null = null;
let errorBuffer: AudioBuffer | null = null;

/** Beep de scanner: 1600 Hz senoidal, 120 ms, decay rápido */
function renderBeepBuffer(ctx: AudioContext): AudioBuffer {
  const sr  = ctx.sampleRate;
  const len = Math.ceil(0.12 * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t   = i / sr;
    const env = Math.exp(-t * 25); // τ ≈ 40 ms
    d[i] = Math.sin(2 * Math.PI * 1600 * t) * env * 0.08;
  }
  return buf;
}

/** Cash register: dois chimes (varredura triangle 1000→1500 Hz + sine 2200 Hz) */
function renderCashBuffer(ctx: AudioContext): AudioBuffer {
  const sr  = ctx.sampleRate;
  const len = Math.ceil(0.25 * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d   = buf.getChannelData(0);

  let phase1 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;

    // Primeiro chime: varredura linear de frequência + onda triangular
    if (t < 0.15) {
      const freq = 1000 + 500 * (t / 0.15);
      phase1    += (2 * Math.PI * freq) / sr;
      const p    = ((phase1 / (2 * Math.PI)) % 1 + 1) % 1;
      const tri  = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
      d[i]      += tri * Math.exp(-t * 20) * 0.06;
    }

    // Segundo chime: 2200 Hz senoidal, começa em 80 ms
    if (t >= 0.08 && t < 0.18) {
      const t2 = t - 0.08;
      d[i]    += Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t2 * 25) * 0.05;
    }
  }
  return buf;
}

/** Error beep: 180 Hz dente-de-serra, 250 ms, decay médio */
function renderErrorBuffer(ctx: AudioContext): AudioBuffer {
  const sr  = ctx.sampleRate;
  const len = Math.ceil(0.25 * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d   = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t  = i / sr;
    phase   += (2 * Math.PI * 180) / sr;
    const saw = ((phase % (2 * Math.PI)) / Math.PI) - 1; // dente-de-serra -1..1
    d[i] = saw * Math.exp(-t * 12) * 0.12;
  }
  return buf;
}

// ─── Reprodução via buffer (sem latência de oscilador) ───────────────────────

function playBuffer(buf: AudioBuffer): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Pré-aquece o AudioContext e renderiza todos os buffers.
 * Chamar no primeiro gesto do usuário garante latência zero nas chamadas seguintes.
 */
export function warmUpAudio(): void {
  try {
    const ctx   = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    beepBuffer  = beepBuffer  ?? renderBeepBuffer(ctx);
    cashBuffer  = cashBuffer  ?? renderCashBuffer(ctx);
    errorBuffer = errorBuffer ?? renderErrorBuffer(ctx);
  } catch (e) {
    // Silencioso — ambiente sem Web Audio (SSR, testes)
  }
}

export function playBeep(): void {
  try {
    const ctx = getAudioContext();
    beepBuffer ??= renderBeepBuffer(ctx);
    playBuffer(beepBuffer);
  } catch (e) {
    console.warn('playBeep falhou:', e);
  }
}

export function playCashRegister(): void {
  try {
    const ctx = getAudioContext();
    cashBuffer ??= renderCashBuffer(ctx);
    playBuffer(cashBuffer);
  } catch (e) {
    console.warn('playCashRegister falhou:', e);
  }
}

export function playErrorBeep(): void {
  try {
    const ctx = getAudioContext();
    errorBuffer ??= renderErrorBuffer(ctx);
    playBuffer(errorBuffer);
  } catch (e) {
    console.warn('playErrorBeep falhou:', e);
  }
}

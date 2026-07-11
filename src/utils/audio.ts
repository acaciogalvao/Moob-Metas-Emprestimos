/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Web Audio API Synthesizer for tactile feedback
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Classic supermarket laser barcode scanner beep (crisp high pitch short beep)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (error) {
    console.warn('Audio check failed or blocked by autoplay settings:', error);
  }
}

export function playCashRegister() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Quick double-coin register drawer slide sound effect
    const now = ctx.currentTime;
    
    // First high chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1000, now);
    osc1.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(now + 0.15);
    
    // Second brief noise chime
    setTimeout(() => {
      try {
        const nextTime = ctx.currentTime;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2200, nextTime);
        gain2.gain.setValueAtTime(0.05, nextTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.1);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(nextTime + 0.1);
      } catch (e) {}
    }, 80);
  } catch (error) {
    console.warn('Sound drawer effect failed:', error);
  }
}

export function playErrorBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (error) {
    console.warn('Error beep audio blocked:', error);
  }
}

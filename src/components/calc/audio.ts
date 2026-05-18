'use client'

// Zero-asset Web Audio API tone generator.
// AudioContext must be created lazily after a user gesture to satisfy browser autoplay policies.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
  if (!Ctor) return null
  try { ctx = new Ctor() } catch { return null }
  return ctx
}

function playTone(
  freq: number,
  durMs: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
  startDelayMs = 0,
) {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + startDelayMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.05)
}

function playGlide(
  fromHz: number,
  toHz: number,
  durMs: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
) {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(fromHz, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + durMs / 1000)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.05)
}

export type CalcSfx =
  | 'correct'
  | 'retry'
  | 'wrong'
  | 'coin'
  | 'streak'
  | 'challenge'
  | 'complete'
  | 'redeem'
  | 'levelup'

export function playSfx(name: CalcSfx, enabled: boolean) {
  if (!enabled) return
  switch (name) {
    case 'correct':
      playGlide(880, 1320, 150, 'sine', 0.15)
      break
    case 'retry':
      playTone(660, 200, 'triangle', 0.12)
      break
    case 'wrong':
      playGlide(220, 196, 300, 'square', 0.10)
      break
    case 'coin':
      playGlide(1760, 2640, 80, 'sine', 0.10)
      break
    case 'streak':
      playTone(523, 200, 'sine', 0.10, 0)       // C5
      playTone(659, 200, 'sine', 0.10, 80)      // E5
      playTone(784, 250, 'sine', 0.10, 160)     // G5
      break
    case 'challenge':
      playTone(880, 400, 'sine', 0.12, 0)
      playTone(1760, 400, 'sine', 0.08, 100)
      break
    case 'complete':
      playTone(523, 150, 'sine', 0.13, 0)
      playTone(587, 150, 'sine', 0.13, 130)
      playTone(659, 150, 'sine', 0.13, 260)
      playTone(784, 150, 'sine', 0.13, 390)
      playTone(1047, 350, 'sine', 0.13, 520)
      break
    case 'redeem':
      playTone(1318, 800, 'sine', 0.14, 0)
      playTone(1976, 800, 'sine', 0.08, 100)
      playTone(2637, 800, 'sine', 0.05, 250)
      break
    case 'levelup':
      playTone(659, 150, 'sine', 0.12, 0)
      playTone(880, 150, 'sine', 0.12, 130)
      playTone(1047, 300, 'sine', 0.13, 260)
      break
  }
}

'use client'

import type { StarColor } from './star-types'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try { ctx = new Ctor() } catch { return null }
  return ctx
}

function tone(c: AudioContext, freq: number, durMs: number, type: OscillatorType, gain: number, startDelayMs: number) {
  const t0 = c.currentTime + startDelayMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.05)
}

function glide(c: AudioContext, fromHz: number, toHz: number, durMs: number, type: OscillatorType, gain: number, startDelayMs = 0) {
  const t0 = c.currentTime + startDelayMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(fromHz, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + durMs / 1000)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.05)
}

const COLOR_ROOT: Record<StarColor, number> = {
  yellow: 988,
  red: 1175,
  blue: 880,
}

/** Tiny sparkle chime per star earned. Higher amount → longer arpeggio. */
export function playStarEarn(color: StarColor, amount: number, bonus: number = 0) {
  if (typeof window === 'undefined') return
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') { try { void c.resume() } catch { /* noop */ } }

  const root = COLOR_ROOT[color]
  glide(c, root, root * 1.5, 110, 'sine', 0.14, 0)
  glide(c, root * 1.25, root * 2, 110, 'sine', 0.10, 50)
  if (amount >= 3) {
    tone(c, root * 2, 140, 'sine', 0.10, 110)
    tone(c, root * 2.5, 180, 'sine', 0.10, 180)
  }
  if (amount >= 5) {
    tone(c, root * 3, 220, 'sine', 0.10, 260)
  }
  if (bonus > 0) {
    // Fanfare: ascending major arpeggio with a glittering top note
    tone(c, root, 130, 'sine', 0.12, 320)
    tone(c, root * 1.26, 130, 'sine', 0.12, 430)
    tone(c, root * 1.5, 130, 'sine', 0.12, 540)
    tone(c, root * 2, 320, 'sine', 0.12, 650)
    tone(c, root * 3, 320, 'sine', 0.08, 720)
  }
}

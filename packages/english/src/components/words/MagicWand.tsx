'use client'

import { useId, useLayoutEffect, useRef, type RefObject } from 'react'

const MAGIC_GROW_MS = 200
const MAGIC_ROTATE_MS = 700
const MAGIC_ENTRY_MS = 260
export const MAGIC_ARRIVAL_MS = MAGIC_GROW_MS + MAGIC_ROTATE_MS + MAGIC_ENTRY_MS
export const MAGIC_CHARGE_MS = 64
export const MAGIC_REVEAL_DELAY_MS = 64
export const MAGIC_STAR_COLOR = '#a2eeff'
export const MAGIC_LETTER_MS = 400
export const MAGIC_TRAVEL_MS = 170

/** The button and enlarged performer share the same upright crystal artwork. */
export function CrystalWand({ className, width = 36, height = 65 }: {
  className?: string
  width?: number
  height?: number
}) {
  const id = useId()
  return (
    <svg aria-hidden width={width} height={height} style={{ width, height, maxWidth: 'none', flexShrink: 0, display: 'block' }} viewBox="0 0 80 145" className={className} fill="none">
      <defs>
        <linearGradient id={`${id}-shaft`} x1="33" y1="90" x2="47" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#364c75" /><stop offset=".4" stopColor="#c4e9f4" /><stop offset="1" stopColor="#52668e" />
        </linearGradient>
        <linearGradient id={`${id}-crystal`} x1="19" y1="4" x2="59" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0ffff" /><stop offset=".45" stopColor="#b4f1ff" /><stop offset="1" stopColor="#7796df" />
        </linearGradient>
      </defs>
      <rect x="35" y="52" width="10" height="89" rx="5" fill={`url(#${id}-shaft)`} />
      <path d="M35 128H45V136Q45 141 40 141Q35 141 35 136Z" fill="#a2dfee" />
      <path d="M40 2L62 20L55 48L40 63L25 48L18 20Z" fill={`url(#${id}-crystal)`} />
      <path d="M40 2L35 27L18 20Z" fill="#f2ffff" fillOpacity=".85" />
      <path d="M40 2L62 20L35 27Z" fill="#a8cde9" />
      <path d="M35 27L55 48L40 63Z" fill="#d8fbff" />
      <path d="M35 27L62 20L55 48Z" fill="#8bace5" fillOpacity=".7" />
      <path d="M18 20L35 27L25 48Z" fill="#85e0ef" />
      <ellipse cx="40" cy="33" rx="35" ry="11" stroke="#b5f3ff" strokeWidth="1.5" transform="rotate(-15 40 33)" />
      <rect x="28" y="55" width="24" height="12" rx="5" fill="#bce4ee" />
      <path d="M31 57H48" stroke="#efffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type MagicWandProps = {
  container: RefObject<HTMLDivElement | null>
  target: string
  burst: boolean
}

/** Decorative only: never writes or submits an answer. */
export default function MagicWand({ container, target, burst }: MagicWandProps) {
  const wand = useRef<HTMLDivElement>(null)
  const particles = useRef<HTMLDivElement>(null)
  const rotation = useRef<HTMLDivElement>(null)
  const previous = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const root = container.current
    const element = root?.querySelector<HTMLElement>(target)
    const sprite = wand.current
    if (!root || !element || !sprite) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bounds = root.getBoundingClientRect()
    const destination = element.getBoundingClientRect()
    const source = root.querySelector('[data-magic-source] svg')?.getBoundingClientRect() ?? destination
    const firstMove = previous.current === null
    // Start at the upper-left-facing button pose, then rotate the crystal down-left for casting.
    const from = previous.current ?? { x: source.left - bounds.left + source.width / 2 - 18, y: source.top - bounds.top + source.height / 2 - 14 }
    const to = { x: destination.left - bounds.left + destination.width / 2 - 18, y: destination.top - bounds.top - 34 }
    const pose = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`
    const animations: Animation[] = []
    sprite.style.transform = pose(to.x, to.y)
    if (!reduced) {
      const grownAt = MAGIC_GROW_MS / MAGIC_ARRIVAL_MS
      const rotatedAt = (MAGIC_GROW_MS + MAGIC_ROTATE_MS) / MAGIC_ARRIVAL_MS
      const ease = 'cubic-bezier(.45,0,.2,1)'
      const frames: Keyframe[] = firstMove ? [
        { transform: pose(from.x, from.y, source.height / 65), easing: ease },
        { transform: pose(from.x, from.y - 8), offset: grownAt },
        { transform: pose(from.x, from.y - 8), offset: rotatedAt, easing: ease },
        { transform: pose((from.x + to.x) / 2, Math.min(from.y, to.y) - 16), offset: rotatedAt + (1 - rotatedAt) / 2, easing: ease },
        { transform: pose(to.x, to.y) },
      ] : [
        { transform: pose(from.x, from.y) },
        { transform: pose((from.x + to.x) / 2, Math.min(from.y, to.y) - 6), offset: .5 },
        { transform: pose(to.x, to.y) },
      ]
      const movement = sprite.animate(frames, {
        duration: firstMove ? MAGIC_ARRIVAL_MS : MAGIC_TRAVEL_MS,
        easing: firstMove ? 'linear' : ease,
      })
      movement.onfinish = () => { previous.current = to }
      animations.push(movement)
      const handle = rotation.current
      if (handle) {
        const start = firstMove ? 'rotate(-25deg)' : getComputedStyle(handle).transform
        handle.style.transform = 'rotate(235deg)'
        animations.push(handle.animate(firstMove ? [
          { transform: start },
          { transform: start, offset: grownAt, easing: 'ease-in-out' },
          { transform: 'rotate(220deg)', offset: rotatedAt, easing: ease },
          { transform: 'rotate(235deg)' },
        ] : [{ transform: start }, { transform: 'rotate(235deg)' }], {
          duration: firstMove ? MAGIC_ARRIVAL_MS : MAGIC_TRAVEL_MS,
          easing: firstMove ? 'linear' : ease,
        }))
      }
    }
    if (reduced) previous.current = to
    // A cancelled intro (including Strict Mode's effect replay) has not arrived.
    return () => animations.forEach((animation) => animation.cancel())
  }, [container, target])

  // Casting and dust have their own lifetime: moving to the next letter must
  // not abruptly cut off the falling particles from the previous one.
  useLayoutEffect(() => {
    if (!burst) return
    const root = container.current
    const element = root?.querySelector<HTMLElement>(target)
    const handle = rotation.current
    const cloud = particles.current
    if (!root || !element || !handle || !cloud) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const bounds = root.getBoundingClientRect()
    const destination = element.getBoundingClientRect()
    const animations: Animation[] = []
    const start = getComputedStyle(handle).transform
    handle.style.transform = 'rotate(220deg)'
    const swing = handle.animate([
      { transform: start },
      { transform: 'rotate(205deg)', offset: .6 },
      { transform: 'rotate(220deg)' },
    ], { duration: 120, easing: 'ease-in-out' })
    animations.push(swing)
    if (burst && target.includes('slot') && !reduced) {
      const letter = element.querySelector('span')
      if (letter) animations.push(letter.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }))
    }
    Array.from(cloud.querySelectorAll('[data-particle-template]')).forEach((template, i) => {
      const particle = template.cloneNode(true) as HTMLElement
      particle.removeAttribute('data-particle-template')
      particle.style.left = `${destination.left - bounds.left + destination.width / 2}px`
      particle.style.top = `${destination.top - bounds.top - 20}px`
      cloud.appendChild(particle)
      const falling = particle.animate([
        { transform: 'translate(0, 0) scale(.3)', opacity: 0 },
        { opacity: 1, offset: .18 },
        { transform: `translate(${Math.sin(i * 2.4) * 22}px, ${22 + (i % 5) * 6}px) scale(.1)`, opacity: 0 },
      ], { duration: 560, delay: i * 5, easing: 'ease-out' })
      falling.onfinish = () => particle.remove()
      falling.oncancel = () => particle.remove()
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [container, target, burst])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 motion-reduce:hidden">
      <div ref={wand} style={{ width: 36, height: 65, transformOrigin: '18px 14px' }} className="absolute left-0 top-0 drop-shadow-[0_0_12px_rgba(162,238,255,.4)]">
        <div ref={rotation} style={{ width: 36, height: 65, transformOrigin: '18px 14px' }}><CrystalWand /></div>
      </div>
      <div ref={particles} style={{ color: MAGIC_STAR_COLOR }} className="absolute left-0 top-0 text-xs">
        {Array.from({ length: 24 }, (_, i) => <span key={i} data-particle-template className="absolute opacity-0 drop-shadow-[0_0_5px_rgba(162,238,255,.8)]">{i % 2 === 0 ? '✦' : '·'}</span>)}
      </div>
    </div>
  )
}

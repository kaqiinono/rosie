// 粒子画布，来自 bubble-wish-tree 演示：泡泡破裂、星光、水滴、花瓣、彩纸、飞行小球、萤火虫。
// 所有对外坐标都是浏览器视口坐标（clientX / clientY），内部换算成画布坐标。

import { gardenAudio } from './audio'

type Particle =
  | { kind: 'ring'; x: number; y: number; age: number; life: number; r0: number; r1: number; color: string }
  | { kind: 'shard'; x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; color: string }
  | { kind: 'spark'; x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; color: string; ph: number }
  | { kind: 'drop'; x: number; y: number; vx: number; vy: number; age: number; life: number; r: number }
  | { kind: 'petal'; x: number; y: number; vx: number; vy: number; age: number; life: number; rot: number; vr: number; ph: number; color: string }
  | { kind: 'conf'; x: number; y: number; vx: number; vy: number; age: number; life: number; rot: number; vr: number; color: string; w: number; h: number }
  | {
      kind: 'orb'
      x0: number
      y0: number
      cx: number
      cy: number
      x1: number
      y1: number
      x: number
      y: number
      t: number
      dur: number
      color: string
      r: number
      trail: { x: number; y: number }[]
      age: number
      life: number
      done: boolean
      onDone?: () => void
    }
  | { kind: 'firefly'; x: number; y: number; ph: number; age: number; life: number }

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const TAU = Math.PI * 2

export type SeedFlight = { id: string; x: number; y: number }

export class GardenFx {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private dpr = 1
  private w = 0
  private h = 0
  private left = 0
  private top = 0
  private parts: Particle[] = []
  private raf = 0
  private last = 0
  private petalTimer = 0
  private night = false
  private reduceMotion = false
  /** 环境花瓣从哪里飘下（视口坐标矩形），由场景提供 */
  private treeRect: () => DOMRect | null = () => null

  attach(canvas: HTMLCanvasElement, treeRect: () => DOMRect | null): void {
    this.treeRect = treeRect
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.resize()
    this.last = performance.now()
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.update(dt, now / 1000)
      this.draw(now / 1000)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  detach(): void {
    cancelAnimationFrame(this.raf)
    this.parts = []
    this.canvas = null
    this.ctx = null
  }

  resize(): void {
    const c = this.canvas
    if (!c || !this.ctx) return
    const rect = c.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = rect.width
    this.h = rect.height
    this.left = rect.left
    this.top = rect.top
    c.width = Math.max(1, Math.floor(this.w * this.dpr))
    c.height = Math.max(1, Math.floor(this.h * this.dpr))
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private local(x: number, y: number): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect()
    if (rect) {
      this.left = rect.left
      this.top = rect.top
    }
    return { x: x - this.left, y: y - this.top }
  }

  private add(p: Particle): void {
    if (this.parts.length < 560) this.parts.push(p)
  }

  setNight(night: boolean): void {
    if (this.night === night) return
    this.night = night
    this.parts = this.parts.filter((p) => p.kind !== 'firefly')
    if (night && !this.reduceMotion) {
      for (let i = 0; i < 9; i += 1) {
        this.add({ kind: 'firefly', x: rand(0.08, 0.92) * this.w, y: rand(0.3, 0.8) * this.h, ph: rand(0, 9), age: 0, life: 1e9 })
      }
    }
  }

  burst(cx: number, cy: number, color: string): void {
    const { x, y } = this.local(cx, cy)
    this.add({ kind: 'ring', x, y, age: 0, life: 0.38, r0: 8, r1: 74, color })
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU + rand(-0.2, 0.2)
      const sp = rand(130, 330)
      this.add({
        kind: 'shard',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        age: 0,
        life: rand(0.45, 0.8),
        r: rand(2.5, 5.5),
        color: i % 3 ? color : '#ffffff',
      })
    }
    this.sparkleLocal(x, y, 6, '#fff3c4')
  }

  private sparkleLocal(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i += 1) {
      this.add({
        kind: 'spark',
        x: x + rand(-26, 26),
        y: y + rand(-26, 26),
        vx: rand(-14, 14),
        vy: rand(-34, -8),
        age: 0,
        life: rand(0.5, 0.9),
        r: rand(3, 7),
        color,
        ph: rand(0, 6),
      })
    }
  }

  sparkle(cx: number, cy: number, n = 6, color = '#ffe082'): void {
    const { x, y } = this.local(cx, cy)
    this.sparkleLocal(x, y, n, color)
  }

  droplets(cx: number, cy: number): void {
    const { x, y } = this.local(cx, cy)
    for (let i = 0; i < 8; i += 1) {
      this.add({ kind: 'drop', x: x + rand(-22, 22), y: y - rand(34, 60), vx: rand(-8, 8), vy: rand(30, 80), age: 0, life: rand(0.4, 0.6), r: rand(2.5, 4.5) })
    }
  }

  petals(cx: number, cy: number, n = 8): void {
    const { x, y } = this.local(cx, cy)
    for (let i = 0; i < n; i += 1) {
      this.add({
        kind: 'petal',
        x: x + rand(-14, 14),
        y: y + rand(-10, 10),
        vx: rand(-26, 26),
        vy: rand(24, 60),
        age: 0,
        life: rand(1.6, 2.6),
        rot: rand(0, 6.3),
        vr: rand(-3, 3),
        ph: rand(0, 6),
        color: pick(['#ffb3cd', '#ffc9de', '#ffe3ee']),
      })
    }
  }

  confetti(cx: number, cy: number): void {
    const { x, y } = this.local(cx, cy)
    const colors = ['#ff6b9d', '#4dabf7', '#ffd54a', '#51cf66', '#9775fa', '#ff922b']
    for (let i = 0; i < 70; i += 1) {
      this.add({
        kind: 'conf',
        x: x + rand(-30, 30),
        y,
        vx: rand(-270, 270),
        vy: rand(-390, -90),
        age: 0,
        life: rand(1.5, 2.4),
        rot: rand(0, 6.3),
        vr: rand(-9, 9),
        color: pick(colors),
        w: rand(5, 8),
        h: rand(8, 13),
      })
    }
  }

  prefersReducedMotion(): boolean {
    return this.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * 金色种子飞到花位。减少动效时不飞、不撒火花，立刻落地并播一次开花音。
   * 正常动效下每颗种子落地时撒一小团火花并播开花音。
   */
  flySeeds(fromX: number, fromY: number, seeds: SeedFlight[], onLand: (seed: SeedFlight) => void): void {
    if (seeds.length === 0) return
    if (this.prefersReducedMotion()) {
      for (const seed of seeds) onLand(seed)
      gardenAudio.bloom()
      return
    }
    seeds.forEach((seed, index) => {
      this.orb(fromX, fromY, seed.x, seed.y, '#ffe082', 8, 0.9 + index * 0.12, () => {
        this.sparkle(seed.x, seed.y, 10, '#ffffff')
        gardenAudio.bloom()
        onLand(seed)
      })
    })
  }

  /** 一个沿弧线飞向目标的小球，到达时回调 */
  orb(fromX: number, fromY: number, toX: number, toY: number, color: string, r: number, dur: number, onDone?: () => void): void {
    const a = this.local(fromX, fromY)
    const b = this.local(toX, toY)
    this.add({
      kind: 'orb',
      x0: a.x,
      y0: a.y,
      cx: (a.x + b.x) / 2 + rand(-40, 40),
      cy: Math.min(a.y, b.y) - rand(70, 130),
      x1: b.x,
      y1: b.y,
      x: a.x,
      y: a.y,
      t: 0,
      dur,
      color,
      r,
      trail: [],
      age: 0,
      life: dur + 0.2,
      done: false,
      onDone,
    })
  }

  private update(dt: number, t: number): void {
    this.petalTimer += dt
    if (this.petalTimer > 2.7 && !this.night && !this.reduceMotion) {
      this.petalTimer = 0
      const tr = this.treeRect()
      if (tr) {
        const p = this.local(tr.left + rand(0.2, 0.8) * tr.width, tr.top + rand(0.1, 0.4) * tr.height)
        this.add({
          kind: 'petal',
          x: p.x,
          y: p.y,
          vx: rand(-22, 22),
          vy: rand(22, 46),
          age: 0,
          life: rand(3, 4.5),
          rot: rand(0, 6.3),
          vr: rand(-2, 2),
          ph: rand(0, 6),
          color: pick(['#ffb3cd', '#ffffff', '#ffc9de']),
        })
      }
    }
    for (const p of this.parts) {
      p.age += dt
      switch (p.kind) {
        case 'shard':
          p.vy += 320 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          break
        case 'spark':
          p.x += p.vx * dt
          p.y += p.vy * dt
          break
        case 'drop':
          p.vy += 520 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          break
        case 'petal':
          p.x += (p.vx + Math.sin(t * 2 + p.ph) * 22) * dt
          p.y += p.vy * dt
          p.rot += p.vr * dt
          break
        case 'conf':
          p.vy += 640 * dt
          p.vx *= 0.99
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.rot += p.vr * dt
          break
        case 'orb': {
          p.t = Math.min(1, p.t + dt / p.dur)
          const u = 1 - p.t
          p.x = u * u * p.x0 + 2 * u * p.t * p.cx + p.t * p.t * p.x1
          p.y = u * u * p.y0 + 2 * u * p.t * p.cy + p.t * p.t * p.y1
          p.trail.push({ x: p.x, y: p.y })
          if (p.trail.length > 7) p.trail.shift()
          if (p.t >= 1 && !p.done) {
            p.done = true
            p.age = p.life
            p.onDone?.()
          }
          break
        }
        case 'firefly':
          p.x += Math.sin(t * 0.6 + p.ph) * 0.5
          p.y += Math.cos(t * 0.45 + p.ph * 1.3) * 0.35
          break
        default:
          break
      }
    }
    this.parts = this.parts.filter((p) => (p.kind === 'firefly' ? this.night : p.age < p.life))
  }

  private draw(t: number): void {
    const c = this.ctx
    if (!c) return
    c.clearRect(0, 0, this.w, this.h)
    for (const p of this.parts) {
      const k = 1 - p.age / p.life
      switch (p.kind) {
        case 'ring': {
          const r = p.r0 + (p.r1 - p.r0) * (p.age / p.life)
          c.globalAlpha = k * 0.8
          c.strokeStyle = p.color
          c.lineWidth = 3.5 * k + 0.5
          c.beginPath()
          c.arc(p.x, p.y, r, 0, TAU)
          c.stroke()
          break
        }
        case 'shard':
          c.globalAlpha = k
          c.fillStyle = p.color
          c.beginPath()
          c.arc(p.x, p.y, p.r * k + 0.6, 0, TAU)
          c.fill()
          break
        case 'spark': {
          c.globalAlpha = k * (0.6 + 0.4 * Math.sin(t * 14 + p.ph))
          c.fillStyle = p.color
          const r = p.r
          c.beginPath()
          c.moveTo(p.x, p.y - r)
          c.quadraticCurveTo(p.x, p.y, p.x + r, p.y)
          c.quadraticCurveTo(p.x, p.y, p.x, p.y + r)
          c.quadraticCurveTo(p.x, p.y, p.x - r, p.y)
          c.quadraticCurveTo(p.x, p.y, p.x, p.y - r)
          c.fill()
          break
        }
        case 'drop':
          c.globalAlpha = k
          c.fillStyle = '#74c0fc'
          c.beginPath()
          c.ellipse(p.x, p.y, p.r * 0.7, p.r, 0, 0, TAU)
          c.fill()
          break
        case 'petal':
          c.globalAlpha = Math.min(1, k * 2.2) * 0.9
          c.fillStyle = p.color
          c.save()
          c.translate(p.x, p.y)
          c.rotate(p.rot)
          c.beginPath()
          c.ellipse(0, 0, 7, 4, 0, 0, TAU)
          c.fill()
          c.restore()
          break
        case 'conf':
          c.globalAlpha = Math.min(1, k * 2)
          c.fillStyle = p.color
          c.save()
          c.translate(p.x, p.y)
          c.rotate(p.rot)
          c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          c.restore()
          break
        case 'orb': {
          for (let i = 0; i < p.trail.length; i += 1) {
            const tr = p.trail[i]
            c.globalAlpha = (i / p.trail.length) * 0.35
            c.fillStyle = p.color
            c.beginPath()
            c.arc(tr.x, tr.y, p.r * (i / p.trail.length) * 0.8, 0, TAU)
            c.fill()
          }
          // 平涂的小球：一圈浅色外晕 + 实心主体 + 白色高光点
          c.globalAlpha = 0.35
          c.fillStyle = p.color
          c.beginPath()
          c.arc(p.x, p.y, p.r * 1.7, 0, TAU)
          c.fill()
          c.globalAlpha = 1
          c.beginPath()
          c.arc(p.x, p.y, p.r, 0, TAU)
          c.fill()
          c.fillStyle = '#ffffff'
          c.beginPath()
          c.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.35, 0, TAU)
          c.fill()
          break
        }
        case 'firefly': {
          const a = 0.35 + 0.3 * Math.sin(t * 2.2 + p.ph)
          c.globalAlpha = a * 0.5
          c.fillStyle = '#fff0a0'
          c.beginPath()
          c.arc(p.x, p.y, 8, 0, TAU)
          c.fill()
          c.globalAlpha = Math.min(1, a + 0.3)
          c.beginPath()
          c.arc(p.x, p.y, 3, 0, TAU)
          c.fill()
          break
        }
        default:
          break
      }
    }
    c.globalAlpha = 1
  }
}

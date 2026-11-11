import * as THREE from 'three'
import { clamp01, easeOutCubic, easeOutExpo, mulberry32 } from './ease'
import type { TweenRunner } from './tween'

// ───────────────────────────────────────────────────────────────────────────────
// 物理：摘下的果实 → 抛物线下落 → 落地挤开石头堆
//
// 刻意不引入物理引擎（cannon / rapier）：
//   · 孩子的游戏要的是「可预期、可调的手感」，不是真实碰撞；
//   · 解析抛物线 + 两次衰减弹跳 + 石头位移的 easeOutExpo，调参更直接，包体积为 0。
//
// ── 调参速查 ──────────────────────────────────────────────────────────────────
//  gravity 7–12            比真实 9.8 稍小 → 轻盈、给孩子时间看清落点。
//  restitution 0.3–0.42    弹性。> 0.5 会像橡皮球；< 0.2 像铅块。
//  PILE push 0.12–0.3      挤开最大位移（世界单位）。「微小位移」：约等于石头直径的 0.5–1 倍。
//  PILE reach 0.45–0.8     影响半径，exp(-d/reach) 衰减。小 = 只推最近的几颗，大 = 整堆一起晃。
//  settle 0.3–0.5          冲击后回弹比例：最终保留 settle×峰值位移，作为「被挤过」的痕迹。
//  squash 0.1–0.2          落地瞬间的压扁。不要为 0，那是刚体的感觉。
// ───────────────────────────────────────────────────────────────────────────────

export interface LandingEvent {
  point: THREE.Vector3
  /** 落地速度（世界单位 / 秒） */
  speed: number
  bounce: number
}

export interface FruitPhysicsOptions {
  gravity?: number
  restitution?: number
  groundY?: number
  maxBounces?: number
  squash?: number
  onLand?: (event: LandingEvent) => void
  onSettled?: (point: THREE.Vector3) => void
}

/** 抛物线运动的果实。 */
export class FallingFruit {
  private readonly pos = new THREE.Vector3()
  private readonly vel = new THREE.Vector3()
  private readonly spin = new THREE.Vector3()
  private bounce = 0
  private squashT = 1 // 1 = 已恢复
  private squashAmp = 0
  private active = false
  private readonly baseScale: THREE.Vector3

  private readonly gravity: number
  private readonly restitution: number
  private groundY: number
  private readonly maxBounces: number
  private readonly squash: number

  constructor(
    private readonly object: THREE.Object3D,
    private readonly opts: FruitPhysicsOptions = {},
  ) {
    this.gravity = opts.gravity ?? 9
    this.restitution = opts.restitution ?? 0.36
    this.groundY = opts.groundY ?? 0
    this.maxBounces = opts.maxBounces ?? 2
    this.squash = opts.squash ?? 0.16
    this.baseScale = object.scale.clone()
  }

  get isActive(): boolean {
    return this.active
  }

  /**
   * 从 from 抛向 to，flightTime 秒后第一次落地。
   * 抛物线 p(t) = p0 + v0·t + ½·g·t²，要求 p(T) = to：
   *   v0.xz = (to - p0).xz / T
   *   v0.y  = (to.y - p0.y + ½·g·T²) / T
   */
  launch(from: THREE.Vector3, to: THREE.Vector3, flightTime = 0.75): void {
    this.pos.copy(from)
    this.groundY = to.y
    this.vel.set(
      (to.x - from.x) / flightTime,
      (to.y - from.y + 0.5 * this.gravity * flightTime * flightTime) / flightTime,
      (to.z - from.z) / flightTime,
    )
    this.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6)
    this.bounce = 0
    this.squashT = 1
    this.active = true
    this.object.position.copy(this.pos)
  }

  update(dt: number): void {
    // 弹跳碰撞判定对步长敏感：切成不超过 1/90s 的子步。
    let remaining = Math.min(dt, 0.1)
    while (remaining > 0 && this.active) {
      const h = Math.min(remaining, 1 / 90)
      remaining -= h
      this.step(h)
    }

    // 压扁恢复：1→0 的 squashT，体积守恒（y 压扁 s，xz 外扩 1/√(1-s)）。
    if (this.squashT < 1) {
      this.squashT = clamp01(this.squashT + dt / 0.28)
      const s = this.squashAmp * (1 - easeOutCubic(this.squashT)) * Math.cos(this.squashT * 9) // 带一点回弹振荡
      const sy = 1 - s
      const sxz = 1 / Math.sqrt(Math.max(sy, 0.2))
      this.object.scale.set(this.baseScale.x * sxz, this.baseScale.y * sy, this.baseScale.z * sxz)
    } else {
      this.object.scale.copy(this.baseScale)
    }
  }

  private step(h: number): void {
    this.vel.y -= this.gravity * h
    this.pos.addScaledVector(this.vel, h)
    this.object.rotation.x += this.spin.x * h
    this.object.rotation.y += this.spin.y * h
    this.object.rotation.z += this.spin.z * h

    if (this.pos.y <= this.groundY && this.vel.y < 0) {
      this.pos.y = this.groundY
      const impact = Math.abs(this.vel.y)
      this.opts.onLand?.({
        point: this.pos.clone(),
        speed: Math.hypot(impact, this.vel.x, this.vel.z),
        bounce: this.bounce,
      })

      this.squashAmp = Math.min(this.squash * (impact / 5), this.squash * 1.6)
      this.squashT = 0

      if (this.bounce >= this.maxBounces || impact * this.restitution < 0.7) {
        this.active = false
        this.object.position.copy(this.pos)
        this.opts.onSettled?.(this.pos.clone())
        return
      }
      this.bounce += 1
      this.vel.y = impact * this.restitution
      this.vel.x *= 0.55
      this.vel.z *= 0.55
      this.spin.multiplyScalar(0.5)
    }
    this.object.position.copy(this.pos)
  }
}

// ───────────────────────────── 石头堆 ─────────────────────────────

interface PileStone {
  object: THREE.Object3D
  rest: THREE.Vector3
  restRot: THREE.Euler
  offset: THREE.Vector3
  tilt: number
}

export interface PileOptions {
  /** 最大位移（世界单位）。 */
  push?: number
  /** 影响半径。 */
  reach?: number
  /** 冲击后保留的位移比例。 */
  settle?: number
}

/**
 * 石头堆：对一组 Mesh（通常是 THREE.Group 的子节点）施加「基于距离的挤压」。
 * 所有坐标均为 group 局部坐标；调用方负责把世界落点转换进来（group.worldToLocal）。
 */
export class StonePile {
  private readonly stones: PileStone[] = []
  private readonly rand = mulberry32(7)
  private readonly push: number
  private readonly reach: number
  private readonly settle: number

  constructor(
    private readonly group: THREE.Group,
    private readonly tweens: TweenRunner,
    opts: PileOptions = {},
  ) {
    this.push = opts.push ?? 0.2
    this.reach = opts.reach ?? 0.6
    this.settle = opts.settle ?? 0.4
    for (const child of group.children) this.register(child)
  }

  get count(): number {
    return this.stones.length
  }

  register(object: THREE.Object3D): void {
    this.stones.push({
      object,
      rest: object.position.clone(),
      restRot: object.rotation.clone(),
      offset: new THREE.Vector3(),
      tilt: (this.rand() - 0.5) * 0.9,
    })
  }

  /** 把新石头加入堆（落地的果实变成石头）。 */
  add(object: THREE.Object3D): void {
    this.group.add(object)
    this.register(object)
  }

  /**
   * 落点 point（group 局部）冲击强度 impact（约 0.5–1.5）。
   *   位移幅度  m_i = push · impact · exp(-d_i / reach)         （距离越远越小）
   *   位移方向  从落点指向石头（水平），y 方向再抬一点点 → 被挤起来
   *   时间曲线  easeOutExpo 冲出去（一下子顶开）→ easeOutCubic 回弹到 settle 比例（慢慢安顿）
   * 两段不同的缓动是「自然挤压」的关键：只用一条曲线会像弹簧玩具。
   */
  receive(point: THREE.Vector3, impact = 1): void {
    const peaks = this.stones.map((s) => {
      const dx = s.rest.x - point.x
      const dz = s.rest.z - point.z
      const dist = Math.hypot(dx, dz)
      const mag = this.push * impact * Math.exp(-dist / this.reach)
      // 正好落在石头正上方时没有方向，随机给一个
      const dir =
        dist > 1e-3
          ? new THREE.Vector3(dx / dist, 0, dz / dist)
          : new THREE.Vector3(Math.cos(this.rand() * 6.283), 0, Math.sin(this.rand() * 6.283))
      return { dir, mag, lift: mag * 0.35 }
    })

    // 阶段 1：顶开
    this.tweens.add({
      duration: 0.38,
      ease: easeOutExpo,
      onUpdate: (k) => this.apply(peaks, k, 1),
      onComplete: () => {
        // 阶段 2：回弹到 settle 比例
        this.tweens.add({
          duration: 0.9,
          ease: easeOutCubic,
          onUpdate: (k) => this.apply(peaks, 1, 1 - k * (1 - this.settle)),
          onComplete: () => {
            // 把「被挤过」的位置固化成新的静止位置，下次挤压从这里出发（石头会慢慢被推散，而不是每次都弹回原点）
            this.stones.forEach((s, i) => {
              s.rest.addScaledVector(peaks[i].dir, peaks[i].mag * this.settle)
              s.object.position.copy(s.rest)
              s.restRot.copy(s.object.rotation)
            })
          },
        })
      },
    })
  }

  private apply(
    peaks: { dir: THREE.Vector3; mag: number; lift: number }[],
    k: number,
    hold: number,
  ): void {
    this.stones.forEach((s, i) => {
      const p = peaks[i]
      const amount = k * hold
      s.object.position.set(
        s.rest.x + p.dir.x * p.mag * amount,
        s.rest.y + p.lift * Math.sin(Math.min(k, 1) * Math.PI) * hold, // 顶开途中微微抬起、再落下
        s.rest.z + p.dir.z * p.mag * amount,
      )
      // 被推的石头顺着推力方向微微滚动
      s.object.rotation.set(
        s.restRot.x + p.dir.z * p.mag * amount * 2.2,
        s.restRot.y,
        s.restRot.z - p.dir.x * p.mag * amount * 2.2 + s.tilt * 0.02 * amount,
      )
    })
  }
}

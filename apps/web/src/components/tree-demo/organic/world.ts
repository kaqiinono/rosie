import * as THREE from 'three'
import { STONE_PILES, type SubjectKey } from '../data'
import { createBarkMaterial, TrunkRings, type BarkHandle } from './barkMaterial'
import { BubbleSpring, createBubbleMaterial, type BubbleHandle } from './bubbleMaterial'
import { clamp01, easeInOutSine, easeOutBack, lerp } from './ease'
import { FallingFruit, StonePile, type LandingEvent } from './fruitPhysics'
import {
  applyGemPreset,
  appleVariant,
  createGemMaterial,
  GEM_PRESETS,
  type GemHandle,
} from './gemMaterial'
import {
  createBranchGeometry,
  createBubbleGeometry,
  createGemGeometry,
  createTrunkGeometry,
} from './geometry'
import {
  BRANCH_HEIGHTS,
  BRANCH_LENGTH,
  BUBBLE_SPOTS,
  HISTORY_HEIGHTS,
  HISTORY_LENGTH,
  PILE_SPOTS,
  TRUNK_HEIGHT,
  TRUNK_R_BOTTOM,
  TRUNK_R_TOP,
  trunkRadiusAt,
} from './layout'
import { createRippleMaterial, type RippleHandle } from './rippleMaterial'
import { growBranch, startMidnightRollover } from './rollover'
import { TweenRunner } from './tween'

// 把所有「非 React」的东西收在一起：材质、补间、弹簧、物理。
// React 场景只负责把这些对象摆到场景树里，并在 useFrame 里调一次 world.update(dt)。
// 这样动效数值直接写 uniform，不触发任何 React 重渲染。

export interface BranchEntry {
  history: boolean
  geometry: THREE.BufferGeometry
  bark: BarkHandle
  /** 彩枝网格，由 React 挂载后回填。 */
  mesh: THREE.Object3D | null
  /** 枝上挂的花 / 果 / 苞，缩回时跟着收拢。 */
  items: THREE.Object3D | null
  junctionY: number
}

export interface AppleEntry {
  subject: SubjectKey | 'rainbow'
  object: THREE.Object3D
  plucked: boolean
}

interface PileEntry {
  group: THREE.Group | null
  pile: StonePile | null
  count: number
}

interface FruitSlot {
  mesh: THREE.Mesh
  gem: GemHandle
  fruit: FallingFruit
  busy: boolean
  subject: SubjectKey
}

export interface WorldOptions {
  /** 七根彩枝的周几颜色 */
  branchColors: string[]
  reducedMotion: boolean
}

const FRUIT_POOL = 3
const STONE_RADIUS = 0.24

export class OrganicTimeTreeWorld {
  readonly tweens = new TweenRunner()
  readonly gemGeometry = createGemGeometry(3)
  readonly bubbleGeometry = createBubbleGeometry()
  readonly trunkGeometry = createTrunkGeometry(TRUNK_HEIGHT, TRUNK_R_TOP, TRUNK_R_BOTTOM)
  readonly rippleGeometry = new THREE.PlaneGeometry(2, 2)

  readonly trunk: BarkHandle = createBarkMaterial({
    kind: 'trunk',
    length: TRUNK_HEIGHT,
    seed: 3.7,
  })
  readonly rings = new TrunkRings(this.trunk.uniforms)
  readonly ripple: RippleHandle = createRippleMaterial(0.5, 2.3)
  rippleObject: THREE.Object3D | null = null

  /** 前 7 个是彩枝（下标 0 = 最老 = 今天），后 4 个是已衰老的历史枝。 */
  readonly branches: BranchEntry[]
  readonly bubbles: { handle: BubbleHandle; spring: BubbleSpring }[]
  readonly apples = new Map<string, AppleEntry>()
  readonly piles: Record<SubjectKey, PileEntry>
  readonly fruitRoot = new THREE.Group()

  /** 石头堆数量变化（落地的果实变成石头后）。 */
  onPileCount?: (subject: SubjectKey, count: number) => void

  private readonly slots: FruitSlot[] = []
  private readonly reduced: boolean
  private time = 0
  private rolloverBusy = false

  constructor(opts: WorldOptions) {
    this.reduced = opts.reducedMotion

    // 树干：初始年轮（树干上已有的圈）
    for (let i = 0; i < 4; i++) this.rings.addRing(0.85 + i * 0.4)

    // 彩枝
    const live = BRANCH_HEIGHTS.map<BranchEntry>((h, i) => ({
      history: false,
      geometry: createBranchGeometry(BRANCH_LENGTH, 0.2, 0.1),
      bark: createBarkMaterial({
        kind: 'branch',
        length: BRANCH_LENGTH,
        seed: 11 + i * 2.3,
        tint: opts.branchColors[i],
      }),
      mesh: null,
      items: null,
      junctionY: h,
    }))
    const old = HISTORY_HEIGHTS.map<BranchEntry>((h, i) => {
      const entry: BranchEntry = {
        history: true,
        geometry: createBranchGeometry(HISTORY_LENGTH, 0.11, 0.06),
        bark: createBarkMaterial({ kind: 'branch', length: HISTORY_LENGTH, seed: 31 + i * 1.9 }),
        mesh: null,
        items: null,
        junctionY: h,
      }
      // 历史枝：整根已衰老、细、半透明的亚麻褐。
      entry.bark.uniforms.uAge.value = 1
      entry.bark.uniforms.uRadiusScale.value = 0.72
      return entry
    })
    this.branches = [...live, ...old]

    // 泡泡
    this.bubbles = BUBBLE_SPOTS.map((spot, i) => {
      const handle = createBubbleMaterial(1 + i * 3.1)
      return { handle, spring: new BubbleSpring(handle.uniforms, { x: spot[0], z: spot[2] }) }
    })

    // 石头堆
    this.piles = {
      chinese: this.emptyPile(),
      math: this.emptyPile(),
      english: this.emptyPile(),
      life: this.emptyPile(),
    }
    for (const p of STONE_PILES) this.piles[p.subject].count = p.count

    // 果实对象池
    for (let i = 0; i < FRUIT_POOL; i++) {
      const gem = createGemMaterial({
        preset: GEM_PRESETS.chinese,
        seed: 5 + i * 2,
        radius: STONE_RADIUS + 0.02,
        apple: 1,
      })
      const mesh = new THREE.Mesh(this.gemGeometry, gem.material)
      mesh.visible = false
      mesh.frustumCulled = false
      this.fruitRoot.add(mesh)
      const fruit = new FallingFruit(mesh, {
        gravity: 9,
        restitution: 0.36,
        onLand: (e) => this.onFruitLand(i, e),
        onSettled: (p) => this.onFruitSettled(i, p),
      })
      this.slots.push({ mesh, gem, fruit, busy: false, subject: 'chinese' })
    }
  }

  private emptyPile(): PileEntry {
    return { group: null, pile: null, count: 0 }
  }

  // ───────── React 回填 ─────────

  setBranchMesh(index: number, mesh: THREE.Object3D | null): void {
    this.branches[index].mesh = mesh
  }

  setBranchItems(index: number, items: THREE.Object3D | null): void {
    this.branches[index].items = items
  }

  setRippleObject(object: THREE.Object3D | null): void {
    this.rippleObject = object
  }

  setPileCountListener(listener: ((subject: SubjectKey, count: number) => void) | undefined): void {
    this.onPileCount = listener
  }

  registerApple(id: string, subject: AppleEntry['subject'], object: THREE.Object3D): void {
    this.apples.set(id, { subject, object, plucked: false })
  }

  unregisterApple(id: string): void {
    this.apples.delete(id)
  }

  attachPile(subject: SubjectKey, group: THREE.Group | null): void {
    const entry = this.piles[subject]
    if (entry.group !== group) entry.pile = null
    entry.group = group
  }

  // ───────── 每帧 ─────────

  update(dt: number): void {
    this.time += dt
    const t = this.time
    this.tweens.update(dt)
    this.trunk.uniforms.uTime.value = t
    this.rings.update(dt)
    this.ripple.uniforms.uTime.value = t
    for (const b of this.branches) b.bark.uniforms.uTime.value = t
    if (!this.reduced) for (const b of this.bubbles) b.spring.update(dt, t)
    for (const s of this.slots) if (s.busy) s.fruit.update(dt)
  }

  // ───────── 0 点结算 ─────────

  get isRollingOver(): boolean {
    return this.rolloverBusy
  }

  /** 触发 0 点：最老的一根彩枝衰老 → 缩回 → 年轮涟漪。 */
  rollover(): boolean {
    const oldest = this.branches[0]
    if (this.rolloverBusy || !oldest.mesh || !oldest.mesh.visible || !this.rippleObject)
      return false
    this.rolloverBusy = true
    this.ripple.uniforms.uInnerR.value = trunkRadiusAt(oldest.junctionY) * 1.02
    startMidnightRollover(
      this.tweens,
      {
        branch: oldest.bark.uniforms,
        branchObject: oldest.mesh,
        junctionY: oldest.junctionY,
        rippleObject: this.rippleObject,
        ripple: this.ripple.uniforms,
        rings: this.rings,
      },
      {
        onRetract: (k) => oldest.items?.scale.setScalar(Math.max(1 - k, 0.0001)),
        onDone: () => {
          this.rolloverBusy = false
        },
      },
    )
    return true
  }

  /** 新的一天：被收走的那根枝以「第 7 天」的身份重新长出来。 */
  newDay(): boolean {
    const b = this.branches[0]
    if (this.rolloverBusy || !b.mesh || b.mesh.visible) return false
    growBranch(this.tweens, b.bark.uniforms, b.mesh)
    const items = b.items
    if (items) {
      items.scale.setScalar(0.0001)
      this.tweens.add({
        delay: 0.5,
        duration: 0.8,
        ease: (k) => easeOutBack(k, 1.3),
        onUpdate: (k) => items.scale.setScalar(Math.max(k, 0.0001)),
      })
    }
    return true
  }

  // ───────── 摘果 ─────────

  /** 摘一颗 subject 学科的苹果：抛物线落到对应石头堆前，挤开石头，然后化作新石头。 */
  pluck(subject: SubjectKey): boolean {
    const entry = this.piles[subject]
    const group = entry.group
    const slot = this.slots.find((s) => !s.busy)
    if (!group || !slot) return false

    slot.busy = true
    slot.subject = subject
    const u = slot.gem.uniforms
    applyGemPreset(u, appleVariant(GEM_PRESETS[subject]))
    u.uApple.value = 1
    u.uFlash.value = 0
    slot.mesh.visible = true
    slot.mesh.rotation.set(0, 0, 0)
    slot.mesh.scale.set(1, 1, 1)

    // 起点：树上这个学科的第一颗没摘的苹果；没有就从树冠上方「掉」一颗。
    const from = new THREE.Vector3()
    const apple = [...this.apples.values()].find((a) => a.subject === subject && !a.plucked)
    if (apple) {
      apple.object.updateWorldMatrix(true, false)
      apple.object.getWorldPosition(from)
      from.y -= 0.46
      apple.plucked = true
      apple.object.visible = false
    } else {
      from.set(PILE_SPOTS[subject][0] * 0.35, 6.4, 0.4)
    }

    const spot = PILE_SPOTS[subject]
    const target = new THREE.Vector3(
      spot[0] + (Math.random() - 0.5) * 0.7,
      0.25,
      spot[2] + 0.62 + Math.random() * 0.2,
    )
    slot.fruit.launch(from, target, 0.85)
    return true
  }

  private ensurePile(subject: SubjectKey): StonePile | null {
    const entry = this.piles[subject]
    if (!entry.group) return null
    if (!entry.pile)
      entry.pile = new StonePile(entry.group, this.tweens, { push: 0.2, reach: 0.6, settle: 0.4 })
    return entry.pile
  }

  private onFruitLand(index: number, e: LandingEvent): void {
    const slot = this.slots[index]
    const entry = this.piles[slot.subject]
    const pile = this.ensurePile(slot.subject)
    if (!pile || !entry.group) return
    entry.group.updateWorldMatrix(true, false)
    const local = entry.group.worldToLocal(e.point.clone())
    // 首次落地冲击最大，之后每次小弹跳只有 35%。
    const impact = THREE.MathUtils.clamp(e.speed / 6, 0.35, 1.4) * (e.bounce === 0 ? 1 : 0.35)
    pile.receive(local, impact)
  }

  private onFruitSettled(index: number, point: THREE.Vector3): void {
    const slot = this.slots[index]
    const subject = slot.subject
    const preset = GEM_PRESETS[subject]
    const apple = appleVariant(preset)
    const u = slot.gem.uniforms

    // 果实化石：苹果造型 → 鹅卵石，条带从弱到强，伴随一闪暖光。
    this.tweens.add({
      duration: 0.9,
      ease: easeInOutSine,
      onUpdate: (k) => {
        u.uApple.value = 1 - clamp01(k)
        u.uBandMix.value = lerp(apple.bandMix, preset.bandMix, k)
        u.uBandFreq.value = lerp(apple.bandFreq, preset.bandFreq, k)
        u.uWarp.value = lerp(apple.warp, preset.warp, k)
        u.uFlash.value = Math.sin(clamp01(k) * Math.PI) * 0.22
      },
      onComplete: () => {
        const entry = this.piles[subject]
        const pile = this.ensurePile(subject)
        if (pile && entry.group) {
          entry.group.updateWorldMatrix(true, false)
          const local = entry.group.worldToLocal(point.clone())
          const gem = createGemMaterial({ preset, seed: Math.random() * 20, radius: STONE_RADIUS })
          const stone = new THREE.Group()
          stone.add(new THREE.Mesh(this.gemGeometry, gem.material))
          stone.position.set(local.x, 0.2, local.z)
          stone.rotation.y = Math.random() * Math.PI * 2
          pile.add(stone)
          entry.count += 1
          this.onPileCount?.(subject, entry.count)
        }
        slot.mesh.visible = false
        slot.busy = false
      },
    })
  }

  dispose(): void {
    this.tweens.clear()
    this.gemGeometry.dispose()
    this.bubbleGeometry.dispose()
    this.trunkGeometry.dispose()
    this.rippleGeometry.dispose()
    this.trunk.material.dispose()
    this.ripple.material.dispose()
    for (const b of this.branches) {
      b.geometry.dispose()
      b.bark.material.dispose()
    }
    for (const b of this.bubbles) b.handle.material.dispose()
    for (const s of this.slots) s.gem.material.dispose()
  }
}

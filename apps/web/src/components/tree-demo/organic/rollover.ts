import type * as THREE from 'three'
import type { BarkUniforms, TrunkRings } from './barkMaterial'
import { easeInCubic, easeInOutSine, easeOutBack, easeOutExpo, lerp } from './ease'
import type { RippleUniforms } from './rippleMaterial'
import type { TweenRunner } from './tween'

// ───────────────────────────────────────────────────────────────────────────────
// 0 点结算：最老的一根彩枝「衰老 → 缩回树干 → 年轮涟漪」
//
// 时间线（默认参数，总长约 4.6s）：
//
//   0.0s ─────── 2.6s   ① 衰老：uAge 0→1（easeInOutSine）
//                          衰老前沿沿 X 轴从枝梢扫向树干；经过之处 Opacity↓、Saturation↓，
//                          并被染成亚麻褐。同时枝慢慢变细（uRadiusScale 1→0.7）。
//   2.0s ─────── 3.3s   ② 缩回：uGrow 1→0（easeInCubic：起初慢，越缩越快，像被吸回去）
//   3.3s ─────── 5.3s   ③ 涟漪：交界处环形光波向外扩散（easeOutExpo 先快后慢）
//   3.3s                    树皮在交界高度透出暖光脉冲
//   3.8s                    年轮刻痕永久留在树干上
//
// ①② 重叠 0.6s：衰老还没扫完枝根就开始缩回，动作是连贯的，而不是「一步一步」。
//
// ── 调参速查 ──────────────────────────────────────────────────────────────────
//  ageDuration / retractDelay  想让孩子看清「颜色从外往里褪」就把 ageDuration 拉到 3–3.5s。
//  retractEase                 easeInCubic 像「被吸回」；改 easeInOutSine 会像「自己收拢」，更温和。
//  minOpacity (uniform)        老枝褪到多透明。0.55 保留存在感；0.3 更「幽灵」。
// ───────────────────────────────────────────────────────────────────────────────

export interface RolloverTarget {
  branch: BarkUniforms
  branchObject: THREE.Object3D
  /** 彩枝与树干的交界高度（树干局部 Y）。 */
  junctionY: number
  rippleObject: THREE.Object3D
  ripple: RippleUniforms
  rings: TrunkRings
}

export interface RolloverOptions {
  ageDuration?: number
  retractDelay?: number
  retractDuration?: number
  rippleDuration?: number
  /** 缩回过程每帧回调（k: 0→1），用来让枝上挂的花 / 果同步收向树干。 */
  onRetract?: (k: number) => void
  onDone?: () => void
}

export function startMidnightRollover(
  tweens: TweenRunner,
  target: RolloverTarget,
  opts: RolloverOptions = {},
): void {
  const { branch, branchObject, junctionY, rippleObject, ripple, rings } = target
  const ageDuration = opts.ageDuration ?? 2.6
  const retractDelay = opts.retractDelay ?? 2.0
  const retractDuration = opts.retractDuration ?? 1.3
  const rippleDuration = opts.rippleDuration ?? 2.0

  branchObject.visible = true
  branch.uAge.value = 0
  branch.uGrow.value = 1
  branch.uRadiusScale.value = 1

  // ① 衰老
  tweens.add({
    duration: ageDuration,
    ease: easeInOutSine,
    onUpdate: (k) => {
      branch.uAge.value = k
      branch.uRadiusScale.value = lerp(1, 0.7, k)
    },
  })

  // ② 缩回
  tweens.add({
    delay: retractDelay,
    duration: retractDuration,
    ease: easeInCubic,
    onUpdate: (k) => {
      branch.uGrow.value = 1 - k
      opts.onRetract?.(k)
    },
    onComplete: () => {
      branchObject.visible = false

      // ③ 涟漪 + 树皮脉冲 + 年轮
      rippleObject.position.y = junctionY
      rippleObject.visible = true
      ripple.uProgress.value = 0
      rings.pulse(junctionY)
      tweens.add({
        duration: rippleDuration,
        ease: easeOutExpo,
        onUpdate: (k) => {
          ripple.uProgress.value = k
        },
        onComplete: () => {
          rippleObject.visible = false
          opts.onDone?.()
        },
      })
      tweens.after(0.5, () => rings.addRing(junctionY))
    },
  })
}

/** 新的一天：枝从树干里「长」出来（easeOutBack 带一点点过冲，像发芽时的弹性）。 */
export function growBranch(
  tweens: TweenRunner,
  branch: BarkUniforms,
  branchObject: THREE.Object3D,
  duration = 1.1,
): void {
  branchObject.visible = true
  branch.uAge.value = 0
  branch.uRadiusScale.value = 1
  branch.uGrow.value = 0
  tweens.add({
    duration,
    ease: (t) => easeOutBack(t, 1.2),
    onUpdate: (k) => {
      branch.uGrow.value = Math.max(0, k)
    },
  })
}

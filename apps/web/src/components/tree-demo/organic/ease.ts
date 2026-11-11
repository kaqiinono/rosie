// 缓动与数学小工具。所有动效函数都只依赖这里，方便单测和换引擎。
//
// 「有机感」的第一条规矩：任何动效都不要用线性插值。
//  - 出现 / 扩散：easeOutExpo（先猛后缓，像水波、像被挤开的石头）
//  - 收缩 / 坠落：easeInCubic（先慢后快，像重力）
//  - 来回过渡：easeInOutSine（呼吸感）
//  - 生长：easeOutBack（轻微冲过头再回弹，像新芽顶出来）

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const linear = (t: number): number => t
export const easeInCubic = (t: number): number => t * t * t
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t)
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Expo.easeOut：t=0 时斜率极大、t→1 时几乎静止。石头被果实「挤」开的那一下就靠它。 */
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** 轻微过冲。overshoot 越大越「弹」，儿童向可用 1.2–1.8，想要更沉稳用 0.6–1.0。 */
export function easeOutBack(t: number, overshoot = 1.4): number {
  const c3 = overshoot + 1
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2)
}

/** 帧率无关的指数趋近：lambda 越大追得越紧。比 lerp(a, b, 0.1) 在不同帧率下表现一致。 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** 可复现的伪随机（同一个 seed 每次摆出同一堆石头，截图和对比才稳定）。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

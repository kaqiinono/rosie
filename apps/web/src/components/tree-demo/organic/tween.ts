import { clamp01, linear } from './ease'

// 极小的补间调度器：不依赖任何动画库，由渲染循环每帧喂 dt。
// 好处：和 React 状态完全解耦（动效数值直接写进 shader uniform，不触发重渲染）。

export interface TweenSpec {
  /** 秒 */
  duration: number
  /** 开始前等待的秒数 */
  delay?: number
  /** 缓动函数，默认线性（有机动效里几乎总是应该换掉它） */
  ease?: (t: number) => number
  /** k 为缓动后的进度，0→1（easeOutBack 等可能短暂超出 1） */
  onUpdate: (k: number) => void
  onComplete?: () => void
}

interface ActiveTween extends TweenSpec {
  elapsed: number
}

export class TweenRunner {
  private active: ActiveTween[] = []

  get busy(): boolean {
    return this.active.length > 0
  }

  add(spec: TweenSpec): void {
    this.active.push({ ...spec, elapsed: 0 })
  }

  /** 延时执行一个回调。 */
  after(seconds: number, fn: () => void): void {
    this.add({ duration: 0, delay: seconds, onUpdate: () => {}, onComplete: fn })
  }

  update(dt: number): void {
    // onComplete 里可以继续 add，所以先取走当前这一批。
    const current = this.active
    this.active = []
    const keep: ActiveTween[] = []
    for (const tween of current) {
      tween.elapsed += dt
      const local = tween.elapsed - (tween.delay ?? 0)
      if (local < 0) {
        keep.push(tween)
        continue
      }
      const raw = tween.duration <= 0 ? 1 : clamp01(local / tween.duration)
      const ease = tween.ease ?? linear
      tween.onUpdate(raw >= 1 ? ease(1) : ease(raw))
      if (raw >= 1) tween.onComplete?.()
      else keep.push(tween)
    }
    this.active = [...keep, ...this.active]
  }

  clear(): void {
    this.active = []
  }
}

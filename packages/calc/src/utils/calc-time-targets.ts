// src/utils/calc-time-targets.ts
// 四档建议耗时（秒/题），转录自 docs/calc-per-type-time-targets.md。
// 仅作「建议」用于家长确认与报告档位判定，绝不自动写入设置。

import { BLOCKS } from './calc-blocks'
import { SKELETONS } from './calc-mixed'
import { PRESENTATION_COEFFICIENTS, type PresentationKey } from './calc-concept-key'

export type Band = [number, number] // [lo, hi] 秒
export interface TimeTarget {
  entry: Band   // 入门
  stable: Band  // 进阶
  fluent: Band  // 高级 ⭐（推荐目标）
  auto: Band    // 超高级
  /** 各展示模式的时间系数（乘以 band 上限）。缺省视为 1.0。 */
  presentationCoefficients?: Partial<Record<PresentationKey, number>>
}
export type Tier = 'entry' | 'stable' | 'fluent' | 'auto'

export const TIER_LABEL: Record<Tier, string> = {
  entry: '入门',
  stable: '进阶',
  fluent: '高级',
  auto: '超高级',
}
/** 从慢到快的顺序（entry 最慢 / auto 最快）。 */
export const TIER_ORDER: Tier[] = ['entry', 'stable', 'fluent', 'auto']

export const TIME_TARGETS: Record<string, TimeTarget> = {
  // 加法
  'add:10': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [1, 2] },
  'add:20a': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  // 进位/退位有额外认知负荷，比不进位/不退位放宽 1 秒
  'add:20b': { entry: [11, 13], stable: [8, 9], fluent: [6, 7], auto: [4, 5] },
  'add:100a': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'add:100b': { entry: [13, 16], stable: [9, 11], fluent: [7, 9], auto: [5, 6] },
  'add:100-comp': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'add:1000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  // 10000 档全部走竖式，目标已按竖式校准 → 竖式系数归 1
  'add:10000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8], presentationCoefficients: { vertical: 1.0 } },
  // 减法
  'sub:10': { entry: [8, 10], stable: [5, 6], fluent: [3, 4], auto: [1, 2] },
  'sub:20a': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'sub:20b': { entry: [11, 13], stable: [8, 9], fluent: [6, 7], auto: [4, 5] },
  'sub:100a': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'sub:100b': { entry: [13, 16], stable: [9, 11], fluent: [7, 9], auto: [5, 6] },
  'sub:round': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  'sub:1000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8] },
  // 10000 档全部走竖式，目标已按竖式校准 → 竖式系数归 1
  'sub:10000': { entry: [15, 20], stable: [12, 15], fluent: [8, 12], auto: [6, 8], presentationCoefficients: { vertical: 1.0 } },
  // 乘法
  'mul:25': { entry: [4, 5], stable: [3, 3], fluent: [2, 2], auto: [1, 1] },
  'mul:34': { entry: [4, 5], stable: [3, 3], fluent: [2, 2], auto: [1, 1] },
  'mul:67': { entry: [6, 7], stable: [4, 5], fluent: [3, 3], auto: [2, 2] },
  'mul:89': { entry: [6, 7], stable: [4, 5], fluent: [3, 3], auto: [2, 2] },
  'mul:29': { entry: [6, 7], stable: [4, 5], fluent: [3, 3], auto: [2, 2] },
  'mul:1012': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:1319': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:219': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:2d1d-nc': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  // 进位 2d/3d×1d 与 2d×2d 全部走竖式，目标已按竖式校准 → 竖式系数归 1
  'mul:2d1d-c': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5], presentationCoefficients: { vertical: 1.0 } },
  'mul:3d1d-nc': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'mul:3d1d-c': { entry: [15, 18], stable: [10, 12], fluent: [8, 10], auto: [5, 6], presentationCoefficients: { vertical: 1.0 } },
  // 相邻档错开 1s，保证四档均可达
  'mul:zeros': { entry: [6, 8], stable: [5, 6], fluent: [4, 5], auto: [3, 4] },
  // 两位数×两位数：课标为笔算内容，stable/fluent 放宽为可达的心算目标
  'mul:2d': { entry: [20, 25], stable: [18, 22], fluent: [15, 18], auto: [10, 12], presentationCoefficients: { vertical: 1.0 } },
  // 除法
  'div:25': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'div:34': { entry: [10, 12], stable: [7, 8], fluent: [5, 6], auto: [3, 4] },
  'div:69': { entry: [12, 15], stable: [8, 10], fluent: [5, 6], auto: [3, 4] },
  'div:29': { entry: [12, 15], stable: [8, 10], fluent: [5, 6], auto: [3, 4] },
  'div:1012': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'div:1319': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  'div:219': { entry: [12, 15], stable: [8, 10], fluent: [6, 8], auto: [4, 5] },
  // 多位数除法全部走竖式，目标已按竖式校准 → 竖式系数归 1
  'div:multi': { entry: [18, 22], stable: [12, 15], fluent: [10, 12], auto: [8, 8], presentationCoefficients: { vertical: 1.0 } },
  'div:2d1d-borrow': { entry: [18, 22], stable: [12, 15], fluent: [10, 12], auto: [8, 8], presentationCoefficients: { vertical: 1.0 } },
  'div:zeros': { entry: [7, 9], stable: [5, 6], fluent: [4, 5], auto: [3, 4] },
  // 商+余数双字段输入是该题型唯一形态，目标已按其校准 → 系数归 1
  'div:rem': { entry: [12, 15], stable: [9, 11], fluent: [6, 8], auto: [4, 5], presentationCoefficients: { 'remainder-input': 1.0 } },
  // 小数
  'dec:add1': { entry: [12, 15], stable: [10, 12], fluent: [8, 10], auto: [6, 8] },
  'dec:add2': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 10] },
  'dec:mulInt': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  'dec:divInt': { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  // 分数
  // 分数题一律为分子/分母双字段输入，目标已按该形态校准 → 系数归 1
  'frac:add-same': { entry: [8, 10], stable: [5, 6], fluent: [4, 5], auto: [3, 3], presentationCoefficients: { 'fraction-input': 1.0 } },
  // 异分母加减：入门/进阶/高级放宽；分数除分数同为高年级内容，auto 档放宽为冲刺目标
  'frac:add-diff': { entry: [35, 40], stable: [25, 30], fluent: [20, 25], auto: [15, 18], presentationCoefficients: { 'fraction-input': 1.0 } },
  'frac:mul-int': { entry: [15, 20], stable: [12, 15], fluent: [10, 12], auto: [8, 8], presentationCoefficients: { 'fraction-input': 1.0 } },
  'frac:mul-frac': { entry: [25, 30], stable: [20, 25], fluent: [15, 20], auto: [12, 15], presentationCoefficients: { 'fraction-input': 1.0 } },
  'frac:div-int': { entry: [20, 25], stable: [15, 18], fluent: [12, 15], auto: [10, 10], presentationCoefficients: { 'fraction-input': 1.0 } },
  'frac:div-frac': { entry: [25, 30], stable: [20, 25], fluent: [15, 20], auto: [15, 18], presentationCoefficients: { 'fraction-input': 1.0 } },
  // 混合骨架
  as: { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  md: { entry: [15, 18], stable: [12, 15], fluent: [10, 12], auto: [8, 8] },
  asm: { entry: [20, 25], stable: [15, 18], fluent: [12, 15], auto: [10, 10] },
  asmd: { entry: [30, 35], stable: [22, 26], fluent: [15, 18], auto: [12, 15] },
  as_m_paren: { entry: [30, 35], stable: [22, 26], fluent: [17, 23], auto: [15, 18] },
  md_paren: { entry: [25, 30], stable: [18, 22], fluent: [15, 20], auto: [12, 16] },
  asmd_paren: { entry: [40, 45], stable: [30, 35], fluent: [23, 27], auto: [18, 22] },
}

/** 建议四档；缺失返回 null（调用方据此显示「暂无建议」）。 */
export function suggestedTiers(id: string): TimeTarget | null {
  return TIME_TARGETS[id] ?? null
}

/**
 * 按目标 id 解析展示模式时间系数：
 * 题型级 presentationCoefficients 覆盖 → 全局默认表 → 1.0。
 * 无 presentationKey 时返回 1（行为不变）。
 */
export function presentationCoefficientFor(
  targetId: string | undefined,
  presentationKey: PresentationKey | undefined,
): number {
  if (!presentationKey) return 1
  const target = targetId ? TIME_TARGETS[targetId] : undefined
  return (
    target?.presentationCoefficients?.[presentationKey] ??
    PRESENTATION_COEFFICIENTS[presentationKey] ??
    1
  )
}

/** 所有 BLOCKS + SKELETONS 中缺 TIME_TARGETS 条目的 id（覆盖审计用）。 */
export function missingTargetIds(): string[] {
  const ids = [...BLOCKS.map((b) => b.id), ...SKELETONS.map((s) => s.id)]
  return ids.filter((id) => !(id in TIME_TARGETS))
}

/**
 * 由平均秒/题 + 首答正确率判定档位。
 * - 无 target → null（未知）
 * - 正确率 < 0.8 → 'entry'（稳定性优先，doc §2/§5）
 * - 否则取最快的、满足 avg ≤ band.hi 的档（auto→fluent→stable→entry）
 * - 可选 presentationKey：提供时用展示系数放宽 band 上限
 */
export function tierOf(
  avgSec: number,
  accuracy: number,
  target: TimeTarget | null,
  presentationKey?: PresentationKey,
): Tier | null {
  if (!target) return null
  if (accuracy < 0.8) return 'entry'
  const coefficient = presentationKey
    ? (target.presentationCoefficients?.[presentationKey] ??
      PRESENTATION_COEFFICIENTS[presentationKey] ??
      1.0)
    : 1.0
  if (avgSec <= target.auto[1] * coefficient) return 'auto'
  if (avgSec <= target.fluent[1] * coefficient) return 'fluent'
  if (avgSec <= target.stable[1] * coefficient) return 'stable'
  return 'entry'
}

/** 距离下一更快档的差值（秒，>0）。已是 auto 或无 target → 0。 */
export function nextTierGap(avgSec: number, current: Tier | null, target: TimeTarget | null): number {
  if (!target || current === null || current === 'auto') return 0
  const nextIdx = TIER_ORDER.indexOf(current) + 1
  const next = TIER_ORDER[nextIdx] as Exclude<Tier, never>
  return Math.max(0, +(avgSec - target[next][1]).toFixed(1))
}

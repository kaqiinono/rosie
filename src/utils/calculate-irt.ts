import type { TreeId } from './calculate-types'

/** IRT 参数 */
const LEARN_RATE_CORRECT = 0.15
const LEARN_RATE_WRONG = 0.10
const THETA_MIN = 0.05
const THETA_MAX = 0.95
const INITIAL_THETA = 0.4

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * 答题后更新能力值 θ。
 * correct=true → θ 上升（题越难升越少）
 * correct=false → θ 下降（题越难降越多）
 */
export function updateTheta(
  theta: number,
  difficulty: number,
  correct: boolean,
): number {
  const next = correct
    ? theta + LEARN_RATE_CORRECT * (1 - difficulty)
    : theta - LEARN_RATE_WRONG * difficulty
  return clamp(next, THETA_MIN, THETA_MAX)
}

/**
 * 根据当前 θ 选择下一题的目标难度。
 * 目标：正确率稳定在 ~75%。
 */
export function nextDifficulty(theta: number): number {
  return clamp(theta, 0.1, 0.9)
}

/**
 * 为给定题目难度 b 和能力 θ 估算正确概率 (Rasch model)。
 * P(correct) = 1 / (1 + e^(b - θ))
 * 这里 θ 和 b 都在 0~1 范围，做简单线性映射到 logit 空间。
 */
export function predictCorrectRate(theta: number, difficulty: number): number {
  const logitTheta = (theta - 0.5) * 8
  const logitB = (difficulty - 0.5) * 8
  return 1 / (1 + Math.exp(logitB - logitTheta))
}

/** 为新用户 / 新技能树返回初始 θ */
export function initialTheta(): number {
  return INITIAL_THETA
}

/** 批量初始化所有树的 θ */
export function initialThetaMap(treeIds: TreeId[]): Record<TreeId, number> {
  const map: Partial<Record<TreeId, number>> = {}
  for (const id of treeIds) map[id] = INITIAL_THETA
  return map as Record<TreeId, number>
}

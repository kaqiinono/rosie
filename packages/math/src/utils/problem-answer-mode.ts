import type { Problem } from '@rosie/core'

/** 题目在详情页 / 草稿纸中的作答方式 */
export type ProblemAnswerMode =
  | 'numeric'
  /** 答题区由自定义组件渲染（竖式谜、宫格等），checkAnswer 校验 */
  | 'custom-widget'
  /** 只读竖式展示 + 数值填空 */
  | 'readonly-puzzle-numeric'

export function getProblemAnswerMode(problem: Problem): ProblemAnswerMode {
  if (problem.verticalPuzzle?.readonly) return 'readonly-puzzle-numeric'
  if (problem.verticalPuzzle) return 'custom-widget'
  if (typeof problem.checkAnswer === 'function' && problem.figureNode) return 'custom-widget'
  return 'numeric'
}

export function isCustomAnswerWidget(problem: Problem): boolean {
  return getProblemAnswerMode(problem) === 'custom-widget'
}

/** 草稿纸「加入画布」：题面图或答题区组件均可导出 */
export function hasScratchExportableVisual(problem: Problem): boolean {
  return Boolean(problem.figureNode || problem.verticalPuzzle)
}

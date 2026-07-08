import type { AnswerCheckResult, Problem } from '@rosie/core'

export const CORRECT_MESSAGE = '🎉 完全正确！你真棒！'

export interface CheckProblemAnswerOptions {
  wrongHint?: string
  onCorrect?: (result: AnswerCheckResult) => void
}

export function isInteractiveProblem(problem: Problem): boolean {
  return typeof problem.checkAnswer === 'function' || Boolean(problem.verticalPuzzle)
}

export function isEmptyAnswerInput(input: unknown): boolean {
  return input === '' || input === null || input === undefined
}

export function checkProblemAnswer(
  problem: Problem,
  input: unknown,
  options?: CheckProblemAnswerOptions,
): AnswerCheckResult {
  if (problem.checkAnswer) {
    return problem.checkAnswer(input)
  }

  if (isEmptyAnswerInput(input)) {
    return { ok: false, message: '' }
  }

  const v = Number(input)
  if (v === problem.finalAns) {
    return { ok: true, message: CORRECT_MESSAGE }
  }

  const hint = options?.wrongHint ?? problem.wrongHint
  return {
    ok: false,
    message:
      hint ?? `❌ 不对哦，再想想？提示：答案是 ${problem.finalAns} 以内的数。`,
  }
}

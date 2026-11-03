import type { AnswerCheckResult, Problem } from '@rosie/core'
import { getProblemAnswerMode } from '@rosie/math-kit/utils/problem-answer-mode'

export const CORRECT_MESSAGE = '🎉 完全正确！你真棒！'

export interface CheckProblemAnswerOptions {
  wrongHint?: string
  onCorrect?: (result: AnswerCheckResult) => void
}

export function isInteractiveProblem(problem: Problem): boolean {
  return getProblemAnswerMode(problem) === 'custom-widget'
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

  if (problem.additionalQuestions?.length) {
    const questions = [problem, ...problem.additionalQuestions]
    const answers = typeof input === 'string' ? input.split('|') : []
    if (answers.length !== questions.length || answers.some(value => !value.trim())) {
      return { ok: false, message: '' }
    }
    const wrong = questions.flatMap((question, index) =>
      Number(answers[index]) === question.finalAns ? [] : [index + 1],
    )
    return wrong.length
      ? { ok: false, message: `请再检查第 ${wrong.join('、')} 小问。` }
      : { ok: true, message: CORRECT_MESSAGE }
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

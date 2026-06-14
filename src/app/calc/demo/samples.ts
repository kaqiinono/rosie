import { intAnswer, decimalAnswer, remainderAnswer, fractionAnswer } from '@/utils/calc-answer'
import type { CalcQuestion } from '@/utils/type'

/**
 * Deterministic demo samples — ONE example per answer surface the calc module can
 * produce. Shared by the demo gallery (`/calc/demo`) and the per-type pages
 * (`/calc/demo/[key]`) so both stay in sync with each other and with the real
 * session (every sample is rendered through the same `CalcQuestionStage`).
 */

export type Sample = {
  key: string
  title: string
  note: string
  question: CalcQuestion
}

function q(
  partial: Partial<CalcQuestion> & Pick<CalcQuestion, 'display' | 'signature' | 'answer' | 'category'>,
): CalcQuestion {
  return { arity: 1, level: 0, isChallenge: false, coinBase: 1, ...partial }
}

export const SAMPLES: Sample[] = [
  {
    key: 'int',
    title: '整数 · 数字键盘',
    note: '默认题型。加 / 减 / 乘 / 除（整除）。answer.kind=int，无 answerMode。',
    question: q({ display: '7 × 8 = ?', signature: 'mul(7,8)', answer: intAnswer(56), category: 'muldiv' }),
  },
  {
    key: 'inverse',
    title: '逆运算 · 挖空',
    note: '「包含逆运算」开启时，约 30% 单运算整数题改成挖空式。仍用数字键盘。',
    question: q({ display: '48 + □ = 105', signature: 'add(48,57)', answer: intAnswer(57), category: 'addsub' }),
  },
  {
    key: 'decimal',
    title: '小数 · 数字键盘（带小数点）',
    note: '小数加减 / 小数×整数 / 小数÷整数。键盘出现「.」键，✓ 移到下方整行。',
    question: q({ display: '3.5 + 2.7 = ?', signature: 'add(3.5,2.7)', answer: decimalAnswer(6.2, 1), category: 'addsub' }),
  },
  {
    key: 'remainder',
    title: '有余数除法 · 商…余',
    note: '专用 RemainderPad，两格（商 / 余）+ 键盘。answer.kind=remainder。',
    question: q({ display: '23 ÷ 4 = ?', signature: 'div(23,4)', answer: remainderAnswer(5, 3), category: 'muldiv', coinBase: 2 }),
  },
  {
    key: 'frac-pie',
    title: '分数 · 饼图',
    note: '同分母加减且答案 ≤ 1 时，用可点选的饼图（FractionPie）。',
    question: q({ display: '1/5 + 2/5 = ?', signature: 'frac:add(1/5,2/5)', answer: fractionAnswer(3, 5), category: 'addsub', coinBase: 2 }),
  },
  {
    key: 'frac-pad',
    title: '分数 · 分数键盘',
    note: '异分母 / 分数乘除 / 答案 > 1 时，退回 FractionPad（分子分母两格）。',
    question: q({ display: '1/2 + 1/3 = ?', signature: 'frac:add(1/2,1/3)', answer: fractionAnswer(5, 6), category: 'addsub', coinBase: 2 }),
  },
  {
    key: 'v-add',
    title: '竖式 · 加法',
    note: '1000 / 万以内加法。VerticalCalc：进位行 + 结果格 + 内置键盘 + 检查。',
    question: q({ display: '855 + 72 = ?', signature: 'add(855,72)', answer: intAnswer(927), category: 'addsub', answerMode: 'vertical' }),
  },
  {
    key: 'v-sub',
    title: '竖式 · 减法',
    note: '1000 / 万以内减法。退位行用同一 VerticalCalc 渲染。',
    question: q({ display: '1000 - 348 = ?', signature: 'sub(1000,348)', answer: intAnswer(652), category: 'addsub', answerMode: 'vertical' }),
  },
  {
    key: 'v-mul',
    title: '竖式 · 乘法',
    note: '两位数 × 一位数。进位行 + 结果格。',
    question: q({ display: '37 × 6 = ?', signature: 'mul(37,6)', answer: intAnswer(222), category: 'muldiv', answerMode: 'vertical' }),
  },
  {
    key: 'v-div',
    title: '竖式 · 除法',
    note: '多位数 ÷ 一位数。DivisionVertical：商行 + 微调 ±1 + 检查后分步详情。',
    question: q({ display: '84 ÷ 6 = ?', signature: 'div(84,6)', answer: intAnswer(14), category: 'muldiv', answerMode: 'vertical' }),
  },
]

export function sampleByKey(key: string): Sample | undefined {
  return SAMPLES.find((s) => s.key === key)
}

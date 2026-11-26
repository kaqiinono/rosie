import type { CalcOp, CalcQuestion } from '@rosie/core'
import { decimalAnswer, fractionAnswer, intAnswer, remainderAnswer } from './calc-answer'
import { makeQuestion } from './calc-ast'

export interface CalcDemoSample {
  id: string
  label: string
  question: CalcQuestion
  canSwitchAnswerMode?: boolean
}

const base = {
  arity: 1,
  level: 1,
  isChallenge: false,
  category: 'addsub',
  coinBase: 0,
} as const

function integerSample(
  id: string,
  label: string,
  op: CalcOp,
  left: number,
  right: number,
  answerMode: 'pad' | 'vertical',
): CalcDemoSample {
  const category = op === 'add' || op === 'sub' ? 'addsub' : 'muldiv'
  return {
    id,
    label,
    question: { ...makeQuestion({ op, left, right }, 1, category, 0), answerMode },
    canSwitchAnswerMode: true,
  }
}

export const CALC_DEMO_SAMPLES: readonly CalcDemoSample[] = [
  integerSample('integer', '整数键盘', 'add', 8, 7, 'pad'),
  {
    id: 'decimal',
    label: '小数键盘',
    question: {
      ...base,
      display: '1.2 + 0.3 = ?',
      signature: 'add(1.2,0.3)',
      answer: decimalAnswer(1.5, 1),
    },
  },
  {
    id: 'inverse',
    label: '逆运算挖空',
    question: {
      ...base,
      display: '48 + □ = 105',
      signature: 'add(48,57)',
      answer: intAnswer(57),
    },
  },
  {
    id: 'fraction-pad',
    label: '分数键盘',
    question: {
      ...base,
      display: '1/2 + 1/3 = ?',
      signature: 'frac:add(1/2,1/3)',
      answer: fractionAnswer(5, 6),
    },
  },
  {
    id: 'fraction-pie',
    label: '分数圆饼',
    question: {
      ...base,
      display: '1/4 + 1/4 = ?',
      signature: 'frac:add(1/4,1/4)',
      answer: fractionAnswer(1, 2),
    },
  },
  {
    id: 'remainder',
    label: '有余数除法',
    question: {
      ...base,
      display: '17 ÷ 5 = ?',
      signature: 'div(17,5)',
      category: 'muldiv',
      answer: remainderAnswer(3, 2),
    },
  },
  integerSample('vertical-add', '加法竖式（进位）', 'add', 28, 17, 'vertical'),
  integerSample('vertical-sub', '减法竖式（退位）', 'sub', 62, 27, 'vertical'),
  integerSample('vertical-mul-single', '一位数乘法竖式', 'mul', 47, 8, 'vertical'),
  integerSample('vertical-mul-multi', '多位数乘法竖式', 'mul', 47, 38, 'vertical'),
  integerSample('vertical-div', '长除法竖式', 'div', 156, 3, 'vertical'),
]

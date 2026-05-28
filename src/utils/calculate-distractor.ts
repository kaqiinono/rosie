import type { ChoiceOption, DistractorType, LevelId } from './calculate-types'

/**
 * 为选择题生成 4 个选项（1 正确 + 3 干扰）。
 * 根据关卡和正确答案，选择合适的干扰项策略。
 */
export function generateChoices(
  answer: number,
  levelId: LevelId,
): ChoiceOption[] {
  const treeId = levelId.split('-')[0]
  const distractors = pickDistractors(answer, treeId)

  const options: ChoiceOption[] = [
    { value: String(answer), distractorType: null },
    ...distractors,
  ]

  return shuffle(options)
}

function pickDistractors(
  answer: number,
  treeId: string,
): ChoiceOption[] {
  const strategies = getStrategies(answer, treeId)
  const used = new Set<number>([answer])
  const result: ChoiceOption[] = []

  for (const s of strategies) {
    if (result.length >= 3) break
    const val = s.generate(answer)
    if (val !== answer && !used.has(val)) {
      used.add(val)
      result.push({ value: String(val), distractorType: s.type })
    }
  }

  // 不够 3 个时用 ±1, ±2 补
  const fallbacks = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]
  for (const fb of fallbacks) {
    if (result.length >= 3) break
    if (!used.has(fb) && fb >= 0) {
      used.add(fb)
      result.push({ value: String(fb), distractorType: 'close_number' })
    }
  }

  return result.slice(0, 3)
}

interface Strategy {
  type: DistractorType
  generate: (answer: number) => number
}

function getStrategies(answer: number, treeId: string): Strategy[] {
  const base: Strategy[] = [
    // 相近数字
    {
      type: 'close_number',
      generate: (a) => a + (Math.random() > 0.5 ? 1 : -1),
    },
    {
      type: 'close_number',
      generate: (a) => a + (Math.random() > 0.5 ? 2 : -2),
    },
  ]

  if (treeId === 'AS') {
    // 进位遗漏：减去 10（模拟漏进位）
    base.unshift({
      type: 'carry_omit',
      generate: (a) => (a >= 10 ? a - 10 : a + 10),
    })
    // 位值错误
    base.push({
      type: 'place_shift',
      generate: (a) => {
        if (a >= 100) return Math.round(a / 10)
        return a * 10
      },
    })
  }

  if (treeId === 'MU' || treeId === 'DI') {
    // 相邻乘法表值
    base.unshift({
      type: 'close_number',
      generate: (a) => a + (Math.random() > 0.5 ? Math.ceil(Math.sqrt(a)) : -Math.ceil(Math.sqrt(Math.max(1, a)))),
    })
  }

  if (treeId === 'MX') {
    // 运算顺序混淆：和正确答案差距较大
    base.unshift({
      type: 'order_swap',
      generate: (a) => {
        const offset = Math.round(a * 0.3) || 5
        return a + (Math.random() > 0.5 ? offset : -offset)
      },
    })
  }

  if (treeId === 'FR') {
    // 分母直加
    base.unshift({
      type: 'denom_add',
      generate: (a) => a + 1,
    })
  }

  return base
}

/**
 * 根据用户选择的干扰项类型，返回对应的错误标签。
 */
export function distractorToErrorTag(
  type: DistractorType | null,
): string | null {
  if (!type) return null
  const map: Record<DistractorType, string> = {
    carry_omit: 'carry_miss',
    order_swap: 'order_confusion',
    place_shift: 'place_value',
    close_number: 'careless',
    denom_add: 'fraction_concept',
    op_confusion: 'order_confusion',
  }
  return map[type] ?? null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

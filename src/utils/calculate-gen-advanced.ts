import type { LevelId } from './calculate-types'

// ─────────────────────────────────────────────────────────────────────────
// 计算模块 v2 — 高级技能树参数生成器
// NS / MX / DE / FR / PC / NG / PW / AP
// ─────────────────────────────────────────────────────────────────────────

export interface QuestionParams {
  a: number
  b: number
  op: string
  answer: number
  display: string
  hint?: string
  explanation?: string
  remainder?: number
  numerator?: number
  denominator?: number
  steps?: { label: string; formula: string; result: string }[]
  fixedChoices?: string[]
  fixedAnswer?: string
}

export function generateAdvancedParams(
  treeId: string,
  levelId: LevelId,
  difficulty: number,
): QuestionParams | null {
  const n = parseInt(levelId.split('-')[1])

  switch (treeId) {
    case 'NS':
      return generateNS(n, difficulty)
    case 'MX':
      return generateMX(n, difficulty)
    case 'DE':
      return generateDE(n, difficulty)
    case 'FR':
      return generateFR(n, difficulty)
    case 'PC':
      return generatePC(n, difficulty)
    case 'NG':
      return generateNG(n, difficulty)
    case 'PW':
      return generatePW(n, difficulty)
    case 'AP':
      return generateAP(n, difficulty)
    default:
      return null
  }
}

// ─── 工具函数 ────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickOne<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function roundDec(n: number, places: number): number {
  const f = Math.pow(10, places)
  return Math.round(n * f) / f
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

const VALID_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12]

function randDenom(): number {
  return pickOne(VALID_DENOMS)
}

function randNumerator(denom: number): number {
  return randInt(1, denom - 1)
}

function simplify(num: number, den: number): [number, number] {
  const g = gcd(num, den)
  return [num / g, den / g]
}

// ─── NS 数感基础 ─────────────────────────────────────────────────────────

function generateNS(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      const a = randInt(1, 100)
      let b = randInt(1, 100)
      while (b === a) b = randInt(1, 100)
      const symbol = a > b ? '>' : '<'
      return {
        a,
        b,
        op: '○',
        answer: 0,
        display: `${a} ○ ${b}`,
        hint: '比较两个数的大小，填入 > 或 <',
        fixedChoices: ['>', '<'],
        fixedAnswer: symbol,
      }
    }
    case 2: {
      const thousands = randInt(1, 9)
      const hundreds = randInt(0, 9)
      const tens = randInt(0, 9)
      const ones = randInt(0, 9)
      const num = thousands * 1000 + hundreds * 100 + tens * 10 + ones
      const places = ['千', '百', '十', '个'] as const
      const digits = [thousands, hundreds, tens, ones]
      const idx = randInt(0, 3)
      const answer = digits[idx]
      return {
        a: num,
        b: idx,
        op: '位值',
        answer,
        display: `${num}的${places[idx]}位上是几？`,
        hint: '找到对应数位上的数字',
      }
    }
    case 3: {
      const a = randInt(100, 999)
      const b = randInt(100, 999)
      const exact = a + b
      const rounded = Math.round(exact / 100) * 100
      return {
        a,
        b,
        op: '≈',
        answer: rounded,
        display: `${a} + ${b} ≈ ?`,
        hint: '先把每个数估算到最接近的整百，再相加',
        explanation: `${a} ≈ ${Math.round(a / 100) * 100}，${b} ≈ ${Math.round(b / 100) * 100}，合计约 ${rounded}`,
      }
    }
    case 4: {
      const rangeMin = randInt(0, 5) * 10
      const rangeMax = rangeMin + 50
      const target = randInt(rangeMin + 1, rangeMax - 1)
      return {
        a: rangeMin,
        b: rangeMax,
        op: '数轴',
        answer: target,
        display: `在 ${rangeMin}~${rangeMax} 的数轴上标出 ${target}`,
        hint: '观察数轴的刻度范围，找到正确的位置',
      }
    }
    default:
      return generateNS(1, _diff)
  }
}

// ─── MX 四则混合 ─────────────────────────────────────────────────────────

function generateMX(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      const a = randInt(10, 50)
      const b = randInt(5, 30)
      const c = randInt(5, Math.min(a + b - 1, 30))
      const answer = a + b - c
      return {
        a,
        b: c,
        op: '+−',
        answer,
        display: `${a} + ${b} − ${c} = ?`,
        explanation: `先算 ${a} + ${b} = ${a + b}，再减 ${c} = ${answer}`,
      }
    }
    case 2: {
      const b = randInt(2, 9)
      const c = randInt(2, 9)
      const a = randInt(b * c, 99)
      const answer = a + b * c
      return {
        a,
        b,
        op: '+×',
        answer,
        display: `${a} + ${b} × ${c} = ?`,
        hint: '先算乘法，再算加法',
        explanation: `先算 ${b} × ${c} = ${b * c}，再加 ${a} = ${answer}`,
      }
    }
    case 3: {
      const a = randInt(2, 20)
      const b = randInt(2, 20)
      const c = randInt(2, 9)
      const answer = (a + b) * c
      return {
        a,
        b: c,
        op: '(+)×',
        answer,
        display: `(${a} + ${b}) × ${c} = ?`,
        hint: '先算括号里的',
        explanation: `先算 ${a} + ${b} = ${a + b}，再乘 ${c} = ${answer}`,
      }
    }
    case 4: {
      const b = randInt(2, 9)
      const c = randInt(2, 9)
      const d = randInt(1, 20)
      const a = randInt(d + 1, 99)
      const answer = a + b * c - d
      return {
        a,
        b: d,
        op: '+×−',
        answer,
        display: `${a} + ${b} × ${c} − ${d} = ?`,
        explanation: `先算 ${b} × ${c} = ${b * c}，然后 ${a} + ${b * c} = ${a + b * c}，最后减 ${d} = ${answer}`,
      }
    }
    case 5: {
      const a = randInt(2, 15)
      const b = randInt(2, 15)
      const c = randInt(2, 15)
      const d = randInt(1, c - 1 > 0 ? c - 1 : 1)
      const answer = (a + b) * (c - d)
      return {
        a,
        b: d,
        op: '(+)×(−)',
        answer,
        display: `(${a} + ${b}) × (${c} − ${d}) = ?`,
        explanation: `${a} + ${b} = ${a + b}，${c} − ${d} = ${c - d}，${a + b} × ${c - d} = ${answer}`,
      }
    }
    case 6: {
      const strategies = [
        () => {
          const c = randInt(2, 9)
          const answer = 25 * 4 * c
          return {
            a: 25,
            b: 4 * c,
            op: '×',
            answer,
            display: `25 × ${4 * c} = ?`,
            hint: '试试拆成 25 × 4 × ' + c,
            explanation: `25 × ${4 * c} = 25 × 4 × ${c} = 100 × ${c} = ${answer}`,
          } satisfies QuestionParams
        },
        () => {
          const a = randInt(10, 50)
          const b = pickOne([99, 98, 101, 102])
          const answer = a * b
          return {
            a,
            b,
            op: '×',
            answer,
            display: `${a} × ${b} = ?`,
            hint: b < 100 ? `试试 ${a} × ${100} − ${a} × ${100 - b}` : `试试 ${a} × 100 + ${a} × ${b - 100}`,
            explanation: b < 100
              ? `${a} × ${b} = ${a} × 100 − ${a} × ${100 - b} = ${a * 100} − ${a * (100 - b)} = ${answer}`
              : `${a} × ${b} = ${a} × 100 + ${a} × ${b - 100} = ${a * 100} + ${a * (b - 100)} = ${answer}`,
          } satisfies QuestionParams
        },
      ]
      return pickOne(strategies)()
    }
    default:
      return generateMX(1, _diff)
  }
}

// ─── DE 小数 ─────────────────────────────────────────────────────────────

function generateDE(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      const a = roundDec(randInt(10, 99) / 10, 1)
      const b = roundDec(randInt(10, 99) / 10, 1)
      const isAdd = Math.random() > 0.4
      const [x, y] = isAdd ? [a, b] : [Math.max(a, b), Math.min(a, b)]
      const answer = roundDec(isAdd ? x + y : x - y, 1)
      const op = isAdd ? '+' : '−'
      return {
        a: x,
        b: y,
        op,
        answer,
        display: `${x} ${op} ${y} = ?`,
      }
    }
    case 2: {
      const a = roundDec(randInt(100, 999) / 100, 2)
      const b = roundDec(randInt(100, 999) / 100, 2)
      const isAdd = Math.random() > 0.4
      const [x, y] = isAdd ? [a, b] : [Math.max(a, b), Math.min(a, b)]
      const answer = roundDec(isAdd ? x + y : x - y, 2)
      const op = isAdd ? '+' : '−'
      return {
        a: x,
        b: y,
        op,
        answer,
        display: `${x} ${op} ${y} = ?`,
      }
    }
    case 3: {
      const a = roundDec(randInt(10, 99) / 10, 1)
      const b = randInt(2, 9)
      const answer = roundDec(a * b, 1)
      return {
        a,
        b,
        op: '×',
        answer,
        display: `${a} × ${b} = ?`,
      }
    }
    case 4: {
      const a = roundDec(randInt(10, 99) / 10, 1)
      const b = roundDec(randInt(1, 9) / 10, 1)
      const answer = roundDec(a * b, 2)
      return {
        a,
        b,
        op: '×',
        answer,
        display: `${a} × ${b} = ?`,
      }
    }
    case 5: {
      const b = randInt(2, 9)
      const quotient = roundDec(randInt(10, 99) / 10, 1)
      const a = roundDec(quotient * b, 1)
      return {
        a,
        b,
        op: '÷',
        answer: quotient,
        display: `${a} ÷ ${b} = ?`,
      }
    }
    case 6: {
      const b = roundDec(randInt(2, 9) / 10, 1)
      const quotient = roundDec(randInt(10, 99) / 10, 1)
      const a = roundDec(quotient * b, 2)
      return {
        a,
        b,
        op: '÷',
        answer: quotient,
        display: `${a} ÷ ${b} = ?`,
        hint: '先把除数变成整数，被除数同步移小数点',
      }
    }
    default:
      return generateDE(1, _diff)
  }
}

// ─── FR 分数 ─────────────────────────────────────────────────────────────

function fractionDisplay(num: number, den: number): string {
  return `${num}/${den}`
}

function generateFR(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      const den = randDenom()
      const a = randNumerator(den)
      let b = randNumerator(den)
      const isAdd = Math.random() > 0.4
      if (!isAdd && a < b) b = randInt(1, a)
      if (isAdd && a + b > den) b = den - a
      const [rn, rd] = simplify(isAdd ? a + b : a - b, den)
      const op = isAdd ? '+' : '−'
      return {
        a,
        b,
        op,
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(a, den)} ${op} ${fractionDisplay(b, den)} = ?`,
        hint: '同分母直接加减分子',
      }
    }
    case 2: {
      const d1 = pickOne([2, 3, 4, 5, 6])
      let d2 = pickOne([2, 3, 4, 5, 6])
      while (d2 === d1) d2 = pickOne([2, 3, 4, 5, 6])
      const n1 = randNumerator(d1)
      const n2 = randNumerator(d2)
      const common = lcm(d1, d2)
      const sumNum = n1 * (common / d1) + n2 * (common / d2)
      const [rn, rd] = simplify(sumNum, common)
      return {
        a: n1,
        b: n2,
        op: '+',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(n1, d1)} + ${fractionDisplay(n2, d2)} = ?`,
        hint: `通分到 ${common}`,
        explanation: `${fractionDisplay(n1 * (common / d1), common)} + ${fractionDisplay(n2 * (common / d2), common)} = ${fractionDisplay(sumNum, common)}`,
      }
    }
    case 3: {
      const d1 = pickOne([4, 5, 6, 7, 8])
      let d2 = pickOne([3, 4, 5, 6, 7])
      while (d2 === d1) d2 = pickOne([3, 4, 5, 6, 7])
      const n1 = randInt(2, d1 - 1)
      const n2 = randInt(1, d2 - 1)
      const common = lcm(d1, d2)
      const diffNum = n1 * (common / d1) - n2 * (common / d2)
      if (diffNum <= 0) {
        return generateFR(3, _diff)
      }
      const [rn, rd] = simplify(diffNum, common)
      return {
        a: n1,
        b: n2,
        op: '−',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(n1, d1)} − ${fractionDisplay(n2, d2)} = ?`,
        hint: `通分到 ${common}`,
      }
    }
    case 4: {
      const den = randDenom()
      const num = randNumerator(den)
      const c = randInt(2, 12)
      const product = num * c
      const [rn, rd] = simplify(product, den)
      return {
        a: num,
        b: c,
        op: '×',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(num, den)} × ${c} = ?`,
        hint: '分子乘以整数，分母不变',
      }
    }
    case 5: {
      const d1 = randDenom()
      const d2 = randDenom()
      const n1 = randNumerator(d1)
      const n2 = randNumerator(d2)
      const prodNum = n1 * n2
      const prodDen = d1 * d2
      const [rn, rd] = simplify(prodNum, prodDen)
      return {
        a: n1,
        b: n2,
        op: '×',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(n1, d1)} × ${fractionDisplay(n2, d2)} = ?`,
        hint: '分子乘分子，分母乘分母',
      }
    }
    case 6: {
      const den = randDenom()
      const num = randNumerator(den)
      const c = randInt(2, 6)
      const resultNum = num
      const resultDen = den * c
      const [rn, rd] = simplify(resultNum, resultDen)
      return {
        a: num,
        b: c,
        op: '÷',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(num, den)} ÷ ${c} = ?`,
        hint: '除以整数等于乘以它的倒数',
      }
    }
    case 7: {
      const d1 = randDenom()
      const d2 = randDenom()
      const n1 = randNumerator(d1)
      const n2 = randNumerator(d2)
      const resNum = n1 * d2
      const resDen = d1 * n2
      const [rn, rd] = simplify(resNum, resDen)
      return {
        a: n1,
        b: n2,
        op: '÷',
        answer: rn / rd,
        numerator: rn,
        denominator: rd,
        display: `${fractionDisplay(n1, d1)} ÷ ${fractionDisplay(n2, d2)} = ?`,
        hint: '除以一个分数等于乘以它的倒数',
        explanation: `${fractionDisplay(n1, d1)} × ${fractionDisplay(d2, n2)} = ${fractionDisplay(resNum, resDen)}`,
      }
    }
    default:
      return generateFR(1, _diff)
  }
}

// ─── PC 百分数 ───────────────────────────────────────────────────────────

function generatePC(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      if (Math.random() > 0.5) {
        const den = pickOne([2, 4, 5, 8, 10, 20, 25, 50])
        const num = randInt(1, den - 1)
        const pct = (num / den) * 100
        return {
          a: num,
          b: den,
          op: '→%',
          answer: pct,
          display: `${fractionDisplay(num, den)} = ?%`,
          hint: '分子除以分母，再乘100',
        }
      }
      const dec = pickOne([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9])
      const pct = dec * 100
      return {
        a: dec,
        b: 100,
        op: '→%',
        answer: pct,
        display: `${dec} = ?%`,
        hint: '小数乘以100变百分数',
      }
    }
    case 2: {
      const base = pickOne([100, 200, 300, 400, 500, 50, 80, 150, 250])
      const pct = pickOne([5, 10, 15, 20, 25, 30, 40, 50, 60, 75])
      const answer = base * pct / 100
      return {
        a: base,
        b: pct,
        op: '×%',
        answer,
        display: `${base}的${pct}%是多少？`,
        explanation: `${base} × ${pct}% = ${base} × ${pct / 100} = ${answer}`,
      }
    }
    case 3: {
      const price = pickOne([40, 50, 60, 80, 100, 120, 150, 200])
      const discount = pickOne([5, 6, 7, 8, 9])
      const answer = price * discount / 10
      return {
        a: price,
        b: discount,
        op: '折扣',
        answer,
        display: `原价${price}元打${discount === 5 ? '五' : discount === 6 ? '六' : discount === 7 ? '七' : discount === 8 ? '八' : '九'}折是多少？`,
        hint: `打${discount}折就是乘以0.${discount}`,
        explanation: `${price} × 0.${discount} = ${answer}`,
      }
    }
    default:
      return generatePC(1, _diff)
  }
}

// ─── NG 负数 ─────────────────────────────────────────────────────────────

function generateNG(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      const a = -randInt(1, 20)
      const b = randInt(1, 20)
      const isAdd = Math.random() > 0.4
      const answer = isAdd ? a + b : a - b
      const op = isAdd ? '+' : '−'
      return {
        a,
        b,
        op,
        answer,
        display: `(${a}) ${op} ${b} = ?`,
      }
    }
    case 2: {
      const aSign = Math.random() > 0.5 ? -1 : 1
      const bSign = Math.random() > 0.5 ? -1 : 1
      const aVal = aSign * randInt(1, 12)
      const bVal = bSign * randInt(1, 12)
      const isMul = Math.random() > 0.4
      const answer = isMul ? aVal * bVal : 0
      const op = isMul ? '×' : '÷'
      if (!isMul) {
        const divisor = bVal === 0 ? 1 : bVal
        const quotient = randInt(1, 9)
        const dividend = quotient * divisor
        const signedDividend = aSign * dividend
        return {
          a: signedDividend,
          b: divisor,
          op: '÷',
          answer: aSign * bSign > 0 ? quotient : -quotient,
          display: `(${signedDividend}) ÷ (${divisor}) = ?`,
          hint: '同号得正，异号得负',
        }
      }
      return {
        a: aVal,
        b: bVal,
        op,
        answer,
        display: `(${aVal}) × (${bVal}) = ?`,
        hint: '同号得正，异号得负',
      }
    }
    case 3: {
      const a = -randInt(1, 10)
      const b = randInt(1, 10)
      const c = -randInt(1, 5)
      const answer = a + b * c
      return {
        a,
        b,
        op: '+×',
        answer,
        display: `(${a}) + ${b} × (${c}) = ?`,
        hint: '先算乘法，再算加法',
        explanation: `${b} × (${c}) = ${b * c}，(${a}) + (${b * c}) = ${answer}`,
      }
    }
    case 4: {
      const a = -randInt(1, 15)
      const b = randInt(1, 15)
      const isAdd = Math.random() > 0.5
      const inner = isAdd ? a + b : a - b
      const answer = Math.abs(inner)
      const op = isAdd ? '+' : '−'
      return {
        a,
        b,
        op: '||',
        answer,
        display: `|(${a}) ${op} ${b}| = ?`,
        hint: '先算绝对值内的值，再取绝对值',
        explanation: `(${a}) ${op} ${b} = ${inner}，|${inner}| = ${answer}`,
      }
    }
    default:
      return generateNG(1, _diff)
  }
}

// ─── PW 幂与根 ──────────────────────────────────────────────────────────

function generatePW(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1: {
      if (Math.random() > 0.4) {
        const base = randInt(1, 12)
        const answer = base * base
        return {
          a: base,
          b: 2,
          op: '^',
          answer,
          display: `${base}² = ?`,
        }
      }
      const base = randInt(1, 6)
      const answer = base * base * base
      return {
        a: base,
        b: 3,
        op: '^',
        answer,
        display: `${base}³ = ?`,
      }
    }
    case 2: {
      const base = pickOne([2, 3, 5, 10])
      const exp1 = randInt(1, 5)
      const exp2 = randInt(1, 5)
      const answer = exp1 + exp2
      return {
        a: exp1,
        b: exp2,
        op: '^+',
        answer,
        display: `${base}${toSuperscript(exp1)} × ${base}${toSuperscript(exp2)} = ${base}^?`,
        hint: '同底数幂相乘，指数相加',
        explanation: `${base}^${exp1} × ${base}^${exp2} = ${base}^(${exp1}+${exp2}) = ${base}^${answer}`,
      }
    }
    case 3: {
      if (Math.random() > 0.4) {
        const root = randInt(1, 12)
        const answer = root
        const radicand = root * root
        return {
          a: radicand,
          b: 2,
          op: '√',
          answer,
          display: `√${radicand} = ?`,
        }
      }
      const root = randInt(1, 5)
      const answer = root
      const radicand = root * root * root
      return {
        a: radicand,
        b: 3,
        op: '³√',
        answer,
        display: `³√${radicand} = ?`,
      }
    }
    default:
      return generatePW(1, _diff)
  }
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  }
  return String(n).split('').map(c => map[c] || c).join('')
}

// ─── AP 综合应用 ─────────────────────────────────────────────────────────

interface WordProblemTemplate {
  display: string
  steps: { label: string; formula: string; result: string }[]
  answer: number
  a: number
  b: number
}

function generateAP(level: number, _diff: number): QuestionParams {
  switch (level) {
    case 1:
      return apLevel1()
    case 2:
      return apLevel2()
    case 3:
      return apLevel3()
    case 4:
      return apLevel4()
    default:
      return apLevel1()
  }
}

function apLevel1(): QuestionParams {
  const templates: (() => WordProblemTemplate)[] = [
    () => {
      const priceA = randInt(5, 20)
      const countA = randInt(2, 5)
      const priceB = randInt(3, 15)
      const countB = randInt(1, 4)
      const total = priceA * countA + priceB * countB
      return {
        display: `小明买了${countA}本笔记本，每本${priceA}元；又买了${countB}支钢笔，每支${priceB}元。一共花了多少钱？`,
        steps: [
          { label: '笔记本总价', formula: `${priceA} × ${countA}`, result: String(priceA * countA) },
          { label: '钢笔总价', formula: `${priceB} × ${countB}`, result: String(priceB * countB) },
          { label: '总花费', formula: `${priceA * countA} + ${priceB * countB}`, result: String(total) },
        ],
        answer: total,
        a: priceA * countA,
        b: priceB * countB,
      }
    },
    () => {
      const total = randInt(50, 200)
      const spent = randInt(10, total - 10)
      const remaining = total - spent
      const saved = randInt(5, remaining)
      const answer = remaining - saved
      return {
        display: `小红有${total}元零花钱，花了${spent}元买文具，又存了${saved}元。还剩多少钱？`,
        steps: [
          { label: '买完文具剩余', formula: `${total} − ${spent}`, result: String(remaining) },
          { label: '存钱后剩余', formula: `${remaining} − ${saved}`, result: String(answer) },
        ],
        answer,
        a: total,
        b: spent,
      }
    },
  ]
  const t = pickOne(templates)()
  return {
    a: t.a,
    b: t.b,
    op: '应用',
    answer: t.answer,
    display: t.display,
    steps: t.steps,
  }
}

function apLevel2(): QuestionParams {
  const templates: (() => WordProblemTemplate)[] = [
    () => {
      const price = roundDec(randInt(10, 50) / 10, 1)
      const count = randInt(3, 8)
      const paid = Math.ceil(price * count)
      const total = roundDec(price * count, 1)
      const change = roundDec(paid - total, 1)
      return {
        display: `每千克苹果${price}元，买了${count}千克，付了${paid}元，应找回多少钱？`,
        steps: [
          { label: '总价', formula: `${price} × ${count}`, result: String(total) },
          { label: '找零', formula: `${paid} − ${total}`, result: String(change) },
        ],
        answer: change,
        a: paid,
        b: count,
      }
    },
    () => {
      const den = pickOne([2, 4, 5])
      const num = randNumerator(den)
      const total = randInt(20, 100)
      const part = total * num / den
      const rest = total - part
      return {
        display: `一条绳子长${total}米，用去了${fractionDisplay(num, den)}，还剩多少米？`,
        steps: [
          { label: '用去长度', formula: `${total} × ${fractionDisplay(num, den)}`, result: String(part) },
          { label: '剩余长度', formula: `${total} − ${part}`, result: String(rest) },
        ],
        answer: rest,
        a: total,
        b: part,
      }
    },
  ]
  const t = pickOne(templates)()
  return {
    a: t.a,
    b: t.b,
    op: '应用',
    answer: t.answer,
    display: t.display,
    steps: t.steps,
  }
}

function apLevel3(): QuestionParams {
  const speed = randInt(40, 80)
  const time1 = randInt(2, 4)
  const time2 = randInt(1, 3)
  const speedBoost = randInt(5, 15)
  const dist1 = speed * time1
  const dist2 = (speed + speedBoost) * time2
  const total = dist1 + dist2
  return {
    a: speed,
    b: time1 + time2,
    op: '应用',
    answer: total,
    display: `一辆车先以每小时${speed}公里行驶了${time1}小时，然后加速到每小时${speed + speedBoost}公里又行驶了${time2}小时。总共行驶了多少公里？`,
    steps: [
      { label: '第一段路程', formula: `${speed} × ${time1}`, result: String(dist1) },
      { label: '第二段路程', formula: `${speed + speedBoost} × ${time2}`, result: String(dist2) },
      { label: '总路程', formula: `${dist1} + ${dist2}`, result: String(total) },
    ],
  }
}

function apLevel4(): QuestionParams {
  const length = randInt(20, 50)
  const width = randInt(10, length - 1)
  const area = length * width
  const perimeter = 2 * (length + width)
  const fencePrice = randInt(5, 15)
  const totalCost = perimeter * fencePrice
  return {
    a: length,
    b: width,
    op: '应用',
    answer: totalCost,
    display: `一块长${length}米、宽${width}米的长方形菜地，要在四周围上篱笆，每米篱笆${fencePrice}元。求篱笆的总费用。另外，如果要在菜地里种菜，可种植面积是多少平方米？`,
    steps: [
      { label: '周长', formula: `2 × (${length} + ${width})`, result: String(perimeter) },
      { label: '篱笆费用', formula: `${perimeter} × ${fencePrice}`, result: String(totalCost) },
      { label: '面积', formula: `${length} × ${width}`, result: String(area) },
    ],
    hint: '分别求周长和面积',
  }
}

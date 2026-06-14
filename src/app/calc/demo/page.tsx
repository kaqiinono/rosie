'use client'

/**
 * 口算题型预览 Demo — `/calc/demo`
 *
 * A non-persisted gallery that renders ONE deterministic example of every
 * answer surface the calc module can produce, each inside a phone-sized frame
 * laid out the way the redesigned session screen should look:
 *   · 顶部信息压成一行（计时 / 进度 / 星星）
 *   · 普通题：算式紧贴键盘，去掉多余留白，一屏放下
 *   · 竖式题：移除大号算式，竖式本身就是主角，居中放大
 *
 * Every card is fully interactive (tap to answer) so layout/sizing can be
 * fine-tuned per type before porting the layout into the real session page.
 */

import { useState } from 'react'
import Link from 'next/link'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import { checkAnswer, intAnswer, decimalAnswer, remainderAnswer, fractionAnswer } from '@/utils/calc-answer'
import type { CalcQuestion } from '@/utils/type'

// ── Sample questions (deterministic, one per rendering type) ───────────────

type Sample = {
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

const SAMPLES: Sample[] = [
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

// ── One interactive phone-frame card ───────────────────────────────────────

function DemoCard({ sample }: { sample: Sample }) {
  const { question } = sample
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [round, setRound] = useState(0)

  const grade = (ok: boolean) => {
    setResult(ok ? 'correct' : 'wrong')
    if (!ok) {
      // Demo: briefly show the "再想想" hint, then reset so the pad re-enables
      // (and the multi-cell pads remount out of their locked state) for a retry.
      window.setTimeout(() => {
        setResult(null)
        setInput('')
        setRound((r) => r + 1)
      }, 1100)
    }
  }
  const gradeRaw = (raw: string) => grade(checkAnswer(raw, question.answer))

  const reset = () => {
    setInput('')
    setResult(null)
    setRound((r) => r + 1) // remount the pad/竖式 to a fresh state
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[14px] font-black" style={{ color: '#e9d5ff' }}>
          {sample.title}
        </h3>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 text-[11px] font-bold transition-opacity hover:opacity-70"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          ↺ 重置
        </button>
      </div>
      <p className="px-1 text-[11px] leading-snug" style={{ color: 'rgba(196,181,253,0.45)' }}>
        {sample.note}
      </p>

      {/* Phone frame */}
      <div
        className="relative mx-auto flex w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem]"
        style={{
          height: 'min(720px, 78svh)',
          minHeight: 560,
          background: 'radial-gradient(120% 80% at 50% 0%, #15132e 0%, #0a0820 60%)',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Top bar — collapsed to a single row */}
        <div className="shrink-0 px-4 pt-4">
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span style={{ color: 'rgba(196,181,253,0.55)' }}>⏱ ∞</span>
            <span style={{ color: 'rgba(245,243,255,0.55)' }}>1 / 10</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
            >
              ⭐ 0
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full w-[10%] rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#a855f7)' }} />
          </div>
        </div>

        {/* Result banner slot (fixed height to avoid layout shift) */}
        <div className="flex h-7 shrink-0 items-center justify-center px-4 pt-1">
          {result === 'correct' && (
            <span className="text-[13px] font-black" style={{ color: '#4ade80' }}>✓ 答对啦！</span>
          )}
          {result === 'wrong' && (
            <span className="text-[13px] font-black" style={{ color: '#f87171' }}>✗ 再想想～</span>
          )}
        </div>

        <CalcQuestionStage
          padKey={`${sample.key}-${round}`}
          question={question}
          disabled={result !== null}
          input={input}
          onInputChange={setInput}
          onNumberSubmit={() => gradeRaw(input)}
          onFractionSubmit={gradeRaw}
          onRemainderSubmit={gradeRaw}
          onVerticalSubmit={grade}
        />
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CalcDemoPage() {
  return (
    <main className="min-h-screen px-3 pt-5 pb-16 sm:px-5" style={{ background: '#07061a' }}>
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-fredoka text-[24px] font-black" style={{ color: '#f5f3ff' }}>
              口算题型预览
            </h1>
            <p className="mt-0.5 text-[12px]" style={{ color: 'rgba(196,181,253,0.5)' }}>
              {SAMPLES.length} 种作答形态 · 每张卡片即一屏 · 可直接作答微调
            </p>
          </div>
          <Link
            href="/calc/settings"
            className="rounded-full px-3 py-1.5 text-[12px] font-extrabold no-underline"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          >
            ← 返回设置
          </Link>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLES.map((s) => (
            <DemoCard key={s.key} sample={s} />
          ))}
        </div>
      </div>
    </main>
  )
}

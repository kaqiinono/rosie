'use client'

import Link from 'next/link'
import type { ReadingGrammarReference } from '../../utils/reading-data'

interface Props {
  refs: ReadingGrammarReference[]
}

const SIMPLE_USES = [
  ['普遍事实', 'In Peru, people speak Spanish.'],
  ['经常发生', 'Do you write in your diary every day?'],
  ['长期状态', 'Cusco is high in the mountains.'],
  ['公共时刻表', 'The bus leaves at 12.30.'],
] as const

const CONTINUOUS_USES = [
  ['正在发生', "I'm reading a book."],
  ['当前阶段的临时情况', "I'm not sending any postcards this year."],
  ['已确定的个人安排', "We're meeting Laura at 1.00."],
] as const

function TenseCard({
  title,
  formula,
  signals,
  uses,
  tone,
}: {
  title: string
  formula: string
  signals: string
  uses: ReadonlyArray<readonly [string, string]>
  tone: 'blue' | 'violet'
}) {
  const styles = tone === 'blue'
    ? 'border-sky-200 bg-sky-50 text-sky-950'
    : 'border-violet-200 bg-violet-50 text-violet-950'
  return (
    <article className={`rounded-2xl border p-4 ${styles}`}>
      <h4 className="font-fredoka text-lg font-black">{title}</h4>
      <p className="mt-1 text-sm font-bold opacity-75">{formula}</p>
      <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold">提示词：{signals}</p>
      <div className="mt-3 space-y-2">
        {uses.map(([label, example]) => (
          <div key={label}>
            <div className="text-xs font-black">{label}</div>
            <div className="text-sm leading-relaxed">{example}</div>
          </div>
        ))}
      </div>
    </article>
  )
}

export default function ReadingGrammarSummary({ refs }: Props) {
  const primary = refs.find((ref) => ref.role === 'primary')
  const related = refs.filter((ref) => ref.role !== 'primary')

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <TenseCard
          title="一般现在时 · Present simple"
          formula="主语 + 动词原形 / 第三人称单数"
          signals="every day · on Mondays · usually · always"
          uses={SIMPLE_USES}
          tone="blue"
        />
        <TenseCard
          title="现在进行时 · Present continuous"
          formula="主语 + am / is / are + doing"
          signals="now · today · at the moment · this year"
          uses={CONTINUOUS_USES}
          tone="violet"
        />
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-black text-amber-900">⭐ 本课最重要的区别</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <p className="rounded-xl bg-white/75 p-3 text-sm text-amber-950">
            <strong>The bus leaves at 12.30.</strong><br />公共时刻表 → 一般现在时
          </p>
          <p className="rounded-xl bg-white/75 p-3 text-sm text-amber-950">
            <strong>We&apos;re meeting Laura at 1.00.</strong><br />个人已安排的计划 → 现在进行时
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-sm font-black text-slate-800">一眼判断</div>
        <p className="mt-2 text-sm leading-7 text-slate-700">
          事实、习惯、长期状态、时刻表 → <strong>一般现在时</strong><br />
          正在发生、临时情况、个人已安排的未来计划 → <strong>现在进行时</strong>
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
          <li>现在进行时必须包含 am/is/are + doing。</li>
          <li>一般现在时疑问句通常使用 do/does。</li>
          <li>句子有未来时间，不代表一定要用 will。</li>
          <li>be going to 和 will 在课文中出现，但不是本课 Grammar 框的重点。</li>
        </ul>
      </div>

      {primary && (
        <Link
          href={`/english/grammar/${primary.book}/${primary.unitNumber}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-center text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
        >
          📗 系统学习：剑桥 Essential Unit {primary.unitNumber} · {primary.label}
        </Link>
      )}
      {related.length > 0 && (
        <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">基础复习与扩展单元</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((ref) => (
              <Link
                key={`${ref.book}-${ref.unitNumber}`}
                href={`/english/grammar/${ref.book}/${ref.unitNumber}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Unit {ref.unitNumber} · {ref.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

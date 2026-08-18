'use client'

import type { ReactNode } from 'react'
import type {
  CrossReference,
  GrammarBlock,
  GrammarExample,
  GrammarLesson,
  GrammarSection,
} from '../types'

/** 按 bold 数组顺序逐个匹配并高亮例句中的关键词 */
function renderBold(en: string, bold?: string[]): ReactNode[] {
  if (!bold || bold.length === 0) return [en]
  const nodes: ReactNode[] = []
  let cursor = 0
  bold.forEach((word, i) => {
    const idx = en.indexOf(word, cursor)
    if (idx === -1) return
    if (idx > cursor) nodes.push(en.slice(cursor, idx))
    nodes.push(
      <strong key={`b${i}`} className="font-bold text-app-blue-dark">
        {word}
      </strong>,
    )
    cursor = idx + word.length
  })
  if (cursor < en.length) nodes.push(en.slice(cursor))
  return nodes
}

/** 原书印刷页码角标 */
function PageBadge({ page }: { page?: number }) {
  if (typeof page !== 'number') return null
  return (
    <span className="ml-auto shrink-0 rounded-full bg-surface-dim px-2 py-0.5 text-[10px] font-bold text-text-muted ring-1 ring-border-light">
      p.{page}
    </span>
  )
}

function ExampleRow({ item }: { item: GrammarExample }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <div className="text-[15px] leading-relaxed font-medium text-text-primary">
        {renderBold(item.en, item.bold)}
      </div>
      <div className="text-[13px] leading-relaxed text-text-secondary">
        {item.zh}
        {item.note ? <span className="ml-1 text-text-muted">（{item.note}）</span> : null}
      </div>
    </div>
  )
}

function BlockView({ block }: { block: GrammarBlock }) {
  if (block.type === 'example_set') {
    return (
      <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-100">
        {block.context && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
            🎬 {block.context}
          </div>
        )}
        <div className="divide-y divide-sky-100">
          {block.items.map((item, i) => (
            <ExampleRow key={i} item={item} />
          ))}
        </div>
      </div>
    )
  }

  if (block.type === 'grammar_table') {
    return (
      <div className="overflow-hidden rounded-xl ring-1 ring-border-light">
        {block.title && (
          <div className="bg-gradient-to-r from-app-blue to-sky-500 px-4 py-2 text-sm font-bold text-white">
            {block.title}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-surface' : 'bg-surface-dim'}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-4 py-2 ${ci === 0 ? 'font-bold text-text-primary' : 'text-text-secondary'} ${cell.startsWith('(') ? 'text-[13px] text-app-blue-dark' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (block.type === 'contraction_note') {
    return (
      <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
        <div className="mb-2 text-xs font-bold tracking-wide text-amber-700 uppercase">
          ✂️ 缩略形式
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {block.items.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">{c.full}</span>
              <span className="text-amber-500">→</span>
              <span className="font-bold text-text-primary">{c.short}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (block.type === 'rule_text' || block.type === 'tip') {
    return (
      <div
        className={`rounded-xl p-4 text-sm leading-relaxed ring-1 ${
          block.type === 'tip'
            ? 'bg-app-purple-light/50 text-app-purple-dark ring-app-purple/20'
            : 'bg-surface-dim text-text-primary ring-border-light'
        }`}
      >
        {block.type === 'tip' && <span className="mr-1">💡</span>}
        {block.text}
      </div>
    )
  }

  if (block.type === 'examples') {
    return (
      <div className="divide-y divide-border-light rounded-xl bg-surface p-4 ring-1 ring-border-light">
        {block.items.map((item, i) => (
          <ExampleRow key={i} item={item} />
        ))}
      </div>
    )
  }

  // unsupported：未知 block 类型优雅降级（框架扩展四步流程落地前的兜底）
  return (
    <div className="rounded-xl border-2 border-dashed border-border-light bg-surface-dim p-4 text-sm text-text-muted">
      <div className="mb-1 text-xs font-bold">🧩 暂未支持的内容块（{block.originalType}）</div>
      <details>
        <summary className="cursor-pointer text-xs">原始数据</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px]">{block.text}</pre>
      </details>
    </div>
  )
}

function SectionView({ section }: { section: GrammarSection }) {
  return (
    <section className="flex gap-3 sm:gap-4">
      {section.label ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-app-blue to-sky-500 text-lg font-black text-white shadow-md shadow-sky-200">
          {section.label}
        </div>
      ) : (
        <div className="w-9 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          {section.title && <h3 className="text-base font-bold text-text-primary">{section.title}</h3>}
          <PageBadge page={section.bookPage} />
        </div>
        {section.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
    </section>
  )
}

function CrossReferenceChips({ refs }: { refs: CrossReference[] }) {
  if (refs.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border-light pt-4">
      <span className="text-xs font-bold text-text-muted">相关单元</span>
      {refs.map((ref, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-app-blue-light px-3 py-1 text-xs font-semibold text-app-blue-dark"
        >
          {ref.text}
        </span>
      ))}
    </div>
  )
}

export function LessonView({ data }: { data: GrammarLesson }) {
  return (
    <div className="flex flex-col gap-6">
      {data.sections.map((section, i) => (
        <SectionView key={section.label ?? `s${i}`} section={section} />
      ))}
      <CrossReferenceChips refs={data.crossReferences} />
    </div>
  )
}

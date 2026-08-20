'use client'

import type { ReactNode } from 'react'
import type {
  CrossReference,
  GrammarBlock,
  GrammarExample,
  GrammarFigure,
  GrammarLesson,
  GrammarPageImage,
  GrammarSection,
  GrammarTableBlock,
} from '../types'
import { grammarPageImageUrl } from '../types'
import { FigureCard } from './FigureCard'

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
function PageBadge({ page, onClick }: { page?: number; onClick?: (page: number) => void }) {
  if (typeof page !== 'number') return null
  const clickable = !!onClick
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onClick(page)}
      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 transition-colors ${
        clickable
          ? 'cursor-pointer bg-surface-dim text-app-blue ring-border-light hover:bg-app-blue-light hover:text-app-blue-dark'
          : 'bg-surface-dim text-text-muted ring-border-light'
      }`}
    >
      p.{page}
    </button>
  )
}

/** 情境例句使用紧凑卡片，降低长列表高度并强化英中对照的扫描路径。 */
function ExampleCard({ item, index }: { item: GrammarExample; index: number }) {
  return (
    <li className="group relative min-w-0 overflow-hidden rounded-lg bg-surface px-3.5 py-3 ring-1 ring-sky-200/80 transition-[box-shadow,border-color] duration-200 hover:ring-sky-300 hover:shadow-sm">
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-br-lg bg-sky-100 text-[11px] font-black tabular-nums text-sky-700"
      >
        {index + 1}
      </span>
      <div className="min-w-0 pl-4">
        <p className="text-base leading-6 font-bold tracking-[-0.01em] text-app-blue-dark sm:text-[17px]">
          {renderBold(item.en, item.bold)}
        </p>
        <p className="mt-1 text-[13px] leading-5 font-normal text-text-secondary">
          {item.zh}
          {item.note ? <span className="ml-1 text-text-muted">（{item.note}）</span> : null}
        </p>
      </div>
    </li>
  )
}

function isQuotedReply(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith("'") || trimmed.startsWith('“') || trimmed.startsWith('"')
}

/** 通用例句网格：翻译弱化显示；借用 zh 字段存储的引号答语按问答关系呈现。 */
function ExamplesGrid({ items }: { items: GrammarExample[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item, i) => {
        const reply = isQuotedReply(item.zh)
        return (
          <li
            key={i}
            className="relative min-w-0 overflow-hidden rounded-lg bg-surface px-3.5 py-3 pl-5 ring-1 ring-border-light"
          >
            <span
              aria-hidden="true"
              className={`absolute top-3.5 bottom-3.5 left-0 w-1 rounded-r-full ${reply ? 'bg-app-green' : 'bg-app-blue'}`}
            />
            <p className="text-base leading-6 font-semibold text-app-blue-dark">
              {renderBold(item.en, item.bold)}
            </p>
            {item.zh && (
              <div className={`mt-1 leading-6 ${reply ? 'text-base font-semibold text-app-green-dark' : 'text-[13px] text-text-secondary'}`}>
                <span>
                  {item.zh}
                  {item.note ? <span className="ml-1 text-text-muted">（{item.note}）</span> : null}
                </span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function isPresentTimelineSection(section: GrammarSection): boolean {
  return (
    section.title?.includes('am/is/are + -ing') === true &&
    section.title.includes('现在') &&
    section.blocks[0]?.type === 'examples' &&
    section.blocks[1]?.type === 'examples'
  )
}

function isPresentFormSection(section: GrammarSection): boolean {
  return (
    section.blocks[0]?.type === 'example_set' &&
    section.blocks[1]?.type === 'rule_text' &&
    section.blocks[2]?.type === 'grammar_table' &&
    section.blocks[3]?.type === 'examples' &&
    section.blocks[1].text.includes('am/is/are') &&
    section.blocks[1].text.includes('ing')
  )
}

/** 公式型表格的紧凑展示：主语与助动词逐组对应，共享同一个 -ing 结果列。 */
function CompactFormulaView({ block }: { block: GrammarTableBlock }) {
  const suffix = block.headers.find((header) => header.includes('ing')) || '-ing'
  return (
    <div
      className="grid overflow-hidden rounded-lg bg-surface ring-1 ring-app-blue/20 grid-cols-[minmax(0,1fr)_4.5rem]"
      role="table"
      aria-label="现在进行时结构：主语搭配 am、is 或 are，再加 ing 动词"
    >
      <div className="divide-y divide-border-light" role="rowgroup">
        {block.rows.map((row, i) => (
          <div key={i} className="grid min-h-14 grid-cols-[0.85fr_1.15fr] items-center" role="row">
            <div className="px-3 py-2 text-sm leading-5 font-medium whitespace-pre-line text-text-secondary" role="cell">
              {row[0]}
            </div>
            <div className="border-l border-border-light px-3 py-2 text-base font-bold text-text-primary" role="cell">
              {renderTableCell(row[1] ?? '')}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center border-l border-app-blue/20 bg-app-blue-light/60 px-2 text-lg font-black text-app-blue-dark" role="cell">
        {suffix}
      </div>
    </div>
  )
}

/** 结构表和应用例句在宽屏并排，重现原书“公式 → 应用”的横向阅读关系。 */
function PresentFormView({
  section,
  isAdmin,
  onEditTable,
  sectionIdx,
}: {
  section: GrammarSection
  isAdmin: boolean
  onEditTable?: (sectionIdx: number, blockIdx: number) => void
  sectionIdx: number
}) {
  const ruleBlock = section.blocks[1]
  const tableBlock = section.blocks[2]
  const examplesBlock = section.blocks[3]
  if (
    ruleBlock.type !== 'rule_text' ||
    tableBlock.type !== 'grammar_table' ||
    examplesBlock.type !== 'examples'
  ) return null

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(15rem,0.85fr)_minmax(0,1.6fr)]">
      <div className="relative overflow-hidden rounded-xl bg-surface ring-1 ring-app-blue/25">
        <div className="flex items-center justify-between gap-3 bg-app-blue-light/70 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-app-blue-dark uppercase">现在进行时结构</div>
            <p className="mt-1 text-base leading-6 font-black text-text-primary">
              am / is / are <span className="mx-1 text-app-blue">+</span> 动词-ing
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onEditTable?.(sectionIdx, 2)}
              className="min-h-9 shrink-0 rounded-full bg-surface px-3 text-xs font-bold text-app-blue shadow-sm ring-1 ring-border-light transition-colors hover:bg-app-blue-light"
            >
              编辑
            </button>
          )}
        </div>
        <div className="p-3">
          <CompactFormulaView block={tableBlock} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-border-light">
        <div className="border-b border-border-light px-4 py-3">
          <div className="text-[11px] font-bold tracking-[0.14em] text-text-secondary uppercase">应用例句</div>
          <p className="mt-0.5 text-xs text-text-muted">观察 am / is / are 与 -ing 动词如何组合</p>
        </div>
        <ul className="grid grid-cols-1 gap-x-5 px-4 py-2 sm:grid-cols-2">
          {examplesBlock.items.map((item, i) => (
            <li key={i} className="relative border-b border-border-light py-2.5 pl-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
              <span className="absolute top-4 left-0 h-1.5 w-1.5 rounded-full bg-app-blue" aria-hidden="true" />
              <p className="text-[15px] leading-6 font-semibold text-app-blue-dark">
                {renderBold(item.en, item.bold)}
              </p>
              <p className="text-[13px] leading-5 text-text-secondary">
                {item.zh}
                {item.note ? <span className="ml-1 text-text-muted">（{item.note}）</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** 把「现在进行时」还原为原书的教学结构：句型聚焦 → 时间定位 → 语境例句。 */
function PresentTimelineView({ section }: { section: GrammarSection }) {
  const patternBlock = section.blocks[0]
  const contextBlock = section.blocks[1]
  if (patternBlock.type !== 'examples' || contextBlock.type !== 'examples') return null

  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-b from-sky-50 via-surface to-surface ring-1 ring-sky-200">
      <div className="px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-2xl rounded-xl bg-app-blue px-4 py-3 text-white shadow-md shadow-sky-200/70">
          <div className="mb-2 text-center text-[11px] font-bold tracking-[0.16em] text-blue-100 uppercase">
            正在发生
          </div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-1 text-center sm:grid-cols-2">
            {patternBlock.items.map((item, i) => (
              <div key={i} className="min-w-0">
                <p className="text-base leading-6 font-bold">{item.en}</p>
                <p className="text-xs leading-5 text-blue-100">{item.zh}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative mx-2 mt-5 mb-6 h-12 sm:mx-6"
          role="img"
          aria-label="时间轴：现在进行时表示动作正在现在发生"
        >
          <div className="absolute top-5 right-0 left-0 h-0.5 bg-border-light" />
          <div className="absolute top-5 left-1/2 h-0.5 w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-app-blue to-transparent" />
          <div className="absolute top-3.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-app-blue ring-4 ring-app-blue-light" />
          <span className="absolute top-7 left-0 text-xs font-medium text-text-muted">过去</span>
          <span className="absolute top-7 left-1/2 -translate-x-1/2 text-xs font-black text-app-blue-dark">现在</span>
          <span className="absolute top-7 right-0 text-xs font-medium text-text-muted">将来</span>
        </div>
      </div>

      <div className="border-t border-sky-100 bg-surface/80 px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-app-blue" aria-hidden="true" />
          <h4 className="text-xs font-bold tracking-wide text-text-secondary">从语境判断“此刻正在发生”</h4>
        </div>
        <ul className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">
          {contextBlock.items.map((item, i) => (
            <li key={i} className="border-b border-border-light py-2.5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
              <p className="text-[15px] leading-6 font-semibold text-app-blue-dark">{item.en}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{item.zh}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Vision 提取会省略行首的合并单元格，因此短行要在左侧补空，
 * 否则后续单元格会整体错列。
 */
function normalizeTableRows(rows: string[][], columnCount: number): string[][] {
  return rows.map((row) => {
    if (row.length >= columnCount) return row.slice(0, columnCount)
    return [...Array<string>(columnCount - row.length).fill(''), ...row]
  })
}

const PLURAL_SUBJECTS = new Set(['I', 'we', 'you', 'they'])
const THIRD_PERSON_SUBJECTS = new Set(['he', 'she', 'it'])
const QUESTION_AUXILIARIES = new Set(['do', 'does'])

/**
 * 还原 Vision 展平的动词变位表：肯定式按主语类型分组，
 * 疑问式则重建为「助动词｜主语组｜动词组」三列。
 */
function restoreConjugationGroups(block: GrammarTableBlock): string[][] {
  if (
    block.headers.length === 2 &&
    block.rows.length > 2 &&
    block.rows.every(
      (row) =>
        row.length === 2 &&
        (row[0] === '' || PLURAL_SUBJECTS.has(row[0]) || THIRD_PERSON_SUBJECTS.has(row[0])),
    )
  ) {
    const groups: string[][][] = []
    let currentGroup = 0
    for (const row of block.rows) {
      if (THIRD_PERSON_SUBJECTS.has(row[0])) currentGroup = 1
      groups[currentGroup] ??= []
      groups[currentGroup].push(row)
    }
    if (groups.length === 2 && groups.every((group) => group.length > 0)) {
      return groups.map((group) => [
        group.map((row) => row[0]).filter(Boolean).join('\n'),
        group.map((row) => row[1]).join('\n'),
      ])
    }
  }

  if (block.headers.length === 3 && block.rows.every((row) => row.length > 3)) {
    const restored = block.rows.map((row) => {
      const auxiliaryIndex = row.findIndex((cell) => QUESTION_AUXILIARIES.has(cell))
      if (auxiliaryIndex <= 0 || auxiliaryIndex === row.length - 1) return null
      return [
        row[auxiliaryIndex],
        row.slice(0, auxiliaryIndex).join('\n'),
        row.slice(auxiliaryIndex + 1).join('\n'),
      ]
    })
    if (restored.every((row): row is string[] => row !== null)) return restored
  }

  return block.rows
}

/**
 * 同列连续空白或相同单元格向下合并（rowSpan），还原原书的分组效果。
 * 返回值 0 表示该单元格被上方 rowspan 吸收，不渲染。
 */
function buildRowSpans(rows: string[][], mergeRepeated: boolean): number[][] {
  const spans = rows.map((row) => row.map(() => 1))
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  for (let c = 0; c < colCount; c++) {
    let anchor = -1
    for (let r = 0; r < rows.length; r++) {
      const value = rows[r][c] ?? ''
      if (value === '' || (mergeRepeated && anchor >= 0 && value === rows[anchor][c])) {
        if (anchor >= 0) {
          spans[r][c] = 0
          spans[anchor][c] += 1
        }
      } else {
        anchor = r
      }
    }
  }
  return spans
}

/** 单元格尾部括号注记（如 (wasn't)）弱化为次要视觉，不抢动词本体的焦点 */
function renderTableCell(cell: string): ReactNode {
  const match = cell.match(/^(.*?\S)\s*(\(.*\))$/)
  if (!match) return cell
  return (
    <>
      {match[1]} <span className="font-normal text-text-muted">{match[2]}</span>
    </>
  )
}

export function GrammarTableView({ block }: { block: GrammarTableBlock }) {
  const usesExplicitMerges = block.merges !== undefined
  const restoredRows = usesExplicitMerges ? block.rows : restoreConjugationGroups(block)
  const columnCount = Math.max(
    block.headers.length,
    ...restoredRows.map((row) => row.length),
  )
  const rows = normalizeTableRows(restoredRows, columnCount)
  // 多列完整句型中重复的 do/does 是每句的独立成分，不应合并。
  const spans = usesExplicitMerges
    ? rows.map((row) => row.map(() => 1))
    : buildRowSpans(rows, columnCount <= 3)
  const spanningHeaderColumns = new Set(
    usesExplicitMerges
      ? []
      : block.headers.flatMap((header, columnIndex) =>
          header !== '' && rows.every((row) => row[columnIndex] === '') ? [columnIndex] : [],
        ),
  )
  const hasHeaders = block.headers.some(
    (header, columnIndex) => header !== '' && !spanningHeaderColumns.has(columnIndex),
  )
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border-light">
      {block.title && (
        <div className="bg-gradient-to-r from-app-blue to-sky-500 px-4 py-2 text-sm font-bold text-white">
          {block.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {hasHeaders && (
            <thead>
              <tr className="bg-app-blue-light/50">
                {block.headers.map((h, i) => (
                  <th key={i} className="border border-border-light px-4 py-2 text-left text-xs font-bold text-app-blue-dark">
                    {spanningHeaderColumns.has(i) ? '' : h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="bg-surface">
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  if (spanningHeaderColumns.has(ci)) {
                    if (ri > 0) return null
                    return (
                      <td
                        key={ci}
                        rowSpan={rows.length}
                        className="border border-app-blue/40 bg-app-blue-light/50 px-4 py-2.5 align-middle font-bold whitespace-pre-line text-text-primary"
                      >
                        {block.headers[ci]}
                      </td>
                    )
                  }
                  const coveringMerge = block.merges?.find(
                    (merge) =>
                      ri >= merge.row &&
                      ri < merge.row + merge.rowSpan &&
                      ci >= merge.column &&
                      ci < merge.column + merge.colSpan,
                  )
                  if (coveringMerge && (coveringMerge.row !== ri || coveringMerge.column !== ci)) {
                    return null
                  }
                  const rowSpan = spans[ri]?.[ci] ?? 1
                  if (rowSpan === 0) return null
                  const renderedRowSpan = coveringMerge?.rowSpan ?? rowSpan
                  const renderedColSpan = coveringMerge?.colSpan ?? 1
                  const isMerged = renderedRowSpan > 1 || renderedColSpan > 1
                  return (
                    <td
                      key={ci}
                      rowSpan={renderedRowSpan > 1 ? renderedRowSpan : undefined}
                      colSpan={renderedColSpan > 1 ? renderedColSpan : undefined}
                      className={`border px-4 py-2.5 align-middle whitespace-pre-line ${
                        ci === 0
                          ? 'font-medium text-text-secondary'
                          : 'font-bold text-text-primary'
                      } ${isMerged ? 'border-app-blue/40 bg-app-blue-light/50' : 'border-border-light'}`}
                    >
                      {renderTableCell(cell)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BlockView({ block }: { block: GrammarBlock }) {
  if (block.type === 'example_set') {
    return (
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 to-surface p-3 ring-1 ring-sky-200 sm:p-4">
        {block.context && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-sky-100/80 px-3 py-2 text-sm font-semibold leading-5 text-sky-800">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 shrink-0"
            >
              <path d="m7 4 2 4" />
              <path d="m11 4 2 4" />
              <path d="m15 4 2 4" />
              <path d="m19 4 2 4" />
              <path d="M4 4h16a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1Z" />
              <path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
            </svg>
            <span>{block.context}</span>
          </div>
        )}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {block.items.map((item, i) => (
            <ExampleCard key={i} item={item} index={i} />
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'grammar_table') {
    return <GrammarTableView block={block} />
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
    return <ExamplesGrid items={block.items} />
  }

  if (block.type === 'spelling_rule') {
    return (
      <div className="rounded-xl bg-orange-50 p-4 ring-1 ring-orange-100">
        <div className="mb-2 text-xs font-bold tracking-wide text-orange-700 uppercase">
          ✍️ 拼写规则
        </div>
        {block.text && (
          <p className="mb-2 text-sm leading-relaxed whitespace-pre-line text-text-primary">{block.text}</p>
        )}
        {block.examples.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {block.examples.map((e, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[13px] font-medium ring-1 ring-orange-100"
              >
                <span className="text-text-secondary">{e.base}</span>
                <span className="text-orange-400">→</span>
                <span className="font-bold text-text-primary">{e.form}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (block.type === 'image_description') {
    return (
      <div className="rounded-xl bg-teal-50 p-4 ring-1 ring-teal-100">
        <div className="mb-2 text-xs font-bold tracking-wide text-teal-700 uppercase">
          🖼️ 插图说明
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line text-text-primary">{block.text}</p>
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

interface SectionViewProps {
  section: GrammarSection
  sectionIdx: number
  isAdmin: boolean
  /** 该 Section bookPage 对应的原书页图 URL（无则隐藏「＋ 插图」入口） */
  figureSourceUrl?: string
  onPageClick?: (page: number) => void
  /** admin 发起裁切；replaceIdx 有值 = 重裁替换该张 */
  onStartCrop?: (sectionIdx: number, replaceIdx?: number) => void
  onPreviewFigure: (figure: GrammarFigure) => void
  onRemoveFigure?: (sectionIdx: number, figureIdx: number) => void
  onEditTable?: (sectionIdx: number, blockIdx: number) => void
}

function SectionView({
  section,
  sectionIdx,
  isAdmin,
  figureSourceUrl,
  onPageClick,
  onStartCrop,
  onPreviewFigure,
  onRemoveFigure,
  onEditTable,
}: SectionViewProps) {
  const figures = section.figures ?? []
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
          <PageBadge page={section.bookPage} onClick={onPageClick} />
          {isAdmin && figureSourceUrl && typeof section.bookPage === 'number' && (
            <button
              type="button"
              onClick={() => onStartCrop?.(sectionIdx)}
              title="从原书页图裁切插图"
              className="shrink-0 rounded-full bg-surface-dim px-2 py-0.5 text-[10px] font-bold text-app-purple ring-1 ring-border-light transition-colors hover:bg-app-purple-light hover:text-app-purple-dark"
            >
              ＋ 插图
            </button>
          )}
        </div>
        {/* Section 级插图：标题下方、内容块之前，按插入顺序渲染 */}
        {figures.length > 0 && (
          <div className="flex flex-col gap-2">
            {figures.map((figure, fi) => (
              <FigureCard
                key={figure.path}
                figure={figure}
                isAdmin={isAdmin}
                onPreview={onPreviewFigure}
                onRecrop={isAdmin && figureSourceUrl ? () => onStartCrop?.(sectionIdx, fi) : undefined}
                onRemove={isAdmin ? () => onRemoveFigure?.(sectionIdx, fi) : undefined}
              />
            ))}
          </div>
        )}
        {isPresentFormSection(section) ? (
          <>
            <BlockView block={section.blocks[0]} />
            <PresentFormView
              section={section}
              sectionIdx={sectionIdx}
              isAdmin={isAdmin}
              onEditTable={onEditTable}
            />
          </>
        ) : isPresentTimelineSection(section) ? (
          <>
            <PresentTimelineView section={section} />
            {renderSectionBlocks(section.blocks.slice(2), sectionIdx, isAdmin, onEditTable, 2)}
          </>
        ) : (
          renderSectionBlocks(section.blocks, sectionIdx, isAdmin, onEditTable)
        )}
      </div>
    </section>
  )
}

/**
 * 连续的 grammar_table 在桌面端并排（对齐原书横排布局：肯定式/否定式/疑问式三表并列），
 * 移动端仍纵向堆叠；其余 block 保持原顺序逐个渲染。
 */
function renderSectionBlocks(
  blocks: GrammarBlock[],
  sectionIdx: number,
  isAdmin: boolean,
  onEditTable?: (sectionIdx: number, blockIdx: number) => void,
  blockOffset = 0,
): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  while (i < blocks.length) {
    if (blocks[i].type !== 'grammar_table') {
      out.push(<BlockView key={`b${i}`} block={blocks[i]} />)
      i += 1
      continue
    }
    let j = i
    while (j < blocks.length && blocks[j].type === 'grammar_table') j += 1
    const tableStart = i
    const run = blocks.slice(i, j)
    const gridClass =
      run.length >= 3 ? 'grid gap-3 md:grid-cols-3' : run.length === 2 ? 'grid gap-3 sm:grid-cols-2' : ''
    out.push(
      <div key={`tables${i}`} className={gridClass}>
        {run.map((table, k) => (
          <div key={k} className="group/table relative min-w-0">
            <BlockView block={table} />
            {isAdmin && (
              <button
                type="button"
                onClick={() => onEditTable?.(sectionIdx, blockOffset + tableStart + k)}
                className="absolute top-2 right-2 min-h-9 rounded-full bg-surface/95 px-3 text-xs font-bold text-app-blue shadow-md ring-1 ring-border-light transition-colors hover:bg-app-blue-light"
              >
                编辑表格
              </button>
            )}
          </div>
        ))}
      </div>,
    )
    i = j
  }
  return out
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

export interface LessonViewProps {
  data: GrammarLesson
  isAdmin: boolean
  pageImages: GrammarPageImage[]
  onPageClick?: (page: number) => void
  /** admin 发起裁切；replaceIdx 有值 = 重裁替换该张 */
  onStartCrop?: (sectionIdx: number, replaceIdx?: number) => void
  onPreviewFigure: (figure: GrammarFigure) => void
  onRemoveFigure?: (sectionIdx: number, figureIdx: number) => void
  onEditTable?: (sectionIdx: number, blockIdx: number) => void
}

export function LessonView({
  data,
  isAdmin,
  pageImages,
  onPageClick,
  onStartCrop,
  onPreviewFigure,
  onRemoveFigure,
  onEditTable,
}: LessonViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {data.sections.map((section, i) => {
        const src =
          typeof section.bookPage === 'number'
            ? pageImages.find((img) => img.page === section.bookPage)
            : undefined
        return (
          <SectionView
            key={section.label ?? `s${i}`}
            section={section}
            sectionIdx={i}
            isAdmin={isAdmin}
            figureSourceUrl={src ? grammarPageImageUrl(src.path) : undefined}
            onPageClick={onPageClick}
            onStartCrop={onStartCrop}
            onPreviewFigure={onPreviewFigure}
            onRemoveFigure={onRemoveFigure}
            onEditTable={onEditTable}
          />
        )
      })}
      <CrossReferenceChips refs={data.crossReferences} />
    </div>
  )
}

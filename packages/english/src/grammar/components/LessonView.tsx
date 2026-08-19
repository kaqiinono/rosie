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

/**
 * 同列连续空单元格向下合并：空单元格并入上方最近非空单元格（rowSpan），
 * 还原原书「一个动词形式用花括号跨多行」的分组效果（如 was 覆盖 I/he/she/it）。
 * 返回值 0 表示该单元格被上方 rowspan 吸收，不渲染。
 */
function buildRowSpans(rows: string[][]): number[][] {
  const spans = rows.map((row) => row.map(() => 1))
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  for (let c = 0; c < colCount; c++) {
    let anchor = -1
    for (let r = 0; r < rows.length; r++) {
      if ((rows[r][c] ?? '') === '') {
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

function GrammarTableView({ block }: { block: GrammarTableBlock }) {
  const spans = buildRowSpans(block.rows)
  const hasHeaders = block.headers.some((h) => h !== '')
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border-light">
      {block.title && (
        <div className="bg-gradient-to-r from-app-blue to-sky-500 px-4 py-2 text-sm font-bold text-white">
          {block.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {hasHeaders && (
            <thead>
              <tr className="bg-app-blue-light/50">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-4 py-2 text-left text-xs font-bold text-app-blue-dark">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border-light bg-surface">
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const rowSpan = spans[ri]?.[ci] ?? 1
                  if (rowSpan === 0) return null
                  return (
                    <td
                      key={ci}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      className={`px-4 py-2.5 align-middle ${
                        ci === 0
                          ? 'font-medium text-text-secondary'
                          : 'font-bold text-text-primary'
                      }`}
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
    return (
      <div className="divide-y divide-border-light rounded-xl bg-surface p-4 ring-1 ring-border-light">
        {block.items.map((item, i) => (
          <ExampleRow key={i} item={item} />
        ))}
      </div>
    )
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
        {renderSectionBlocks(section.blocks)}
      </div>
    </section>
  )
}

/**
 * 连续的 grammar_table 在桌面端并排（对齐原书横排布局：肯定式/否定式/疑问式三表并列），
 * 移动端仍纵向堆叠；其余 block 保持原顺序逐个渲染。
 */
function renderSectionBlocks(blocks: GrammarBlock[]): ReactNode[] {
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
    const run = blocks.slice(i, j)
    const gridClass =
      run.length >= 3 ? 'grid gap-3 md:grid-cols-3' : run.length === 2 ? 'grid gap-3 sm:grid-cols-2' : ''
    out.push(
      <div key={`tables${i}`} className={gridClass}>
        {run.map((table, k) => (
          <BlockView key={k} block={table} />
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
}

export function LessonView({
  data,
  isAdmin,
  pageImages,
  onPageClick,
  onStartCrop,
  onPreviewFigure,
  onRemoveFigure,
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
          />
        )
      })}
      <CrossReferenceChips refs={data.crossReferences} />
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useChineseContext } from '../../context/ChineseContext'
import { getChineseBook } from '../../utils/chinese-books'
import {
  buildCharCardItems,
  filterLessons,
} from '../../utils/chinese-chars-session-helpers'
import { chineseRoute } from '../../utils/chinese-routes'
import { buildWordCardItems } from '../../utils/chinese-pinyin-write-helpers'
import {
  buildCharPrintSections,
  buildCombinedPrintLessonBlocks,
  buildPinyinWritePrintTitle,
  buildWordPrintSections,
  type PinyinWritePrintKind,
  type PinyinWritePrintLessonBlock,
  type PinyinWritePrintSection,
  type PinyinWriteWordPrintSection,
} from '../../utils/chinese-pinyin-write-print-helpers'

function parseUnits(raw: string | null): Set<number> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n)),
  )
}

function parseLessons(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

function parsePrintKind(raw: string | null): PinyinWritePrintKind {
  if (raw === 'chars') return 'chars'
  if (raw === 'all') return 'all'
  return 'words'
}

function PrintRows({ rows, prefix }: { rows: PinyinWritePrintSection['rows']; prefix: string }) {
  return (
    <>
      {rows.map((row, rowIndex) => (
        <div key={`${prefix}-${rowIndex}`} className="cn-print-row">
          {row.map((cell, cellIndex) => (
            <div key={`${prefix}-${rowIndex}-${cellIndex}`} className="cn-print-cell">
              <span className="cn-print-pinyin">{cell.pinyin}</span>
              <span className="cn-print-box" aria-hidden="true" />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function PrintWordRows({
  rows,
  prefix,
}: {
  rows: PinyinWriteWordPrintSection['rows']
  prefix: string
}) {
  return (
    <>
      {rows.map((row, rowIndex) => (
        <div key={`${prefix}-word-row-${rowIndex}`} className="cn-print-word-row">
          {row.map((group, groupIndex) => (
            <div
              key={`${prefix}-word-${rowIndex}-${groupIndex}`}
              className="cn-print-word-group"
            >
              {group.cells.map((cell, cellIndex) => (
                <div
                  key={`${prefix}-word-${rowIndex}-${groupIndex}-${cellIndex}`}
                  className="cn-print-cell"
                >
                  <span className="cn-print-pinyin">{cell.pinyin}</span>
                  <span className="cn-print-box" aria-hidden="true" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function PrintWordSectionBlock({ section }: { section: PinyinWriteWordPrintSection }) {
  return (
    <section className="cn-print-lesson">
      <div className="cn-print-lesson-header">
        <span className="cn-print-lesson-title">{section.lessonLabel}</span>
      </div>
      <PrintWordRows rows={section.rows} prefix={section.lessonKey} />
    </section>
  )
}

function PrintSectionBlock({ section }: { section: PinyinWritePrintSection }) {
  return (
    <section className="cn-print-lesson">
      <div className="cn-print-lesson-header">
        <span className="cn-print-lesson-title">{section.lessonLabel}</span>
      </div>
      <PrintRows rows={section.rows} prefix={section.lessonKey} />
    </section>
  )
}

function PrintLessonBlock({ block }: { block: PinyinWritePrintLessonBlock }) {
  return (
    <section className="cn-print-lesson">
      <div className="cn-print-lesson-header">
        <span className="cn-print-lesson-title">{block.lessonLabel}</span>
      </div>
      {block.charRows.length > 0 && (
        <div className="cn-print-subsection">
          {block.wordGroupRows.length > 0 && <span className="cn-print-subsection-label">生字</span>}
          <PrintRows rows={block.charRows} prefix={`${block.lessonKey}-char`} />
        </div>
      )}
      {block.wordGroupRows.length > 0 && (
        <div className="cn-print-subsection">
          <span className="cn-print-subsection-label">词语</span>
          <PrintWordRows rows={block.wordGroupRows} prefix={`${block.lessonKey}-word`} />
        </div>
      )}
    </section>
  )
}

export default function ChinesePinyinWritePrintPage() {
  const searchParams = useSearchParams()
  const { lessons, lessonGroups, isCharDataReady, bookSlug } = useChineseContext()
  const book = getChineseBook(bookSlug)

  const kind = parsePrintKind(searchParams.get('type'))
  const selUnits = useMemo(() => parseUnits(searchParams.get('units')), [searchParams])
  const selLessons = useMemo(() => parseLessons(searchParams.get('lessons')), [searchParams])

  const filtered = useMemo(
    () =>
      isCharDataReady
        ? filterLessons(lessons, lessonGroups, selUnits, selLessons)
        : [],
    [isCharDataReady, lessons, lessonGroups, selUnits, selLessons],
  )

  const charSections = useMemo(() => {
    if (kind !== 'chars') return []
    const cards = buildCharCardItems(filtered, lessons, bookSlug)
    return buildCharPrintSections(cards, lessons)
  }, [kind, filtered, lessons, bookSlug])

  const wordSections = useMemo(() => {
    if (kind !== 'words') return []
    const words = buildWordCardItems(filtered, lessons, bookSlug)
    return buildWordPrintSections(words, lessons)
  }, [kind, filtered, lessons, bookSlug])

  const combinedBlocks = useMemo(() => {
    if (kind !== 'all') return []
    const cards = buildCharCardItems(filtered, lessons, bookSlug)
    const words = buildWordCardItems(filtered, lessons, bookSlug)
    const lessonKeys = filtered.map((f) => f.lesson.lessonKey)
    return buildCombinedPrintLessonBlocks(
      lessonKeys,
      buildCharPrintSections(cards, lessons),
      buildWordPrintSections(words, lessons),
    )
  }, [kind, filtered, lessons, bookSlug])

  const title = useMemo(() => {
    const unitNums =
      selUnits.size > 0 ? [...selUnits].sort((a, b) => a - b) : [...new Set(filtered.map((f) => f.lesson.unit))].sort((a, b) => a - b)
    const unitTitles = unitNums
      .map((unit) => book?.units.find((u) => u.unit === unit)?.title)
      .filter((t): t is string => Boolean(t))
    return buildPinyinWritePrintTitle(kind, book?.label ?? '', unitTitles)
  }, [kind, book, selUnits, filtered])

  const backHref = chineseRoute(bookSlug, 'chars')
  const kindLabel = kind === 'words' ? '词语' : kind === 'chars' ? '生字' : '生字和词语'
  const hasPrintContent =
    kind === 'all'
      ? combinedBlocks.length > 0
      : kind === 'chars'
        ? charSections.length > 0
        : wordSections.length > 0

  if (!isCharDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
        加载字库中…
      </div>
    )
  }

  if (!hasPrintContent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-600">当前筛选下没有可打印的{kindLabel}内容</p>
        <Link href={backHref} className="text-sm text-amber-700 no-underline hover:underline">
          ← 返回生字库
        </Link>
      </div>
    )
  }

  return (
    <div className="cn-print-root min-h-screen bg-stone-100">
      <div className="cn-no-print sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-2 px-3 sm:px-4">
          <Link
            href={backHref}
            className="shrink-0 text-sm text-stone-500 no-underline transition hover:text-stone-700"
          >
            ← 返回
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-bold text-stone-800">
            打印预览 · {title}
          </h1>
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 sm:px-4"
          >
            打印
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[800px] px-4 py-6 print:max-w-none print:p-0">
        <div className="cn-print-sheet rounded-lg bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <header className="cn-print-doc-header">
            <h1 className="cn-print-doc-title">{title}</h1>
          </header>

          {kind === 'all'
            ? combinedBlocks.map((block) => <PrintLessonBlock key={block.lessonKey} block={block} />)
            : kind === 'chars'
              ? charSections.map((section) => (
                  <PrintSectionBlock key={section.lessonKey} section={section} />
                ))
              : wordSections.map((section) => (
                  <PrintWordSectionBlock key={section.lessonKey} section={section} />
                ))}
        </div>
      </div>

      <style>{`
        .cn-print-sheet { color: #1c1917; font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
        .cn-print-doc-header {
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #1c1917;
          text-align: center;
        }
        .cn-print-doc-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .cn-print-lesson {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 1.5rem;
        }
        .cn-print-lesson-header {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem 1rem;
          margin-bottom: 0.65rem;
          font-size: 0.875rem;
          color: #292524;
        }
        .cn-print-lesson-title {
          font-weight: 700;
          margin-right: 0.25rem;
        }
        .cn-print-subsection {
          margin-bottom: 0.5rem;
        }
        .cn-print-subsection-label {
          display: block;
          margin-bottom: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #78716c;
        }
        .cn-print-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.5rem;
          margin-bottom: 0.5rem;
        }
        .cn-print-word-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 0.25rem;
          margin-bottom: 0.65rem;
        }
        .cn-print-word-group {
          display: inline-flex;
          gap: 0;
        }
        .cn-print-word-group .cn-print-cell + .cn-print-cell .cn-print-box {
          margin-left: -1.5px;
        }
        .cn-print-word-group .cn-print-cell:first-child:not(:last-child) .cn-print-box {
          border-radius: 0.2rem 0 0 0.2rem;
        }
        .cn-print-word-group .cn-print-cell:last-child:not(:first-child) .cn-print-box {
          border-radius: 0 0.2rem 0.2rem 0;
        }
        .cn-print-word-group .cn-print-cell:not(:first-child):not(:last-child) .cn-print-box {
          border-radius: 0;
        }
        .cn-print-cell {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          width: 4.25rem;
        }
        .cn-print-pinyin {
          font-size: 0.8rem;
          line-height: 1.2;
          color: #57534e;
          min-height: 1rem;
          text-align: center;
        }
        .cn-print-box {
          display: block;
          width: 3.5rem;
          height: 3.5rem;
          margin-top: 0.15rem;
          border: 1.5px solid #78716c;
          border-radius: 0.2rem;
          background:
            linear-gradient(to right, rgba(120, 113, 108, 0.35) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(120, 113, 108, 0.35) 1px, transparent 1px),
            linear-gradient(45deg, transparent 49.5%, rgba(120, 113, 108, 0.2) 49.5%, rgba(120, 113, 108, 0.2) 50.5%, transparent 50.5%),
            linear-gradient(-45deg, transparent 49.5%, rgba(120, 113, 108, 0.2) 49.5%, rgba(120, 113, 108, 0.2) 50.5%, transparent 50.5%);
          background-size: 50% 50%, 50% 50%, 100% 100%, 100% 100%;
          background-position: center, center, center, center;
        }

        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          html, body { background: #ffffff !important; }
          .cn-no-print { display: none !important; }
          .cn-print-root { background: #ffffff !important; min-height: 0 !important; }
          .cn-print-sheet { box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

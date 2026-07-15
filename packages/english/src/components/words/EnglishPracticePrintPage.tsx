'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { getWordMasteryLevel } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import {
  buildPracticePrintTitle,
  buildPrintSections,
  parsePrintLessons,
  parsePrintMastery,
  parsePrintTypes,
  parsePrintUnits,
  parsePrintWords,
} from '../../utils/english-practice-print-helpers'
import { getFilteredWords, lessonChipTag, letterCount, wordKey } from '../../utils/english-helpers'

/** Minimum width ≈ three short English words; grows for longer phrases. */
function printFourLineWidthRem(word: string): number {
  const letters = letterCount(word)
  const spaces = (word.match(/\s/g) ?? []).length
  const units = letters + spaces * 0.65
  const fromWord = units * 0.72
  const minThreeWords = 16.5
  return Math.min(32, Math.max(minThreeWords, fromWord))
}

function PrintFourLineGrid() {
  return <div className="en-print-four-line-grid" aria-hidden="true" />
}

function PrintQuestionBlock({
  question,
}: {
  question: ReturnType<typeof buildPrintSections>[number]['questions'][number]
}) {
  const isC = question.type === 'C'
  const isD = question.type === 'D'
  const lessonTag = lessonChipTag(question.word.unit, question.word.lesson)

  if (isC) {
    const gridWidthRem = printFourLineWidthRem(question.word.word)
    return (
      <div className="en-print-question en-print-question-spell">
        <div className="en-print-spell-row">
          <div className="en-print-spell-def">
            <span className="en-print-qnum">{question.num}.</span>
            <span className="en-print-spell-prompt">{question.prompt}</span>
            <span className="en-print-lesson-tag">{lessonTag}</span>
          </div>
          <div
            className="en-print-spell-grid"
            style={{ width: `${gridWidthRem}rem` }}
            aria-hidden="true"
          >
            <PrintFourLineGrid />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="en-print-question">
      <div className="en-print-question-stem">
        <span className="en-print-qnum">{question.num}.</span>
        <span className={`en-print-prompt ${isD ? 'en-print-prompt-passage' : ''}`}>
          {isD ? `“${question.prompt}”` : question.prompt}
        </span>
        <span className="en-print-lesson-tag">{lessonTag}</span>
      </div>

      {question.ipa && (
        <div className="en-print-ipa">{question.ipa}</div>
      )}

      <div className="en-print-options">
        {question.options.map((opt) => (
          <div key={opt.label} className="en-print-option">
            <span className="en-print-option-label">{opt.label}.</span>
            <span className="en-print-option-text">{opt.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function runPrint() {
  // Mark <html> before the dialog opens so WebKit drops fixed chrome
  // even if @media print application is delayed on iOS.
  document.documentElement.classList.add('en-printing')
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.documentElement.classList.remove('en-printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  // iOS sometimes never fires afterprint; keep class until dialog is long gone.
  window.setTimeout(cleanup, 60_000)
}

export default function EnglishPracticePrintPage() {
  const { vocab, masteryMap } = useWordsContext()
  const searchParams = useSearchParams()

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('en-printing')
    }
  }, [])

  const stage = searchParams.get('stage') ?? '4A'
  const selUnits = useMemo(
    () => parsePrintUnits(searchParams.get('units')),
    [searchParams],
  )
  const selLessons = useMemo(
    () => parsePrintLessons(searchParams.get('lessons')),
    [searchParams],
  )
  const selWords = useMemo(
    () => parsePrintWords(searchParams.get('words')),
    [searchParams],
  )
  const types = useMemo(
    () => parsePrintTypes(searchParams.get('types')),
    [searchParams],
  )
  const masteryFilter = useMemo(
    () => parsePrintMastery(searchParams.get('mastery')),
    [searchParams],
  )

  const filteredWords = useMemo(() => {
    let base = getFilteredWords(vocab, stage, selUnits, selLessons, selWords)
    if (masteryFilter !== null) {
      base = base.filter(
        (v) =>
          getWordMasteryLevel(masteryMap[wordKey(v)]?.correct ?? 0) ===
          masteryFilter,
      )
    }
    return base
  }, [vocab, stage, selUnits, selLessons, selWords, masteryFilter, masteryMap])

  const sections = useMemo(
    () => buildPrintSections(filteredWords, types, vocab),
    [filteredWords, types, vocab],
  )

  const title = useMemo(
    () =>
      buildPracticePrintTitle(
        stage,
        selUnits,
        selLessons,
        filteredWords.length,
        types,
      ),
    [stage, selUnits, selLessons, filteredWords.length, types],
  )

  const questionCount = sections.reduce((n, s) => n + s.questions.length, 0)
  const hasPrintContent = questionCount > 0

  if (!vocab.length) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
        加载词库中…
      </div>
    )
  }

  if (!hasPrintContent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-stone-600">当前筛选下没有可打印的练习内容</p>
        <Link
          href="/english/words/practice"
          className="text-sm text-indigo-700 no-underline hover:underline"
        >
          ← 返回练习设置
        </Link>
      </div>
    )
  }

  return (
    <div className="en-print-root min-h-screen bg-stone-100">
      <div className="en-no-print sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[900px] items-center gap-2 px-3 sm:px-4">
          <Link
            href="/english/words/practice"
            className="shrink-0 text-sm text-stone-500 no-underline transition hover:text-stone-700"
          >
            ← 返回
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-bold text-stone-800">
            打印预览 · {questionCount} 题
          </h1>
          <button
            type="button"
            onClick={runPrint}
            className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 sm:px-4"
          >
            打印
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
        <div className="en-print-sheet rounded-lg bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <header className="en-print-doc-header">
            <h1 className="en-print-doc-title">{title}</h1>
            <p className="en-print-doc-meta">
              姓名：____________　　日期：____________
            </p>
          </header>

          {sections.map((section) => (
            <section key={section.type} className="en-print-section">
              <h2 className="en-print-section-title">{section.title}</h2>
              {section.questions.map((q) => (
                <PrintQuestionBlock key={`${section.type}-${q.num}`} question={q} />
              ))}
            </section>
          ))}
        </div>
      </div>

      <style>{`
        .en-print-sheet {
          color: #1c1917;
          font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        }
        .en-print-doc-header {
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #1c1917;
          text-align: center;
        }
        .en-print-doc-title {
          margin: 0 0 0.5rem;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          line-height: 1.35;
        }
        .en-print-doc-meta {
          margin: 0;
          font-size: 0.875rem;
          color: #57534e;
        }
        .en-print-section {
          margin-bottom: 1.75rem;
        }
        .en-print-section-title {
          margin: 0 0 0.85rem;
          padding: 0.35rem 0.5rem;
          font-size: 0.95rem;
          font-weight: 800;
          color: #312e81;
          background: #eef2ff;
          border-radius: 0.25rem;
        }
        .en-print-question {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 1.1rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px dashed #d6d3d1;
        }
        .en-print-question:last-child {
          border-bottom: none;
        }
        .en-print-question-stem {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem 0.5rem;
          margin-bottom: 0.45rem;
        }
        .en-print-qnum {
          flex-shrink: 0;
          font-size: 0.9rem;
          font-weight: 800;
          color: #44403c;
        }
        .en-print-lesson-tag {
          flex-shrink: 0;
          margin-left: auto;
          font-size: 0.62rem;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a8a29e;
        }
        .en-print-prompt {
          flex: 1 1 12rem;
          min-width: 0;
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.45;
          color: #1c1917;
        }
        .en-print-prompt-passage {
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.55;
        }
        .en-print-ipa {
          margin-bottom: 0.4rem;
          font-size: 0.85rem;
          font-style: italic;
          color: #78716c;
        }
        .en-print-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.35rem 1rem;
        }
        .en-print-option {
          display: flex;
          align-items: flex-start;
          gap: 0.35rem;
          font-size: 0.875rem;
          line-height: 1.4;
        }
        .en-print-option-label {
          flex-shrink: 0;
          font-weight: 800;
          color: #57534e;
        }
        .en-print-option-text {
          word-break: break-word;
        }
        .en-print-spell-row {
          display: flex;
          align-items: center;
          gap: 0.85rem 1.25rem;
        }
        .en-print-spell-def {
          flex: 1 1 58%;
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem 0.5rem;
        }
        .en-print-spell-prompt {
          flex: 1 1 10rem;
          min-width: 0;
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.45;
          color: #1c1917;
        }
        .en-print-spell-grid {
          flex: 0 0 auto;
          min-width: 16.5rem;
        }
        /* Borders / ::before|after — not background-image — so lines survive
           Chrome print with「背景图形」unchecked. */
        .en-print-four-line-grid {
          display: block;
          position: relative;
          width: 100%;
          height: 2.625rem;
          box-sizing: border-box;
          border-top: 1px solid #b45309;
          border-bottom: 1px solid #b45309;
        }
        .en-print-four-line-grid::before,
        .en-print-four-line-grid::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px solid #78716c;
        }
        .en-print-four-line-grid::before { top: 33.333%; }
        .en-print-four-line-grid::after { top: 66.666%; }

        html.en-printing .en-words-bg-deco,
        html.en-printing .en-no-print {
          display: none !important;
          visibility: hidden !important;
        }
        html.en-printing,
        html.en-printing body,
        html.en-printing .en-words-print-layout,
        html.en-printing .en-print-root {
          background: #ffffff !important;
          color: #1c1917 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: visible !important;
        }

        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          html, body {
            background: #ffffff !important;
            color: #1c1917 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .en-words-bg-deco,
          .en-no-print {
            display: none !important;
            visibility: hidden !important;
          }
          .en-words-print-layout,
          .en-print-root {
            background: #ffffff !important;
            color: #1c1917 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .en-print-sheet {
            box-shadow: none !important;
            padding: 0 !important;
            color: #1c1917 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .en-print-doc-title,
          .en-print-prompt,
          .en-print-spell-prompt,
          .en-print-qnum,
          .en-print-option-text { color: #1c1917 !important; }
          .en-print-doc-meta,
          .en-print-option-label,
          .en-print-ipa { color: #44403c !important; }
          .en-print-section-title {
            color: #312e81 !important;
            background: #eef2ff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .en-print-lesson-tag { color: #78716c !important; }
        }

        @media (max-width: 640px) {
          .en-print-options { grid-template-columns: 1fr; }
          .en-print-spell-row {
            flex-direction: column;
            align-items: stretch;
          }
          .en-print-spell-grid {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}

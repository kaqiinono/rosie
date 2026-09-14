'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { SelectControl } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useWordData } from '../../hooks/useWordData'
import { buildEntryMatchRegex, findPassageByKey } from '../../utils/reading-data'

type PrintFont = {
  id: string
  label: string
  family: string
  note: string
}

type PrintTone = {
  id: string
  label: string
  color: string
}

type GlyphStartPoint = {
  x: number
  y: number
}

type PositioningMode = 'normal' | 'advanced'

// Sassoon Primary is a commercial font. Keeping it first lets a licensed local
// installation (or a future licensed @font-face asset) be used automatically,
// while the other choices are available as no-download browser/system fallbacks.
const PRINT_FONTS: PrintFont[] = [
  {
    id: 'sassoon-infant',
    label: 'U 形 y（Sassoon Infant）',
    family: '"Rosie Sassoon Infant", "Sassoon Infant", "Sassoon Primary Infant", "Sassoon Primary", "Chalkboard SE", cursive',
    note: '初学书写字形；y 的上半部为圆弧连接，优先推荐临摹使用',
  },
  {
    id: 'sassoon',
    label: 'Sassoon Primary',
    family: '"Sassoon Primary", "Sassoon Infant", "Chalkboard SE", cursive',
    note: '若设备已安装授权字体，会优先使用',
  },
  {
    id: 'sassoon-infant-dotted',
    label: '点状描红（Sassoon Infant Dotted）',
    family: '"Rosie Sassoon Infant Dotted", "Sassoon Infant Dotted", "Sassoon Infant", cursive',
    note: '由点状笔画组成，适合沿字形描写练习',
  },
  {
    id: 'chalkboard',
    label: '圆润手写（Chalkboard）',
    family: '"Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive',
    note: '字形圆润，适合低龄孩子跟读临摹',
  },
  {
    id: 'handwriting',
    label: '自然手写（Bradley Hand）',
    family: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
    note: '笔画有手写感，可作进阶临摹范字',
  },
  {
    id: 'friendly',
    label: '友好圆体（Comic Sans）',
    family: '"Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive',
    note: '字母辨识度高，容易看清圆弧和转角',
  },
  {
    id: 'print',
    label: '规范印刷体（Arial）',
    family: 'Arial, "Helvetica Neue", sans-serif',
    note: '最接近常见教材印刷体，适合认读',
  },
  {
    id: 'school',
    label: '清晰圆体（Century Gothic）',
    family: '"Century Gothic", "Trebuchet MS", Arial, sans-serif',
    note: '笔画清楚、字距舒展，适合先认读再书写',
  },
  {
    id: 'serif',
    label: '阅读衬线体（Georgia）',
    family: 'Georgia, "Times New Roman", serif',
    note: '适合朗读和较长课文，不建议作为初学书写范字',
  },
]

const PRINT_TONES: PrintTone[] = [
  { id: 'dark', label: '清晰深色', color: '#1c1917' },
  { id: 'medium', label: '中等灰色', color: '#64748b' },
  { id: 'light', label: '浅灰色', color: '#9ca3af' },
  { id: 'trace', label: '临摹浅色', color: '#cbd0d6' },
  { id: 'faint', label: '极浅临摹', color: '#dce0e5' },
]

// Primary stroke-start dot centers extracted from SassoonInfantDt-Regular.
// x is measured from the glyph origin and y upward from the baseline, in em.
const SASSOON_PRIMARY_START_POINTS: Record<string, GlyphStartPoint> = {
  a: { x: 0.38, y: 0.37 }, b: { x: 0.104, y: 0.688 }, c: { x: 0.356, y: 0.373 },
  d: { x: 0.384, y: 0.371 }, e: { x: 0.081, y: 0.228 }, f: { x: 0.325, y: 0.656 },
  g: { x: 0.392, y: 0.374 }, h: { x: 0.102, y: 0.689 }, i: { x: 0.102, y: 0.421 },
  j: { x: 0.102, y: 0.421 }, k: { x: 0.102, y: 0.686 }, l: { x: 0.096, y: 0.686 },
  m: { x: 0.084, y: 0.424 }, n: { x: 0.084, y: 0.424 }, o: { x: 0.373, y: 0.392 },
  p: { x: 0.087, y: 0.418 }, q: { x: 0.394, y: 0.367 }, r: { x: 0.079, y: 0.424 },
  s: { x: 0.293, y: 0.391 }, t: { x: 0.132, y: 0.566 }, u: { x: 0.09, y: 0.426 },
  v: { x: 0.068, y: 0.422 }, w: { x: 0.058, y: 0.422 }, x: { x: 0.086, y: 0.426 },
  y: { x: 0.091, y: 0.426 }, z: { x: 0.071, y: 0.423 },
  A: { x: 0.315, y: 0.692 }, B: { x: 0.113, y: 0.688 }, C: { x: 0.531, y: 0.596 },
  D: { x: 0.113, y: 0.688 }, E: { x: 0.113, y: 0.688 }, F: { x: 0.113, y: 0.688 },
  G: { x: 0.531, y: 0.596 }, H: { x: 0.114, y: 0.688 }, I: { x: 0.042, y: 0.688 },
  J: { x: 0.185, y: 0.688 }, K: { x: 0.113, y: 0.688 }, L: { x: 0.113, y: 0.688 },
  M: { x: 0.113, y: 0.688 }, N: { x: 0.113, y: 0.688 }, O: { x: 0.536, y: 0.606 },
  P: { x: 0.113, y: 0.688 }, Q: { x: 0.536, y: 0.606 }, R: { x: 0.113, y: 0.688 },
  S: { x: 0.411, y: 0.612 }, T: { x: 0.049, y: 0.689 }, U: { x: 0.113, y: 0.688 },
  V: { x: 0.068, y: 0.686 }, W: { x: 0.043, y: 0.692 }, X: { x: 0.066, y: 0.688 },
  Y: { x: 0.07, y: 0.688 }, Z: { x: 0.052, y: 0.688 },
}

function primaryStartPoint(word: string): GlyphStartPoint {
  const firstLetter = word.match(/[A-Za-z]/)?.[0]
  return (firstLetter && SASSOON_PRIMARY_START_POINTS[firstLetter]) || { x: 0, y: 0.42 }
}

function advancedMarkerStyle(word: string): CSSProperties {
  const point = primaryStartPoint(word)
  return {
    '--advanced-marker-x': `${point.x}em`,
    '--advanced-marker-y': `${point.y}em`,
  } as CSSProperties
}

function documentTitle(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]/g, '-')} · 课文打印`
}

async function printSettledLayout(): Promise<void> {
  await document.fonts.load('400 17pt "Rosie Sassoon Infant"', 'agjyp')
  await document.fonts.ready
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  })
  window.print()
}

export default function ReadingPassagePrintPage({ passageKey }: { passageKey: string }) {
  const passage = findPassageByKey(passageKey)
  const { user } = useAuth()
  const { vocab, isLoading: isVocabLoading } = useWordData(user)
  const [fontId, setFontId] = useState(PRINT_FONTS[0].id)
  const [toneId, setToneId] = useState(PRINT_TONES[0].id)
  const [blankVocabulary, setBlankVocabulary] = useState(false)
  const [positioningMode, setPositioningMode] = useState<PositioningMode>('normal')
  const [showWritingLines, setShowWritingLines] = useState(true)
  const font = useMemo(
    () => PRINT_FONTS.find((item) => item.id === fontId) ?? PRINT_FONTS[0],
    [fontId],
  )
  const tone = useMemo(
    () => PRINT_TONES.find((item) => item.id === toneId) ?? PRINT_TONES[0],
    [toneId],
  )
  const copyMode = toneId === 'trace'
  const blankableRegex = useMemo(() => buildEntryMatchRegex(vocab), [vocab])

  const renderParagraph = (text: string): ReactNode => {
    if (!blankVocabulary || !blankableRegex) return text
    const regex = new RegExp(blankableRegex.source, blankableRegex.flags)
    const parts: ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
      parts.push(
        <span
          key={`${match.index}-${match[0]}`}
          className="reading-print-blank"
          aria-label="词语挖空"
          style={advancedMarkerStyle(match[0])}
        >
          {match[0]}
        </span>,
      )
      lastIndex = match.index + match[0].length
      if (match.index === regex.lastIndex) regex.lastIndex += 1
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
  }

  useEffect(() => {
    if (!passage) return
    const previousTitle = document.title
    document.title = documentTitle(passage.title)
    return () => {
      document.title = previousTitle
    }
  }, [passage])

  if (!passage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-stone-600">
        <p>这篇课文不存在，暂时无法打印。</p>
        <Link href="/english/words/reading" className="text-sm text-indigo-700 hover:underline">
          ← 返回阅读列表
        </Link>
      </main>
    )
  }

  return (
    <div className="reading-print-root min-h-screen bg-stone-100">
      <div className="en-no-print sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-14 max-w-[1600px] flex-nowrap items-center gap-2 overflow-visible px-3 py-2 whitespace-nowrap sm:px-4">
          <Link
            href={`/english/words/reading/${passage.key}`}
            className="shrink-0 text-sm text-stone-500 no-underline transition hover:text-stone-700"
          >
            ← 返回课文
          </Link>
          <SelectControl
            value={fontId}
            options={PRINT_FONTS.map(({ id, label }) => ({ value: id, label }))}
            onValueChange={setFontId}
            ariaLabel="选择临摹字体"
            className="ml-auto w-[16rem] shrink-0"
            selectClassName="text-xs"
          />
          <button
            type="button"
            onClick={() => setBlankVocabulary((current) => !current)}
            disabled={isVocabLoading}
            aria-pressed={blankVocabulary}
            title="将文章里所有已录入词库的单词和变体挖空"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
              blankVocabulary
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {isVocabLoading ? '词库加载中…' : blankVocabulary ? '已挖空词汇' : '挖空词汇'}
          </button>
          <button
            type="button"
            onClick={() => setPositioningMode((current) => (current === 'normal' ? 'advanced' : 'normal'))}
            aria-pressed={positioningMode === 'advanced'}
            title="普通定位使用第 2 条线上的小点；高级定位使用首字母的主要起笔点"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              positioningMode === 'advanced'
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {positioningMode === 'advanced' ? '定位：高级' : '定位：普通'}
          </button>
          <button
            type="button"
            onClick={() => setShowWritingLines((current) => !current)}
            aria-pressed={showWritingLines}
            title="显示或隐藏英文四线书写格"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              showWritingLines
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {showWritingLines ? '四线格：开' : '四线格：关'}
          </button>
          <button
            type="button"
            onClick={() => setToneId((current) => (current === 'trace' ? 'dark' : 'trace'))}
            aria-pressed={copyMode}
            title="将正文变为浅灰色，方便临摹描写"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              copyMode
                ? 'bg-slate-600 text-white hover:bg-slate-700'
                : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {copyMode ? '默写模式：开' : '默写模式'}
          </button>
          <SelectControl
            value={toneId}
            options={PRINT_TONES.map(({ id, label, color }) => ({
              value: id,
              label,
              swatchColor: color,
            }))}
            onValueChange={setToneId}
            ariaLabel="选择打印字体颜色深浅"
            className="w-[9rem] shrink-0"
            selectClassName="text-xs"
          />
          <button
            type="button"
            onClick={() => void printSettledLayout()}
            className="shrink-0 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            打印
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] overflow-x-auto px-4 py-6 print:max-w-none print:overflow-visible print:p-0">
        <article
          className="reading-print-sheet rounded-lg bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none"
          style={{
            fontFamily: font.family,
            '--reading-print-ink': tone.color,
          } as CSSProperties}
        >
          <header className="reading-print-header">
            <h1>{passage.title}</h1>
          </header>

          <div
            className={`reading-print-body ${showWritingLines ? 'reading-print-guides' : ''} ${
              positioningMode === 'advanced' ? 'reading-print-position-advanced' : ''
            }`}
          >
            {passage.paragraphs.map((paragraph, index) => (
              <section key={`${passage.key}-${index}`}>
                {passage.paragraphTitles?.[index] && <h2>{passage.paragraphTitles[index]}</h2>}
                <p>
                  <span className="reading-print-line-text">{renderParagraph(paragraph)}</span>
                </p>
              </section>
            ))}
          </div>
        </article>
      </div>

      <style>{`
        @font-face {
          font-family: "Rosie Sassoon Infant";
          src: url("/fonts/SassoonInfantRg-Regular.ttf?v=20260913") format("truetype");
          font-style: normal;
          font-weight: 400;
          font-display: block;
        }
        @font-face {
          font-family: "Rosie Sassoon Infant Dotted";
          src: url("/fonts/SassoonInfantDt-Regular.ttf?v=20260914") format("truetype");
          font-style: normal;
          font-weight: 400;
          font-display: block;
        }
        .reading-print-sheet {
          box-sizing: border-box;
          width: 210mm;
          min-height: 297mm;
          padding: 10mm 12mm;
          color: #1c1917;
        }
        .reading-print-header { margin-bottom: .7rem; text-align: center; }
        .reading-print-header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; line-height: 1.25; }
        .reading-print-body { font-size: 17pt; line-height: 2.05; letter-spacing: .025em; }
        /* Four solid, evenly spaced guide lines. The third line is aligned as
           the baseline for the model text; the fourth leaves descender room. */
        .reading-print-guides {
          --guide-spacing: 3.5mm;
          --guide-height: 10.5mm;
          --guide-gap: 3.5mm;
          --guide-top: 0mm;
          --guide-second: calc(var(--guide-top) + var(--guide-spacing));
          --guide-third: calc(var(--guide-top) + var(--guide-spacing) + var(--guide-spacing));
          --guide-bottom: calc(var(--guide-top) + var(--guide-height));
          --writing-row: calc(var(--guide-height) + var(--guide-gap));
          --writing-text-offset: -1.2mm;
          --blank-marker-top: calc(var(--guide-second) - var(--writing-text-offset) + .5px);
          line-height: var(--writing-row);
        }
        .reading-print-guides p {
          background-image:
            linear-gradient(to bottom, #c6d7e8 0, #c6d7e8 1px, transparent 1px),
            linear-gradient(to bottom, #c6d7e8 0, #c6d7e8 1px, transparent 1px),
            linear-gradient(to bottom, #c6d7e8 0, #c6d7e8 1px, transparent 1px),
            linear-gradient(to bottom, #c6d7e8 0, #c6d7e8 1px, transparent 1px);
          background-repeat: repeat-y;
          background-size:
            100% var(--writing-row),
            100% var(--writing-row),
            100% var(--writing-row),
            100% var(--writing-row);
          background-position:
            0 var(--guide-top),
            0 var(--guide-second),
            0 var(--guide-third),
            0 var(--guide-bottom);
          /* Four lines create three 3.5 mm writing bands, followed by one
             3.5 mm blank band before the next four-line group begins. */
        }
        .reading-print-guides .reading-print-line-text {
          position: relative;
          top: var(--writing-text-offset);
        }
        .reading-print-body section { margin-bottom: .6rem; break-inside: auto; page-break-inside: auto; }
        .reading-print-guides section { margin-bottom: 0; }
        .reading-print-body h2 { margin: 0 0 .25rem; font-size: 1.08em; font-weight: 700; }
        .reading-print-body p { margin: 0; font-weight: 400; white-space: pre-wrap; }
        .reading-print-header h1,
        .reading-print-body h2,
        .reading-print-body p { color: var(--reading-print-ink, #1c1917); }
        .reading-print-blank { position: relative; z-index: 0; display: inline-block; color: transparent; vertical-align: baseline; white-space: pre; }
        /* The transparent source word keeps its exact printed width. A single
           small dot sits on the second guide at the word's starting edge. */
        .reading-print-blank::before {
          content: "";
          position: absolute;
          z-index: 1;
          top: var(--blank-marker-top, 50%);
          left: 0;
          width: 1px;
          height: 1px;
          border-radius: 50%;
          background: rgba(76, 111, 146, .62);
          transform: translateY(-50%);
        }
        .reading-print-position-advanced .reading-print-blank::before {
          top: calc(
            var(--guide-third, 7mm) -
            var(--advanced-marker-y, .42em) -
            var(--writing-text-offset, 0mm)
          );
          left: var(--advanced-marker-x, 0);
          width: .55mm;
          height: .55mm;
          border-radius: 50%;
          background: #cbd0d6;
          box-shadow: none;
          transform: translate(-50%, -50%);
        }
        @media print {
          @page { size: A4; margin: 10mm 12mm; }
          html, body, .en-words-print-layout, .reading-print-root {
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #1c1917 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .en-words-bg-deco, .en-no-print { display: none !important; visibility: hidden !important; }
          button[aria-label^="打开不不"],
          button[aria-label="收起不不"],
          button[aria-label="关闭不不"],
          aside[aria-label="不不对话框"] { display: none !important; visibility: hidden !important; }
          .reading-print-sheet {
            box-sizing: border-box !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .reading-print-guides p { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

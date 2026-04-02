'use client'

import type { Problem } from '@/utils/type'

function HighlightText({ text }: { text: string }) {
  // Highlight numbers and variable 'x'
  const parts = text.split(/(\d+(?:[.,]\d+)*|[a-z]x?\b)/)
  return (
    <>
      {parts.map((part, i) => {
        if (/^\d/.test(part)) {
          return (
            <strong key={i} className="font-extrabold text-violet-700">
              {part}
            </strong>
          )
        }
        if (/^[a-z]x?\b/.test(part) && part.length <= 3) {
          return (
            <em key={i} className="not-italic font-bold text-violet-600">
              {part}
            </em>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function classifyLine(line: string): 'method' | 'equation' | 'verify' | 'result' | 'step' {
  if (line.startsWith('方法') || line.startsWith('建立方程')) return 'method'
  if (line.startsWith('验证')) return 'verify'
  if (line.includes('→') && !line.includes('=')) return 'result'
  if (line.includes('→') || (line.includes('=') && !line.startsWith('建立'))) return 'result'
  if (/^[^：:]+[=＝]/.test(line)) return 'equation'
  return 'step'
}

const LINE_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  method:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   icon: '💡' },
  equation: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', icon: '📝' },
  verify:   { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-900',icon: '✅' },
  result:   { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-900',icon: '🌟' },
  step:     { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-800',   icon: '▸' },
}

export default function EquationDiagram({ problem }: { problem: Problem }) {
  return (
    <div className="mb-4">
      {/* Section label */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        <span>📐</span>
        <span>方程法 · 图解</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {problem.analysis.map((line, i) => {
          const type = classifyLine(line)
          const style = LINE_STYLES[type]
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${style.bg} ${style.border}`}
            >
              <span className="mt-px shrink-0 text-[13px]">{style.icon}</span>
              <span className={`text-[12px] leading-relaxed font-medium ${style.text}`}>
                <HighlightText text={line} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

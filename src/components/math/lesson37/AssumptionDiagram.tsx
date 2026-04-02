'use client'

import type { Problem } from '@/utils/type'

// ── Helpers ──────────────────────────────────────────────────────────────────

function HighlightText({ text, cls }: { text: string; cls: string }) {
  const parts = text.split(/(\d+(?:[.,]\d+)*)/)
  return (
    <>
      {parts.map((part, i) =>
        /^\d/.test(part) ? (
          <strong key={i} className={`font-extrabold ${cls}`}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function parseAnalysis(analysis: string[]) {
  const steps: (string | null)[] = [null, null, null, null]
  const preamble: string[] = []
  for (const line of analysis) {
    if (line.startsWith('①')) steps[0] = line.slice(2).trim()
    else if (line.startsWith('②')) steps[1] = line.slice(2).trim()
    else if (line.startsWith('③')) steps[2] = line.slice(2).trim()
    else if (line.startsWith('④')) steps[3] = line.slice(2).trim()
    else preamble.push(line)
  }
  return { steps, preamble }
}

// ── Step config ───────────────────────────────────────────────────────────────

const STEP_CFG = [
  {
    badge: '①',
    icon: '🎯',
    title: '全部假设',
    card: 'bg-blue-50 border-blue-200',
    badgeStyle: { background: '#3b82f6' },
    textCls: 'text-blue-900',
    numCls: 'text-blue-600',
    dotCls: 'bg-blue-300',
  },
  {
    badge: '②',
    icon: '🔍',
    title: '找出差值',
    card: 'bg-amber-50 border-amber-200',
    badgeStyle: { background: '#f59e0b' },
    textCls: 'text-amber-900',
    numCls: 'text-amber-700',
    dotCls: 'bg-amber-300',
  },
  {
    badge: '③',
    icon: '🔄',
    title: '换算一次',
    card: 'bg-violet-50 border-violet-200',
    badgeStyle: { background: '#8b5cf6' },
    textCls: 'text-violet-900',
    numCls: 'text-violet-600',
    dotCls: 'bg-violet-300',
  },
  {
    badge: '④',
    icon: '🌟',
    title: '推出答案',
    card: 'bg-emerald-50 border-emerald-200',
    badgeStyle: { background: '#10b981' },
    textCls: 'text-emerald-900',
    numCls: 'text-emerald-600',
    dotCls: 'bg-emerald-300',
  },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssumptionDiagram({ problem }: { problem: Problem }) {
  const { steps, preamble } = parseAnalysis(problem.analysis)
  const hasAnyStep = steps.some(Boolean)
  if (!hasAnyStep) return null

  return (
    <div className="mb-4">
      {/* Section label */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        <span>🧮</span>
        <span>假设法 · 图解</span>
      </div>

      {/* Preamble chips */}
      {preamble.length > 0 && (
        <div className="mb-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-[1.8] text-gray-600">
          {preamble.map((line, i) => (
            <div key={i}>
              <HighlightText text={line} cls="text-gray-800" />
            </div>
          ))}
        </div>
      )}

      {/* Step pipeline */}
      <div className="flex flex-col gap-0">
        {STEP_CFG.map((cfg, i) => {
          const text = steps[i]
          if (!text) return null
          const isLast = i === 3 || !steps.slice(i + 1).some(Boolean)
          return (
            <div key={i}>
              <div className={`rounded-xl border px-3 py-2.5 ${cfg.card}`}>
                <div className="mb-1 flex items-center gap-2">
                  {/* Numbered badge */}
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={cfg.badgeStyle}
                  >
                    {i + 1}
                  </span>
                  {/* Step title */}
                  <span className={`text-[11px] font-semibold ${cfg.textCls}`}>
                    {cfg.icon} {cfg.title}
                  </span>
                </div>
                {/* Step content */}
                <div className={`ml-[30px] text-[12px] leading-relaxed font-medium ${cfg.textCls}`}>
                  <HighlightText text={text} cls={cfg.numCls} />
                </div>
              </div>

              {/* Connector between steps */}
              {!isLast && (
                <div className="flex justify-center py-0.5">
                  <div className="flex flex-col items-center gap-[3px]">
                    <div className={`h-[5px] w-[5px] rounded-full ${cfg.dotCls}`} />
                    <div className={`h-[5px] w-[5px] rounded-full ${cfg.dotCls} opacity-60`} />
                    <div className={`h-[5px] w-[5px] rounded-full ${cfg.dotCls} opacity-30`} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

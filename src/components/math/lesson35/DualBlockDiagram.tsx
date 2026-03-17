'use client'

import { useState, useCallback } from 'react'
import type { DualSceneConfig } from '@/utils/type'

interface DualBlockDiagramProps {
  config: DualSceneConfig
  probId: string
}

interface DualState {
  guiA: boolean
  guiB: boolean
  expA: boolean
  expB: boolean
  spinA: number
  spinB: number
}

export default function DualBlockDiagram({ config: ds, probId }: DualBlockDiagramProps) {
  const [state, setState] = useState<DualState>({
    guiA: false,
    guiB: false,
    expA: false,
    expB: false,
    spinA: ds.targetA,
    spinB: ds.targetB,
  })

  const guiALabel = ds.guiALabel || `÷${ds.initA} 归一到1${ds.unitA}`
  const guiBLabel = ds.guiBLabel || `÷${ds.initB} 归一到1${ds.unitB}`

  let curA = state.guiA ? 1 : ds.initA
  let curB = state.guiB ? 1 : ds.initB
  if (state.expA) curA = state.spinA
  if (state.expB) curB = state.spinB

  const perUnit = ds.totalBase / ds.initA / ds.initB
  const result = perUnit * curA * curB
  const totalGroups = curA * curB
  const rounded = Math.round(result)

  const toggle = useCallback((key: 'guiA' | 'guiB') => {
    setState(s => ({ ...s, [key]: !s[key] }))
  }, [])

  const toggleExpand = useCallback((axis: 'A' | 'B') => {
    setState(s => {
      if (axis === 'A') return { ...s, expA: !s.expA }
      return { ...s, expB: !s.expB }
    })
  }, [])

  const spin = useCallback((axis: 'A' | 'B', delta: number) => {
    setState(s => {
      const key = axis === 'A' ? 'spinA' : 'spinB'
      return { ...s, [key]: Math.max(1, Math.min(1000, s[key] + delta)) }
    })
  }, [])

  const spinInput = useCallback((axis: 'A' | 'B', val: string) => {
    const v = Math.max(1, Math.min(1000, parseInt(val) || 1))
    setState(s => {
      const key = axis === 'A' ? 'spinA' : 'spinB'
      return { ...s, [key]: v }
    })
  }, [])

  const reset = useCallback(() => {
    setState({
      guiA: false, guiB: false, expA: false, expB: false,
      spinA: ds.targetA, spinB: ds.targetB,
    })
  }, [ds.targetA, ds.targetB])

  const isTargetMatch = ds.isReverse && ds.targetTotal && rounded === ds.targetTotal

  function renderGroups(count: number, unit: string, dimClass: string, labelColor: string, max = 8) {
    return (
      <div className="flex min-h-[34px] flex-wrap items-center gap-[5px] rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
        {Array.from({ length: Math.min(count, max) }, (_, i) => (
          <div key={i} className="relative mt-2.5 flex max-w-[110px] flex-wrap items-center gap-0.5 rounded-[5px] border border-dashed border-gray-800/25 bg-white/75 px-1 py-1">
            <div className="absolute -top-2.5 left-0.5 whitespace-nowrap rounded-full bg-[#f0f1ff] px-1 text-[9px] text-text-secondary">
              {i + 1}{unit}
            </div>
            <div className={`h-[11px] w-[11px] shrink-0 rounded-[3px] transition-all duration-250 ${dimClass}`} />
          </div>
        ))}
        {count > max && (
          <div className={`px-1.5 py-1 text-[10px] font-bold ${labelColor}`}>
            共{count}{unit}
          </div>
        )}
      </div>
    )
  }

  function renderResultGroups() {
    const perG = Math.round(perUnit)
    const grpShow = Math.min(totalGroups, 8)
    return (
      <div className="flex min-h-[34px] flex-wrap items-center gap-[5px] rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
        {Array.from({ length: grpShow }, (_, i) => (
          <div key={i} className="relative mt-2.5 flex max-w-[110px] flex-wrap items-center gap-0.5 rounded-[5px] border border-dashed border-gray-800/25 bg-white/75 px-1 py-1">
            <div className="absolute -top-2.5 left-0.5 whitespace-nowrap rounded-full bg-[#f0f1ff] px-1 text-[9px] text-text-secondary">
              {i + 1}
            </div>
            {Array.from({ length: Math.min(perG, 6) }, (_, j) => (
              <div key={j} className="h-[11px] w-[11px] shrink-0 rounded-[3px] bg-app-orange transition-all duration-250" />
            ))}
            {perG > 6 && (
              <div className="px-0.5 text-[8px] font-bold text-[#c2410c]">×{perG}</div>
            )}
          </div>
        ))}
        {totalGroups > 8 && (
          <div className="px-1.5 py-1 text-[10px] font-semibold text-[#92400e]">共{totalGroups}组</div>
        )}
      </div>
    )
  }

  const summaryHTML = (() => {
    if (!state.guiA && !state.guiB && !state.expA && !state.expB) {
      return `初始状态：${ds.initA}${ds.unitA} × ${ds.initB}${ds.unitB} → 共 <strong>${ds.totalBase}${ds.unitC}</strong>`
    }
    const steps: string[] = []
    if (state.guiA) steps.push(`<span style="color:#3b82f6">÷${ds.initA}→1${ds.unitA}</span>`)
    if (state.guiB) steps.push(`<span style="color:#6366f1">÷${ds.initB}→1${ds.unitB}</span>`)
    if (state.expA) steps.push(`<span style="color:#0ea5e9">→${curA}${ds.unitA}</span>`)
    if (state.expB) steps.push(`<span style="color:#8b5cf6">→${curB}${ds.unitB}</span>`)
    const color = isTargetMatch ? '#10b981' : '#374151'
    return `${steps.join(' ')}<br><strong>${curA}${ds.unitA} × ${curB}${ds.unitB} = ${totalGroups}组 × 每组${Math.round(perUnit)}${ds.unitC} = <span style="color:${color}">${rounded}${ds.unitC}</span></strong>`
  })()

  return (
    <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[#4338ca]">
        🧩 双归一 · 份数联动图
        {ds.isReverse && (
          <span className="ml-1.5 rounded-full bg-yellow-light px-2 py-0.5 text-[11px] text-[#92400e]">
            反向推理
          </span>
        )}
      </div>

      {/* Three axis columns */}
      <div className="mb-2.5 flex flex-wrap gap-2.5">
        <div className="min-w-[130px] flex-1">
          <div className="mb-1.5 inline-block rounded bg-[#dbeafe] px-2 py-0.5 text-[11px] font-bold text-[#1d4ed8]">
            🔵 {ds.labelA}（初始{ds.initA}{ds.unitA}）
          </div>
          {renderGroups(curA, ds.unitA, 'bg-[#3b82f6]', 'text-[#1d4ed8]')}
          <div className="mt-1 text-[11px] text-text-secondary">{curA}{ds.unitA}</div>
        </div>
        <div className="min-w-[130px] flex-1">
          <div className="mb-1.5 inline-block rounded bg-[#e0e7ff] px-2 py-0.5 text-[11px] font-bold text-[#4338ca]">
            🟣 {ds.labelB}（初始{ds.initB}{ds.unitB}）
          </div>
          {renderGroups(curB, ds.unitB, 'bg-[#6366f1]', 'text-[#6366f1]')}
          <div className="mt-1 text-[11px] text-text-secondary">{curB}{ds.unitB}</div>
        </div>
        <div className="min-w-[130px] flex-1">
          <div className="mb-1.5 inline-block rounded bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
            🟠 {ds.labelC}（结果）
          </div>
          {renderResultGroups()}
          <div className={`mt-1 text-[11px] ${isTargetMatch ? 'text-app-green' : 'text-text-secondary'}`}>
            共{rounded}{ds.unitC}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div
        className="mb-2 rounded-lg bg-[#eef2ff] px-2.5 py-2 text-xs leading-relaxed text-[#3730a3]"
        dangerouslySetInnerHTML={{ __html: summaryHTML }}
      />

      {/* Phase 1: Gui buttons */}
      <div className="mb-1 text-[11px] font-semibold text-text-muted">第一步：选择归一（可同时选）</div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => toggle('guiA')}
          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-all ${
            state.guiA
              ? 'border-[#3b82f6] bg-[#3b82f6] text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
              : 'border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]'
          }`}
        >
          {guiALabel}
        </button>
        <button
          onClick={() => toggle('guiB')}
          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-all ${
            state.guiB
              ? 'border-[#6366f1] bg-[#6366f1] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
              : 'border-[#a5b4fc] bg-[#eef2ff] text-[#4338ca]'
          }`}
        >
          {guiBLabel}
        </button>
      </div>

      {/* Phase 2: Expand */}
      <div className="mb-1 text-[11px] font-semibold text-text-muted">第二步：调整扩展目标（点击开启后用＋/－调节，范围1-1000）</div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => toggleExpand('A')}
          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-all ${
            state.expA ? 'border-[#0ea5e9] bg-[#0ea5e9] text-white' : 'border-[#7dd3fc] bg-[#f0f9ff] text-[#0369a1]'
          }`}
        >
          扩展{ds.labelA}
        </button>
        <button
          onClick={() => toggleExpand('B')}
          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-all ${
            state.expB ? 'border-[#8b5cf6] bg-[#8b5cf6] text-white' : 'border-[#c4b5fd] bg-[#faf5ff] text-[#7c3aed]'
          }`}
        >
          扩展{ds.labelB}
        </button>
        <button
          onClick={reset}
          className="cursor-pointer rounded-full border-[1.5px] border-border-light bg-[#f9fafb] px-3 py-1.5 text-xs font-semibold text-text-secondary transition-all"
        >
          重置
        </button>
      </div>

      {/* Spinboxes */}
      {state.expA && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#f8faff] px-2.5 py-2">
          <span className="whitespace-nowrap text-xs font-semibold text-[#1d4ed8]">{ds.labelA}：</span>
          <button onClick={() => spin('A', -1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92]">－</button>
          <input
            type="number" min="1" max="1000"
            className="h-7 w-16 rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-center text-sm font-bold outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]"
            value={state.spinA}
            onChange={e => spinInput('A', e.target.value)}
          />
          <button onClick={() => spin('A', 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92]">＋</button>
          <span className="text-xs text-[#1d4ed8]">{ds.unitA}</span>
        </div>
      )}
      {state.expB && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#f8faff] px-2.5 py-2">
          <span className="whitespace-nowrap text-xs font-semibold text-[#6366f1]">{ds.labelB}：</span>
          <button onClick={() => spin('B', -1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-base font-bold transition-all active:scale-[0.92]">－</button>
          <input
            type="number" min="1" max="1000"
            className="h-7 w-16 rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-center text-sm font-bold outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]"
            value={state.spinB}
            onChange={e => spinInput('B', e.target.value)}
          />
          <button onClick={() => spin('B', 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-base font-bold transition-all active:scale-[0.92]">＋</button>
          <span className="text-xs text-[#6366f1]">{ds.unitB}</span>
        </div>
      )}

      {/* Reverse hint */}
      {ds.isReverse && state.expB && (
        <div className="mt-1.5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs">
          🎯 目标：{ds.targetTotal}{ds.unitC}｜当前结果：
          <span className={`font-bold ${isTargetMatch ? 'text-app-green' : 'text-[#6366f1]'}`}>
            {rounded}{ds.unitC}
          </span>
          {isTargetMatch && <span className="ml-1.5">✅ 找到答案！</span>}
        </div>
      )}
    </div>
  )
}

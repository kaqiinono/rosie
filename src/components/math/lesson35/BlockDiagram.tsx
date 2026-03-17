'use client'

import { useState, useCallback } from 'react'
import type { BlockScene } from '@/utils/type'

interface BlockDiagramProps {
  scene: BlockScene
  probId: string
}

type Stage = 'initial' | 'unit' | 'target'

export default function BlockDiagram({ scene, probId }: BlockDiagramProps) {
  const isExpandable = !!scene.expandUnit

  if (isExpandable) {
    return <ExpandableBlockDiagram scene={scene} />
  }
  return <SteppedBlockDiagram scene={scene} />
}

function ExpandableBlockDiagram({ scene }: { scene: BlockScene }) {
  const [parts, setParts] = useState(scene.init)
  const rightUnit = scene.rightUnit || '个'
  const result = parts * scene.perPart
  const isAnswer = scene.answer != null && result === scene.answer

  const spin = useCallback((delta: number) => {
    setParts(p => Math.max(1, Math.min(20, p + delta)))
  }, [])

  const spinInput = useCallback((val: string) => {
    const v = Math.max(1, Math.min(20, parseInt(val) || 1))
    setParts(v)
  }, [])

  const reset = useCallback(() => {
    setParts(scene.init)
  }, [scene.init])

  return (
    <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[#4338ca]">
        🧩 拆解图 · 可扩展
      </div>

      {/* Left: 份数 blocks */}
      <div className="mb-1.5 text-[11px] font-semibold text-text-muted">📦 {scene.leftLabel || '份数'}</div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[10px] bg-[#e5e7ff] px-2 py-1">
          {Array.from({ length: Math.min(parts, 8) }, (_, i) => (
            <div key={i} className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
              <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">
                {i + 1}份
              </div>
              <div className="h-[13px] w-[13px] rounded-[3px] bg-[#4f46e5] shadow-[0_1px_2px_rgba(0,0,0,0.1)]" />
            </div>
          ))}
          {parts > 8 && (
            <div className="px-1.5 py-1 text-[10px] font-bold text-[#4338ca]">共{parts}份</div>
          )}
        </div>
        <span className="text-[11px] text-text-secondary">{parts}份</span>
      </div>

      {/* Right: 结果 blocks */}
      <div className="mb-1.5 mt-3 text-[11px] font-semibold text-text-muted">🔢 {scene.rightLabel || '结果'}</div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[10px] bg-[#e5e7ff] px-2 py-1">
          {Array.from({ length: Math.min(parts, 8) }, (_, i) => (
            <div key={i} className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
              <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">
                {i + 1}份
              </div>
              {Array.from({ length: Math.min(scene.perPart, 6) }, (_, j) => (
                <div key={j} className="h-[13px] w-[13px] rounded-[3px] bg-app-orange shadow-[0_1px_2px_rgba(0,0,0,0.1)]" />
              ))}
              {scene.perPart > 6 && (
                <div className="px-0.5 text-[8px] font-bold text-[#c2410c]">×{scene.perPart}</div>
              )}
            </div>
          ))}
          {parts > 8 && (
            <div className="px-1.5 py-1 text-[10px] font-semibold text-[#92400e]">共{parts}组</div>
          )}
        </div>
        <span className={`text-[11px] ${isAnswer ? 'font-bold text-app-green' : 'text-text-secondary'}`}>
          {parts}份 共{result}{rightUnit}
        </span>
      </div>

      {/* Expand controls */}
      <div className="mb-1 mt-3 text-[11px] font-semibold text-text-muted">
        调整份数（每份 = {scene.expandUnit}，用＋/－加减1份）
      </div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#f8faff] px-2.5 py-2">
        <span className="whitespace-nowrap text-xs font-semibold text-[#4338ca]">份数：</span>
        <button
          onClick={() => spin(-1)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92]"
        >
          －
        </button>
        <input
          type="number"
          min="1"
          max="20"
          className="h-7 w-16 rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-center text-sm font-bold outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]"
          value={parts}
          onChange={e => spinInput(e.target.value)}
        />
        <button
          onClick={() => spin(1)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92]"
        >
          ＋
        </button>
        <span className="text-xs text-[#4338ca]">份（每份{scene.expandUnit}）</span>
        <button
          onClick={reset}
          className="ml-auto cursor-pointer rounded-full border-[1.5px] border-border-light bg-[#f9fafb] px-3 py-1.5 text-xs font-semibold text-text-secondary transition-all"
        >
          重置
        </button>
      </div>

      {/* Summary */}
      <div className={`rounded-lg px-3 py-2.5 text-xs leading-relaxed ${isAnswer ? 'border border-app-green bg-app-green-light text-app-green-dark' : 'bg-[#eef2ff] text-[#3730a3]'}`}>
        {isAnswer ? (
          <span>✅ <strong>{parts}份 × 每份{scene.perPart}{rightUnit} = {result}{rightUnit}</strong> — 找到答案！</span>
        ) : (
          <span>💡 当前：{parts}份 × 每份{scene.perPart}{rightUnit} = <strong>{result}{rightUnit}</strong>（目标：{scene.answer}{rightUnit}）</span>
        )}
      </div>
    </div>
  )
}

function SteppedBlockDiagram({ scene }: { scene: BlockScene }) {
  const [stage, setStage] = useState<Stage>('initial')

  const leftLabel = scene.leftLabel || '份数'
  const rightLabel = scene.rightLabel || '结果'
  const hint = scene.hint || '口令：先÷份数归一，再×目标份数'
  const rightUnit = scene.rightUnit || '个'

  const parts = stage === 'initial' ? scene.init : stage === 'unit' ? scene.unit : scene.target

  const hintText =
    stage === 'unit'
      ? `归一后：1份含${scene.perPart}${rightUnit}，每份相同！`
      : stage === 'target'
        ? `扩展到${scene.target}份：共${scene.target * scene.perPart}${rightUnit}！`
        : hint

  return (
    <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5">
      {/* Left groups */}
      <div className="mb-1.5 text-[11px] font-semibold text-text-muted">📦 {leftLabel}</div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-full bg-[#e5e7ff] px-2 py-1">
          {Array.from({ length: Math.min(parts, 8) }, (_, i) => (
            <div key={i} className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
              <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">
                {i + 1}份
              </div>
              <div className="h-[13px] w-[13px] rounded-[3px] bg-[#4f46e5] shadow-[0_1px_2px_rgba(0,0,0,0.1)]" />
            </div>
          ))}
        </div>
        <span className="text-[11px] text-text-secondary">{parts}份</span>
      </div>

      {/* Right groups */}
      <div className="mb-1.5 mt-3 text-[11px] font-semibold text-text-muted">🔢 {rightLabel}</div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-full bg-[#e5e7ff] px-2 py-1">
          {Array.from({ length: Math.min(parts, 8) }, (_, i) => (
            <div key={i} className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
              <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">
                {i + 1}份
              </div>
              {Array.from({ length: Math.min(scene.perPart, 6) }, (_, j) => (
                <div key={j} className="h-[13px] w-[13px] rounded-[3px] bg-app-orange shadow-[0_1px_2px_rgba(0,0,0,0.1)]" />
              ))}
            </div>
          ))}
        </div>
        <span className="text-[11px] text-text-secondary">
          {parts}份 共{parts * scene.perPart}{rightUnit}
        </span>
      </div>

      {/* Step buttons */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => setStage('unit')}
          disabled={stage !== 'initial'}
          className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
        >
          ① 归一到1份
        </button>
        <button
          onClick={() => setStage('target')}
          disabled={stage !== 'unit'}
          className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
        >
          ② 扩展到{scene.target}份
        </button>
        <button
          onClick={() => setStage('initial')}
          className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-[13px] font-semibold text-text-secondary transition-all active:translate-y-px"
        >
          重置
        </button>
      </div>

      <div className="mt-2 rounded-lg bg-app-green-light px-3 py-2.5 text-xs leading-relaxed text-app-green-dark">
        💡 {hintText}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { BlockScene } from '@/utils/type'

interface BlockDiagramProps {
  scene: BlockScene
  probId: string
}

type Stage = 'initial' | 'unit' | 'target'

export default function BlockDiagram({ scene, probId }: BlockDiagramProps) {
  const [stage, setStage] = useState<Stage>('initial')

  const leftLabel = scene.leftLabel || '份数'
  const rightLabel = scene.rightLabel || '结果'
  const hint = scene.hint || '口令：先÷份数归一，再×目标份数'
  const rightUnit = scene.rightUnit || '个'

  const parts = stage === 'initial' ? scene.init : stage === 'unit' ? scene.unit : scene.target

  function stepUnit() {
    setStage('unit')
  }

  function stepTarget() {
    setStage('target')
  }

  function reset() {
    setStage('initial')
  }

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
          onClick={stepUnit}
          disabled={stage !== 'initial'}
          className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
        >
          ① 归一到1份
        </button>
        <button
          onClick={stepTarget}
          disabled={stage !== 'unit'}
          className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
        >
          ② 扩展到{scene.target}份
        </button>
        <button
          onClick={reset}
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

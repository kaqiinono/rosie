'use client'

import { useState, useCallback } from 'react'
import type { BlockScene } from '@/utils/type'

interface BlockDiagramProps {
  scene: BlockScene
  probId: string
}

type Stage = 'split' | 'expand'

export default function BlockDiagram({ scene }: BlockDiagramProps) {
  const initVar = scene.init
  const initRes = scene.total
  const leftUnit = scene.leftUnit || '份'
  const rightUnit = scene.rightUnit || '个'

  const [stage, setStage] = useState<Stage>('split')
  const [splitParts, setSplitParts] = useState(1)
  const [expandParts, setExpandParts] = useState(1)

  const varOk = splitParts > 0 && initVar % splitParts === 0
  const resOk = splitParts > 0 && initRes % splitParts === 0
  const canSplit = varOk && resOk && splitParts >= 1

  const varPerUnit = canSplit ? initVar / splitParts : 0
  const resPerUnit = canSplit ? initRes / splitParts : 0

  const expandVar = expandParts * varPerUnit
  const expandRes = expandParts * resPerUnit
  const isAnswer = scene.answer != null && expandRes === scene.answer

  const spinSplit = useCallback((d: number) => {
    setSplitParts(p => Math.max(1, Math.min(999, p + d)))
  }, [])
  const onSplitInput = useCallback((v: string) => {
    setSplitParts(Math.max(1, Math.min(999, parseInt(v) || 1)))
  }, [])
  const spinExpand = useCallback((d: number) => {
    setExpandParts(p => Math.max(1, Math.min(999, p + d)))
  }, [])
  const onExpandInput = useCallback((v: string) => {
    setExpandParts(Math.max(1, Math.min(999, parseInt(v) || 1)))
  }, [])

  const doGuiyi = useCallback(() => {
    if (canSplit) setStage('expand')
  }, [canSplit])

  const reset = useCallback(() => {
    setStage('split')
    setSplitParts(1)
    setExpandParts(1)
  }, [])

  const varRem = initVar % (splitParts || 1)
  const resRem = initRes % (splitParts || 1)

  return (
    <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[#4338ca]">
        🧩 拆解图 · 分步操作
      </div>

      {/* ── Step 1: 拆解 ── */}
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] font-semibold text-text-muted">
          📦 第一步：将{' '}
          <strong className="text-[#1d4ed8]">{initVar}{leftUnit}</strong> 和{' '}
          <strong className="text-[#c2410c]">{initRes}{rightUnit}</strong> 同时平均拆分
          {scene.expandUnit && (
            <span className="ml-1 text-text-muted">（每份 = {scene.expandUnit}）</span>
          )}
        </div>

        <SpinRow
          label="拆分份数"
          value={splitParts}
          onSpin={spinSplit}
          onInput={onSplitInput}
          suffix="份"
          disabled={stage !== 'split'}
        />

        {/* Two-column split visual */}
        <div className="flex gap-2.5">
          <SplitColumn
            title={leftUnit}
            initValue={initVar}
            parts={splitParts}
            unit={leftUnit}
            isValid={splitParts <= 1 || varOk}
            blockColor="bg-[#4f46e5]"
            labelBg="bg-[#dbeafe]"
            labelColor="text-[#1d4ed8]"
          />
          <SplitColumn
            title="结果"
            initValue={initRes}
            parts={splitParts}
            unit={rightUnit}
            isValid={splitParts <= 1 || resOk}
            blockColor="bg-app-orange"
            labelBg="bg-[#fff7ed]"
            labelColor="text-[#c2410c]"
          />
        </div>

        {/* Feedback */}
        {stage === 'split' && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            splitParts <= 1
              ? 'bg-[#eef2ff] text-[#3730a3]'
              : canSplit
                ? 'border border-app-green bg-app-green-light text-app-green-dark'
                : 'border border-red-300 bg-red-50 text-red-700'
          }`}>
            {splitParts <= 1
              ? <span>💡 试试将 {initVar}{leftUnit} 和 {initRes}{rightUnit} 拆分成更多份数</span>
              : canSplit
                ? <span>✅ {initVar}{leftUnit}÷{splitParts} = <strong>{varPerUnit}{leftUnit}</strong>，{initRes}{rightUnit}÷{splitParts} = <strong>{resPerUnit}{rightUnit}</strong>，平均分配成功！</span>
                : <span>❌ {!varOk && `${initVar}${leftUnit}无法被${splitParts}整除（余${varRem}）`}{!varOk && !resOk && '；'}{!resOk && `${initRes}${rightUnit}无法被${splitParts}整除（余${resRem}）`}，请调整份数</span>}
          </div>
        )}
      </div>

      {/* ── 归一 Button ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={doGuiyi}
          disabled={!canSplit || stage !== 'split'}
          className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
        >
          ① 归一 → 取出 1 份
        </button>
        {stage === 'expand' && (
          <span className="rounded-full bg-app-green-light px-2.5 py-1 text-xs font-bold text-app-green-dark">
            ✅ 1份 = {varPerUnit}{leftUnit} / {resPerUnit}{rightUnit}
          </span>
        )}
      </div>

      {/* ── Step 2: 扩展 ── */}
      {stage === 'expand' && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold text-text-muted">
            🔢 第二步：同时扩展（每份 = {varPerUnit}{leftUnit} / {resPerUnit}{rightUnit}）
          </div>

          <SpinRow
            label="扩展份数"
            value={expandParts}
            onSpin={spinExpand}
            onInput={onExpandInput}
            suffix="份"
            disabled={false}
          />

          {/* Two-column expand visual */}
          <div className="flex gap-2.5">
            <ExpandColumn
              title={leftUnit}
              unitValue={varPerUnit}
              parts={expandParts}
              unit={leftUnit}
              blockColor="bg-[#4f46e5]"
              labelBg="bg-[#dbeafe]"
              labelColor="text-[#1d4ed8]"
            />
            <ExpandColumn
              title="结果"
              unitValue={resPerUnit}
              parts={expandParts}
              unit={rightUnit}
              blockColor="bg-app-orange"
              labelBg="bg-[#fff7ed]"
              labelColor="text-[#c2410c]"
            />
          </div>

          {/* Result summary */}
          <div className={`mt-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed ${
            isAnswer
              ? 'border border-app-green bg-app-green-light text-app-green-dark'
              : 'bg-[#eef2ff] text-[#3730a3]'
          }`}>
            {isAnswer
              ? <span>✅ <strong>{expandParts}份 → {expandVar}{leftUnit} / {expandRes}{rightUnit}</strong> — 找到答案！</span>
              : <span>💡 当前：{expandParts}份 → {expandVar}{leftUnit} / <strong>{expandRes}{rightUnit}</strong>（继续调整份数）</span>}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={reset}
          className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-[13px] font-semibold text-text-secondary transition-all active:translate-y-px"
        >
          重置
        </button>
      </div>
      <div className="mt-2 rounded-lg bg-app-green-light px-3 py-2.5 text-xs leading-relaxed text-app-green-dark">
        💡 {scene.hint || '口令：先÷份数归一，再×目标份数'}
      </div>
    </div>
  )
}

/* ── SpinRow ── */
function SpinRow({ label, value, onSpin, onInput, suffix, disabled }: {
  label: string; value: number; onSpin: (d: number) => void; onInput: (v: string) => void
  suffix: string; disabled: boolean
}) {
  const btn = 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92] disabled:cursor-default disabled:opacity-40'
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#f8faff] px-2.5 py-2">
      <span className="whitespace-nowrap text-xs font-semibold text-[#4338ca]">{label}：</span>
      <button onClick={() => onSpin(-1)} disabled={disabled} className={btn}>－</button>
      <input
        type="number" min="1"
        disabled={disabled}
        className="h-7 w-16 rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-center text-sm font-bold outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)] disabled:opacity-40"
        value={value}
        onChange={e => onInput(e.target.value)}
      />
      <button onClick={() => onSpin(1)} disabled={disabled} className={btn}>＋</button>
      <span className="text-xs text-[#4338ca]">{suffix}</span>
    </div>
  )
}

/* ── SplitColumn: one side of the two-column split visual ── */
const MG = 8, MB = 6

function SplitColumn({ title, initValue, parts, unit, isValid, blockColor, labelBg, labelColor }: {
  title: string; initValue: number; parts: number; unit: string
  isValid: boolean; blockColor: string; labelBg: string; labelColor: string
}) {
  if (parts <= 1) {
    return (
      <div className="min-w-0 flex-1">
        <div className={`mb-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${labelBg} ${labelColor}`}>
          📊 {title}（{initValue}{unit}）
        </div>
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
          <div className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
            <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">总量</div>
            {Array.from({ length: Math.min(initValue, MB) }, (_, j) => (
              <div key={j} className={`h-[13px] w-[13px] rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${blockColor}`} />
            ))}
            {initValue > MB && <div className={`px-0.5 text-[8px] font-bold ${labelColor}`}>×{initValue}</div>}
          </div>
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">共{initValue}{unit}</div>
      </div>
    )
  }

  const perG = Math.floor(initValue / parts)
  const rem = initValue % parts
  const showN = Math.min(parts, MG)

  return (
    <div className="min-w-0 flex-1">
      <div className={`mb-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${labelBg} ${labelColor}`}>
        📊 {title}（{initValue}{unit}）
      </div>
      <div className={`flex min-h-8 flex-wrap items-center gap-1.5 rounded-[10px] px-2 py-1.5 ${
        isValid ? 'bg-[#e5e7ff]' : 'border border-red-200 bg-red-50'
      }`}>
        {Array.from({ length: showN }, (_, i) => {
          const extra = !isValid && i < rem
          const gs = isValid ? initValue / parts : (extra ? perG + 1 : perG)
          const showB = Math.min(gs, MB)
          return (
            <div key={i} className={`relative mt-3 flex gap-0.5 rounded-md border px-1.5 py-1 ${
              extra ? 'border-red-400 bg-red-50' : 'border-dashed border-gray-800/30 bg-white/70'
            }`}>
              <div className={`absolute -top-2.5 left-1 whitespace-nowrap rounded-full px-1 text-[9px] ${
                extra ? 'bg-red-100 font-bold text-red-600' : 'bg-[#f8fafc] text-text-secondary'
              }`}>{i + 1}份{extra ? ' ⚠' : ''}</div>
              {Array.from({ length: showB }, (_, j) => (
                <div key={j} className={`h-[13px] w-[13px] rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${
                  extra && j === showB - 1 ? 'bg-red-400' : blockColor
                }`} />
              ))}
              {gs > MB && (
                <div className={`px-0.5 text-[8px] font-bold ${extra ? 'text-red-600' : labelColor}`}>×{gs}</div>
              )}
            </div>
          )
        })}
        {parts > MG && <div className={`px-1.5 py-1 text-[10px] font-semibold ${labelColor}`}>共{parts}份</div>}
      </div>
      <div className={`mt-1 text-[11px] ${isValid ? 'text-text-secondary' : 'font-bold text-red-600'}`}>
        {isValid
          ? `${parts}份 · 每份${initValue / parts}${unit}`
          : `无法平均分（余${rem}）`}
      </div>
    </div>
  )
}

/* ── ExpandColumn: one side of the two-column expand visual ── */
function ExpandColumn({ title, unitValue, parts, unit, blockColor, labelBg, labelColor }: {
  title: string; unitValue: number; parts: number; unit: string
  blockColor: string; labelBg: string; labelColor: string
}) {
  const total = unitValue * parts
  return (
    <div className="min-w-0 flex-1">
      <div className={`mb-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${labelBg} ${labelColor}`}>
        📊 {title}（每份{unitValue}{unit}）
      </div>
      <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
        {Array.from({ length: Math.min(parts, MG) }, (_, i) => (
          <div key={i} className="relative mt-3 flex gap-0.5 rounded-md border border-dashed border-gray-800/30 bg-white/70 px-1.5 py-1">
            <div className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full bg-[#f8fafc] px-1 text-[9px] text-text-secondary">
              {i + 1}份
            </div>
            {Array.from({ length: Math.min(unitValue, MB) }, (_, j) => (
              <div key={j} className={`h-[13px] w-[13px] rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${blockColor}`} />
            ))}
            {unitValue > MB && (
              <div className={`px-0.5 text-[8px] font-bold ${labelColor}`}>×{unitValue}</div>
            )}
          </div>
        ))}
        {parts > MG && <div className={`px-1.5 py-1 text-[10px] font-semibold ${labelColor}`}>共{parts}份</div>}
      </div>
      <div className="mt-1 text-[11px] text-text-secondary">
        {parts}份 · 共{total}{unit}
      </div>
    </div>
  )
}

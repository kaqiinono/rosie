'use client'

import { useState, useCallback } from 'react'
import type { DualSceneConfig } from '@/utils/type'

interface DualBlockDiagramProps {
  config: DualSceneConfig
  probId: string
}

type Stage = 'split' | 'expand'

export default function DualBlockDiagram({ config: ds }: DualBlockDiagramProps) {
  const [stage, setStage] = useState<Stage>('split')
  const [splitA, setSplitA] = useState(1)
  const [splitB, setSplitB] = useState(1)
  const [expandA, setExpandA] = useState(1)
  const [expandB, setExpandB] = useState(1)

  const totalGroups = splitA * splitB
  const canSplit = (splitA > 1 || splitB > 1) && ds.totalBase % totalGroups === 0
  const perUnit = canSplit ? ds.totalBase / totalGroups : 0

  const expandGroups = expandA * expandB
  const result = perUnit * expandGroups
  const rounded = Math.round(result)

  const expectedAnswer = ds.isReverse && ds.targetTotal
    ? ds.targetTotal
    : Math.round((ds.totalBase / ds.initA / ds.initB) * ds.targetA * ds.targetB)
  const isAnswer = stage === 'expand' && rounded === expectedAnswer

  const clamp = (v: number) => Math.max(1, Math.min(999, v))

  const spinSplitA = useCallback((d: number) => setSplitA(p => clamp(p + d)), [])
  const inputSplitA = useCallback((v: string) => setSplitA(clamp(parseInt(v) || 1)), [])
  const spinSplitB = useCallback((d: number) => setSplitB(p => clamp(p + d)), [])
  const inputSplitB = useCallback((v: string) => setSplitB(clamp(parseInt(v) || 1)), [])

  const spinExpandA = useCallback((d: number) => setExpandA(p => clamp(p + d)), [])
  const inputExpandA = useCallback((v: string) => setExpandA(clamp(parseInt(v) || 1)), [])
  const spinExpandB = useCallback((d: number) => setExpandB(p => clamp(p + d)), [])
  const inputExpandB = useCallback((v: string) => setExpandB(clamp(parseInt(v) || 1)), [])

  const doGuiyi = useCallback(() => {
    if (canSplit) setStage('expand')
  }, [canSplit])

  const reset = useCallback(() => {
    setStage('split')
    setSplitA(1)
    setSplitB(1)
    setExpandA(1)
    setExpandB(1)
  }, [])

  const splitRem = ds.totalBase % totalGroups

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

      {/* ── Step 1: 拆解 ── */}
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] font-semibold text-text-muted">
          📦 第一步：将 <strong className="text-[#4338ca]">{ds.totalBase}{ds.unitC}</strong> 沿两个维度拆分
        </div>

        <DualSpinRow
          labelA={ds.labelA}
          unitA={ds.unitA}
          valueA={splitA}
          onSpinA={spinSplitA}
          onInputA={inputSplitA}
          labelB={ds.labelB}
          unitB={ds.unitB}
          valueB={splitB}
          onSpinB={spinSplitB}
          onInputB={inputSplitB}
          disabled={stage !== 'split'}
        />

        {/* Three-column visual */}
        <div className="mb-2.5 flex flex-wrap gap-2.5">
          <GroupColumn
            label={`🔵 ${ds.labelA}`}
            sub={`${splitA}${ds.unitA}`}
            count={splitA}
            unit={ds.unitA}
            blockClass="bg-[#3b82f6]"
            labelBg="bg-[#dbeafe]"
            labelColor="text-[#1d4ed8]"
            countColor="text-text-secondary"
          />
          <GroupColumn
            label={`🟣 ${ds.labelB}`}
            sub={`${splitB}${ds.unitB}`}
            count={splitB}
            unit={ds.unitB}
            blockClass="bg-[#6366f1]"
            labelBg="bg-[#e0e7ff]"
            labelColor="text-[#4338ca]"
            countColor="text-text-secondary"
          />
          <ResultColumn
            totalGroups={totalGroups}
            perUnit={canSplit ? Math.round(perUnit) : 0}
            unitC={ds.unitC}
            labelC={ds.labelC}
            isEven={canSplit}
          />
        </div>

        {stage === 'split' && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            splitA <= 1 && splitB <= 1
              ? 'bg-[#eef2ff] text-[#3730a3]'
              : canSplit
                ? 'border border-app-green bg-app-green-light text-app-green-dark'
                : 'border border-red-300 bg-red-50 text-red-700'
          }`}>
            {splitA <= 1 && splitB <= 1
              ? <span>💡 请根据题目条件，设置 {ds.labelA} 和 {ds.labelB} 的份数</span>
              : canSplit
                ? <span>✅ {ds.totalBase} ÷ ({splitA}×{splitB}) = 每份 <strong>{Math.round(perUnit)}{ds.unitC}</strong>，可以平均分！</span>
                : <span>❌ {ds.totalBase}{ds.unitC} 无法被 {splitA}×{splitB}={totalGroups} 平均分（余 {splitRem}），请调整</span>}
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
          ① 归一 → 1{ds.unitA}·1{ds.unitB}
        </button>
        {stage === 'expand' && (
          <span className="rounded-full bg-app-green-light px-2.5 py-1 text-xs font-bold text-app-green-dark">
            ✅ 1{ds.unitA}·1{ds.unitB} = {Math.round(perUnit)}{ds.unitC}
          </span>
        )}
      </div>

      {/* ── Step 2: 扩展 ── */}
      {stage === 'expand' && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold text-text-muted">
            🔢 第二步：扩展到目标（每份 = {Math.round(perUnit)}{ds.unitC}）
          </div>

          <DualSpinRow
            labelA={ds.labelA}
            unitA={ds.unitA}
            valueA={expandA}
            onSpinA={spinExpandA}
            onInputA={inputExpandA}
            labelB={ds.labelB}
            unitB={ds.unitB}
            valueB={expandB}
            onSpinB={spinExpandB}
            onInputB={inputExpandB}
            disabled={false}
          />

          {/* Expanded three-column visual */}
          <div className="mb-2.5 flex flex-wrap gap-2.5">
            <GroupColumn
              label={`🔵 ${ds.labelA}`}
              sub={`${expandA}${ds.unitA}`}
              count={expandA}
              unit={ds.unitA}
              blockClass="bg-[#3b82f6]"
              labelBg="bg-[#dbeafe]"
              labelColor="text-[#1d4ed8]"
              countColor={isAnswer ? 'text-app-green' : 'text-text-secondary'}
            />
            <GroupColumn
              label={`🟣 ${ds.labelB}`}
              sub={`${expandB}${ds.unitB}`}
              count={expandB}
              unit={ds.unitB}
              blockClass="bg-[#6366f1]"
              labelBg="bg-[#e0e7ff]"
              labelColor="text-[#4338ca]"
              countColor={isAnswer ? 'text-app-green' : 'text-text-secondary'}
            />
            <ResultColumn
              totalGroups={expandGroups}
              perUnit={Math.round(perUnit)}
              unitC={ds.unitC}
              labelC={ds.labelC}
              isEven={true}
            />
          </div>

          {/* Summary */}
          <div className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
            isAnswer
              ? 'border border-app-green bg-app-green-light text-app-green-dark'
              : 'bg-[#eef2ff] text-[#3730a3]'
          }`}>
            {isAnswer
              ? <span>✅ <strong>{expandA}{ds.unitA} × {expandB}{ds.unitB} = {expandGroups}组 × {Math.round(perUnit)}{ds.unitC} = {rounded}{ds.unitC}</strong> — 找到答案！</span>
              : <span>💡 当前：{expandA}{ds.unitA} × {expandB}{ds.unitB} = {expandGroups}组 × {Math.round(perUnit)}{ds.unitC} = <strong>{rounded}{ds.unitC}</strong>（继续调整）</span>}
          </div>

          {ds.isReverse && ds.targetTotal && (
            <div className="mt-1.5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs">
              🎯 目标：{ds.targetTotal}{ds.unitC}｜当前结果：
              <span className={`font-bold ${isAnswer ? 'text-app-green' : 'text-[#6366f1]'}`}>
                {rounded}{ds.unitC}
              </span>
              {isAnswer && <span className="ml-1.5">✅ 找到答案！</span>}
            </div>
          )}
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
    </div>
  )
}

/* ── DualSpinRow: two +/- controls side by side ── */
function DualSpinRow({ labelA, unitA, valueA, onSpinA, onInputA, labelB, unitB, valueB, onSpinB, onInputB, disabled }: {
  labelA: string; unitA: string; valueA: number; onSpinA: (d: number) => void; onInputA: (v: string) => void
  labelB: string; unitB: string; valueB: number; onSpinB: (d: number) => void; onInputB: (v: string) => void
  disabled: boolean
}) {
  const btnCls = "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#93c5fd] bg-white text-base font-bold transition-all active:scale-[0.92] disabled:cursor-default disabled:opacity-40"
  const inputCls = "h-7 w-14 rounded-md border-[1.5px] border-[#a5b4fc] bg-white text-center text-sm font-bold outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)] disabled:opacity-40"

  return (
    <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-[#c7d2fe] bg-[#f8faff] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs font-semibold text-[#1d4ed8]">{labelA}：</span>
        <button onClick={() => onSpinA(-1)} disabled={disabled} className={btnCls}>－</button>
        <input type="number" min="1" disabled={disabled} className={inputCls} value={valueA} onChange={e => onInputA(e.target.value)} />
        <button onClick={() => onSpinA(1)} disabled={disabled} className={btnCls}>＋</button>
        <span className="text-[11px] text-[#1d4ed8]">{unitA}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs font-semibold text-[#6366f1]">{labelB}：</span>
        <button onClick={() => onSpinB(-1)} disabled={disabled} className={btnCls}>－</button>
        <input type="number" min="1" disabled={disabled} className={inputCls} value={valueB} onChange={e => onInputB(e.target.value)} />
        <button onClick={() => onSpinB(1)} disabled={disabled} className={btnCls}>＋</button>
        <span className="text-[11px] text-[#6366f1]">{unitB}</span>
      </div>
    </div>
  )
}

/* ── GroupColumn: visual column showing groups ── */
function GroupColumn({ label, sub, count, unit, blockClass, labelBg, labelColor, countColor }: {
  label: string; sub: string; count: number; unit: string
  blockClass: string; labelBg: string; labelColor: string; countColor: string
}) {
  const max = 8
  return (
    <div className="min-w-[120px] flex-1">
      <div className={`mb-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${labelBg} ${labelColor}`}>
        {label}
      </div>
      <div className="flex min-h-[34px] flex-wrap items-center gap-[5px] rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
        {Array.from({ length: Math.min(count, max) }, (_, i) => (
          <div key={i} className="relative mt-2.5 flex items-center gap-0.5 rounded-[5px] border border-dashed border-gray-800/25 bg-white/75 px-1 py-1">
            <div className="absolute -top-2.5 left-0.5 whitespace-nowrap rounded-full bg-[#f0f1ff] px-1 text-[9px] text-text-secondary">
              {i + 1}{unit}
            </div>
            <div className={`h-[11px] w-[11px] shrink-0 rounded-[3px] transition-all duration-250 ${blockClass}`} />
          </div>
        ))}
        {count > max && (
          <div className={`px-1.5 py-1 text-[10px] font-bold ${labelColor}`}>共{count}{unit}</div>
        )}
      </div>
      <div className={`mt-1 text-[11px] ${countColor}`}>{sub}</div>
    </div>
  )
}

/* ── ResultColumn: visual for result/quantity ── */
function ResultColumn({ totalGroups, perUnit, unitC, labelC, isEven }: {
  totalGroups: number; perUnit: number; unitC: string; labelC: string; isEven: boolean
}) {
  const max = 8
  const total = isEven ? perUnit * totalGroups : 0
  return (
    <div className="min-w-[120px] flex-1">
      <div className="mb-1.5 inline-block rounded bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
        🟠 {labelC}（结果）
      </div>
      <div className="flex min-h-[34px] flex-wrap items-center gap-[5px] rounded-[10px] bg-[#e5e7ff] px-2 py-1.5">
        {isEven ? (
          <>
            {Array.from({ length: Math.min(totalGroups, max) }, (_, i) => (
              <div key={i} className="relative mt-2.5 flex max-w-[110px] flex-wrap items-center gap-0.5 rounded-[5px] border border-dashed border-gray-800/25 bg-white/75 px-1 py-1">
                <div className="absolute -top-2.5 left-0.5 whitespace-nowrap rounded-full bg-[#f0f1ff] px-1 text-[9px] text-text-secondary">
                  {i + 1}
                </div>
                {Array.from({ length: Math.min(perUnit, 6) }, (_, j) => (
                  <div key={j} className="h-[11px] w-[11px] shrink-0 rounded-[3px] bg-app-orange transition-all duration-250" />
                ))}
                {perUnit > 6 && (
                  <div className="px-0.5 text-[8px] font-bold text-[#c2410c]">×{perUnit}</div>
                )}
              </div>
            ))}
            {totalGroups > max && (
              <div className="px-1.5 py-1 text-[10px] font-semibold text-[#92400e]">共{totalGroups}组</div>
            )}
          </>
        ) : (
          <div className="px-2 py-1 text-[10px] text-text-muted">请先完成拆分</div>
        )}
      </div>
      <div className="mt-1 text-[11px] text-text-secondary">
        {isEven ? `共${total}${unitC}` : '—'}
      </div>
    </div>
  )
}

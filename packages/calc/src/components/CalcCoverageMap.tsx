'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { CalcProblemState, CalcSession, MixedOp } from '@rosie/core'
import { signatureToDisplay } from '../utils/calc-ast'
import {
  calculateAllCoverage,
  calculateConceptCoverage,
  finiteCoverageUniverses,
  type BlockCoverage,
  type ConceptCoverage,
} from '../utils/calc-coverage'
import {
  calculateAllStructureCoverage,
  type StructureCoverage,
} from '../utils/calc-structure-coverage'
import { calculateRuleCoverage } from '../utils/calc-rule-coverage'
import { CALC_FEATURES } from '../utils/calc-features'
import type { CurriculumSnapshotMap } from '../utils/calc-curriculum-snapshot'
import {
  evaluateBlockProgression,
  suggestedSuccessors,
  blockTierFromProgression,
  type BlockTier,
} from '../utils/calc-progression'
import { blockById } from '../utils/calc-blocks'

const GROUP_LABEL: Record<BlockCoverage['group'], string> = {
  add: '加法',
  sub: '减法',
  mul: '乘法',
  div: '除法',
}

const TIER_BADGE: Record<BlockTier, { label: string; className: string }> = {
  entry: { label: '起步', className: 'bg-slate-400/15 text-slate-300' },
  stable: { label: '稳固', className: 'bg-emerald-400/15 text-emerald-200' },
  fluent: { label: '熟练', className: 'bg-cyan-400/15 text-cyan-200' },
  auto: { label: '自动化', className: 'bg-violet-400/15 text-violet-200' },
}

const STRUCTURE_GROUP_LABEL: Record<StructureCoverage['group'], string> = {
  add: '加法与竖式',
  sub: '减法与竖式',
  mul: '多位数乘法',
  div: '多位数除法',
  decimal: '小数',
  fraction: '分数',
  mixed: '混合运算',
}

function percent(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '—'
}

function Stat({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-base font-bold" style={{ color }}>
          {value}/{total}
        </span>
        <span className="text-xs text-slate-500">{percent(value, total)}</span>
      </div>
    </div>
  )
}

function ProgressMetric({
  label,
  value,
  target,
  color,
  detail,
}: {
  label: string
  value: number
  target: number
  color: string
  detail: string
}) {
  const current = Math.round(value * 100)
  const threshold = Math.round(target * 100)
  return (
    <div className="rounded-xl bg-black/15 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-200">{label}</span>
        <span className="font-bold" style={{ color }}>
          {current}% <span className="font-normal text-slate-500">/ {threshold}%</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, current)}%`, background: color }}
        />
      </div>
      {detail && <div className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</div>}
    </div>
  )
}

function BlockCard({ block, concept }: { block: BlockCoverage; concept?: ConceptCoverage }) {
  const [familyMode, setFamilyMode] = useState<'left' | 'right' | 'result' | 'structure'>('left')
  const [viewMode, setViewMode] = useState<'formula' | 'concept'>('formula')
  const conceptEnabled = CALC_FEATURES.conceptCoverage && concept != null
  const showConcept = conceptEnabled && viewMode === 'concept'
  const familyPrefixes =
    block.group === 'add'
      ? { left: 'left:', right: 'right:', result: 'result:', structure: 'structure:' }
      : block.group === 'sub'
        ? { left: 'minuend:', right: 'subtrahend:', result: 'result:', structure: 'structure:' }
        : block.group === 'mul'
          ? { left: 'left:', right: 'right:', result: 'fact:', structure: 'fact:' }
          : { left: 'divisor:', right: 'quotient:', result: 'quotient:', structure: 'divisor:' }
  const prefix = familyPrefixes[familyMode]
  const families = block.buckets.filter((bucket) => bucket.key.startsWith(prefix))

  return (
    <details
      data-coverage-detail
      className="rounded-2xl border border-white/10 bg-[#121225] open:border-cyan-400/25"
    >
      <summary className="cursor-pointer list-none p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold text-slate-100">{block.label}</div>
            <div className="mt-1 text-xs text-slate-500">
              核心算式 {block.total} 道 · {block.version}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-cyan-300">
              {percent(block.covered, block.total)}
            </div>
            <div className="text-[11px] text-slate-500">已练习</div>
          </div>
          <span aria-hidden="true" className="text-lg leading-none text-slate-500">
            ⌄
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
            style={{ width: percent(block.covered, block.total) }}
          />
        </div>
      </summary>

      <div className="border-t border-white/8 px-4 pt-4 pb-4">
        {conceptEnabled && concept && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full bg-white/5 p-1">
              {(['formula', 'concept'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs ${viewMode === mode ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'text-slate-400'}`}
                >
                  {mode === 'formula' ? '按算式' : '按知识事实'}
                </button>
              ))}
            </div>
            {showConcept && (
              <span className="text-[10px] text-slate-500">
                交换律归一：3+5 与 5+3 计为同一知识事实
              </span>
            )}
          </div>
        )}

        {showConcept && concept ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat
              label="已练习"
              value={concept.coveredConcepts}
              total={concept.totalConcepts}
              color="#67e8f9"
            />
            <Stat
              label="限时答对"
              value={concept.withinTargetConcepts}
              total={concept.totalConcepts}
              color="#facc15"
            />
            <Stat
              label="已熟练"
              value={concept.fluentConcepts}
              total={concept.totalConcepts}
              color="#4ade80"
            />
            <Stat
              label="已掌握"
              value={concept.masteredConcepts}
              total={concept.totalConcepts}
              color="#c084fc"
            />
            <Stat
              label="待复核"
              value={concept.reviewDueConcepts}
              total={concept.totalConcepts}
              color="#fb7185"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="已练习" value={block.covered} total={block.total} color="#67e8f9" />
              <Stat
                label="限时答对"
                value={block.withinTarget}
                total={block.total}
                color="#facc15"
              />
              <Stat label="已熟练" value={block.fluent} total={block.total} color="#4ade80" />
              <Stat label="已掌握" value={block.mastered} total={block.total} color="#c084fc" />
              <Stat label="待复核" value={block.reviewDue} total={block.total} color="#fb7185" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(['left', 'right', 'result', 'structure'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFamilyMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs ${familyMode === mode ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'bg-white/5 text-slate-400'}`}
                >
                  {
                    {
                      left: block.group === 'div' ? '按除数' : '按左数',
                      right: block.group === 'div' ? '按商' : '按右数',
                      result: '按结果',
                      structure: '按结构',
                    }[mode]
                  }
                </button>
              ))}
            </div>

            {families.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {families.map((family) => (
                  <div key={family.key} className="rounded-xl bg-white/[0.035] px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-300">{family.label}</span>
                      <span className="font-semibold text-cyan-300">
                        {family.covered}/{family.total}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: percent(family.covered, family.total) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {block.missingSignatures.length > 0 && (
              <details className="mt-4 rounded-xl bg-amber-400/[0.06] p-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber-200">
                  还没练过 {block.missingSignatures.length} 道
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {block.missingSignatures.map((signature) => (
                    <span
                      key={signature}
                      className="rounded-md bg-black/20 px-2 py-1 text-xs text-slate-300"
                    >
                      {signatureToDisplay(signature)}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </details>
  )
}

function StructureCard({ coverage }: { coverage: StructureCoverage }) {
  return (
    <details
      data-coverage-detail
      className="rounded-2xl border border-violet-300/10 bg-[#121225] open:border-violet-300/30"
    >
      <summary className="cursor-pointer list-none p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-slate-100">{coverage.label}</span>
              <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                结构覆盖
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {coverage.covered}/{coverage.total} 个能力格 · {coverage.version}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-violet-300">
              {percent(coverage.covered, coverage.total)}
            </div>
            <div className="text-[11px] text-slate-500">能力结构</div>
          </div>
          <span aria-hidden="true" className="text-lg leading-none text-slate-500">
            ⌄
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
            style={{ width: percent(coverage.covered, coverage.total) }}
          />
        </div>
      </summary>
      <div className="grid grid-cols-1 gap-2 border-t border-white/8 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {coverage.cells.map((cell) => (
          <div key={cell.key} className="rounded-xl bg-white/[0.035] px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={cell.covered ? 'text-slate-200' : 'text-slate-500'}>
                {cell.label}
              </span>
              <span
                className={
                  cell.mastered
                    ? 'text-purple-300'
                    : cell.fluent
                      ? 'text-emerald-300'
                      : cell.covered
                        ? 'text-cyan-300'
                        : 'text-slate-600'
                }
              >
                {cell.mastered
                  ? '已掌握'
                  : cell.fluent
                    ? '已熟练'
                    : cell.covered
                      ? '已练习'
                      : '未覆盖'}
              </span>
            </div>
            {cell.sampleSignatures.length > 0 && (
              <div className="mt-1 truncate text-[10px] text-slate-500">
                例：{cell.sampleSignatures.map(signatureToDisplay).join('、')}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

export function CalcCoverageMap({
  states,
  sessions,
  mixedOps,
  selectedBlockIds,
  adaptiveExpansionEnabled,
  curriculumSnapshots,
}: {
  states: Map<string, CalcProblemState>
  sessions: CalcSession[]
  mixedOps: MixedOp[]
  selectedBlockIds: string[]
  adaptiveExpansionEnabled: boolean
  curriculumSnapshots?: CurriculumSnapshotMap
}) {
  const coverage = useMemo(
    () => calculateAllCoverage(states, curriculumSnapshots),
    [states, curriculumSnapshots],
  )
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'review' | 'mastered'>('all')
  const [progressionOpen, setProgressionOpen] = useState(true)
  const coverageMapRef = useRef<HTMLElement>(null)
  const [selectedSignature, setSelectedSignature] = useState('')
  const structureCoverage = useMemo(
    () => calculateAllStructureCoverage(states, mixedOps),
    [states, mixedOps],
  )
  const ruleCoverage = useMemo(() => calculateRuleCoverage(states), [states])
  const conceptByBlock = useMemo(() => {
    const map = new Map<string, ConceptCoverage>()
    if (!CALC_FEATURES.conceptCoverage) return map
    for (const universe of finiteCoverageUniverses()) {
      map.set(universe.blockId, calculateConceptCoverage(universe, states))
    }
    return map
  }, [states])
  const progression = useMemo(
    () =>
      CALC_FEATURES.adaptiveProgression
        ? selectedBlockIds.map((blockId) => evaluateBlockProgression(blockId, states))
        : [],
    [selectedBlockIds, states],
  )
  const successors = useMemo(
    () =>
      CALC_FEATURES.adaptiveProgression
        ? suggestedSuccessors(new Set(selectedBlockIds), states)
        : [],
    [selectedBlockIds, states],
  )
  const groups = useMemo(() => {
    const map = new Map<BlockCoverage['group'], BlockCoverage[]>()
    for (const block of coverage) map.set(block.group, [...(map.get(block.group) ?? []), block])
    return map
  }, [coverage])
  const structureGroups = useMemo(() => {
    const map = new Map<StructureCoverage['group'], StructureCoverage[]>()
    for (const item of structureCoverage)
      map.set(item.group, [...(map.get(item.group) ?? []), item])
    return map
  }, [structureCoverage])

  const total = coverage.reduce((sum, block) => sum + block.total, 0)
  const covered = coverage.reduce((sum, block) => sum + block.covered, 0)
  const withinTarget = coverage.reduce((sum, block) => sum + block.withinTarget, 0)
  const fluent = coverage.reduce((sum, block) => sum + block.fluent, 0)
  const mastered = coverage.reduce((sum, block) => sum + block.mastered, 0)
  const filteredGroups = useMemo(() => {
    const next = new Map<BlockCoverage['group'], BlockCoverage[]>()
    for (const [group, blocks] of groups) {
      const filtered = blocks.filter((block) => {
        if (statusFilter === 'missing') return block.covered < block.total
        if (statusFilter === 'review') return block.reviewDue > 0
        if (statusFilter === 'mastered') return block.mastered > 0
        return true
      })
      if (filtered.length > 0) next.set(group, filtered)
    }
    return next
  }, [groups, statusFilter])
  const selectedState = selectedSignature ? states.get(selectedSignature) : undefined
  const formulaOptions = useMemo(
    () =>
      [...states.values()]
        .filter((state) => state.appearanceCount > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 300),
    [states],
  )
  const repeatAudit = useMemo(() => {
    let questions = 0
    let repeats = 0
    let intentional = 0
    let accidental = 0
    let consecutive = 0
    for (const session of sessions.slice(0, 30)) {
      const seen = new Set<string>()
      let previous: string | null = null
      for (const entry of session.questionLog ?? []) {
        if (!entry.signature) continue
        questions++
        if (seen.has(entry.signature)) {
          repeats++
          if (entry.intentionalRepeat) intentional++
          else accidental++
        }
        if (previous === entry.signature) consecutive++
        seen.add(entry.signature)
        previous = entry.signature
      }
    }
    return { questions, repeats, intentional, accidental, consecutive }
  }, [sessions])

  return (
    <section
      ref={coverageMapRef}
      className="rounded-[24px] border border-white/10 bg-[#0d0d1e] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100">覆盖地图</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            从运算大类下钻到算式家族和具体未练习算式。有限题库使用版本化精确分母，规则题不计入核心分母。
          </p>
          {curriculumSnapshots && curriculumSnapshots.size > 0 && (
            <p className="mt-1 text-[11px] text-emerald-300/70">
              已启用 {curriculumSnapshots.size} 个紧凑课程快照；当前热状态会覆盖较旧快照。
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setProgressionOpen(true)
                coverageMapRef.current
                  ?.querySelectorAll<HTMLDetailsElement>('[data-coverage-detail]')
                  .forEach((item) => {
                    item.open = true
                  })
              }}
              className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              全部展开
            </button>
            <button
              type="button"
              onClick={() => {
                setProgressionOpen(false)
                coverageMapRef.current
                  ?.querySelectorAll<HTMLDetailsElement>('[data-coverage-detail]')
                  .forEach((item) => {
                    item.open = false
                  })
              }}
              className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              全部收起
            </button>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-cyan-300">{percent(covered, total)}</div>
            <div className="text-[11px] text-slate-500">分题型累计</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="课程覆盖" value={covered} total={total} color="#67e8f9" />
        <Stat label="限时达标" value={withinTarget} total={total} color="#facc15" />
        <Stat label="已经熟练" value={fluent} total={total} color="#4ade80" />
        <Stat label="跨日掌握" value={mastered} total={total} color="#c084fc" />
      </div>

      <div className="mt-5 space-y-5">
        {CALC_FEATURES.adaptiveProgression && (
          <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.04] p-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setProgressionOpen((open) => !open)}
                  aria-expanded={progressionOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="text-sm font-extrabold text-emerald-100">自适应升级状态</span>
                </button>
                <Link
                  href="/setting/calc"
                  className="shrink-0 text-xs whitespace-nowrap text-cyan-300"
                >
                  调整权限
                </Link>
                <button
                  type="button"
                  onClick={() => setProgressionOpen((open) => !open)}
                  aria-label={progressionOpen ? '收起自适应升级状态' : '展开自适应升级状态'}
                  className="shrink-0 px-1 text-lg leading-none text-slate-400"
                >
                  {progressionOpen ? '⌃' : '⌄'}
                </button>
              </div>
              {progressionOpen && (
                <>
                  <p className="mt-1 text-xs text-slate-400">
                    {adaptiveExpansionEnabled ? '已允许自动扩展下一题型' : '只在家长已选题型内调整'}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    覆盖率达到90%、近3场首答正确率达到85%、进阶达标率达到75%、高级达标率达到60%后，才会建议自适应升级。覆盖率指练过的核心算式占比；首答正确率不含补练。
                  </p>
                </>
              )}
            </div>
            {progressionOpen && (
              <div className="mt-3 space-y-2">
                {progression.map((item) => {
                  const tier = TIER_BADGE[blockTierFromProgression(item)]
                  return (
                    <div key={item.blockId} className="rounded-xl bg-black/15 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold text-slate-200">
                            {blockById(item.blockId)?.label ?? item.blockId}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.className}`}
                          >
                            {tier.label}
                          </span>
                        </span>
                        <span
                          className={
                            item.recovery
                              ? 'text-rose-300'
                              : item.ready
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                          }
                        >
                          {item.recovery ? '需要回补' : item.ready ? '达到升级门槛' : '继续练习'}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <ProgressMetric
                          label="覆盖率"
                          value={item.exposure}
                          target={0.9}
                          color="#67e8f9"
                          detail={`实际 ${item.coveredCount}/${item.coverageTotal} 道 · 目标 ${Math.ceil(item.coverageTotal * 0.9)}/${item.coverageTotal} 道`}
                        />
                        <ProgressMetric
                          label="近3场首答正确率"
                          value={item.recentAccuracy}
                          target={0.85}
                          color="#facc15"
                          detail={`实际 ${item.accuracyCorrect}/${item.accuracyTotal} 道 · 目标 ${Math.ceil(item.accuracyTotal * 0.85)}/${item.accuracyTotal} 道`}
                        />
                        <ProgressMetric
                          label="进阶达标率"
                          value={item.stableRatio}
                          target={0.75}
                          color="#4ade80"
                          detail={`实际：${item.stableCount}/${item.evaluatedCount} 道 · 目标 ${Math.ceil(item.evaluatedCount * 0.75)}/${item.evaluatedCount} 道`}
                        />
                        <ProgressMetric
                          label="高级达标率"
                          value={item.fluentRatio}
                          target={0.6}
                          color="#c084fc"
                          detail={`实际：${item.fluentCount}/${item.evaluatedCount} 道 · 目标 ${Math.ceil(item.evaluatedCount * 0.6)}/${item.evaluatedCount} 道`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {successors.length > 0 && (
              <div className="mt-3 text-xs text-emerald-200">
                建议解锁：{successors.map((id) => blockById(id)?.label ?? id).join('、')}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', '全部题型'],
              ['missing', '有未覆盖'],
              ['review', '待复核'],
              ['mastered', '已掌握'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs ${statusFilter === value ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'bg-white/5 text-slate-400'}`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/calc/session?drill=weak-formulas"
            className="rounded-full bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200"
          >
            薄弱专项
          </Link>
        </div>
        {repeatAudit.questions > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="近30场重复"
              value={repeatAudit.repeats}
              total={repeatAudit.questions}
              color="#facc15"
            />
            <Stat
              label="有效重复"
              value={repeatAudit.intentional}
              total={repeatAudit.questions}
              color="#4ade80"
            />
            <Stat
              label="无效重复"
              value={repeatAudit.accidental}
              total={repeatAudit.questions}
              color="#fb7185"
            />
            <Stat
              label="连续相同"
              value={repeatAudit.consecutive}
              total={repeatAudit.questions}
              color="#c084fc"
            />
          </div>
        )}
        {[...filteredGroups.entries()].map(([group, blocks]) => (
          <div key={group}>
            <div className="mb-2 text-sm font-bold text-slate-300">{GROUP_LABEL[group]}</div>
            <div className="space-y-2">
              {blocks.map((block) => (
                <div key={block.blockId}>
                  <BlockCard block={block} concept={conceptByBlock.get(block.blockId)} />
                  {block.covered < block.total && (
                    <Link
                      href={`/calc/session?drill=breakthrough&blockId=${encodeURIComponent(block.blockId)}`}
                      className="mt-1 inline-flex rounded-full bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200"
                    >
                      补齐该题型覆盖
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-white/10 pt-5">
          <h3 className="text-base font-extrabold text-slate-100">能力结构覆盖</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            无限或规模很大的题型不承诺逐式穷举，改用固定、可版本化的能力格统计；覆盖率分母不会随练习增长。
          </p>
        </div>
        <div className="border-t border-white/10 pt-5">
          <h3 className="text-base font-extrabold text-slate-100">规则家族覆盖</h3>
          <p className="mt-1 text-xs text-slate-400">
            0和1相关规则不进入核心算式分母，每条规则用3个不同数量级代表题验证。
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ruleCoverage.map((rule) => (
              <div key={rule.key} className="rounded-xl bg-white/[0.035] p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">{rule.label}</span>
                  <span className="text-cyan-300">
                    {rule.covered}/{rule.target}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {rule.signatures.length > 0
                    ? rule.signatures.map(signatureToDisplay).join('、')
                    : '尚未验证'}
                </div>
              </div>
            ))}
          </div>
        </div>
        {[...structureGroups.entries()].map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 text-sm font-bold text-slate-300">
              {STRUCTURE_GROUP_LABEL[group]}
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <StructureCard key={item.id} coverage={item} />
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-white/10 pt-5">
          <h3 className="text-base font-extrabold text-slate-100">具体算式时间线</h3>
          <p className="mt-1 text-xs text-slate-400">
            选择最近练过的算式，查看跨场、跨天掌握证据。
          </p>
          <select
            value={selectedSignature}
            onChange={(event) => setSelectedSignature(event.target.value)}
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#17172c] px-3 py-2 text-sm text-slate-200"
          >
            <option value="">请选择算式</option>
            {formulaOptions.map((state) => (
              <option key={state.signature} value={state.signature}>
                {signatureToDisplay(state.signature)}
              </option>
            ))}
          </select>
          {selectedState && (
            <div className="mt-3 rounded-xl bg-white/[0.035] p-3">
              <div className="text-sm font-bold text-slate-100">
                {signatureToDisplay(selectedState.signature)}
              </div>
              <div className="mt-2 space-y-1">
                {selectedState.recentResults.map((attempt, index) => (
                  <div
                    key={`${attempt.sessionNo ?? 'legacy'}-${index}`}
                    className="flex items-center justify-between gap-2 text-xs text-slate-400"
                  >
                    <span>
                      {attempt.date ?? '历史记录'} · 第{attempt.sessionNo ?? '—'}场 ·{' '}
                      {attempt.evidenceKind === 'makeup'
                        ? '补练'
                        : attempt.evidenceKind === 'recall'
                          ? '间隔复习'
                          : '独立首答'}
                    </span>
                    <span className={attempt.correct ? 'text-emerald-300' : 'text-rose-300'}>
                      {attempt.correct ? '正确' : '错误'} · {(attempt.timeMs / 1000).toFixed(1)}秒
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

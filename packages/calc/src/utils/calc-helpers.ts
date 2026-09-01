import { BLOCKS, blockById, VERTICAL_BLOCK_IDS, type CalcBlock } from './calc-blocks'
import { addHasCarry, hasAnyCarry, subHasBorrow } from './calc-block-gens'
import { makeQuestion, parseSignature } from './calc-ast'
import { assembleMixed, isMixedOpValid } from './calc-mixed'
import { toInverseQuestion } from './calc-inverse'
import { coverageUniverse } from './calc-coverage'
import {
  evaluateBlockProgression,
  allocateMixingCounts,
  MIXING_STAGES,
  mixingStageFromProgression,
  progressionFactor,
  suggestedSuccessors,
  type MixingRatios,
} from './calc-progression'
import { CALC_FEATURES } from './calc-features'
import { hasIndependentAttempt } from './calc-evidence'
import type { CurriculumSnapshot, CurriculumSnapshotMap } from './calc-curriculum-snapshot'
import { maxRetryCeiling } from './calc-session-policy'
import {
  COLD_START_MIN,
  isFiniteBlock,
  pickRandom,
  shuffleInPlace,
  unseenSignatures,
} from './calc-finite'
import type {
  CalcCategory,
  CalcLevel,
  CalcMistake,
  CalcProblemState,
  CalcQuestion,
  CalcSession,
  CalcSettings,
  MixedOp,
} from '@rosie/core'

/** Coin reward including streak bonus. coinBase already accounts for ×2 on challenge questions. */
export function coinReward(question: CalcQuestion, streak: number): number {
  let bonus = 0
  if (streak >= 10) bonus = 2
  else if (streak >= 5) bonus = 1
  return question.coinBase + bonus
}

export interface BuildCtx {
  problemStates: Map<string, CalcProblemState>
  /** Compact exact coverage for finite curricula; avoids re-serving archived formulas. */
  curriculumSnapshots?: CurriculumSnapshotMap
  /**
   * Pre-truncated mastered rows for the recall slot (fetched via a LIMITed
   * SQL query — see fetchMasteredRecallCandidates). When absent (drills,
   * tests) the recall slot is skipped; generateBlock never scans/sorts the
   * full mastered set in memory.
   */
  recallCandidates?: CalcProblemState[]
  /** 最近会话历史（新→旧），用于自适应回补防抖；缺省时防抖不生效。 */
  sessions?: CalcSession[]
}

type Source =
  | { kind: 'block'; block: CalcBlock; adaptiveLane?: 'next' }
  | { kind: 'mixed'; op: MixedOp }

/**
 * Build a session of `count` questions using a weakness-weighted strategy.
 *
 * Sources = selected single-op blocks + enabled/valid mixed ops. The `count`
 * is allocated across sources, weighted toward weak (low-proficiency / never
 * practiced) ones, with a per-source floor of 1 when `count >= sources.length`.
 * Within a block source, ~35% of its allocation resurfaces its weakest specific
 * facts (via `parseSignature`); the rest is generated fresh. Mixed sources are
 * always generated fresh via `assembleMixed`. Every produced question is tagged
 * with its source for later attribution.
 *
 * `carried` are the previous session's still-unresolved mistakes, appended as
 * make-up questions ON TOP of `count` (total length = count + carried.length,
 * truncated so carried never exceeds `count`). They are mixed into the shuffle
 * so they aren't predictably first.
 */
export function buildSession(
  settings: CalcSettings,
  ctx: BuildCtx,
  carried: CalcMistake[] = [],
): CalcQuestion[] {
  // 1. Sources (blocks first, then enabled+valid mixed ops)
  const sources: Source[] = []
  for (const sel of settings.selectedBlocks) {
    const block = blockById(sel.id)
    if (block) sources.push({ kind: 'block', block })
  }
  for (const op of settings.mixedOps) {
    if (op.enabled && isMixedOpValid(op)) sources.push({ kind: 'mixed', op })
  }
  if (
    CALC_FEATURES.adaptiveProgression &&
    settings.countMode === 'auto' &&
    settings.adaptiveExpansionEnabled
  ) {
    const selected = new Set(settings.selectedBlocks.map((item) => item.id))
    for (const blockId of suggestedSuccessors(selected, ctx.problemStates)) {
      const block = blockById(blockId)
      if (block) sources.push({ kind: 'block', block, adaptiveLane: 'next' })
    }
  }
  if (sources.length === 0) sources.push({ kind: 'block', block: BLOCKS[0] }) // 兜底 add:10

  const states = [...ctx.problemStates.values()]

  // 2. Allocate counts per source.
  //    auto  → weakness-weighted allocate() of the global lastCount (原逻辑)
  //    manual→ each source's own configured count
  let alloc: number[]
  if (settings.countMode === 'manual') {
    alloc = sources.map((src) =>
      src.kind === 'block'
        ? (settings.selectedBlocks.find((b) => b.id === src.block.id)?.count ?? 0)
        : src.op.count,
    )
  } else {
    const weights = sources.map((src) => {
      const matching =
        src.kind === 'block'
          ? states.filter((s) => s.blockId === src.block.id)
          : states.filter((s) => s.mixedOpId === src.op.id)
      const p =
        matching.length > 0
          ? matching.reduce((acc, s) => acc + s.proficiency, 0) / matching.length
          : 0
      const weakness = Math.max(0.05, 1 - p / 5)
      if (src.kind === 'block' && src.adaptiveLane === 'next') return 0.25
      return src.kind === 'block'
        ? Math.max(0.75, weakness) *
            (CALC_FEATURES.adaptiveProgression
              ? progressionFactor(src.block.id, ctx.problemStates, ctx.sessions)
              : 1)
        : weakness
    })
    const nextIndexes = sources
      .map((source, index) => ({ source, index }))
      .filter(({ source }) => source.kind === 'block' && source.adaptiveLane === 'next')
      .map(({ index }) => index)
    if (nextIndexes.length > 0) {
      const nextSet = new Set(nextIndexes)
      const currentIndexes = sources.map((_, index) => index).filter((index) => !nextSet.has(index))
      const nextCount = allocateMixingCounts(
        settings.lastCount,
        MIXING_STAGES.initial,
        true,
      ).nextExploration
      const currentCount = settings.lastCount - nextCount
      alloc = new Array<number>(sources.length).fill(0)
      const currentAlloc = allocate(
        currentCount,
        currentIndexes.map((index) => weights[index]),
      )
      const nextAlloc = allocate(
        nextCount,
        nextIndexes.map((index) => weights[index]),
      )
      currentIndexes.forEach((sourceIndex, index) => {
        alloc[sourceIndex] = currentAlloc[index]
      })
      nextIndexes.forEach((sourceIndex, index) => {
        alloc[sourceIndex] = nextAlloc[index]
      })
    } else {
      alloc = allocate(settings.lastCount, weights)
    }
  }
  // Never produce an empty session (e.g. manual mode with all-zero counts, or no
  // sources selected → only the 兜底 block with count 0). Fall back to lastCount.
  let count = alloc.reduce((a, b) => a + b, 0)
  if (count === 0) {
    alloc[0] = settings.lastCount > 0 ? settings.lastCount : 20
    count = alloc[0]
  }

  // 3. Generate per source
  const out: CalcQuestion[] = []
  const hasAdaptiveNext = sources.some(
    (source) => source.kind === 'block' && source.adaptiveLane === 'next',
  )
  sources.forEach((src, i) => {
    const n = alloc[i]
    if (n <= 0) return
    if (src.kind === 'block') {
      const progression = evaluateBlockProgression(src.block.id, ctx.problemStates)
      const stageMixing = MIXING_STAGES[mixingStageFromProgression(progression)]
      const mixing =
        src.adaptiveLane === 'next'
          ? { currentMaintenance: 1, nextExploration: 0, weakReinforcement: 0 }
          : hasAdaptiveNext
            ? stageMixing
            : {
                currentMaintenance: stageMixing.currentMaintenance + stageMixing.nextExploration,
                nextExploration: 0,
                weakReinforcement: stageMixing.weakReinforcement,
              }
      const generated = generateBlock(
        src.block,
        n,
        states,
        ctx.recallCandidates,
        mixing,
        ctx.curriculumSnapshots?.get(src.block.id),
      )
      const recovering = progression.recovery
      out.push(
        ...generated.map((question) =>
          recovering
            ? { ...question, selectionReason: 'prerequisite-recovery' as const }
            : src.adaptiveLane === 'next'
              ? { ...question, selectionReason: 'next-difficulty' as const }
              : question,
        ),
      )
    } else {
      for (let k = 0; k < n; k++) {
        const q = assembleMixed(src.op)
        out.push({ ...q, sourceMixedOpId: src.op.id, selectionReason: 'random-fill' })
      }
    }
  })

  // 3.5 Whole-session dedupe. Reserve carried mistakes first so normal generation
  // cannot accidentally duplicate the deliberate carry-over occurrence.
  const carriedSignatures = new Set(carried.slice(0, count).map((m) => m.signature))
  const usedSignatures = new Set(carriedSignatures)
  for (let i = 0; CALC_FEATURES.sessionDedupe && i < out.length; i++) {
    const original = out[i]
    if (!usedSignatures.has(original.signature)) {
      usedSignatures.add(original.signature)
      continue
    }
    const source = original.sourceBlockId
      ? sources.find(
          (candidate): candidate is Extract<Source, { kind: 'block' }> =>
            candidate.kind === 'block' && candidate.block.id === original.sourceBlockId,
        )
      : sources.find(
          (candidate): candidate is Extract<Source, { kind: 'mixed' }> =>
            candidate.kind === 'mixed' && candidate.op.id === original.sourceMixedOpId,
        )
    let replacement: CalcQuestion | null = null
    if (source?.kind === 'block') {
      const universe = coverageUniverse(source.block.id)
      if (universe) {
        const start = Math.floor(Math.random() * universe.size)
        for (let offset = 0; offset < universe.size; offset++) {
          const signature = universe.signatureAt((start + offset) % universe.size)
          if (usedSignatures.has(signature)) continue
          const category: CalcCategory =
            source.block.group === 'add' || source.block.group === 'sub' ? 'addsub' : 'muldiv'
          replacement = {
            ...makeQuestion(parseSignature(signature), 0, category, category === 'addsub' ? 1 : 2),
            sourceBlockId: source.block.id,
            selectionReason:
              original.selectionReason === 'next-difficulty' ||
              original.selectionReason === 'prerequisite-recovery'
                ? original.selectionReason
                : 'coverage',
          }
          break
        }
      }
    }
    for (let attempt = 0; attempt < 12 && source; attempt++) {
      if (replacement) break
      const candidate =
        source.kind === 'block'
          ? {
              ...source.block.generateSingle(),
              sourceBlockId: source.block.id,
              selectionReason: 'random-fill' as const,
            }
          : {
              ...assembleMixed(source.op),
              sourceMixedOpId: source.op.id,
              selectionReason: 'random-fill' as const,
            }
      if (!usedSignatures.has(candidate.signature)) {
        replacement =
          original.selectionReason === 'next-difficulty' ||
          original.selectionReason === 'prerequisite-recovery'
            ? { ...candidate, selectionReason: original.selectionReason }
            : candidate
        break
      }
    }
    if (replacement) {
      out[i] = replacement
      usedSignatures.add(replacement.signature)
    } else {
      out[i] = { ...original, selectionReason: 'fallback' }
    }
  }

  // 4.4 Tag questions from vertical-capable blocks so the session renders a 竖式 layout.
  if (settings.verticalForBigNumbers) {
    for (let i = 0; i < out.length; i++) {
      out[i] = applyVerticalAnswerMode(out[i])
    }
  }

  // 4.5 Optionally rewrite ~30% of eligible single-op block questions into the
  // inverse blank form (48 + □ = 105). Only block-sourced arity-1 questions are
  // eligible; mixed-op and carried questions are left as-is.
  if (settings.includeInverse) {
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      if (q.sourceBlockId && q.arity === 1 && q.answerMode !== 'vertical' && Math.random() < 0.3) {
        const inv = toInverseQuestion(q)
        if (inv) out[i] = inv
      }
    }
  }

  // 5. Append carried-over make-up questions. Carried and same-session make-up
  // share one capped remediation budget; carried mistakes get first priority.
  // Restore source + 竖式 from problem-state attribution (mistakes table has neither).
  const carry = carried.slice(0, maxRetryCeiling(count))
  for (const m of carry) {
    // Inverse mistakes are stored as a complete blank equation ("48 + □ = 105");
    // normal mistakes are stored as a bare LHS needing "= ?". Detect by the blank glyph.
    const expr = m.display.replace(/\s*=\s*\?\s*$/, '')
    const isInverse = expr.includes('□')
    const display = isInverse ? expr : `${expr} = ?`
    const state = ctx.problemStates.get(m.signature)
    const sourceBlockId = state?.blockId ?? inferVerticalBlockId(m.signature)
    const q: CalcQuestion = {
      display,
      signature: m.signature,
      arity: 1,
      level: m.level,
      answer: m.answer,
      isChallenge: false,
      category: m.category,
      coinBase: 1,
      sourceBlockId,
      sourceMixedOpId: state?.mixedOpId,
      selectionReason: 'carried-mistake',
    }
    out.push(settings.verticalForBigNumbers && !isInverse ? applyVerticalAnswerMode(q) : q)
  }

  // 6. Shuffle the WHOLE thing (Fisher-Yates) so carried ones aren't predictably first.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Tag a block-sourced multi-digit drill as 竖式 when its source is in VERTICAL_BLOCK_IDS. */
function applyVerticalAnswerMode(q: CalcQuestion): CalcQuestion {
  if (!q.sourceBlockId || !VERTICAL_BLOCK_IDS.has(q.sourceBlockId)) return q
  if (q.answer.kind !== 'int' && q.answer.kind !== 'decimal') return q
  if (q.display.includes('□')) return q
  // 1000 以内：只有真正进位/退位才走竖式；不进位/不退位用数字键盘。
  if (q.sourceBlockId === 'add:1000' || q.sourceBlockId === 'sub:1000') {
    try {
      const ast = parseSignature(q.signature)
      if (
        typeof ast === 'number' ||
        typeof ast.left !== 'number' ||
        typeof ast.right !== 'number'
      ) {
        return q
      }
      if (q.sourceBlockId === 'add:1000' && !addHasCarry(ast.left, ast.right)) return q
      if (q.sourceBlockId === 'sub:1000' && !subHasBorrow(ast.left, ast.right)) return q
    } catch {
      return q
    }
  }
  return { ...q, answerMode: 'vertical' }
}

/**
 * When problem_state has no blockId (legacy / incomplete attribution), infer a
 * vertical-capable block id from digit shape. Avoids add/sub-within-100 heuristics
 * so strategy blocks (凑整 / 整百减) stay on the number pad.
 */
function inferVerticalBlockId(signature: string): string | undefined {
  try {
    const ast = parseSignature(signature)
    if (typeof ast === 'number') return undefined
    if (typeof ast.left !== 'number' || typeof ast.right !== 'number') return undefined
    const a = ast.left
    const b = ast.right
    if (ast.op === 'mul') {
      // Carry 2d/3d×1d → vertical; no-carry stays on the pad.
      if (a >= 100 && a <= 999 && b >= 2 && b <= 9 && hasAnyCarry(a, b)) return 'mul:3d1d-c'
      if (a >= 10 && a <= 99 && b >= 2 && b <= 9 && hasAnyCarry(a, b)) return 'mul:2d1d-c'
      // Exclude trailing-zero facts (mul:zeros) from the 2d×2d 竖式 path.
      if (a >= 10 && a <= 99 && b >= 10 && b <= 99 && a % 10 !== 0 && b % 10 !== 0) {
        return 'mul:2d'
      }
    }
    if (ast.op === 'div' && a >= 10 && b >= 2 && b <= 9) return 'div:multi'
  } catch {
    /* ignore malformed signatures */
  }
  return undefined
}

/** Allocate `count` units across sources weighted by `weights`. Sum === count. */
function allocate(count: number, weights: number[]): number[] {
  const m = weights.length
  if (m === 0) return []
  const alloc = new Array<number>(m).fill(0)
  if (count <= 0) return alloc

  if (count >= m) {
    // base of 1 each, then distribute the remainder via largest-remainder
    for (let i = 0; i < m; i++) alloc[i] = 1
    const remaining = count - m
    const sumW = weights.reduce((a, b) => a + b, 0)
    const ideals = weights.map((w) => (sumW > 0 ? (remaining * w) / sumW : remaining / m))
    const floors = ideals.map((x) => Math.floor(x))
    for (let i = 0; i < m; i++) alloc[i] += floors[i]
    let leftover = remaining - floors.reduce((a, b) => a + b, 0)
    const order = ideals
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac)
    let k = 0
    while (leftover > 0) {
      alloc[order[k % m].i] += 1
      leftover--
      k++
    }
  } else {
    // fewer slots than sources: give 1 each to the `count` weakest (highest w)
    const order = weights.map((w, i) => ({ i, w })).sort((a, b) => b.w - a.w)
    for (let k = 0; k < count; k++) alloc[order[k].i] = 1
  }
  return alloc
}

/** Generate `n` questions for a single block: coverage / weak / maintenance / cold-start. */
function generateBlock(
  block: CalcBlock,
  n: number,
  states: CalcProblemState[],
  recallCandidates?: CalcProblemState[],
  mixing: MixingRatios = MIXING_STAGES.initial,
  curriculumSnapshot?: CurriculumSnapshot,
): CalcQuestion[] {
  const category: CalcCategory =
    block.group === 'add' || block.group === 'sub' ? 'addsub' : 'muldiv'
  const coinBase = category === 'addsub' ? 1 : 2
  const tag = (q: CalcQuestion): CalcQuestion => ({ ...q, sourceBlockId: block.id })
  const blockStates = states.filter((s) => s.blockId === block.id)
  const finite = isFiniteBlock(block.id)

  // Infinite cold-start: explore until pool has enough rows
  if (!finite && blockStates.length < COLD_START_MIN) {
    return Array.from({ length: n }, () => ({
      ...tag(block.generateSingle()),
      selectionReason: 'coverage',
    }))
  }

  // Spec: recallSlot = max(1, floor(0.05*n)) — but only when SQL-truncated
  // candidates for this block are actually available (and n leaves room).
  const blockRecallPool = block.noResurface
    ? []
    : (recallCandidates ?? []).filter((s) => s.blockId === block.id && s.status === 'mastered')
  const recallN = blockRecallPool.length > 0 && n >= 2 ? Math.max(1, Math.floor(0.05 * n)) : 0
  const nWork = Math.max(0, n - recallN)
  // `nextExploration` is allocated at whole-session level. Inside the current
  // lane, preserve the exact maintenance:weak ratio for the active stage.
  const currentLaneTotal = mixing.currentMaintenance + mixing.weakReinforcement
  let nWeak =
    currentLaneTotal > 0 ? Math.round((mixing.weakReinforcement / currentLaneTotal) * nWork) : 0
  let nCover = finite ? nWork - nWeak : 0
  let nMaint = finite ? 0 : nWork - nWeak

  if (!finite) {
    nWeak += nCover
    nCover = 0
  }
  if (block.noResurface) {
    nMaint += nWeak
    nWeak = 0
  }

  const out: CalcQuestion[] = []
  const used = new Set<string>()

  // 1) Coverage — finite unseen first
  if (finite && nCover > 0) {
    const universe = coverageUniverse(block.id)
    const compatibleSnapshot =
      universe &&
      curriculumSnapshot?.version === universe.version &&
      curriculumSnapshot.universeSize === universe.size
        ? curriculumSnapshot
        : undefined
    const stateBySignature = new Map(blockStates.map((state) => [state.signature, state]))
    const unseen = shuffleInPlace(
      universe && compatibleSnapshot
        ? Array.from({ length: universe.size }, (_, index) => ({
            index,
            signature: universe.signatureAt(index),
          }))
            .filter(
              ({ index, signature }) =>
                !compatibleSnapshot.covered.has(index) &&
                !hasIndependentAttempt(stateBySignature.get(signature)),
            )
            .map(({ signature }) => signature)
        : unseenSignatures(block.id, blockStates),
    )
    for (const sig of unseen) {
      if (out.length >= nCover) break
      if (used.has(sig)) continue
      try {
        const ast = parseSignature(sig)
        out.push({ ...tag(makeQuestion(ast, 0, category, coinBase)), selectionReason: 'coverage' })
        used.add(sig)
      } catch {
        /* skip bad sig */
      }
    }
    // shortfall → weak
    nWeak += Math.max(0, nCover - out.length)
  }

  // 2) Weak / lagging resurface (exclude mastered)
  const weakPool = blockStates
    .filter((s) => s.status === 'active' || s.status === 'lagging')
    .sort((a, b) => {
      const lag = (x: CalcProblemState) => (x.status === 'lagging' ? 0 : 1)
      return (
        lag(a) - lag(b) || a.proficiency - b.proficiency || b.consecutiveWrong - a.consecutiveWrong
      )
    })
  let weakTaken = 0
  for (const s of weakPool) {
    if (weakTaken >= nWeak) break
    if (used.has(s.signature)) continue
    if (block.noResurface) break
    try {
      const ast = parseSignature(s.signature)
      out.push({
        ...tag(makeQuestion(ast, 0, category, coinBase)),
        selectionReason: s.status === 'lagging' ? 'lagging' : 'weak',
      })
      used.add(s.signature)
      weakTaken++
    } catch {
      /* skip */
    }
  }
  nMaint += Math.max(0, nWeak - weakTaken)

  // 3) Maintenance from eligible pool (no reject-retry loop)
  const eligible = blockStates.filter(
    (s) =>
      (s.status === 'active' || s.status === 'lagging') &&
      s.proficiency < 4 &&
      !used.has(s.signature),
  )
  let maintTaken = 0
  while (maintTaken < nMaint && eligible.length > 0) {
    const s = pickRandom(eligible)
    const idx = eligible.indexOf(s)
    eligible.splice(idx, 1)
    if (block.noResurface) {
      out.push({ ...tag(block.generateSingle()), selectionReason: 'random-fill' })
    } else {
      try {
        const ast = parseSignature(s.signature)
        out.push({
          ...tag(makeQuestion(ast, 0, category, coinBase)),
          selectionReason: 'maintenance',
        })
        used.add(s.signature)
      } catch {
        out.push({ ...tag(block.generateSingle()), selectionReason: 'fallback' })
      }
    }
    maintTaken++
  }
  // Pool empty → single generateSingle per remaining slot (no reject loop)
  while (maintTaken < nMaint) {
    out.push({ ...tag(block.generateSingle()), selectionReason: 'random-fill' })
    maintTaken++
  }

  // 4) Recall slot: score-rank only the SQL-truncated candidate window
  //    (never the full mastered set — perf constraint from the spec).
  if (recallN > 0) {
    const mastered = blockRecallPool
      .filter((s) => !used.has(s.signature))
      .sort((a, b) => recallScore(b) - recallScore(a))
      .slice(0, recallN)
    for (const s of mastered) {
      try {
        const ast = parseSignature(s.signature)
        out.push({
          ...tag(makeQuestion(ast, 0, category, coinBase)),
          selectionReason: 'mastered-recall',
        })
        used.add(s.signature)
      } catch {
        /* skip */
      }
    }
  }

  // Pad if still short
  while (out.length < n) {
    out.push({ ...tag(block.generateSingle()), selectionReason: 'fallback' })
  }

  return out.slice(0, n)
}

function recallScore(s: CalcProblemState): number {
  const ageDays = Math.max(0, (Date.now() - new Date(s.updatedAt).getTime()) / 86400000)
  return ageDays * 2 + Math.max(0, 12 - s.attemptCount) * 3
}

// Voucher prices, labels and gradients live in the `voucher_templates` DB table
// and are accessed via `useVoucherCatalog`. The previously hardcoded constants
// were migrated by docs/voucher-templates.sql.

export function levelKey(level: CalcLevel): string {
  return typeof level === 'number' ? String(level) : level
}

export function parseLevelKey(key: string): CalcLevel {
  if (key === 'C') return 'C'
  const n = Number(key)
  return Number.isFinite(n) ? n : 1
}

export function categoryLabel(cat: CalcCategory): string {
  switch (cat) {
    case 'addsub':
      return '加减法'
    case 'muldiv':
      return '乘除法'
    case 'mixed':
      return '混合运算'
  }
}

/**
 * Pie-eligibility for a fraction question: same-denominator add/sub with a proper
 * (≤ 1) non-negative answer. Returns the two operand numerators, the shared
 * denominator, and the op — or null (caller falls back to the FractionPad keypad).
 * Parses the display so it also works for carried mistakes (no sourceBlockId).
 */
export function fractionPieSpec(
  q: CalcQuestion,
): { operands: [number, number]; den: number; op: '+' | '−' } | null {
  if (q.answer.kind !== 'fraction') return null
  if (q.answer.num < 0 || q.answer.num > q.answer.den) return null
  const m = q.display.match(/^(\d+)\/(\d+)\s*([+−-])\s*(\d+)\/(\d+)\s*=/)
  if (!m) return null
  const d1 = Number(m[2])
  const d2 = Number(m[5])
  if (d1 !== d2) return null
  return { operands: [Number(m[1]), Number(m[4])], den: d1, op: m[3] === '+' ? '+' : '−' }
}

export type DrillType = 'weak-formulas' | 'breakthrough'

export interface DrillParams {
  type: DrillType
  blockId?: string // for 'breakthrough'
}

/**
 * Build a drill session from URL params, WITHOUT reading calc_settings.
 *
 * - 'weak-formulas': generate questions from weak signatures (proficiency <= 2, attemptCount >= 3)
 *   via parseSignature -> makeQuestion. Skips blocks where noResurface = true.
 * - 'breakthrough': generate `count` questions from a single block via generateSingle().
 *   Default count = 20.
 */
export function buildDrillSession(
  params: DrillParams,
  problemStates: Map<string, CalcProblemState>,
  count = 20,
  /** Honor the same 竖式 switch as daily sessions (default on). */
  verticalForBigNumbers = true,
): CalcQuestion[] {
  const tagVertical = (q: CalcQuestion): CalcQuestion =>
    verticalForBigNumbers ? applyVerticalAnswerMode(q) : q

  if (params.type === 'weak-formulas') {
    const weak = [...problemStates.values()].filter(
      (s) => (s.proficiency <= 2 && s.attemptCount >= 3) || s.status === 'lagging',
    )
    if (weak.length === 0) return []

    const out: CalcQuestion[] = []
    for (const state of weak) {
      if (!state.blockId) continue
      const block = blockById(state.blockId)
      if (!block || block.noResurface) continue
      const ast = parseSignature(state.signature)
      const category: CalcCategory =
        block.group === 'add' || block.group === 'sub' ? 'addsub' : 'muldiv'
      const q = makeQuestion(ast, state.level as CalcLevel, category, 1, false)
      out.push(tagVertical({ ...q, sourceBlockId: block.id }))
    }

    // Fisher-Yates shuffle
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  if (params.type === 'breakthrough' && params.blockId) {
    const block = blockById(params.blockId)
    if (!block) return []
    const out: CalcQuestion[] = []
    for (let i = 0; i < count; i++) {
      const q = block.generateSingle()
      out.push(tagVertical({ ...q, sourceBlockId: block.id }))
    }
    return out
  }

  return []
}

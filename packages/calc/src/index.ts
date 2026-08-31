// @rosie/calc — public API for app consumers.
// Route page bodies are imported directly via '@rosie/calc/pages/<name>'.
export { default as VoucherCard } from './components/VoucherCard'
export { playSfx } from './components/audio'
export { useCalcDaily, useCalcSessionSummaries } from './hooks/useCalcDaily'
export {
  useCalcTodaySessions,
  calcTodaySessionsStore,
} from './hooks/useCalcTodaySessions'
export type { CalcTodaySessionRow } from './hooks/useCalcTodaySessions'
export { useCalcPracticeStats } from './hooks/useCalcPracticeStats'
export { todayProgressFromSummaries } from './utils/calc-today-from-summaries'
export { calcPlannedQuestionCount } from './utils/calc-planned-question-count'
export { useCalcMistakes } from './hooks/useCalcMistakes'
export { categoryLabel, buildSession } from './utils/calc-helpers'
export {
  formatAnswer,
  checkAnswer,
  shouldAutoSubmitNumberPad,
  intAnswer,
  decimalAnswer,
  remainderAnswer,
  fractionAnswer,
} from './utils/calc-answer'
export {
  digitsOf,
  hasAnyCarry,
  addHasCarry,
  subHasBorrow,
  hasConsecutiveCarries,
  needsDivMidRemainder,
  enumerateComplementsTo100,
  genMul3d1d,
  genDiv2d1d,
  genSubRound,
  genZerosMul,
  genZerosDiv,
  genAdd100Comp,
  genMul2d1d,
} from './utils/calc-block-gens'
export {
  blockById,
  BLOCKS,
  VERTICAL_BLOCK_IDS,
} from './utils/calc-blocks'
export {
  isFiniteBlock,
  enumerateFinite,
} from './utils/calc-finite'
export { missingTargetIds } from './utils/calc-time-targets'
export {
  INTEGER_CURRICULUM_VERSION,
  canonicalizeIntegerFact,
  coverageSignature,
  curriculumForBlock,
  evaluateIntegerFact,
  factFromSignature,
  integerDifficultyKey,
  isGloballyEligible,
  questionFromCurriculum,
} from './utils/calc-curriculum'
export type { IntegerCurriculum, IntegerFact } from './utils/calc-curriculum'
export { normalizeMixedOps, normalizeSelectedBlocks } from './utils/calc-settings-normalize'
export {
  type CalcTimingMode,
  maxRetryCeiling,
  clampBonusSec,
  resolveTargetSec,
  resolveClockSec,
  tryEnqueueRetry,
  isInMakeupPhase,
  sessionStarMultiplier,
  applySessionStarMultiplier,
} from './utils/calc-session-policy'

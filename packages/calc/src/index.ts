// @rosie/calc — public API for app consumers.
// Route page bodies are imported directly via '@rosie/calc/pages/<name>'.
export { default as VoucherCard } from './components/VoucherCard'
export { playSfx } from './components/audio'
export { useCalcDaily } from './hooks/useCalcDaily'
export { useCalcPracticeStats } from './hooks/useCalcPracticeStats'
export { useCalcMistakes } from './hooks/useCalcMistakes'
export { categoryLabel } from './utils/calc-helpers'
export { formatAnswer } from './utils/calc-answer'
export {
  digitsOf,
  hasAnyCarry,
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

function enabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value !== '0' && value !== 'false'
}

export const CALC_FEATURES = {
  coverageReport: enabled(process.env.NEXT_PUBLIC_CALC_COVERAGE_REPORT, true),
  sessionDedupe: enabled(process.env.NEXT_PUBLIC_CALC_SESSION_DEDUPE, true),
  masteryV2: enabled(process.env.NEXT_PUBLIC_CALC_MASTERY_V2, true),
  adaptiveProgression: enabled(process.env.NEXT_PUBLIC_CALC_ADAPTIVE_PROGRESSION, true),
  conceptCoverage: enabled(process.env.NEXT_PUBLIC_CALC_CONCEPT_COVERAGE, true),
  unifiedSettlement: enabled(process.env.NEXT_PUBLIC_CALC_UNIFIED_SETTLEMENT, false),
  blockProgress: enabled(
    process.env.NEXT_PUBLIC_CALC_BLOCK_PROGRESS,
    enabled(process.env.NEXT_PUBLIC_CALC_UNIFIED_SETTLEMENT, false),
  ),
  serverSelection: enabled(process.env.NEXT_PUBLIC_CALC_SERVER_SELECTION, false),
  serverReport: enabled(process.env.NEXT_PUBLIC_CALC_SERVER_REPORT, false),
} as const

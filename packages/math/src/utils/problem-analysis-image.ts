import type { Problem } from '@rosie/core'

/** Static path in lesson data (`analysisImg`). */
export function hasStaticAnalysisImage(problem: Problem): boolean {
  return Boolean(problem.analysisImg)
}

/** DB upload and/or static `analysisImg`. */
export function problemHasAnalysisImage(
  problem: Problem,
  dbAnalysisProblemIds?: ReadonlySet<string>,
): boolean {
  if (problem.analysisImg) return true
  return dbAnalysisProblemIds?.has(problem.id) ?? false
}

export function analysisImageKey(problemId: string): string {
  return `${problemId}:analysis`
}

/** Extract problem ids that have uploaded analysis images from a lesson image map. */
export function analysisProblemIdsFromImageMap(
  map: ReadonlyMap<string, string>,
): Set<string> {
  const ids = new Set<string>()
  const suffix = ':analysis'
  for (const key of map.keys()) {
    if (key.endsWith(suffix)) ids.add(key.slice(0, -suffix.length))
  }
  return ids
}

import type { MaterialCatalogProjection } from '@rosie/materials'
import { lessonModuleByKey } from '@rosie/math/utils/lesson-module-registry'
import { problemVideoKey } from '@rosie/math-kit/utils/problem-video'
/** Resolve filename aliases through the existing real bank, retaining full group namespaces. */
export function materialProblemProjection(
  keys: string[],
): NonNullable<MaterialCatalogProjection['problems']> {
  return [...new Set(keys)].map((stable_key) => {
    const [lesson, group, encodedId] = stable_key.split(':')
    const lessonKey = decodeURIComponent(lesson)
    const id = decodeURIComponent(encodedId ?? '')
    const groups = lessonModuleByKey(lessonKey)?.PROBLEMS
    const problem = groups?.[group as keyof typeof groups]?.find((p) => p.id === id)
    const alias = problem ? problemVideoKey(problem) : null
    return {
      stable_key,
      label: problem ? `${lessonKey} · ${group} · ${problem.displayId ?? problem.id}` : stable_key,
      aliases: alias ? [alias] : [],
    }
  })
}

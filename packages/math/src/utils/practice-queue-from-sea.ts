import type { SeaProblem } from '@rosie/math/utils/sea-data'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'

export function seaProblemToQueueItem(sp: SeaProblem): PracticeQueueItem {
  return {
    problem: sp.problem,
    section: sp.section,
    lessonId: sp.lessonId,
    detailHref: sp.href,
  }
}

export function seaPoolToQueueItems(pool: SeaProblem[]): PracticeQueueItem[] {
  return pool.map(seaProblemToQueueItem)
}

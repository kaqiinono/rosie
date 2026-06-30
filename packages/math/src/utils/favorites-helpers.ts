import { SEA_POOL, SEA_LESSONS, SEA_LESSON_MAP, type SeaProblem } from './sea-data'

export function resolveFavoriteProblems(
  favorites: Set<string>,
  pool: SeaProblem[] = SEA_POOL,
): SeaProblem[] {
  if (favorites.size === 0) return []
  return pool.filter(sp => favorites.has(sp.problem.id))
}

export type FavoriteLessonGroup = {
  lessonId: string
  title: string
  items: SeaProblem[]
}

export function groupFavoritesByLesson(items: SeaProblem[]): FavoriteLessonGroup[] {
  const byLesson = new Map<string, SeaProblem[]>()
  for (const sp of items) {
    const arr = byLesson.get(sp.lessonId)
    if (arr) arr.push(sp)
    else byLesson.set(sp.lessonId, [sp])
  }
  // 组顺序遵循 SEA_LESSONS
  return SEA_LESSONS
    .filter(l => byLesson.has(l.id))
    .map(l => ({
      lessonId: l.id,
      title: SEA_LESSON_MAP[l.id]?.shortTitle ?? l.id,
      items: byLesson.get(l.id)!,
    }))
}

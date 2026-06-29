import { describe, it, expect } from 'vitest'
import {
  resolveFavoriteProblems,
  groupFavoritesByLesson,
} from '@rosie/math/utils/favorites-helpers'
import { SEA_POOL } from '@rosie/math/utils/sea-data'

describe('resolveFavoriteProblems', () => {
  it('空收藏返回空数组', () => {
    expect(resolveFavoriteProblems(new Set())).toEqual([])
  })

  it('只返回 problem.id 命中的题，且保持 pool 顺序', () => {
    const ids = SEA_POOL.slice(0, 3).map(sp => sp.problem.id)
    const res = resolveFavoriteProblems(new Set(ids))
    expect(res.length).toBe(3)
    expect(res.every(sp => ids.includes(sp.problem.id))).toBe(true)
    const idxInPool = res.map(sp => SEA_POOL.indexOf(sp))
    expect(idxInPool).toEqual([...idxInPool].sort((a, b) => a - b))
  })
})

describe('groupFavoritesByLesson', () => {
  it('按课分组，组顺序遵循 SEA_LESSONS', () => {
    const sample = [SEA_POOL[0], SEA_POOL[SEA_POOL.length - 1]]
    const groups = groupFavoritesByLesson(sample)
    expect(groups.length).toBeGreaterThanOrEqual(1)
    expect(groups.every(g => g.items.length > 0 && g.title.length > 0)).toBe(true)
    const lessonIds = groups.map(g => g.lessonId)
    expect(lessonIds).toEqual([...new Set(lessonIds)]) // 无重复组
  })
})

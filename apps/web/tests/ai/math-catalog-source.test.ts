import { describe, expect, it } from 'vitest'
import { SEA_LESSONS, SEA_POOL } from '@rosie/math/utils/sea-data'

describe('math catalog source', () => {
  it('exposes concrete lesson metadata to the server catalog importer', () => {
    expect(SEA_LESSONS.length).toBeGreaterThan(0)
    expect(SEA_POOL.length).toBeGreaterThan(0)

    for (const lesson of SEA_LESSONS) {
      expect(Array.isArray(lesson.types), `${lesson.id} types`).toBe(true)
      expect(lesson.types.length, `${lesson.id} types`).toBeGreaterThan(0)
    }
  })
})

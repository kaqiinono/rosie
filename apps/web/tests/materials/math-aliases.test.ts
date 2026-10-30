import { it, expect, vi } from 'vitest'
import { suggestCourseMaterialLinks } from '../../../../packages/materials/src/matchCourseMaterials'
vi.mock('@rosie/math/utils/lesson-module-registry', async () => {
  const { PROBLEMS } = await import('../../../../packages/math-content/src/utils/g1/lesson12-data')
  // Collision fixture reuses a real bank problem in a second group, then projects both aliases.
  const shared = PROBLEMS.lesson.find((p) => p.id === '1-12-L5')!
  return {
    lessonModuleByKey: (key: string) =>
      key === '1-12'
        ? { PROBLEMS: { ...PROBLEMS, homework: [...(PROBLEMS.homework ?? []), shared] } }
        : null,
  }
})
import { materialProblemProjection } from '@/components/materials/materialCatalogProjection'
const file = (name: string) => ({
  account_id: '1',
  fs_id: '2',
  path: '/airosie/math/ny/' + name,
  name,
  mime: 'video/mp4',
  size: 1,
})
it('matches the complete real L2/L2-1 filename stem, including restricted projections', () => {
  const problems = materialProblemProjection(['1-12:lesson:1-12-L5', '1-12:lesson:1-12-L6'])
  expect(problems.map((p) => p.aliases)).toEqual([['1-12-L2'], ['1-12-L2-1']])
  const catalog = { lessons: [], segments: [], problems }
  expect(
    suggestCourseMaterialLinks([file('1-12-L2-1.mp4')], catalog)[0].candidates.map((c) => c.scope),
  ).toEqual([{ kind: 'problems', problem_keys: ['1-12:lesson:1-12-L6'] }])
  expect(
    suggestCourseMaterialLinks([file('1-12-L2-1.mp4')], { ...catalog, problems: [problems[0]] })[0]
      .confidence,
  ).toBe('unmatched')
  expect(suggestCourseMaterialLinks([file('1-12-L2.MP4')], catalog)[0].scope).toEqual({
    kind: 'problems',
    problem_keys: ['1-12:lesson:1-12-L5'],
  })
})
it('retains all real group namespaces sharing a complete filename alias', () => {
  const problems = materialProblemProjection(['1-12:lesson:1-12-L5', '1-12:homework:1-12-L5'])
  expect(problems.map((p) => p.aliases)).toEqual([['1-12-L2'], ['1-12-L2']])
  const candidates = problems
  const result = suggestCourseMaterialLinks([file('1-12-L2.mp4')], {
    lessons: [],
    segments: [],
    problems: candidates,
  })[0]
  expect(result.confidence).toBe('ambiguous')
  expect(result.candidates).toHaveLength(2)
})

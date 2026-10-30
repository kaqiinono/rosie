import { it, expect } from 'vitest'
import { suggestCourseMaterialLinks } from '../../../../packages/materials/src/matchCourseMaterials'
const file = (name: string) => ({
  account_id: '1',
  fs_id: '2',
  path: '/x/' + name,
  name,
  mime: '',
  size: 0,
})
it('matches full U/L tokens without U3L1/U3L10 collision', () => {
  const result = suggestCourseMaterialLinks([file('U3L10.mp3')], {
    lessons: [
      { key: '5a-u3l1', title: 'One', book: '5A', unit: 'U3' },
      { key: '5a-u3l10', title: 'Ten', book: '5A', unit: 'U3' },
    ],
    segments: [],
  })
  expect(result[0].candidates.map((c) => c.scope)).toEqual([
    { kind: 'lessons', lesson_keys: ['5a-u3l10'] },
  ])
})
it('keeps ambiguous titles for review and full question namespaces', () => {
  const catalog = {
    lessons: [
      { key: 'l12', title: '第12讲', book: 'math', unit: '' },
      { key: 'l13', title: '第13讲', book: 'math', unit: '' },
    ],
    segments: [],
    problems: [
      { stable_key: 'l12:classroom:1', label: '第12讲 课堂例题 1' },
      { stable_key: 'l13:classroom:1', label: '第13讲 课堂例题 1' },
      { stable_key: 'l12:workbook:1', label: '第12讲 练习册 1' },
    ],
  }
  expect(
    suggestCourseMaterialLinks([file('l12:classroom:1.mp4')], catalog)[0].candidates[0].scope,
  ).toEqual({ kind: 'problems', problem_keys: ['l12:classroom:1'] })
  expect(suggestCourseMaterialLinks([file('unknown.mp4')], catalog)[0].confidence).toBe('unmatched')
  const a = {
    lessons: [
      { key: 'a', title: '春天', book: 'a', unit: '1' },
      { key: 'b', title: '春天', book: 'b', unit: '1' },
    ],
    segments: [],
  }
  expect(suggestCourseMaterialLinks([file('春天.mp3')], a)[0].confidence).toBe('ambiguous')
})

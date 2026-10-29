import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TaskCatalogAdapter, TasksSection } from '../../../../packages/tasks/src/types'
import type { CourseCatalogSnapshot } from '../../../../packages/tasks/src/courseTypes'
import TasksHost from '../../src/components/tasks/TasksHost'
import { retainCompleteSnapshot } from '../../src/lib/task-catalog-snapshot'

const fixture = vi.hoisted(() => ({ catalog: null as TaskCatalogAdapter | null }))
vi.mock('@rosie/core', () => ({ useAuth: () => ({ user: { id: 'catalog-user' } }) }))
vi.mock('@rosie/chinese', () => ({
  useChineseBookLessons: (book: string) => ({ lessons: [{ lessonKey: `${book}::u1-l1`, lessonTitle: '第一课', lesson: 1, unit: 1, lessonKind: 'lesson', sortOrder: 1 }], lessonGroups: [], ready: true, error: null }),
  getBookLessonPassages: () => [], getBookPoems: () => [], getBookAccumulation: () => [], getBookPinyinWriteWords: () => [],
}))
vi.mock('@rosie/english', () => ({
  useWordData: () => ({ vocab: [{ stage: '5A', unit: 'Unit 1', lesson: 'Review', word: 'apple' }], ready: true, error: null }),
  readingPassages: [{ key: '5a-u1l1', stage: '5A', unit: 'Unit 1', lesson: 'Lesson 1', title: 'Known passage', paragraphs: ['Text'] }],
}))
vi.mock('@rosie/math-kit/utils/lesson-registry', () => ({ LESSONS: [{ lessonKey: '2-1', grade: 2, seq: 1 }] }))
vi.mock('@rosie/tasks', () => ({ TasksPage: ({ catalog, section }: { catalog: TaskCatalogAdapter; section: TasksSection }) => {
  fixture.catalog = catalog
  return <div>Task section: {section}</div>
} }))
const identity = { id: 'snapshot', user_id: 'catalog-user', subject: 'english' as const, created_at: '2026-10-29T00:00:00Z', source: 'builtin' as const, progression_mode: 'lesson' as const }

describe('TasksHost catalog source boundary', () => {
  it.each(['tasks', 'pool', 'materials'] as const)('keeps %s usable with accepted nonstandard vocabulary labels and blocks incomplete English snapshots', async section => {
    render(<TasksHost section={section} />)
    expect(screen.getByText(`Task section: ${section}`)).toBeTruthy()
    const catalog = fixture.catalog!
    expect(catalog.english).toEqual([])
    expect(catalog.readiness?.english).toMatchObject({ status: 'error', complete: false, error: 'invalid_lesson_label' })
    expect(catalog.math.map(row => row.key)).toEqual(['2-1'])
    expect(catalog.chinese).toHaveLength(3)
    expect(catalog.readinessFor?.('math')).toMatchObject({ status: 'ready', complete: true })
    expect(catalog.readinessFor?.('chinese', { book: 'g2a' })).toMatchObject({ status: 'ready', complete: true })
    expect(await catalog.prepareSnapshot!({ ...identity, selection: { book: '5A' } })).toMatchObject({ status: 'unavailable', code: 'catalog_not_ready' })
    const previous: CourseCatalogSnapshot = { ...identity, version: 'prior', ordered_lessons: [{ key: '5a-u1l1', title: 'Prior lesson', book: '5A', unit: '1', kind: 'lesson' }], teaching_segments: [] }
    expect(retainCompleteSnapshot(previous, { ...identity, chinese: [], english: [], math: [], manual: [], teaching_segments: [], readiness: catalog.readiness!.english! })).toBe(previous)
  })
})

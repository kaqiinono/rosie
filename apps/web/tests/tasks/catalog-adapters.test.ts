import { describe, expect, it } from 'vitest'
import { adaptChineseCatalog, adaptEnglishCatalog, adaptMathProblems, createTaskCatalogAdapter } from '../../src/components/tasks/taskCatalogAdapters'
import { buildCourseCatalogSnapshot, catalogConfigurationIssues, retainCompleteSnapshot } from '../../src/lib/task-catalog-snapshot'
import type { CatalogSourceInput } from '../../src/lib/task-catalog-snapshot'

const ready = { status: 'ready' as const, complete: true, error: null }
const identity = { id: 'snapshot-1', user_id: 'user-1', created_at: '2026-10-29T00:00:00Z', source: 'builtin' as const, progression_mode: 'lesson' as const }
const lesson = (key: string, book = '5A', unit = '1') => ({ key, book, unit, title: key, kind: 'lesson' })
const source = (overrides: Partial<CatalogSourceInput> = {}): CatalogSourceInput => ({
  ...identity, subject: 'english', chinese: [], english: [{ ...lesson('5a-u1l1'), order: 1 }], math: [], manual: [], teaching_segments: [], readiness: ready, ...overrides,
})

describe('pure durable catalogs', () => {
  it('orders lessons numerically by declared order and limits progression to the selected book/unit', () => {
    const input = source({ english: [{ ...lesson('5a-u10l1', '5A', '10'), order: 10 }, { ...lesson('4a-u1l1', '4A'), order: 0 }, { ...lesson('5a-u2l1', '5A', '2'), order: 2 }], selection: { book: '5A' } })
    const snapshot = buildCourseCatalogSnapshot(input)
    expect(snapshot.ordered_lessons.map(l => l.key)).toEqual(['5a-u2l1', '5a-u10l1'])
    expect(buildCourseCatalogSnapshot({ ...input, selection: { book: '5A', units: ['10'] } }).ordered_lessons.map(l => l.key)).toEqual(['5a-u10l1'])
    expect(snapshot).toMatchObject(identity)
    expect(snapshot.version).toBe(buildCourseCatalogSnapshot({ ...input, id: 'new-id', created_at: '2027-01-01T00:00:00Z' }).version)
    expect(snapshot.version).not.toBe(buildCourseCatalogSnapshot({ ...input, english: input.english.map(l => ({ ...l, order: -l.order })) }).version)
  })
  it('preserves same-titled Chinese lessons in separate books and the declared lesson order', () => {
    const chinese = adaptChineseCatalog([
      { book: 'g2a', lessons: [{ lessonKey: 'u1-l2', lessonTitle: '同名', unit: 1, lessonKind: 'lesson', sortOrder: 20 }, { lessonKey: 'u1-l1', lessonTitle: '第一课', unit: 1, lessonKind: 'lesson', sortOrder: 10 }] },
      { book: 'g2b', lessons: [{ lessonKey: 'g2b::u1-l2', lessonTitle: '同名', unit: 1, lessonKind: 'lesson', sortOrder: 10 }] },
    ])
    expect(chinese.map(l => l.key)).toEqual(['g2a::u1-l1', 'g2a::u1-l2', 'g2b::u1-l2'])
    const snapshot = buildCourseCatalogSnapshot(source({ subject: 'chinese', chinese, selection: { book: 'g2b' } }))
    expect(snapshot.ordered_lessons.map(l => l.key)).toEqual(['g2b::u1-l2'])
  })
  it('keeps vocabulary-only 5A U6 and does not invent passage, audio, page or extra Lesson entries', () => {
    const english = adaptEnglishCatalog([{ stage: '5A', unit: 'Unit 6', lesson: 'Lesson 2', word: 'real' }], [])
    expect(english.map(l => l.key)).toEqual(['5a-u6l2'])
    expect(english[0].href).toBeUndefined()
    expect(english[0].resources).toContainEqual({ kind: 'vocabulary', status: 'available', count: 1 })
    expect(english[0].resources).toContainEqual({ kind: 'passage', status: 'missing' })
    expect(english[0].resources).toContainEqual({ kind: 'audio', status: 'unverified' })
    expect(JSON.stringify(english)).not.toContain('page')
  })
  it('keeps stage in identity and only reports grammar/writing when supplied passage sections exist', () => {
    const english = adaptEnglishCatalog([], [
      { key: '5a-u2l1', stage: '5A', unit: 'Unit 2', lesson: 'Lesson 1', title: 'Same', paragraphs: ['Text'], learningSections: [{ type: 'grammar', grammarRefs: [{ book: 'essential', unitNumber: 2 }] }, { type: 'writing' }] },
      { key: '4a-u2l1', stage: '4A', unit: 'Unit 2', lesson: 'Lesson 1', title: 'Same', paragraphs: ['Text'] },
    ])
    expect(english.map(l => l.key)).toEqual(['4a-u2l1', '5a-u2l1'])
    expect(english[1].resources?.filter(r => r.status === 'available').map(r => r.kind)).toEqual(['passage', 'grammar', 'writing'])
    expect(english[0].resources?.find(r => r.kind === 'grammar')?.status).toBe('missing')
  })
  it('retains group, real ID, display number, order and tags; formal keys include the lesson', () => {
    const bank = { lesson: [{ id: 'real-a', displayId: 'L1', title: '例题', tag: 'shape' }], homework: [{ id: 'real-a', displayId: 'L1', title: '作业', tag: 'shape' }] }
    const rows = adaptMathProblems({ lessonKey: '2-10', grade: 2, seq: 10 }, bank)
    expect(rows.map(r => r.key)).toEqual(['lesson:real-a', 'homework:real-a'])
    expect(rows.map(r => r.stable_key)).toEqual(['2-10:lesson:real-a', '2-10:homework:real-a'])
    expect(rows[0]).toMatchObject({ id: 'real-a', lesson_key: '2-10', group: 'lesson', displayId: 'L1', order: 0, tags: ['shape'], href: '/math/ny/2/10/lesson/real-a' })
    expect(rows.every(r => r.replay_ref === undefined)).toBe(true)
    expect(adaptMathProblems({ lessonKey: '1-10', grade: 1, seq: 10 }, bank)[0].stable_key).not.toBe(rows[0].stable_key)
    expect(adaptMathProblems({ lessonKey: '2-10', grade: 2, seq: 10 }, bank, { 'lesson:real-a': '/verified/replay' })[0].replay_ref).toBe('/verified/replay')
  })
  it('persists declared teaching segments with exact problem identities and selected segment order', () => {
    const math = [{ ...lesson('2-10', '2 年级', '10'), order: 0 }]
    const segments = [{ key: '2-10:part2', lesson_key: '2-10', title: '第二段', problem_keys: ['2-10:homework:real-a'] }, { key: '2-10:part1', lesson_key: '2-10', title: '第一段', problem_keys: ['2-10:lesson:real-a'] }]
    const result = buildCourseCatalogSnapshot(source({ subject: 'math', math, teaching_segments: segments, selection: { book: '2 年级', segment_keys: ['2-10:part1'] } }))
    expect(result.teaching_segments).toEqual([segments[1]])
    segments[1].problem_keys.push('later-edit')
    expect(result.teaching_segments[0].problem_keys).toEqual(['2-10:lesson:real-a'])
  })
  it.each([{ status: 'loading' as const, complete: false, error: null }, { status: 'error' as const, complete: false, error: 'offline' }, { status: 'ready' as const, complete: false, error: null }])('rejects incomplete reads and retains the prior complete snapshot (%o)', readiness => {
    const previous = buildCourseCatalogSnapshot(source())
    expect(() => buildCourseCatalogSnapshot(source({ english: [], readiness }))).toThrow('catalog_not_ready')
    expect(retainCompleteSnapshot(previous, source({ english: [], readiness }))).toBe(previous)
  })
  it('rejects ready-empty selection, duplicate keys, orphan segments and segment references outside their lesson', () => {
    expect(() => buildCourseCatalogSnapshot(source({ english: [] }))).toThrow('catalog_empty')
    expect(() => buildCourseCatalogSnapshot(source({ selection: { book: 'missing' } }))).toThrow('catalog_empty')
    expect(() => buildCourseCatalogSnapshot(source({ english: [source().english[0], source().english[0]] }))).toThrow('duplicate_lesson_key')
    expect(() => buildCourseCatalogSnapshot(source({ teaching_segments: [{ key: 'orphan', lesson_key: 'missing', title: 'x', problem_keys: [] }] }))).toThrow('orphan_segment')
    expect(() => buildCourseCatalogSnapshot(source({ teaching_segments: [{ key: 'seg', lesson_key: '5a-u1l1', title: 'x', problem_keys: ['other:lesson:id'] }] }))).toThrow('invalid_segment_problem')
  })
  it('prepares snapshots asynchronously with explicit readiness failure; material adapter remains an injected seam', async () => {
    const adapter = createTaskCatalogAdapter({ chinese: [], english: source().english, math: [], readiness: { english: ready }, loadMathProblems: async () => [] })
    const result = await adapter.prepareSnapshot({ ...identity, subject: 'english', selection: { book: '5A' } })
    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(result.snapshot.ordered_lessons.map(l => l.key)).toEqual(['5a-u1l1'])
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'chinese' })).toMatchObject({ status: 'unavailable', readiness: { complete: false } })
    const loading = createTaskCatalogAdapter({ chinese: [], english: [], math: [], readiness: { english: { status: 'loading', complete: false, error: null } }, loadMathProblems: async () => [] })
    expect(await loading.prepareSnapshot({ ...identity, subject: 'english' })).toMatchObject({ status: 'unavailable' })
  })
  it('allows manual lesson progression for school math without loading the builtin problem bank', async () => {
    const manual = [{ ...lesson('school-math:chapter1', '校内数学'), order: 0 }]
    const adapter = createTaskCatalogAdapter({ chinese: [], english: [], math: [], readiness: {}, loadMathProblems: async () => { throw new Error('builtin_must_not_load') } })
    const result = await adapter.prepareSnapshot({ ...identity, subject: 'math', source: 'manual', progression_mode: 'lesson', manual_lessons: manual })
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.snapshot).toMatchObject({ source: 'manual', progression_mode: 'lesson', teaching_segments: [] })
      expect(result.snapshot.ordered_lessons.map(row => row.key)).toEqual(['school-math:chapter1'])
    }
  })
  it('reports unconfigured future segments without treating a valid catalog as failed or finished', () => {
    const snapshot = buildCourseCatalogSnapshot(source({ progression_mode: 'segment' }))
    expect(catalogConfigurationIssues(snapshot)).toEqual([{ code: 'missing_teaching_segments', lesson_keys: ['5a-u1l1'] }])
    expect(buildCourseCatalogSnapshot(source({ progression_mode: 'lesson', source: 'builtin' }))).toMatchObject({ progression_mode: 'lesson', source: 'builtin' })
  })

  it('validates explicit math segments against loaded real problems without inferring teaching order from groups', async () => {
    const math = [{ ...lesson('2-10', '2 年级', '10'), order: 0 }]
    const problems = adaptMathProblems({ lessonKey: '2-10', grade: 2, seq: 10 }, { lesson: [{ id: '2-10-L1', title: '例题', tag: 'shape' }], homework: [{ id: '2-10-H1', title: '作业', tag: 'shape' }] })
    const adapter = createTaskCatalogAdapter({ chinese: [], english: [], math, readiness: { math: ready }, loadMathProblems: async () => problems })
    const unconfigured = await adapter.prepareSnapshot({ ...identity, subject: 'math', source: 'builtin', progression_mode: 'segment' })
    expect(unconfigured).toMatchObject({ status: 'ready', snapshot: { teaching_segments: [] }, issues: [{ code: 'missing_teaching_segments', lesson_keys: ['2-10'] }] })
    const segments = [{ key: '2-10:example1', lesson_key: '2-10', title: '例1', problem_keys: ['2-10:lesson:2-10-L1'], completes_lesson: true }]
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'math', teaching_segments: segments })).toMatchObject({ status: 'ready', snapshot: { teaching_segments: segments }, issues: [] })
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'math', teaching_segments: [{ ...segments[0], problem_keys: ['2-10:lesson:invented'] }] })).toMatchObject({ status: 'unavailable', code: 'unknown_segment_problem' })
    const failed = createTaskCatalogAdapter({ chinese: [], english: [], math, readiness: { math: ready }, loadMathProblems: async () => { throw new Error('bank_offline') } })
    expect(await failed.prepareSnapshot({ ...identity, subject: 'math' })).toMatchObject({ status: 'unavailable', code: 'bank_offline' })
  })
  it('does not block a selected ready Chinese book because another book is unavailable', async () => {
    const adapter = createTaskCatalogAdapter({ chinese: [{ ...lesson('g2a::u1-l1', 'g2a'), order: 0 }], english: [], math: [], readiness: { chinese: { status: 'error', complete: false, error: 'other_book_offline' } }, readinessFor: (_, selection) => selection?.book === 'g2a' ? ready : { status: 'error', complete: false, error: 'offline' }, loadMathProblems: async () => [] })
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'chinese', selection: { book: 'g2a' } })).toMatchObject({ status: 'ready' })
  })

  it('distinguishes an open segment sequence from an explicitly finished lesson and rejects premature closure', () => {
    const input = source({ subject: 'math', math: [{ ...lesson('2-10', '2 年级', '10'), order: 0 }], progression_mode: 'segment', teaching_segments: [{ key: 'part1', lesson_key: '2-10', title: '例题10–20', problem_keys: ['2-10:lesson:2-10-L10'] }] })
    expect(catalogConfigurationIssues(buildCourseCatalogSnapshot(input))).toEqual([{ code: 'unclosed_teaching_segments', lesson_keys: ['2-10'] }])
    const closed = buildCourseCatalogSnapshot({ ...input, teaching_segments: [{ ...input.teaching_segments[0], completes_lesson: true }] })
    expect(catalogConfigurationIssues(closed)).toEqual([])
    expect(closed.teaching_segments[0].completes_lesson).toBe(true)
    expect(() => buildCourseCatalogSnapshot({ ...input, teaching_segments: [{ ...input.teaching_segments[0], completes_lesson: true }, { ...input.teaching_segments[0], key: 'part2', problem_keys: ['2-10:lesson:2-10-L21'] }] })).toThrow('premature_lesson_completion')
  })

  it('requires explicit source and progression for new snapshots instead of inferring them from subject', () => {
    const withoutSource = { ...source() } as Partial<CatalogSourceInput>
    delete withoutSource.source
    expect(() => buildCourseCatalogSnapshot(withoutSource as CatalogSourceInput)).toThrow('catalog_source_required')
    const withoutProgression = { ...source({ subject: 'math', math: [{ ...lesson('school:math'), order: 0 }] }) } as Partial<CatalogSourceInput>
    delete withoutProgression.progression_mode
    expect(() => buildCourseCatalogSnapshot(withoutProgression as CatalogSourceInput)).toThrow('catalog_progression_required')
  })

  it('validates only math segments selected by book and segment scope while retaining structural validation', async () => {
    const math = [{ ...lesson('1-12', '1 年级', '12'), order: 0 }, { ...lesson('2-1', '2 年级', '1'), order: 1 }]
    const segments = [
      { key: '1-12:example1', lesson_key: '1-12', title: '一年级例题', problem_keys: ['1-12:lesson:1-12-L1'], completes_lesson: true },
      { key: '2-1:example1', lesson_key: '2-1', title: '二年级例题', problem_keys: ['2-1:lesson:2-1-L1'], completes_lesson: true },
    ]
    const loaded: string[] = []
    const adapter = createTaskCatalogAdapter({ chinese: [], english: [], math, readiness: { math: ready }, loadMathProblems: async key => {
      loaded.push(key)
      if (key !== '2-1') throw new Error('unselected_bank_must_not_load')
      return adaptMathProblems({ lessonKey: '2-1', grade: 2, seq: 1 }, { lesson: [{ id: '2-1-L1', title: '例题', tag: 'shape' }] })
    } })
    for (const selection of [{ book: '2 年级' }, { lesson_keys: ['2-1'], segment_keys: ['2-1:example1'] }]) {
      const result = await adapter.prepareSnapshot({ ...identity, subject: 'math', progression_mode: 'segment', teaching_segments: segments, selection })
      expect(result.status).toBe('ready')
      if (result.status === 'ready') {
        expect(result.snapshot.ordered_lessons.map(row => row.key)).toEqual(['2-1'])
        expect(result.snapshot.teaching_segments).toEqual([segments[1]])
        expect(result.issues).toEqual([])
      }
    }
    expect(loaded).toEqual(['2-1', '2-1'])
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'math', teaching_segments: [{ ...segments[0], lesson_key: 'orphan' }, segments[1]], selection: { book: '2 年级' } })).toMatchObject({ status: 'unavailable', code: 'orphan_segment' })
    expect(await adapter.prepareSnapshot({ ...identity, subject: 'math', teaching_segments: segments, selection: { book: '2 年级', segment_keys: ['1-12:example1'] } })).toMatchObject({ status: 'unavailable', code: 'selected_segment_outside_scope' })
  })

})

'use client'

import { useEffect, useRef, useState } from 'react'
import type { CourseInput, CatalogLesson, ProblemOption, ProblemGroup } from '../../types'
import type { CourseCatalogSnapshot, TeachingSegment } from '../../courseTypes'
import { useTasks, Field, inputClass, minorClass } from '../shared'

type Props = { value: CourseInput; snapshot?: CourseCatalogSnapshot; onChange: (patch: Partial<CourseInput>) => void; onPendingChange: (message: string) => void }
/** Preparation is local to the draft. Only the parent atomic save persists a snapshot. */
export default function CourseLearningSettings({ value, snapshot, onChange, onPendingChange }: Props) {
  const { api, catalog } = useTasks()
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [source, setSource] = useState<'builtin' | 'manual'>(snapshot?.source ?? 'manual')
  const [book, setBook] = useState(snapshot?.ordered_lessons[0]?.book ?? '')
  const [selected, setSelected] = useState<string[]>(snapshot?.ordered_lessons.map(l => l.key) ?? [])
  const [manual, setManual] = useState<CatalogLesson[]>(snapshot?.source === 'manual' ? snapshot.ordered_lessons.map((l, order) => ({ ...l, order })) : [])
  const [segments, setSegments] = useState<TeachingSegment[]>(snapshot?.teaching_segments ?? [])
  const [lessonKey, setLessonKey] = useState(snapshot?.ordered_lessons[0]?.key ?? '')
  const [group, setGroup] = useState<ProblemGroup>('lesson')
  const [problems, setProblems] = useState<ProblemOption[]>([])
  const [problemKeys, setProblemKeys] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [closes, setCloses] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const builtin = value.subject === 'chinese' ? catalog.chinese : value.subject === 'english' ? catalog.english : value.subject === 'math' ? catalog.math : []
  const segmentMode = source === 'builtin' && value.subject === 'math'
  const pending = () => { setMessage('目录修改尚未准备，请准备目录后再保存课程。'); onPendingChange('请先准备修改后的目录。') }
  const available = builtin.filter(l => !book || l.book === book)
  const shownProblems = problems.filter(p => p.group === group).sort((a, b) => a.order - b.order)
  const activeSnapshot = value.catalog_snapshot ?? snapshot
  const prepare = async () => {
    if (!catalog.prepareSnapshot || !api.user) { setMessage('当前目录尚未就绪，请稍后重试。'); return }
    setBusy(true); onPendingChange('正在准备目录。'); setMessage('')
    try {
      if (source === 'manual' && manual.some(l => !l.title.trim())) throw new Error('请填写每个目录项的标题。')
      if (source === 'builtin' && !book) throw new Error('请选择一本教材或阶段。')
      if (source === 'builtin' && !selected.length) throw new Error('请选择至少一个目录项。')
      const result = await catalog.prepareSnapshot({ id: crypto.randomUUID(), user_id: api.user.id, created_at: new Date().toISOString(), subject: value.subject, source, progression_mode: segmentMode ? 'segment' : 'lesson', selection: source === 'builtin' ? { book, lesson_keys: selected } : undefined, manual_lessons: manual.map((l, order) => ({ ...l, order })), teaching_segments: segmentMode ? segments : [] })
      if (!mounted.current) return
      if (result.status !== 'ready') throw new Error(result.readiness.error || '目录暂不可用，已保留原目录。')
      const prepared = result.snapshot
      const previous = value.cursor
      const lesson = prepared.ordered_lessons.find(l => l.key === previous?.lesson_key) ?? prepared.ordered_lessons[0]
      const segment = prepared.teaching_segments.find(s => s.key === previous?.segment_key && s.lesson_key === lesson.key) ?? prepared.teaching_segments.find(s => s.lesson_key === lesson.key)
      onChange({ catalog_snapshot: prepared, catalog_snapshot_id: null, cursor: prepared.progression_mode === 'segment' && !segment ? null : { lesson_key: lesson.key, segment_key: prepared.progression_mode === 'segment' ? segment?.key ?? null : null } })
      onPendingChange('')
      setMessage(result.issues.length ? '目录已准备。尚有未配置或未标记结束的教学段，到达缺口时将暂停推进。' : '目录已准备，保存课程后生效。')
    } catch (cause) { if (!mounted.current) return; const text = cause instanceof Error ? cause.message : '目录准备失败，请重试。'; setMessage(text === 'premature_lesson_completion' ? '“本讲最后一段”之后还有同讲教学段，请移除该结束标记后重试。' : text); onPendingChange(text) } finally { setBusy(false) }
  }
  return <section aria-label="学习内容" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-semibold">学习内容与自动安排</h3>
    <p className="text-sm text-slate-500">学习设置保存后立即生效。自动分配仅安排任务，不表示实际完课。</p>
    <div className="flex flex-wrap gap-4"><label><input type="checkbox" checked={value.auto_assign ?? false} onChange={e => onChange({ auto_assign: e.target.checked })} /> 自动分配任务</label><label><input type="checkbox" checked={value.auto_advance ?? false} onChange={e => onChange({ auto_advance: e.target.checked })} /> 自动推进内容</label></div>
    <details><summary className="cursor-pointer py-3 font-medium">配置目录范围与教学段</summary>
      <fieldset disabled={busy} className="space-y-3 pt-3">
        <Field label="目录来源"><select className={inputClass} value={source} onChange={e => { setSource(e.target.value as typeof source); pending() }}><option value="manual">手动目录（适用所有科目）</option>{['chinese', 'english', 'math'].includes(value.subject) && <option value="builtin">已有学科目录</option>}</select></Field>
        {source === 'manual' ? <div className="space-y-3">
          {manual.map((lesson, index) => <div key={lesson.key} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3"><Field label={`第 ${index + 1} 项标题`}><input required maxLength={200} className={inputClass} value={lesson.title} onChange={e => { setManual(rows => rows.map(l => l.key === lesson.key ? { ...l, title: e.target.value } : l)); pending() }} /></Field><Field label={`第 ${index + 1} 项教材`}><input maxLength={120} className={inputClass} value={lesson.book} onChange={e => { setManual(rows => rows.map(l => l.key === lesson.key ? { ...l, book: e.target.value } : l)); pending() }} /></Field><Field label={`第 ${index + 1} 项单元`}><input maxLength={120} className={inputClass} value={lesson.unit} onChange={e => { setManual(rows => rows.map(l => l.key === lesson.key ? { ...l, unit: e.target.value } : l)); pending() }} /></Field><button type="button" className={minorClass} onClick={() => { setManual(rows => rows.filter(l => l.key !== lesson.key)); pending() }}>移除第 {index + 1} 项</button></div>)}
          <button type="button" className={minorClass} onClick={() => { setManual(rows => [...rows, { key: `manual:${crypto.randomUUID()}`, title: '', book: '', unit: '', kind: 'manual', order: rows.length }]); pending() }}>添加目录项</button>
        </div> : <>
          <Field label="教材 / 阶段"><select className={inputClass} value={book} onChange={e => { setBook(e.target.value); setSelected([]); setSegments([]); setProblems([]); setLessonKey(''); pending() }}><option value="">请选择</option>{[...new Set(builtin.map(l => l.book))].map(b => <option key={b} value={b}>{b}</option>)}</select></Field>
          {book && <div className="max-h-52 space-y-2 overflow-auto">{available.map(l => <label key={l.key} className="block text-sm"><input type="checkbox" checked={selected.includes(l.key)} onChange={e => { setSelected(keys => e.target.checked ? [...keys, l.key] : keys.filter(k => k !== l.key)); pending() }} /> {l.book} · {l.unit} · {l.title}</label>)}</div>}
          {segmentMode && <div className="space-y-3 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-600">按实际教学顺序添加教学段。只选择目前确定的题目；题组本身不决定上课顺序。</p>
            <Field label="教学段所属讲次"><select className={inputClass} value={lessonKey} onChange={e => { setLessonKey(e.target.value); setProblems([]); setProblemKeys([]) }}><option value="">请选择</option>{available.filter(l => selected.includes(l.key)).map(l => <option key={l.key} value={l.key}>{l.title}</option>)}</select></Field>
            <button type="button" disabled={!lessonKey} className={minorClass} onClick={async () => { setBusy(true); try { setProblems(await catalog.loadMathProblems(lessonKey)); setProblemKeys([]); setMessage('') } catch { setMessage('题目加载失败，请重试。') } finally { setBusy(false) } }}>加载本讲题目</button>
            <Field label="题目来源"><select className={inputClass} value={group} onChange={e => { setGroup(e.target.value as ProblemGroup); setProblemKeys([]) }}>{([['lesson', '课堂例题'], ['pretest', '课前测'], ['homework', '课后练习'], ['workbook', '练习册'], ['supplement', '补充题']] as const).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <div className="max-h-52 space-y-2 overflow-auto">{shownProblems.map(p => <label key={p.stable_key} className="block text-sm"><input type="checkbox" checked={problemKeys.includes(p.stable_key)} onChange={e => setProblemKeys(keys => e.target.checked ? [...keys, p.stable_key] : keys.filter(k => k !== p.stable_key))} /> {p.displayId} · {p.title}</label>)}</div>
            <Field label="教学段名称"><input maxLength={200} className={inputClass} placeholder="例如：例题 10–20" value={title} onChange={e => setTitle(e.target.value)} /></Field>
            <label className="block text-sm"><input type="checkbox" checked={closes} onChange={e => setCloses(e.target.checked)} /> 本讲最后一段</label>
            <button type="button" className={minorClass} disabled={!title.trim() || !problemKeys.length || !lessonKey} onClick={() => { setSegments(rows => [...rows, { key: `segment:${crypto.randomUUID()}`, lesson_key: lessonKey, title: title.trim(), problem_keys: shownProblems.filter(p => problemKeys.includes(p.stable_key)).map(p => p.stable_key), completes_lesson: closes }]); setTitle(''); setProblemKeys([]); setCloses(false); pending() }}>添加教学段</button>
            {segments.map((s, i) => <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{i + 1}. {builtin.find(l => l.key === s.lesson_key)?.title} · {s.title} · {s.problem_keys.length} 题{s.completes_lesson ? ' · 本讲最后一段' : ''}</span><label><input type="checkbox" checked={s.completes_lesson ?? false} onChange={e => { setSegments(rows => rows.map(row => row.key === s.key ? { ...row, completes_lesson: e.target.checked } : row)); pending() }} /> {s.title}为本讲最后一段</label><button type="button" className={minorClass} onClick={() => { setSegments(rows => rows.filter(row => row.key !== s.key)); pending() }}>移除 {s.title}</button></div>)}
          </div>}
        </>}
        <button type="button" className={minorClass} onClick={() => void prepare()}>{busy ? '准备中…' : '准备目录'}</button>
        <button type="button" className={minorClass} onClick={() => { setSource(activeSnapshot?.source ?? 'manual'); setBook(activeSnapshot?.ordered_lessons[0]?.book ?? ''); setSelected(activeSnapshot?.ordered_lessons.map(l => l.key) ?? []); setManual(activeSnapshot?.source === 'manual' ? activeSnapshot.ordered_lessons.map((l, order) => ({ ...l, order })) : []); setSegments(activeSnapshot?.teaching_segments ?? []); setProblems([]); setProblemKeys([]); setMessage(''); onPendingChange('') }}>放弃未准备的目录修改</button>
      </fieldset>
    </details>
    {activeSnapshot && <><Field label="下一次学习内容"><select className={inputClass} value={value.cursor?.lesson_key ?? ''} onChange={e => { const key = e.target.value; onChange({ cursor: key ? { lesson_key: key, segment_key: activeSnapshot.progression_mode === 'segment' ? activeSnapshot.teaching_segments.find(s => s.lesson_key === key)?.key ?? null : null } : null }) }}><option value="">未设置</option>{activeSnapshot.ordered_lessons.map(l => <option key={l.key} value={l.key}>{l.book} · {l.unit} · {l.title}</option>)}</select></Field>{activeSnapshot.progression_mode === 'segment' && <Field label="下一次教学段"><select className={inputClass} value={value.cursor?.segment_key ?? ''} onChange={e => onChange({ cursor: value.cursor ? { ...value.cursor, segment_key: e.target.value || null } : null })}><option value="">尚未配置</option>{activeSnapshot.teaching_segments.filter(s => s.lesson_key === value.cursor?.lesson_key).map(s => <option key={s.key} value={s.key}>{s.title}{s.completes_lesson ? '（本讲最后一段）' : ''}</option>)}</select></Field>}</>}
    {message && <p role="status" className="text-sm text-amber-800">{message}</p>}
  </section>
}

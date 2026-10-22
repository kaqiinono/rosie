'use client'

import { useState } from 'react'
import type { CourseOccurrence, LessonRef, ProblemOption, ChecklistItem } from '../types'
import { displayTime } from '../time'
import LessonPicker from './LessonPicker'
import { useTasks, Panel, Field, buttonClass, inputClass, minorClass, lines } from './shared'

export default function CourseConfirm({ occurrence, onClose }: { occurrence: CourseOccurrence; onClose: () => void }) {
  const { api, catalog, run, busy, notify } = useTasks()
  const course = api.data.courses.find(c => c.id === occurrence.course_id)
  const subject = course?.subject ?? 'other'
  const lessons = subject === 'chinese' ? catalog.chinese : subject === 'math' ? catalog.math : subject === 'english' ? catalog.english : []
  const previous = api.data.occurrences.filter(o => o.course_id === occurrence.course_id && o.confirmation && o.starts_at < occurrence.starts_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0]
  const suggested = previous?.confirmation?.next_lesson ?? (subject === 'english' ? lessons[lessons.findIndex(l => l.key === previous?.confirmation?.lesson.key) + 1] : null) ?? null
  const [lesson, setLesson] = useState<LessonRef | null>(occurrence.confirmation?.lesson ?? suggested)
  const [next, setNext] = useState<LessonRef | null>(occurrence.confirmation?.next_lesson ?? (suggested ? lessons[lessons.findIndex(l => l.key === suggested.key) + 1] ?? null : null))
  const [problems, setProblems] = useState<ProblemOption[]>([])
  const [selectedClass, setSelectedClass] = useState<string[]>([])
  const [selectedHomework, setSelectedHomework] = useState<string[]>([])
  const [offlineClass, setOfflineClass] = useState('')
  const [offlineHomework, setOfflineHomework] = useState('')
  const [loadingKey, setLoadingKey] = useState('')
  const changeLesson = (l: LessonRef | null) => { setLesson(l); setNext(l ? lessons[lessons.findIndex(x => x.key === l.key) + 1] ?? null : null); setProblems([]); setSelectedClass([]); setSelectedHomework([]) }
  const items = (selected: string[], offline: string): ChecklistItem[] => [...selected.map(key => { const p = problems.find(p => p.key === key); return { id: key, label: p?.title ?? key, href: p?.href, done: false } }), ...lines(offline).map((label, i) => ({ id: `offline-${i}`, label, done: false }))]
  return <Panel title={`${occurrence.status === 'confirmed' ? '修改预备课' : '确认课程'} · ${course?.name ?? ''}`}>
    <p className="text-sm text-slate-500">{displayTime(occurrence.starts_at)}—{displayTime(occurrence.ends_at)}</p>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
      if (occurrence.status === 'confirmed') {
        if (!next) throw new Error('请选择下次预备课')
        const retained = await api.rpc('task_update_preview', { p_occurrence: occurrence.id, p_lesson: next })
        if (Number(retained) > 0) notify('预备课已修改；已开始或完成的预习任务保留原内容。')
      } else {
        if (!lesson) throw new Error('请选择本次课程内容')
        const unitLessons = subject === 'chinese' ? lessons.filter(l => l.book === lesson.book && l.unit === lesson.unit && ['lesson', 'garden'].includes(l.kind)) : []
        await api.rpc('task_confirm_course', { p_occurrence: occurrence.id, p_confirmation: { lesson, next_lesson: next, class_items: items(selectedClass, offlineClass), homework_items: items(selectedHomework, offlineHomework), unit_lessons: unitLessons } })
      }
      onClose()
    }) }}>
      {occurrence.status === 'confirmed' ? <p className="text-sm">本次讲完：{occurrence.confirmation?.lesson.title}</p> : lessons.length ? <LessonPicker lessons={lessons} value={lesson} onChange={changeLesson} label="本次讲完的一课" /> : <Field label="本次课程内容"><input required className={inputClass} value={lesson?.title ?? ''} onChange={e => setLesson({ key: occurrence.id, title: e.target.value, book: course?.name ?? '', unit: '', kind: 'lesson' })} /></Field>}
      {subject === 'chinese' && <LessonPicker lessons={lessons} value={next} onChange={setNext} label="下次预备课（可修改）" optional={occurrence.status !== 'confirmed'} />}
      {subject === 'math' && occurrence.status !== 'confirmed' && <>
        <button type="button" className={minorClass} disabled={!lesson || busy || !!loadingKey} onClick={() => { if (!lesson) return; const key = lesson.key; setLoadingKey(key); void run(async () => { const rows = await catalog.loadMathProblems(key); setProblems(rows) }).finally(() => setLoadingKey('')) }}>载入所选讲次题库</button>
        <div className="max-h-80 overflow-auto rounded-xl border border-slate-100 p-3">{problems.map(p => <div key={p.key} className="flex gap-3 border-b border-slate-100 py-2 text-sm"><span className="flex-1">{p.title}</span><label><input type="checkbox" checked={selectedClass.includes(p.key)} onChange={e => setSelectedClass(prev => e.target.checked ? [...prev, p.key] : prev.filter(k => k !== p.key))} /> 课上</label><label><input type="checkbox" checked={selectedHomework.includes(p.key)} onChange={e => setSelectedHomework(prev => e.target.checked ? [...prev, p.key] : prev.filter(k => k !== p.key))} /> 作业</label></div>)}</div>
        <Field label="线下课上题（每行一题）"><textarea className={inputClass} value={offlineClass} onChange={e => setOfflineClass(e.target.value)} /></Field><Field label="线下作业题（每行一题）"><textarea className={inputClass} value={offlineHomework} onChange={e => setOfflineHomework(e.target.value)} /></Field>
      </>}
      <div className="flex gap-2"><button disabled={busy || !!loadingKey} className={buttonClass}>{occurrence.status === 'confirmed' ? '保存预备课' : '确认讲完并生成任务'}</button><button type="button" className={minorClass} onClick={onClose}>关闭</button></div>
    </form>
  </Panel>
}

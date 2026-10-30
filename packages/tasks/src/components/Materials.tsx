'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@rosie/core'
import type { LessonRef, TaskMaterial } from '../types'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, CourseSelect, safeHref, text } from './shared'
import LessonPicker from './LessonPicker'

export default function Materials() {
  const { api, catalog, run, busy } = useTasks()
  const [course, setCourse] = useState('')
  useEffect(() => { setCourse(new URLSearchParams(window.location.search).get('course') ?? '') }, [])
  const [lesson, setLesson] = useState<LessonRef | null>(null)
  const [kind, setKind] = useState('reading')
  const [editing, setEditing] = useState<TaskMaterial | null>(null)
  const subject = api.data.courses.find(c => c.id === course)?.subject
  const lessons = subject === 'chinese' ? catalog.chinese : subject === 'math' ? catalog.math : subject === 'english' ? catalog.english : []
  const [scopeLesson, setScopeLesson] = useState<LessonRef | null>(null)
  const [scopeKeys, setScopeKeys] = useState<string[]>([])
  const scope = api.data.scopes.find(s => s.course_id === course && s.book === scopeLesson?.book && s.unit === scopeLesson?.unit)
  const unitLessons = catalog.chinese.filter(l => l.book === scopeLesson?.book && l.unit === scopeLesson?.unit)
  function selectScope(l: LessonRef | null) {
    setScopeLesson(l)
    const existing = api.data.scopes.find(s => s.course_id === course && s.book === l?.book && s.unit === l?.unit)
    setScopeKeys(existing ? existing.lessons.map(x => x.key) : catalog.chinese.filter(x => x.book === l?.book && x.unit === l?.unit && ['lesson', 'garden'].includes(x.kind)).map(x => x.key))
  }
  return <div className="space-y-5"><a className="text-sm text-emerald-800 underline" href="/materials">共享物料库 →</a><Panel title="准备课程资料"><CourseSelect value={course} onChange={v => { setCourse(v); setLesson(null); setEditing(null); setScopeLesson(null) }} />
    <form noValidate key={editing?.id ?? 'new'} className="space-y-4" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run(async () => {
      if (!form.checkValidity()) { form.querySelector<HTMLInputElement>('input:invalid')?.focus(); throw new Error('请填写资料名称。') }
      if (!api.user || !course || !lesson) throw new Error('请选择课程与课次')
      const href = text(f, 'href'); if (href && !safeHref(href)) throw new Error('阅读链接必须为站内路径或 HTTPS 地址')
      const existing = api.data.materials.find(m => m.course_id === course && m.lesson_key === lesson.key && m.kind === kind)
      const audio = [...(existing?.audio ?? [])]; const uploaded: string[] = []
      try {
        for (const file of f.getAll('audio')) {
          if (!(file instanceof File) || !file.size) continue
          if (file.size > 50 * 1024 * 1024 || !file.type.startsWith('audio/')) throw new Error('每段音频需为音频文件且不超过 50MB')
          const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp3'; const path = `${api.user.id}/${crypto.randomUUID()}.${ext}`
          const { error } = await supabase.storage.from('task-audio').upload(path, file, { contentType: file.type })
          if (error) throw error
          uploaded.push(path); audio.push({ path, label: file.name })
        }
        await api.save('materials', { id: existing?.id, course_id: course, lesson_key: lesson.key, kind, title: text(f, 'title'), href: href || null, audio })
      } catch (error) { if (uploaded.length) await supabase.storage.from('task-audio').remove(uploaded); throw error }
      setEditing(null); form.reset()
    }) }}>
      <LessonPicker lessons={lessons} value={lesson} onChange={setLesson} />
      <Field label="资料类型"><select className={inputClass} value={kind} onChange={e => setKind(e.target.value)}><option value="reading">阅读</option><option value="dictation">听记</option><option value="recitation">背诵</option><option value="general">通用</option></select></Field>
      <Field label="资料名称"><input required name="title" defaultValue={editing?.title ?? ''} className={inputClass} /></Field>
      <Field label="阅读链接（留空使用课程内置阅读入口）"><input name="href" defaultValue={editing?.href ?? lesson?.href ?? ''} className={inputClass} placeholder="/english/words/reading/..." /></Field>
      <Field label="添加多段音频（按选择顺序追加，保存后可排序）"><input type="file" name="audio" multiple accept="audio/*" className={inputClass} /></Field>
      <button disabled={busy} className={buttonClass}>保存资料</button>
    </form>
    {api.data.materials.filter(m => !course || m.course_id === course).map(m => <div key={m.id} className="space-y-2 border-t border-slate-100 pt-3"><div className="flex justify-between"><strong>{m.title} · {m.kind}</strong><button className={minorClass} onClick={() => { setCourse(m.course_id); setKind(m.kind); setLesson([...catalog.chinese, ...catalog.english, ...catalog.math].find(l => l.key === m.lesson_key) ?? null); setEditing(m) }}>编辑</button></div>{m.audio.map((a, i) => <div key={a.path} className="flex flex-wrap items-center gap-2 text-sm"><span className="flex-1">{i + 1}. {a.label}</span><button disabled={busy || i === 0} className={minorClass} onClick={() => void run(() => { const audio = [...m.audio]; [audio[i - 1], audio[i]] = [audio[i], audio[i - 1]]; return api.save('materials', { id: m.id, audio }) })}>上移</button><button disabled={busy} className={minorClass} onClick={() => void run(async () => { await api.save('materials', { id: m.id, audio: m.audio.filter(x => x.path !== a.path) }); const { error } = await supabase.storage.from('task-audio').remove([a.path]); if (error) throw error })}>移除</button></div>)}</div>)}
    </Panel>
    {subject === 'chinese' && <Panel title="语文单元范围与补录"><p className="text-sm text-slate-500">默认包含课文和语文园地。补录不会生成历史课后作业；满足单元条件时会生成一次单元复习。</p>
      <LessonPicker lessons={catalog.chinese} value={scopeLesson} onChange={selectScope} label="选择要管理的单元（任意一课）" />
      {scopeLesson && <><fieldset className="space-y-2"><legend>计入单元完成的内容</legend>{unitLessons.map(l => <label key={l.key} className="block text-sm"><input type="checkbox" checked={scopeKeys.includes(l.key)} disabled={scope?.emitted} onChange={e => setScopeKeys(p => e.target.checked ? [...p, l.key] : p.filter(k => k !== l.key))} /> {l.title}{api.data.progress.some(p => p.course_id === course && p.lesson.key === l.key) ? ' ✓ 已讲完' : ''}</label>)}</fieldset>
        <button disabled={busy || !!scope?.emitted || !scopeKeys.length} className={buttonClass} onClick={() => void run(async () => { await api.save('scopes', { id: scope?.id, course_id: course, book: scopeLesson.book, unit: scopeLesson.unit, lessons: unitLessons.filter(l => scopeKeys.includes(l.key)) }); await api.rpc('task_check_units', { p_user: api.user?.id, p_course: course }) })}>{scope?.emitted ? '已生成单元复习' : '保存单元范围'}</button>
        <form noValidate className="space-y-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const picked = unitLessons.filter(l => f.getAll('learned').includes(l.key)); void run(async () => { if (!scope) await api.save('scopes', { course_id: course, book: scopeLesson.book, unit: scopeLesson.unit, lessons: unitLessons.filter(l => scopeKeys.includes(l.key)) }); await api.rpc('task_backfill', { p_course: course, p_lessons: picked }) }) }}><fieldset className="space-y-2"><legend>补录已讲完课程</legend>{unitLessons.filter(l => !api.data.progress.some(p => p.course_id === course && p.lesson.key === l.key)).map(l => <label key={l.key} className="block text-sm"><input type="checkbox" name="learned" value={l.key} /> {l.title}</label>)}</fieldset><button disabled={busy || !scopeKeys.length} className={minorClass}>补录选中课程</button></form>
      </>}
    </Panel>}
  </div>
}

'use client'

import { useMemo, useState } from 'react'
import type { CourseInput, RuleInput, TaskCourse } from '../../types'
import type { CourseRule } from '../../courseTypes'
import CourseTaskBindings, { type CourseTaskBindingDraft } from '../CourseTaskBindings'
import CourseLearningSettings from './CourseLearningSettings'
import { SUBJECTS } from '../../types'
import { dateAfter, localDate } from '../../time'
import { DEFAULT_TIMETABLE_PREFERENCES, previewCourseDates, previewOccurrences } from '../../timetable'
import { Field, useTasks, weekdays } from '../shared'
import TimetableDialog from './TimetableDialog'
import CourseTimeWheel from './CourseTimeWheel'
import { COURSE_COLORS, clockTime, courseColor } from './presentation'
import { courseButtonClass, courseFieldFocusClass, courseFocusClass, courseInputClass, courseSecondaryButtonClass } from './courseFormStyles'

const COURSE_SUBJECTS = ['chinese', 'english', 'math', 'art', 'science', 'sports'] as const
type Slot = { key: string; days: number[]; start: string; end: string; from: string; until: string; recurrence: 'weekly' | 'once' | 'weeks'; interval: number; anchor: string; weeks: string }
const rowClass = 'relative flex min-h-[76px] scroll-mt-24 items-center rounded-xl bg-white'
const iconClass = 'flex w-12 shrink-0 items-center justify-center text-slate-500 sm:w-14'
// Keep rounded focus rings inside the group's clipping boundary.
const groupClass = 'overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 divide-y divide-slate-100'
const valueClass = 'min-h-8 w-full min-w-0 border-0 bg-transparent p-0 text-base leading-7 text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed'
const fieldLabelClass = 'mb-1 block text-xs font-medium text-slate-500'
function CourseIcon({ kind }: { kind: 'book' | 'subject' | 'note' | 'cycle' | 'start' | 'end' | 'reminder' }) {
  const paths = {
    book: <><path d="M12 5v15M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /></>,
    subject: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    note: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4.5a3 3 0 0 1 6 0M9 10h6M9 14h6M9 18h4" /></>,
    cycle: <><path d="M20 7H7a4 4 0 0 0-4 4m17-4-4-4m4 4-4 4M4 17h13a4 4 0 0 0 4-4M4 17l4-4m-4 4 4 4" /></>,
    start: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M8 15h8m-3-3 3 3-3 3" /></>,
    end: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></>,
    reminder: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l3 2M6 3 3 6m15-3 3 3M8 20l-2 2m10-2 2 2" /></>,
  }
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
}
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const timeOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
function newSlot(date: string, time?: string): Slot { const startTime = time ?? '08:00'; const start = minutesOf(startTime) + 45 < 1440 ? startTime : '08:00'; return { key: crypto.randomUUID(), days: [time ? new Date(`${date}T12:00:00Z`).getUTCDay() : 1], start, end: timeOf(minutesOf(start) + 45), from: date, until: '', recurrence: 'weekly', interval: 1, anchor: date, weeks: '' } }
function slotFromRule(rule: CourseRule): Slot { return { key: rule.id, days: [rule.weekday], start: rule.start_time?.slice(0, 5) ?? '08:00', end: rule.end_time?.slice(0, 5) ?? '08:45', from: rule.valid_from, until: rule.valid_until ?? '', recurrence: rule.recurrence ?? 'weekly', interval: rule.interval_weeks ?? 1, anchor: rule.anchor_date ?? rule.valid_from, weeks: (rule.teaching_weeks ?? []).join(',') } }
function parseWeeks(value: string): number[] | null {
  const tokens = value.trim().split(/[,，、\s]+/).filter(Boolean), result = new Set<number>()
  if (!tokens.length) return null
  for (const token of tokens) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token)
    if (!match) return null
    const start = Number(match[1]), end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > 520) return null
    for (let week = start; week <= end; week++) result.add(week)
  }
  return [...result].sort((a, b) => a - b)
}
export default function CourseEditor({ course, duplicate = false, date, time, calendarId, onClose }: { course?: TaskCourse; duplicate?: boolean; date: string; time?: string; calendarId?: string; onClose: () => void }) {
  const { api, notify } = useTasks()
  const initialEffective = course?.effective_from && course.effective_from > localDate() ? course.effective_from : date < localDate() ? localDate() : date
  const [draft, setDraft] = useState<CourseInput>(() => ({ default_deadline: course?.default_deadline ?? null, course_type: course?.course_type ?? 'timetabled', auto_assign: course?.auto_assign ?? false, auto_advance: course?.auto_advance ?? false, cursor: course?.cursor ?? null, catalog_snapshot_id: course?.catalog_snapshot_id ?? null, rules_revision: duplicate ? undefined : course?.rules_revision, name: course ? `${course.name}${duplicate ? '（副本）' : ''}` : '', subject: course?.subject ?? 'other', calendar_id: course?.calendar_id ?? calendarId ?? null, teacher: course?.teacher ?? '', location: course?.location ?? '', credits: course?.credits ?? null, notes: course?.notes ?? '', color: courseColor(course).value, reminder_minutes: course?.reminder_minutes === undefined ? (api.data.preferences[0]?.settings ?? DEFAULT_TIMETABLE_PREFERENCES).default_reminder_minutes : course.reminder_minutes }))
  const [effective, setEffective] = useState(initialEffective)
  const [slots, setSlots] = useState<Slot[]>(() => {
    const rules = course ? api.data.course_rules.filter(r => r.course_id === course.id && (!r.disabled_from || r.disabled_from > initialEffective) && (!r.valid_until || r.valid_until >= localDate()) && (r.recurrence !== 'once' || (r.anchor_date || r.valid_from) >= localDate())) : []
    return rules.map(slotFromRule)
  })
  const [bindings, setBindings] = useState<CourseTaskBindingDraft[]>(() => api.data.bindings.filter(b => b.course_id === course?.id).map(b => ({ pool_item_id: b.pool_item_id, enabled: b.enabled, scope_override: b.scope_override, estimated_minutes_override: b.estimated_minutes_override, material_override: b.material_override, ...(duplicate ? {} : { id: b.id }) })))
  const [learningError, setLearningError] = useState('')
  const snapshot = draft.catalog_snapshot ?? api.data.catalog_snapshots.find(s => s.id === draft.catalog_snapshot_id)
  const flexible = draft.course_type === 'flexible'
  const [activeSlot, setActiveSlot] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState(slots[0]?.from ?? '')
  const [periodEnd, setPeriodEnd] = useState(slots[0]?.until ?? '')
  const [cycle, setCycle] = useState<Slot['recurrence']>(slots[0]?.recurrence ?? 'weekly')
  const [periodInterval, setPeriodInterval] = useState(slots[0]?.interval ?? 1)
  const [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const edit = (patch: Partial<CourseInput>) => { setDraft(prev => ({ ...prev, ...patch })); setDirty(true) }
  const update = (key: string, patch: Partial<Slot>) => { setSlots(prev => prev.map(slot => slot.key === key ? { ...slot, ...patch } : slot)); setDirty(true) }
  const updateTime = (slot: Slot, start: number, duration = minutesOf(slot.end) - minutesOf(slot.start)) => update(slot.key, { start: timeOf(start), end: timeOf(start + Math.min(duration, 1439 - start)) })
  const addSlot = () => { const slot = { ...newSlot(periodStart || date, time), until: periodEnd, recurrence: cycle, interval: periodInterval, weeks: slots[0]?.weeks ?? '' }; setSlots(prev => [...prev, slot]); if (!flexible) setActiveSlot(slot.key); setDirty(true) }
  const editing = !!course && !duplicate
  const validation = useMemo(() => {
    const rules: RuleInput[] = []
    for (const slot of slots) {
      if (!slot.days.length && slot.recurrence !== 'once') return { error: '每个时段至少选择一个星期。', rules }
      if (!slot.from || !slot.anchor || (!flexible && (!slot.start || !slot.end || slot.start >= slot.end))) return { error: '请填写完整日期和时间，结束时间需晚于开始时间。', rules }
      if (slot.until && slot.until < slot.from) return { error: '结束日期不能早于开始日期。', rules }
      if (slot.recurrence === 'weekly' && (!Number.isInteger(slot.interval) || slot.interval < 1 || slot.interval > 520)) return { error: '重复间隔应为 1–520 周。', rules }
      const weeks = slot.recurrence === 'weeks' ? parseWeeks(slot.weeks) : []
      if (!weeks) return { error: '填写教学周，例如 1-8,10,12；支持 1–520 周。', rules }
      const from = slot.from
      if (editing && slot.until && slot.until < effective) continue
      if (slot.recurrence === 'once' && slot.anchor < (editing ? effective : from)) return { error: '单次上课日期不能早于生效日期。', rules }
      const days = slot.recurrence === 'once' ? [new Date(`${slot.anchor}T12:00:00Z`).getUTCDay()] : slot.days
      const originalRule = editing ? api.data.course_rules.find(rule => rule.id === slot.key) : undefined
      const retainedDay = originalRule && days.includes(originalRule.weekday) ? originalRule.weekday : days[0]
      for (const weekday of days) rules.push({ ...(originalRule && weekday === retainedDay ? { id: slot.key } : {}), weekday, ...(flexible ? { kind: 'flexible' as const, start_time: null, end_time: null } : { kind: 'timetabled' as const, start_time: slot.start, end_time: slot.end }), valid_from: from, valid_until: slot.until || null, recurrence: slot.recurrence, interval_weeks: slot.interval, anchor_date: slot.anchor, teaching_weeks: weeks })
    }
    const keys = rules.map(rule => `${rule.weekday}:${rule.start_time}:${rule.end_time}:${rule.valid_from}:${rule.valid_until}:${rule.recurrence}:${rule.anchor_date}:${rule.interval_weeks}:${rule.teaching_weeks?.join(',')}`)
    if (new Set(keys).size !== keys.length) return { error: '存在完全重复的星期和时段，请移除重复项。', rules }
    return { error: rules.length ? '' : '至少保留一个有效上课时段。', rules }
  }, [slots, effective, editing, api.data.course_rules, flexible])
  const previewFrom = editing ? effective : slots.reduce((first, slot) => slot.from < first ? slot.from : first, slots[0]?.from ?? date)
  const preview = useMemo(() => {
    if (validation.error) return { rows: [], conflicts: new Set<string>() }
    const courseId = 'draft-course'
    const rows = previewOccurrences({ courses: [{ ...draft, id: courseId, user_id: '', created_at: '' }], rules: validation.rules.map((rule, i) => ({ ...rule, valid_from: editing && rule.valid_from < effective ? effective : rule.valid_from, id: `draft-${i}`, user_id: '', course_id: courseId })), exceptions: [], occurrences: [] }, previewFrom, dateAfter(previewFrom, 55))
    const others = previewOccurrences(api.data, previewFrom, dateAfter(previewFrom, 55)).filter(row => row.status !== 'cancelled' && (!editing || row.course_id !== course?.id))
    const conflicts = new Set(rows.filter(row => [...others, ...rows].some(other => other.id !== row.id && +new Date(row.starts_at) < +new Date(other.ends_at) && +new Date(other.starts_at) < +new Date(row.ends_at))).map(row => row.id))
    return { rows, conflicts }
  }, [api.data, draft, validation, previewFrom, editing, effective, course?.id])
  const flexibleDates = flexible && !validation.error ? previewCourseDates(validation.rules, previewFrom, dateAfter(previewFrom, 55)) : []
  const close = () => { if (!saving) { if (dirty) setDiscard(true); else onClose() } }
  const selectedSlot = slots.find(slot => slot.key === activeSlot)
  const reminderOn = draft.reminder_minutes != null
  const customColorSelected = !COURSE_COLORS.some(color => color.value === draft.color?.toLowerCase())
  const subjectOptions: { value: CourseInput['subject']; label: string }[] = [
    { value: 'other', label: '不选择科目' },
    ...COURSE_SUBJECTS.map(value => ({ value, label: SUBJECTS[value] })),
  ]
  if (!subjectOptions.some(option => option.value === draft.subject)) subjectOptions.push({ value: draft.subject, label: SUBJECTS[draft.subject] })
  return <TimetableDialog bare title={editing ? '编辑课程' : duplicate ? '复制课程' : '添加课程'} onClose={close} className="max-w-2xl! scroll-pt-24">
    <form noValidate onInput={e => { const field = e.target; if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby') } }} className="relative bg-slate-50" onSubmit={async e => {
      e.preventDefault(); if (saving) return
      const invalid = e.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid')
      if (!e.currentTarget.checkValidity()) { invalid?.setAttribute('aria-invalid', 'true'); invalid?.setAttribute('aria-describedby', 'course-save-error'); invalid?.focus(); setError('请检查必填项、日期范围和输入长度。'); return }
      if (learningError) { setError(learningError); return }
      if ((draft.auto_assign || draft.auto_advance) && (!snapshot || !draft.cursor || !snapshot.ordered_lessons.some(l => l.key === draft.cursor?.lesson_key) || (snapshot.progression_mode === 'segment' && !snapshot.teaching_segments.some(s => s.key === draft.cursor?.segment_key && s.lesson_key === draft.cursor?.lesson_key)))) { setError('开启自动安排前，请准备目录并选择有效的下一次内容。'); return }
      if (!draft.name.trim() || validation.error) { setError(validation.error || '请输入课程名称。'); return }
      setSaving(true); setError('')
      try { await api.saveCourse({ ...draft, bindings, name: draft.name.trim(), ...(editing ? { id: course.id } : {}) }, validation.rules, editing ? effective : undefined); notify('课程与时段已保存'); onClose() } catch (cause) { setError(cause instanceof Error && cause.message === 'stale_course_revision' ? '课程已被其他操作更新。请保留当前修改，关闭并重新打开课程后重试。' : cause instanceof Error ? cause.message : '保存失败，请重试。') } finally { setSaving(false) }
    }}>
      <header className="sticky top-0 z-20 grid min-h-20 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <button type="button" disabled={saving} onClick={close} className={`${courseSecondaryButtonClass} justify-self-start`}>取消</button>
        <h2 className="text-center text-lg font-semibold text-slate-900 sm:text-xl">{editing ? '编辑课程' : duplicate ? '复制课程' : '添加课程'}</h2>
        <button type="submit" disabled={saving || !!learningError || !!validation.error || !draft.name.trim()} className={`${courseButtonClass} min-w-20 justify-self-end`}>{saving ? '保存中' : '保存'}</button>
      </header>

      <fieldset disabled={saving} className="min-w-0 space-y-6 p-4 disabled:opacity-60 sm:p-6">
        <section aria-label="课程信息" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-slate-700">课程信息</h3>
          <div className={groupClass}>
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="book" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>课程名称<span className="ml-2 font-normal">必填</span></span><input required maxLength={120} placeholder="例如：英语阅读" className={valueClass} value={draft.name} onChange={e => edit({ name: e.target.value })} /></span>
            </label>
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="subject" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>科目<span className="ml-2 font-normal">可选</span></span><select className={`${valueClass} cursor-pointer`} value={draft.subject} onChange={e => { edit({ subject: e.target.value as CourseInput['subject'], catalog_snapshot_id: null, catalog_snapshot: null, cursor: null }); setLearningError('') }}>{subjectOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></span>
            </label>
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="note" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>备注<span className="ml-2 font-normal">可选</span></span><textarea maxLength={4000} rows={Math.min(8, Math.max(1, (draft.notes ?? '').split('\n').length))} placeholder="补充课程要求、携带物品等" className={`${valueClass} resize-none`} value={draft.notes ?? ''} onChange={e => edit({ notes: e.target.value })} /></span>
            </label>
          </div>
        </section>

        <Field label="课程类型"><select className={courseInputClass} value={draft.course_type ?? 'timetabled'} onChange={e => { edit({ course_type: e.target.value as 'timetabled' | 'flexible' }); setActiveSlot(null) }}><option value="timetabled">课表课程（有准确时间）</option><option value="flexible">自由课程（按上课星期）</option></select></Field>
        {editing && <p className="text-sm text-slate-500">新排课类型从 {effective} 日生效；此前的排课和历史保留。</p>}
        <section aria-label="上课安排" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-slate-700">上课安排</h3>
          <div className={groupClass}>
            {slots.map(slot => {
              const dayLabel = slot.recurrence === 'once' ? slot.anchor : slot.days.length === 7 ? '每天' : slot.days.length === 5 && [1, 2, 3, 4, 5].every(day => slot.days.includes(day)) ? '工作日' : slot.days.map(day => weekdays[day]).join('、')
              if (flexible) return <div key={slot.key} className="space-y-2 p-3"><span className={fieldLabelClass}>上课星期</span><div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5, 6, 0].map(day => <label key={day} className="text-sm"><input type="checkbox" checked={slot.days.includes(day)} onChange={e => update(slot.key, { days: e.target.checked ? [...slot.days, day] : slot.days.filter(d => d !== day) })} /> {weekdays[day]}</label>)}</div><button type="button" className={courseSecondaryButtonClass} onClick={() => { setSlots(rows => rows.filter(row => row.key !== slot.key)); setDirty(true) }}>移除上课星期</button></div>
              return <div key={slot.key} className={rowClass}>
                <button type="button" aria-haspopup="dialog" onClick={() => setActiveSlot(slot.key)} className={`${courseFocusClass} flex min-h-[76px] rounded-xl min-w-0 flex-1 cursor-pointer items-center text-left hover:bg-slate-50 active:bg-emerald-50 disabled:cursor-not-allowed`}>
                  <span className={iconClass}><CourseIcon kind="reminder" /></span>
                  <span className="min-w-0 flex-1 py-3"><span className={fieldLabelClass}>{dayLabel}</span><span className="block min-h-8 text-base font-medium leading-7 tabular-nums text-slate-900">{slot.start} — {slot.end}</span></span><span className="mx-3 shrink-0 text-xs text-slate-500">编辑</span>
                </button>
                <button type="button" aria-label={'删除' + dayLabel + ' ' + slot.start + '的上课时间'} onClick={() => { setSlots(prev => prev.filter(item => item.key !== slot.key)); if (activeSlot === slot.key) setActiveSlot(null); setDirty(true) }} className={`${courseFocusClass} mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 disabled:cursor-not-allowed`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" /></svg></button>
              </div>
            })}
            <button type="button" onClick={addSlot} className={`${rowClass} ${courseFocusClass} w-full cursor-pointer text-left text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 disabled:cursor-not-allowed`}><span className={iconClass}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-[22px] text-emerald-700"><path d="M12 5v14M5 12h14" /></svg></span><span className="min-w-0 flex-1 py-3 pr-4 text-sm font-semibold">{flexible ? '添加上课星期' : '添加上课时间'}</span></button>
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="cycle" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>课程周期</span><select className={`${valueClass} cursor-pointer`} value={cycle === 'weekly' ? String(periodInterval) : cycle} onChange={e => { if (e.target.value === 'weeks' || e.target.value === 'once') { const recurrence = e.target.value; setCycle(recurrence); setSlots(prev => prev.map(slot => ({ ...slot, recurrence }))); setDirty(true); return } const next = Number(e.target.value); if (!Number.isFinite(next)) return; setCycle('weekly'); setPeriodInterval(next); setSlots(prev => prev.map(slot => ({ ...slot, recurrence: 'weekly', interval: next, anchor: periodStart || date }))); setDirty(true) }}><option value="1">每周</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 2} value={index + 2}>每隔 {index + 1} 周</option>)}{cycle === 'weekly' && periodInterval > 11 && <option value={periodInterval}>每隔 {periodInterval - 1} 周（原有课程）</option>}<option value="once">仅上一次</option><option value="weeks">指定教学周</option></select></span>
            </label>
            {cycle === 'once' && flexible && <Field label="单次上课日期"><input required type="date" className={courseInputClass} value={slots[0]?.anchor ?? date} onChange={e => { setSlots(rows => rows.map(row => ({ ...row, anchor: e.target.value }))); setDirty(true) }} /></Field>}
            {cycle === 'weeks' && slots.length > 0 && <label className={`${rowClass} ${courseFieldFocusClass}`}><span className={iconClass} /><span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>教学周</span><input placeholder="例如 1-8,10,12" className={valueClass} value={slots[0]?.weeks ?? ''} onChange={e => { setSlots(prev => prev.map(slot => ({ ...slot, weeks: e.target.value }))); setDirty(true) }} /></span></label>}
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="start" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>开始日期</span><input type="date" value={periodStart} onChange={e => { setPeriodStart(e.target.value); setSlots(prev => prev.map(slot => ({ ...slot, from: e.target.value || date, anchor: e.target.value || date }))); setDirty(true) }} className={`${valueClass} tabular-nums`} /></span>
            </label>
            <label className={`${rowClass} ${courseFieldFocusClass}`}>
              <span className={iconClass}><CourseIcon kind="end" /></span>
              <span className="min-w-0 flex-1 py-3 pr-4"><span className={fieldLabelClass}>结束日期<span className="ml-2 font-normal">可选</span></span><input type="date" min={periodStart || date} value={periodEnd} onChange={e => { setPeriodEnd(e.target.value); setSlots(prev => prev.map(slot => ({ ...slot, until: e.target.value }))); setDirty(true) }} className={`${valueClass} tabular-nums`} /></span>
            </label>
            {!flexible && <div className={rowClass}>
              <span className={iconClass}><CourseIcon kind="reminder" /></span>
              <span className="min-w-0 flex-1 py-3"><span className={fieldLabelClass}>课前提醒</span><span className="block min-h-8 text-base leading-7 text-slate-900">{reminderOn ? '已开启' : '已关闭'}</span></span>
              <button type="button" role="switch" aria-label="课前提醒" aria-checked={reminderOn} onClick={() => edit({ reminder_minutes: reminderOn ? null : 10 })} className={`${courseFocusClass} mr-3 flex h-11 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl disabled:cursor-not-allowed`}><span aria-hidden="true" className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors motion-reduce:transition-none ${reminderOn ? 'bg-emerald-700' : 'bg-slate-300'}`}><span className={`size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${reminderOn ? 'translate-x-5' : 'translate-x-0'}`} /></span></button>
            </div>}
          </div>
          {!slots.length && <p className="px-1 text-xs text-slate-500">添加至少一个上课时间后即可保存。</p>}
          {slots.length > 0 && validation.error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{validation.error}</p>}
          {preview.conflicts.size > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">未来 8 周有 {preview.conflicts.size} 次上课时间重叠，请检查。</p>}
        </section>

        <CourseLearningSettings key={draft.subject} value={draft} snapshot={snapshot ?? undefined} onChange={edit} onPendingChange={message => { setLearningError(message); if (message) setDirty(true) }} />
        <CourseTaskBindings items={api.data.pool_items.filter(item => item.subject === null || item.subject === draft.subject || bindings.some(b => b.pool_item_id === item.id))} value={bindings} onChange={value => { setBindings(value); setDirty(true) }} lessons={snapshot?.ordered_lessons} segments={snapshot?.teaching_segments} disabled={saving} />
        <section aria-label="课程颜色" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-slate-700">课程颜色</h3>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <label className={`relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 ${courseFieldFocusClass}`} title="自定义课程颜色"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="m14 5 5 5M5 16l-1 4 4-1L20 7a2.8 2.8 0 0 0-4-4L5 16Z" /></svg>{customColorSelected && <span aria-hidden="true" className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-emerald-800 text-[10px] text-white">✓</span>}<input type="color" aria-label="自定义课程颜色" value={draft.color ?? '#059669'} onChange={e => edit({ color: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" /></label>
            {COURSE_COLORS.map(color => <button key={color.value} type="button" aria-label={color.label} aria-pressed={draft.color?.toLowerCase() === color.value} onClick={() => edit({ color: color.value })} className={`${courseFocusClass} flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl p-1 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed`}><span className="flex size-9 items-center justify-center rounded-lg border border-black/10 text-lg font-bold" style={{ backgroundColor: color.value, color: color.text }}>{draft.color?.toLowerCase() === color.value ? '✓' : ''}</span></button>)}
          </div>
        </section>

        <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm text-slate-600"><summary className={`${courseFocusClass} min-h-12 cursor-pointer px-4 py-4 font-medium hover:bg-slate-50 active:bg-emerald-50`}>更多设置 · 课表与提醒时间</summary><div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
          <Field label="所属课表 / 学期"><select className={courseInputClass} value={draft.calendar_id ?? ''} onChange={e => edit({ calendar_id: e.target.value || null })}><option value="">未分组</option>{api.data.calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></Field>
          <Field label="教师"><input className={courseInputClass} maxLength={120} value={draft.teacher ?? ''} onChange={e => edit({ teacher: e.target.value })} /></Field>
          <Field label="地点"><input className={courseInputClass} maxLength={200} value={draft.location ?? ''} onChange={e => edit({ location: e.target.value })} /></Field>
          {!flexible && reminderOn && <Field label="提醒时间"><select className={courseInputClass} value={draft.reminder_minutes ?? 10} onChange={e => edit({ reminder_minutes: Number(e.target.value) })}>{[0, 5, 10, 15, 30, 60, 1440].map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? '开始时' : minutes === 1440 ? '提前一天' : '提前 ' + minutes + ' 分钟'}</option>)}</select></Field>}
          {editing && <Field label="排课规则生效日"><input type="date" required min={localDate()} className={courseInputClass} value={effective} onChange={e => { setEffective(e.target.value); setDirty(true) }} /></Field>}
        </div></details>
        {flexible && slots.length > 0 && <details className="rounded-2xl border border-slate-200 bg-white text-sm"><summary className={`${courseFocusClass} cursor-pointer p-4`}>未来 8 周学习日 · {flexibleDates.length} 天</summary><ul className="grid max-h-48 gap-2 overflow-auto p-4 sm:grid-cols-2">{flexibleDates.map(day => <li key={day}>{day} · {weekdays[new Date(`${day}T00:00:00Z`).getUTCDay()]} · 无固定时刻</li>)}</ul></details>}
        {!flexible && slots.length > 0 && <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm"><summary className={`${courseFocusClass} min-h-12 cursor-pointer px-4 py-4 font-medium text-slate-600 hover:bg-slate-50 active:bg-emerald-50`}>未来 8 周排课预览 · {preview.rows.length} 次</summary><ul className="grid max-h-48 gap-2 overflow-auto border-t border-slate-100 p-4 sm:grid-cols-2">{preview.rows.slice(0, 40).map(row => <li key={row.id} className={preview.conflicts.has(row.id) ? 'font-medium text-amber-800' : 'text-slate-600'}>{localDate(new Date(row.starts_at))} {clockTime(row.starts_at)}–{clockTime(row.ends_at)} {preview.conflicts.has(row.id) && '⚠ 冲突'}</li>)}</ul></details>}
        {error && <p id="course-save-error" role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {discard && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm"><span>放弃尚未保存的修改？</span><button type="button" className={courseSecondaryButtonClass} onClick={() => setDiscard(false)}>继续编辑</button><button type="button" className={courseSecondaryButtonClass} onClick={onClose}>放弃修改</button></div>}
      </fieldset>
    </form>
    {selectedSlot && <CourseTimeWheel days={selectedSlot.days} start={selectedSlot.start} end={selectedSlot.end} once={selectedSlot.recurrence === 'once'} date={selectedSlot.anchor} onDaysChange={days => update(selectedSlot.key, { days })} onTimeChange={(start, duration) => updateTime(selectedSlot, start, duration)} onDateChange={anchor => update(selectedSlot.key, { anchor })} onClose={() => setActiveSlot(null)} />}
  </TimetableDialog>
}

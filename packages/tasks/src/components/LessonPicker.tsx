'use client'

import { useState } from 'react'
import type { LessonRef } from '../types'
import { Field, inputClass } from './shared'

export default function LessonPicker({ lessons, value, onChange, label = '课程内容', optional = false }: { lessons: LessonRef[]; value: LessonRef | null; onChange: (v: LessonRef | null) => void; label?: string; optional?: boolean }) {
  const [bookFilter, setBookFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const book = value?.book || bookFilter || lessons[0]?.book || ''
  const unit = (value?.book === book ? value.unit : '') || unitFilter || lessons.find(l => l.book === book)?.unit || ''
  const books = [...new Set(lessons.map(l => l.book))]
  const units = [...new Set(lessons.filter(l => l.book === book).map(l => l.unit))]
  return <fieldset className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-3"><legend className="text-sm font-semibold">{label}</legend>
    <Field label="教材 / 册别"><select className={inputClass} value={book} onChange={e => { setBookFilter(e.target.value); setUnitFilter(''); onChange(null) }}>{books.map(b => <option key={b} value={b}>{({ g1b: '一年级下册', g2a: '二年级上册', g2b: '二年级下册' } as Record<string, string>)[b] ?? b}</option>)}</select></Field>
    <Field label="单元 / 讲次"><select className={inputClass} value={unit} onChange={e => { setUnitFilter(e.target.value); onChange(null) }}>{units.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
    <Field label="课文 / Lesson"><select required={!optional} className={inputClass} value={value?.key ?? ''} onChange={e => onChange(lessons.find(l => l.key === e.target.value) ?? null)}><option value="">{optional ? '暂无 / 不指定' : '请选择'}</option>{lessons.filter(l => l.book === book && l.unit === unit).map(l => <option key={l.key} value={l.key}>{l.title}</option>)}</select></Field>
  </fieldset>
}

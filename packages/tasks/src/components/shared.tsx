'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { TaskDataApi } from '../useTaskData'
import type { TaskCatalogAdapter, Subject } from '../types'
import { SUBJECTS } from '../types'

export const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 disabled:bg-slate-100 disabled:text-slate-500'
export const buttonClass = 'cursor-pointer rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export const minorClass = 'cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export const TasksContext = createContext<{ api: TaskDataApi; catalog: TaskCatalogAdapter; run: (work: () => Promise<unknown>) => Promise<boolean>; busy: boolean; notify: (message: string) => void } | null>(null)
export function useTasks() { const ctx = useContext(TasksContext); if (!ctx) throw new Error('TasksContext required'); return ctx }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-600">{label}{children}</label> }
export function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-slate-800">{title}</h2>{children}</section> }
export function SubjectSelect({ value, onChange, all = false }: { value: Subject | ''; onChange: (v: Subject | '') => void; all?: boolean }) { return <select className={inputClass} value={value} onChange={e => onChange(e.target.value as Subject | '')}>{all && <option value="">不限定科目</option>}{Object.entries(SUBJECTS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select> }
export function CourseSelect({ value, onChange, optional = false }: { value: string; onChange: (v: string) => void; optional?: boolean }) {
  const { api } = useTasks()
  return <select required={!optional} className={inputClass} value={value} onChange={e => onChange(e.target.value)}><option value="">{optional ? '全部匹配课程' : '选择课程'}</option>{api.data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
}
export const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function WeekdaySelect({ name = 'weekday', value = 1 }: { name?: string; value?: number }) { return <select name={name} className={inputClass} defaultValue={value}>{[1, 2, 3, 4, 5, 6, 0].map(n => <option key={n} value={n}>{weekdays[n]}</option>)}</select> }
export function text(form: FormData, key: string): string { return String(form.get(key) ?? '').trim() }
export function lines(value: string): string[] { return value.split('\n').map(s => s.trim()).filter(Boolean) }
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null } catch { return null }
}

/** App-owned validation keeps native constraints without browser validation bubbles. */
export function validateTaskForm(form: HTMLFormElement, errorId: string): boolean {
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => {
    field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby')
  })
  if (form.checkValidity()) return true
  const invalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(':invalid')
  invalid?.setAttribute('aria-invalid', 'true')
  invalid?.setAttribute('aria-describedby', errorId)
  invalid?.focus()
  return false
}

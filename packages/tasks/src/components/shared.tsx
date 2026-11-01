'use client'

import { createContext, useContext, type ReactNode } from 'react'

export const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 disabled:bg-slate-100 disabled:text-slate-500'
export const minorClass = 'cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-600">{label}{children}</label> }
export const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const buttonClass = 'cursor-pointer rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export function validateForm(form: HTMLFormElement, errorId: string): boolean {
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => {
    field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby')
  })
  if (form.checkValidity()) return true
  const invalid = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, select, textarea'))
    .find(field => field.willValidate && !field.validity.valid)
  invalid?.setAttribute('aria-invalid', 'true')
  invalid?.setAttribute('aria-describedby', errorId)
  invalid?.focus()
  return false
}
export const TimetableContext = createContext<{
  api: ReturnType<typeof import('../useTimetableData').useTimetableData>
  notify: (message: string) => void
} | null>(null)
export function useTimetable() {
  const context = useContext(TimetableContext)
  if (!context) throw new Error('TimetableContext required')
  return context
}

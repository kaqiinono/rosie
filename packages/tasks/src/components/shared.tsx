'use client'

import { createContext, useContext, type ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-600">
      {label}
      {children}
    </label>
  )
}
export const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function validateForm(form: HTMLFormElement, errorId: string): boolean {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute('aria-invalid')
    field.removeAttribute('aria-describedby')
  })
  if (form.checkValidity()) return true
  const invalid = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, select, textarea',
    ),
  ).find((field) => field.willValidate && !field.validity.valid)
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

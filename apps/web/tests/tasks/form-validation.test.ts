import { describe, it, expect } from 'vitest'
import { validateTaskForm } from '../../../../packages/tasks/src/components/shared'
describe('app-owned timetable validation', () => {
 it('focuses and describes invalid constraints, then clears errors after correction', () => {
  const form=document.createElement('form');form.noValidate=true
  form.innerHTML='<input required name="title"><input type="number" min="0" max="10080" value="10081">'
  document.body.append(form)
  expect(validateTaskForm(form,'save-error')).toBe(false)
  const input=form.elements[0] as HTMLInputElement
  expect(document.activeElement).toBe(input)
  expect(input.getAttribute('aria-describedby')).toBe('save-error')
  input.value='考试'
  expect(validateTaskForm(form,'save-error')).toBe(false)
  const reminder=form.elements[1] as HTMLInputElement
  expect(document.activeElement).toBe(reminder)
  reminder.value='10'
  expect(validateTaskForm(form,'save-error')).toBe(true)
  expect(form.querySelector('[aria-invalid]')).toBeNull()
  form.remove()
 })
})

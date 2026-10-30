import { describe, it, expect } from 'vitest'
import { validateTaskForm } from '../../../../packages/tasks/src/components/shared'
describe('app-owned timetable validation', () => {
 it('focuses and describes invalid constraints, then clears errors after correction', () => {
  const form=document.createElement('form');form.noValidate=true
  form.innerHTML='<fieldset><input required name="title"><input type="number" min="0" max="10080" value="10081"></fieldset>'
  document.body.append(form)
  expect(validateTaskForm(form,'save-error')).toBe(false)
  const input=form.querySelector('input[name="title"]') as HTMLInputElement
  expect(document.activeElement).toBe(input)
  expect(input.getAttribute('aria-describedby')).toBe('save-error')
  input.value='考试'
  expect(validateTaskForm(form,'save-error')).toBe(false)
  const reminder=form.querySelector('input[type="number"]') as HTMLInputElement
  expect(document.activeElement).toBe(reminder)
  reminder.value='10'
  expect(validateTaskForm(form,'save-error')).toBe(true)
  expect(form.querySelector('[aria-invalid]')).toBeNull()
  form.remove()
 })
 it('skips ineligible controls and focuses select/textarea inside fieldsets', () => {
  const form=document.createElement('form');form.noValidate=true
  form.innerHTML='<fieldset disabled><input required></fieldset><input required readonly><input type="hidden" required><fieldset><select required><option value="">选择</option><option value="one">一</option></select><textarea required></textarea></fieldset>'
  document.body.append(form)
  const select=form.querySelector('select') as HTMLSelectElement
  const textarea=form.querySelector('textarea') as HTMLTextAreaElement
  expect(validateTaskForm(form,'save-error')).toBe(false)
  expect(document.activeElement).toBe(select)
  expect(form.querySelector('fieldset[aria-invalid]')).toBeNull()
  select.value='one'
  expect(validateTaskForm(form,'save-error')).toBe(false)
  expect(document.activeElement).toBe(textarea)
  textarea.value='备注'
  expect(validateTaskForm(form,'save-error')).toBe(true)
  form.remove()
 })

})

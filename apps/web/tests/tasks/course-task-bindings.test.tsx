import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CourseTaskBindings, { MaterialSelectorField, type CourseTaskBindingDraft } from '../../../../packages/tasks/src/components/CourseTaskBindings'
import { templateDraft } from '../../../../packages/tasks/src/defaults'
import type { TaskPoolItem } from '../../../../packages/tasks/src/courseTypes'

const item: TaskPoolItem = { ...templateDraft('english'), id: 'one', user_id: 'u', created_at: '', name: 'L3 作文', activity_key: 'composition' }
function Draft() {
  const [value, onChange] = useState<CourseTaskBindingDraft[]>([])
  return <><CourseTaskBindings items={[item]} value={value} onChange={onChange} /><output aria-label="绑定草稿">{JSON.stringify(value)}</output></>
}
describe('course binding drafts', () => {
  it('selects, overrides and pauses an activity before a course has any ID', () => {
    render(<Draft />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'L3 作文' }))
    fireEvent.change(screen.getByLabelText('预计分钟（留空使用 20 分钟）'), { target: { value: '35' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '覆盖物料' }))
    fireEvent.change(screen.getByLabelText('学习物料'), { target: { value: 'none' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '启用此绑定' }))
    const data = JSON.parse(screen.getByLabelText('绑定草稿').textContent!)
    expect(data).toEqual([{ pool_item_id: 'one', enabled: false, scope_override: null, estimated_minutes_override: 35, material_override: { kind: 'none' } }])
    fireEvent.click(screen.getByRole('checkbox', { name: 'L3 作文' }))
    expect(screen.getByLabelText('绑定草稿')).toHaveTextContent('[]')
  })
  it('uses catalog labels while persisting full stable keys in scope overrides', () => {
    const onChange = vi.fn()
    const value: CourseTaskBindingDraft[] = [{ pool_item_id: item.id, enabled: true, scope_override: { kind: 'lessons', lesson_keys: [] }, estimated_minutes_override: null, material_override: null }]
    render(<CourseTaskBindings items={[item]} value={value} onChange={onChange} lessons={[{ key: '5a-u3l2', title: 'Lesson 2', book: '5A', unit: '3', kind: 'english', lesson: 2 }]} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '5A · 3 · Lesson 2' }))
    expect(onChange).toHaveBeenCalledWith([{ ...value[0], scope_override: { kind: 'lessons', lesson_keys: ['5a-u3l2'] } }])
  })
  it('preserves existing asset selection and exposes a typed adapter slot without UUID input', () => {
    const onChange = vi.fn()
    const picker = vi.fn(() => <button type="button">选择物料</button>)
    render(<MaterialSelectorField value={{ kind: 'assets', asset_ids: ['asset-private-id'] }} onChange={onChange} renderMaterialPicker={picker} />)
    expect(screen.getByLabelText('学习物料')).toHaveDisplayValue('已选择 1 份物料')
    expect(screen.queryByDisplayValue('asset-private-id')).not.toBeInTheDocument()
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ value: { kind: 'assets', asset_ids: ['asset-private-id'] }, onChange }))
  })
  it('shows an empty-state direction and locks all inputs while disabled', () => {
    const { rerender } = render(<CourseTaskBindings items={[]} value={[]} onChange={vi.fn()} />)
    expect(screen.getByText('任务池暂无课程活动，请先在任务池中创建。')).toBeInTheDocument()
    rerender(<CourseTaskBindings items={[item]} value={[]} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('checkbox', { name: 'L3 作文' })).toBeDisabled()
  })
})

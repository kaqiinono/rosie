import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MaterialPicker } from '../../../../packages/materials/src/components/MaterialPicker'
import { CourseMaterialList } from '../../../../packages/materials/src/components/CourseMaterialList'
import { MaterialsPage } from '../../../../packages/materials/src/MaterialsPage'
const fixture = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  link: vi.fn().mockResolvedValue({}),
  unlink: vi.fn().mockResolvedValue({}),
  assets: [
    {
      id: 'shared',
      subject: 'english',
      kind: 'text',
      title: 'Shared notes',
      created_by: 'other',
      status: 'ready',
      text_content: 'hello',
      href: null,
      version: 1,
    },
    {
      id: 'own',
      subject: 'math',
      kind: 'text',
      title: 'Math notes',
      created_by: 'me',
      status: 'ready',
      text_content: 'math',
      href: null,
      version: 1,
    },
  ],
  links: [
    {
      id: 'general',
      course_id: 'course',
      asset_id: 'shared',
      scope: { kind: 'all' },
      role: 'review',
    },
    {
      id: 'problem',
      course_id: 'course',
      asset_id: 'own',
      scope: { kind: 'problems', problem_keys: ['12:class:1'] },
      role: 'preview',
    },
  ],
}))
vi.mock('../../../../packages/materials/src/useMaterialData', () => ({
  useMaterialData: () => ({
    user: { id: 'me', app_metadata: {} },
    data: { assets: fixture.assets, links: fixture.links },
    listAssets: ({
      subject,
      query = '',
      kind,
    }: { subject?: string; query?: string; kind?: string } = {}) =>
      fixture.assets.filter(
        (a) =>
          (!subject || a.subject === subject) &&
          (!kind || a.kind === kind) &&
          a.title.includes(query),
      ),
    saveAsset: fixture.save,
    linkCourseMaterials: fixture.link,
    unlinkCourseMaterial: fixture.unlink,
    isLoading: false,
    error: null,
  }),
}))
describe('material flows', () => {
  it('defaults to subject and explicitly offers cross-subject selection', () => {
    const change = vi.fn()
    render(<MaterialPicker subject="math" value={{ kind: 'auto' }} onChange={change} />)
    expect(screen.queryByLabelText('Shared notes · 文本')).toBeNull()
    fireEvent.click(screen.getByLabelText('显示其他科目'))
    fireEvent.click(screen.getByLabelText('Shared notes · 文本'))
    expect(change).toHaveBeenCalledWith({ kind: 'assets', asset_ids: ['shared'] })
  })
  it('groups immutable current problem links and unlinks without deleting assets', async () => {
    render(
      <CourseMaterialList
        courseId="course"
        subject="math"
        content={{ problem_keys: ['12:class:1'] }}
      />,
    )
    expect(screen.getByText('课程通用物料 · 1')).toBeTruthy()
    expect(screen.getByText('当前内容物料 · 1')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getAllByText('解除关联')[0]))
    expect(fixture.unlink).toHaveBeenCalledWith('general')
  })
  it('validates empty content and saves typed text; only creator maintenance is offered', async () => {
    render(<MaterialsPage />)
    expect(screen.getAllByText('编辑信息')).toHaveLength(1)
    fireEvent.click(screen.getByText('保存物料'))
    expect(screen.getByRole('status')).toHaveTextContent('请填写名称')
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'New notes' } })
    fireEvent.change(screen.getByLabelText('文本内容'), { target: { value: 'Study notes' } })
    await act(async () => fireEvent.click(screen.getByText('保存物料')))
    expect(fixture.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'text', title: 'New notes', text_content: 'Study notes' }),
    )
  })
})

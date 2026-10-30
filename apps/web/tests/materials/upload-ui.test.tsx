import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
const f = vi.hoisted(() => ({ link: vi.fn().mockResolvedValue([]), upload: vi.fn() }))
vi.mock('@rosie/core', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  },
}))
vi.mock('../../../../packages/materials/src/useMaterialData', () => ({
  useMaterialData: () => ({ refresh: async () => {}, linkCourseMaterials: f.link }),
}))
vi.mock('../../../../packages/materials/src/uploadClient', () => ({ uploadFile: f.upload }))
import { MaterialUpload } from '../../../../packages/materials/src/components/MaterialUpload'
it('requires subject, reports durable session and explicitly links uploaded asset to exact problem scope', async () => {
  f.upload.mockImplementation(async (_file, _subject, _token, options) => {
    const s = { id: 'session', state: 'ready', asset_id: 'asset' }
    options.session(s)
    return s
  })
  render(
    <MaterialUpload
      courses={[
        {
          id: 'course',
          title: '数学课',
          subject: 'math',
          catalog: {
            lessons: [],
            segments: [],
            problems: [{ stable_key: 'lesson12:example:real1', label: '例题1' }],
          },
        },
      ]}
    />,
  )
  const start = screen.getByRole('button', { name: '校验并上传' })
  expect(start).toBeDisabled()
  fireEvent.change(screen.getByLabelText('上传科目'), { target: { value: 'math' } })
  fireEvent.change(screen.getByLabelText('选择文件'), { target: { files: [new File(['x'], 'x')] } })
  fireEvent.click(start)
  await waitFor(() => expect(screen.getByText(/文件已核验/)).toBeInTheDocument())
  expect(f.upload.mock.calls[0][1]).toBe('math')
  fireEvent.change(screen.getByLabelText('关联课程'), { target: { value: 'course' } })
  fireEvent.change(screen.getByLabelText('关联范围'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: '确认关联（复习）' }))
  await waitFor(() =>
    expect(f.link).toHaveBeenCalledWith('course', [
      {
        asset_id: 'asset',
        scope: { kind: 'problems', problem_keys: ['lesson12:example:real1'] },
        role: 'review',
        sort_order: 0,
      },
    ]),
  )
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { DirectoryImport } from '../../../../packages/materials/src/components/DirectoryImport'
const f = vi.hoisted(() => ({ link: vi.fn().mockResolvedValue([]) }))
vi.mock('@rosie/core', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
  },
}))
vi.mock('../../../../packages/materials/src/useMaterialData', () => ({
  useMaterialData: () => ({
    refresh: async () => {},
    readyData: async () => ({ assets: [{ id: 'asset', account_id: '1', fs_id: '2', version: 1 }] }),
    linkCourseMaterials: f.link,
  }),
}))
it('keeps exact matches unselected, then batch confirms the reviewed scope', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessionId: 'scan',
            files: [
              {
                account_id: '1',
                fs_id: '2',
                path: '/airosie/english/U3L1.mp3',
                name: 'U3L1.mp3',
                mime: 'audio/mpeg',
                size: 1,
              },
            ],
            folders: [],
            cursor: null,
            complete: true,
          }),
        ),
      ),
  )
  render(
    <DirectoryImport
      courses={[
        {
          id: 'course',
          title: 'English',
          subject: 'english',
          catalog: {
            lessons: [{ key: '5a-u3l1', book: '5A', unit: 'U3', title: 'Lesson one' }],
            segments: [],
          },
        },
      ]}
    />,
  )
  fireEvent.click(screen.getByText('开始读取'))
  await screen.findByText('U3L1.mp3')
  expect(f.link).not.toHaveBeenCalled()
  expect(screen.getByText('确认关联 0 份物料')).toBeDisabled()
  fireEvent.change(screen.getByLabelText('确认关联范围'), {
    target: { value: JSON.stringify({ kind: 'lessons', lesson_keys: ['5a-u3l1'] }) },
  })
  fireEvent.click(screen.getByText('确认关联 1 份物料'))
  await waitFor(() =>
    expect(f.link).toHaveBeenCalledWith('course', [
      {
        asset_id: 'asset',
        scope: { kind: 'lessons', lesson_keys: ['5a-u3l1'] },
        role: 'general',
        sort_order: 0,
      },
    ]),
  )
  expect(await screen.findByText('已批量关联所选物料。')).toBeTruthy()
  vi.unstubAllGlobals()
})

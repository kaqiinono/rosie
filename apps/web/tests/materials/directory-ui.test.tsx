import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
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
    readyData: async () => ({
      assets: [
        { id: 'asset', account_id: '1', fs_id: '2', version: 1 },
        { id: 'asset3', account_id: '1', fs_id: '3', version: 1 },
      ],
    }),
    linkCourseMaterials: f.link,
  }),
}))
const files = [
  {
    account_id: '1',
    fs_id: '2',
    path: '/airosie/english/U3L1.mp3',
    name: 'U3L1.mp3',
    mime: 'audio/mpeg',
    size: 1,
  },
  {
    account_id: '1',
    fs_id: '3',
    path: '/airosie/english/extra.pdf',
    name: 'extra.pdf',
    mime: 'application/pdf',
    size: 2,
  },
]
const page = (
  revision: number,
  complete: boolean,
  selected = files.slice(0, 1),
  offset = 0,
  next: number | null = null,
) => ({
  sessionId: 'scan',
  files: selected,
  folders: [],
  cursor: complete ? null : String(revision),
  complete,
  revision,
  resultOffset: offset,
  nextResultOffset: next,
  fileCount: 2,
  folderCount: 0,
})
const response = (body: unknown) => new Response(JSON.stringify(body))
const renderImport = () =>
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
afterEach(() => {
  vi.unstubAllGlobals()
  f.link.mockClear()
})
it('starts with an actual empty checkpoint then continues before offering exact matches for confirmation', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ ...page(0, false, []), fileCount: 0 }))
    .mockResolvedValueOnce(response(page(1, true)))
  vi.stubGlobal('fetch', fetch)
  renderImport()
  fireEvent.click(screen.getByText('开始读取'))
  await screen.findByText('U3L1.mp3')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ sessionId: 'scan', cursor: '0' })
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
})
it('recovers latest progress after a lost response and keeps reviewed selections across result pages and partial scans', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ ...page(0, false, []), fileCount: 0 }))
    .mockResolvedValueOnce(response(page(1, false, files.slice(0, 1), 0, 1)))
    .mockRejectedValueOnce(Error('response lost'))
    .mockResolvedValueOnce(
      response({
        ...page(2, false, files.slice(0, 1), 0, 1),
        rootId: 'english',
        relativePath: '',
        recursive: true,
        subject: 'english',
      }),
    )
    .mockResolvedValueOnce(response(page(2, false, files.slice(1), 1)))
    .mockResolvedValueOnce(response(page(3, true)))
  vi.stubGlobal('fetch', fetch)
  renderImport()
  fireEvent.click(screen.getByText('开始读取'))
  await screen.findByText('U3L1.mp3')
  fireEvent.change(screen.getByLabelText('确认关联范围'), { target: { value: '{"kind":"all"}' } })
  fireEvent.click(screen.getByText('继续读取'))
  await screen.findByText('response lost')
  fireEvent.click(screen.getByText('恢复最新进度'))
  await waitFor(() => expect(screen.queryByText('response lost')).toBeNull())
  expect(screen.getByText('确认关联 1 份物料')).toBeEnabled()
  fireEvent.click(screen.getByText('查看下一批文件'))
  await screen.findByText('extra.pdf')
  expect(fetch.mock.calls[4][0]).toBe('/api/materials/baidu/scan/scan?offset=1&revision=2')
  fireEvent.change(screen.getByLabelText('确认关联范围'), { target: { value: '{"kind":"all"}' } })
  fireEvent.click(screen.getByText('确认关联 2 份物料'))
  await waitFor(() =>
    expect(f.link).toHaveBeenCalledWith('course', [
      { asset_id: 'asset', scope: { kind: 'all' }, role: 'general', sort_order: 0 },
      { asset_id: 'asset3', scope: { kind: 'all' }, role: 'general', sort_order: 1 },
    ]),
  )
  fireEvent.click(screen.getByText('继续读取'))
  await screen.findByText(/目录读取完成/)
  expect(JSON.parse(fetch.mock.calls[5][1].body).cursor).toBe('2')
})

import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@rosie/core', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
  },
}))
import { advanceScan } from '../../src/lib/baidu-material-catalog'
import { materialFileType } from '../../src/lib/material-file-type'
import { deliverMaterialStream } from '../../src/lib/baidu-material-delivery'
import { MaterialPreview } from '../../../../packages/materials/src/components/MaterialPreview'
import type { MaterialAsset } from '../../../../packages/materials/src/types'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it.each([
  ['MP3', 'audio/mpeg', 'audio'],
  ['JPEG', 'image/jpeg', 'img'],
  ['pdf', 'application/pdf', 'iframe'],
  ['svg', 'application/octet-stream', null],
  ['html', 'application/octet-stream', null],
  ['unknown', 'application/octet-stream', null],
])('scan %s feeds actual preview and delivery', async (ext, mime, tag) => {
  const path = `/airosie/english/sample.${ext}`
  const state = await advanceScan(
    { queue: [{ path: '/airosie/english', offset: 0 }], entries: [], complete: false },
    '123',
    false,
    async () => [{ fs_id: '456', path, isdir: 0, size: 1 }],
  )
  const file = state.entries[0]
  expect(file.mime).toBe(mime)
  const asset = {
    id: 'scan',
    title: file.name,
    mime_type: file.mime,
    kind: materialFileType(file.path).kind,
  } as MaterialAsset
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content_url: '/api/materials/scan/content' }),
    }),
  )
  const { container } = render(<MaterialPreview asset={asset} />)
  fireEvent.click(screen.getByRole('button', { name: '查看物料' }))
  await screen.findByText('下载文件')
  expect(container.querySelector('audio,img,iframe,video')?.tagName.toLowerCase() ?? null).toBe(tag)
  const response = deliverMaterialStream(new Response('x'), 1, null, file.mime, file.name)
  expect(response.headers.get('content-type')).toBe(mime)
  expect(response.headers.get('content-disposition')).toMatch(tag ? /^inline/ : /^attachment/)
  await response.text()
})

it('extensionless passive-looking filenames stay unknown', () => {
  expect(materialFileType('/airosie/english/mp3')).toEqual({
    kind: 'file',
    mime: 'application/octet-stream',
  })
})

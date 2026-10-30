import { it, expect, vi, afterEach } from 'vitest'
import { File } from 'node:buffer'
import { createHash } from 'node:crypto'
import { uploadFile } from '../../../../packages/materials/src/uploadClient'
import { hashSlices } from '../../../../packages/materials/src/workers/hashSlices'
afterEach(() => vi.unstubAllGlobals())
it('hashes bounded real slices before reservation and uploads raw bytes with max two lanes', async () => {
  const bytes = new Uint8Array(4194304 * 2 + 17).fill(6),
    file = new File([bytes], 'x.mp4', { type: 'video/mp4' }) as unknown as globalThis.File
  let active = 0,
    max = 0,
    initialized = false
  const received: number[] = []
  let session = {
    id: 's',
    name: file.name,
    size: file.size,
    subject: 'math',
    mime: file.type,
    hashes: [] as string[],
    state: 'initializing',
    asset_id: null as string | null,
    partSize: 4194304,
    missingParts: [0, 1, 2],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/materials/uploads') {
        const input = JSON.parse(init.body as string)
        expect(input.hashes).toHaveLength(3)
        expect(input.hashes[2]).toBe(
          createHash('md5').update(bytes.subarray(8388608)).digest('hex'),
        )
        session = { ...session, hashes: input.hashes }
        initialized = true
      } else if (url.endsWith('/prepare')) session = { ...session, state: 'uploading' }
      else if (url.includes('/parts/')) {
        expect(initialized).toBe(true)
        active++
        max = Math.max(max, active)
        const body = init.body as Blob
        received.push(body.size)
        await new Promise((r) => setTimeout(r, 5))
        active--
      } else if (url.endsWith('/complete'))
        session = { ...session, state: 'ready', asset_id: 'asset' }
      return Response.json(session)
    }),
  )
  const result = await uploadFile(file, 'math', 'token', { hash: hashSlices })
  expect(result.asset_id).toBe('asset')
  expect(max).toBe(2)
  expect(received.sort((a, b) => a - b)).toEqual([17, 4194304, 4194304])
})
it('rejects different selected file manifest before sending resume bytes', async () => {
  const file = new File(['a'], 'x') as unknown as globalThis.File
  const fetcher = vi.fn(async () =>
    Response.json({
      id: 's',
      name: 'x',
      size: 1,
      subject: 'math',
      hashes: ['0'.repeat(32)],
      state: 'uploading',
      missingParts: [0],
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  await expect(uploadFile(file, 'math', 't', { sessionId: 's', hash: hashSlices })).rejects.toThrow(
    '不匹配',
  )
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('resumes merging by verification only and reports uncertain outcome without another init', async () => {
  const file = new File(['a'], 'x') as unknown as globalThis.File,
    hashes = await hashSlices(file)
  const fetcher = vi.fn(async () =>
    Response.json({
      id: 's',
      name: 'x',
      size: 1,
      subject: 'math',
      hashes,
      state: 'merging',
      missingParts: [],
      asset_id: null,
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  await expect(uploadFile(file, 'math', 't', { sessionId: 's', hash: hashSlices })).rejects.toThrow(
    '待核验',
  )
  expect(fetcher.mock.calls).toHaveLength(2)
})

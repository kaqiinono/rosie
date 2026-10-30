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
it('settles an aborted sibling before failure unlocks immediate retry and cancellation', async () => {
  const file = new File([new Uint8Array(8388608)], 'held.bin') as unknown as globalThis.File
  const hashes = ['a'.repeat(32), 'b'.repeat(32)]
  const session = {
    id: 's',
    name: file.name,
    size: file.size,
    subject: 'math',
    hashes,
    state: 'uploading',
    asset_id: null,
    missingParts: [0, 1],
    partSize: 4194304,
  }
  const original = Error('first lane exhausted')
  let active = 0,
    maximum = 0,
    attempts = 0,
    phase = 1,
    returned = false,
    siblingAborted = false
  let releaseSibling: () => void = () => {}
  const retrySignals: AbortSignal[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (!url.includes('/parts/')) return Response.json(session)
      if (phase === 1 && url.endsWith('/0')) {
        attempts++
        throw original
      }
      active++
      maximum = Math.max(maximum, active)
      try {
        await new Promise<void>((_resolve, reject) => {
          const signal = init.signal!
          const abort = () => {
            if (phase === 1) {
              siblingAborted = true
              releaseSibling = () => reject(signal.reason)
            } else reject(signal.reason)
          }
          if (phase === 1) releaseSibling = () => reject(Error('released old sibling'))
          else retrySignals.push(signal)
          signal.addEventListener('abort', abort, { once: true })
        })
      } finally {
        active--
      }
      return Response.json(session)
    }),
  )
  const first = uploadFile(file, 'math', 't', { sessionId: 's', hash: async () => hashes }).then(
    () => {
      returned = true
      return null
    },
    (error) => {
      returned = true
      return error
    },
  )
  await vi.waitFor(() => expect(attempts).toBe(3), { timeout: 4000 })
  // Aborting a request may need asynchronous cleanup. The operation still owns this lane.
  expect(siblingAborted).toBe(true)
  expect(returned).toBe(false)
  expect(active).toBe(1)
  releaseSibling()
  expect(await first).toBe(original)
  expect(active).toBe(0)
  phase = 2
  const caller = new AbortController()
  const add = vi.spyOn(caller.signal, 'addEventListener')
  const remove = vi.spyOn(caller.signal, 'removeEventListener')
  const cancelled = Error('user cancelled retry')
  const retry = uploadFile(file, 'math', 't', {
    sessionId: 's',
    signal: caller.signal,
    hash: async () => hashes,
  }).catch((error) => error)
  await vi.waitFor(() => expect(active).toBe(2))
  caller.abort(cancelled)
  expect(await retry).toBe(cancelled)
  expect(active).toBe(0)
  expect(maximum).toBe(2)
  expect(retrySignals.every((signal) => signal.aborted)).toBe(true)
  const linked = add.mock.calls.find(([event]) => event === 'abort')
  expect(linked).toBeDefined()
  expect(remove).toHaveBeenCalledWith('abort', linked![1])
}, 10000)

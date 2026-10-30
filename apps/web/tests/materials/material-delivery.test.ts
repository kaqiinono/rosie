import { createHash } from 'node:crypto'
import { it, expect } from 'vitest'
import { materialRange, deliverMaterialStream, materialMime } from '@/lib/baidu-material-delivery'
it('reconstructs all bytes beyond 4.5MB through actual streaming and repeated ranges', async () => {
  const bytes = new Uint8Array(6 * 1024 * 1024 + 37)
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251
  const full = deliverMaterialStream(
    new Response(bytes, { headers: { 'content-length': String(bytes.length) } }),
    bytes.length,
    null,
    'video/mp4',
    'x',
  )
  expect(
    createHash('sha256')
      .update(new Uint8Array(await full.arrayBuffer()))
      .digest('hex'),
  ).toBe(createHash('sha256').update(bytes).digest('hex'))
  const chunks = []
  for (let start = 0; start < bytes.length; start += 1048576) {
    const end = Math.min(bytes.length - 1, start + 1048575),
      range = { start, end }
    const upstream = new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${end}/${bytes.length}`,
        'content-length': String(end - start + 1),
      },
    })
    chunks.push(
      new Uint8Array(
        await deliverMaterialStream(upstream, bytes.length, range, 'video/mp4', 'x').arrayBuffer(),
      ),
    )
  }
  expect(createHash('sha256').update(Buffer.concat(chunks)).digest('hex')).toBe(
    createHash('sha256').update(bytes).digest('hex'),
  )
})
it('validates suffix/open range, rejects ignored range and forces active MIME attachment', () => {
  expect(materialRange('bytes=-5', 10)).toEqual({ start: 5, end: 9 })
  expect(materialRange('bytes=3-', 10)).toEqual({ start: 3, end: 9 })
  expect(() => materialRange('bytes=10-', 10)).toThrow()
  expect(() =>
    deliverMaterialStream(new Response('abc'), 3, { start: 0, end: 1 }, 'image/png', 'x'),
  ).toThrow()
  for (const mime of ['image/svg+xml', 'text/html', 'unknown'])
    expect(materialMime(mime)).toBe('application/octet-stream')
  const r = deliverMaterialStream(
    new Response('abc', { headers: { 'content-length': '3' } }),
    3,
    null,
    'text/html',
    'x',
  )
  expect(r.headers.get('Content-Disposition')).toContain('attachment')
  expect(r.headers.get('Cache-Control')).toBe('private, no-store')
})
it('rejects truncated provider streams', async () => {
  const r = deliverMaterialStream(
    new Response('ab', { headers: { 'content-length': '3' } }),
    3,
    null,
    'video/mp4',
    'x',
  )
  await expect(r.arrayBuffer()).rejects.toThrow()
})

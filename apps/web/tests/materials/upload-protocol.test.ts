import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  validateManifest,
  readPart,
  uploadForm,
  validateFinalFile,
} from '@/lib/baidu-material-upload'
const hash = (b: Uint8Array) => createHash('md5').update(b).digest('hex')
describe('bounded upload protocol', () => {
  it('validates complete ordered manifest, subject and 2GiB limit', () => {
    expect(() =>
      validateManifest({
        name: 'x',
        size: 4194305,
        subject: 'math',
        mime: 'x',
        hashes: ['a'.repeat(32)],
      }),
    ).toThrow()
    expect(() =>
      validateManifest({ name: 'x', size: 1, subject: '', hashes: ['a'.repeat(32)] }),
    ).toThrow()
    expect(() =>
      validateManifest({ name: 'x', size: 2147483649, subject: 'math', hashes: [] }),
    ).toThrow()
  })
  it('reads a real 4MiB part and final byte with actual hash checks', async () => {
    const b = new Uint8Array(4194304).fill(9)
    expect((await readPart(new Response(b).body!, b.length, hash(b))).length).toBe(b.length)
    expect(
      (await readPart(new Response(new Uint8Array([1])).body!, 1, hash(new Uint8Array([1]))))
        .length,
    ).toBe(1)
    await expect(readPart(new Response(b).body!, 1, hash(b))).rejects.toThrow()
    await expect(readPart(new Response(b).body!, b.length, '0'.repeat(32))).rejects.toThrow()
  })
  it('uses the entire ordered manifest for both forms, never overwrite', () => {
    const s = {
      path: '/apps/a/id',
      size: 5,
      hashes: ['b'.repeat(32), 'a'.repeat(32)],
      upload_id: 'up',
    }
    for (const method of ['precreate', 'create'] as const) {
      const f = uploadForm(s, method)
      expect(JSON.parse(f.get('block_list')!)).toEqual(s.hashes)
      expect(f.get('rtype')).toBe('0')
    }
  })
  it('requires exact stable path size and lossless ID', () => {
    expect(
      validateFinalFile(
        { fs_id: '9223372036854775807', path: '/a', size: 5, isdir: 0 },
        { path: '/a', size: 5 },
      ),
    ).toBe('9223372036854775807')
    for (const file of [
      { fs_id: 1, path: '/b', size: 5, isdir: 0 },
      { fs_id: 1, path: '/a', size: 6, isdir: 0 },
    ])
      expect(() => validateFinalFile(file, { path: '/a', size: 5 })).toThrow()
  })
})

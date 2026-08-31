import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  curriculumHashInput,
  curriculumRegistrySources,
} from '../calc-curriculum-registry'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('calc curriculum registry contract', () => {
  it('has one unique, non-empty versioned source per block', () => {
    const sources = curriculumRegistrySources()
    expect(sources.length).toBeGreaterThan(0)
    expect(new Set(sources.map((source) => source.blockId)).size).toBe(sources.length)
    for (const source of sources) {
      expect(source.version).toMatch(/^v\d+$/)
      expect(source.members.length).toBeGreaterThan(0)
      expect(new Set(source.members).size).toBe(source.members.length)
    }
  })

  it('keeps the reviewed complete registry fingerprint stable', () => {
    const manifest = curriculumRegistrySources().map((source) => ({
      blockId: source.blockId,
      curriculumVersion: source.version,
      universeSize: source.members.length,
      curriculumHash: sha256(curriculumHashInput(source)),
      coverageKind: source.coverageKind,
    }))
    expect(sha256(JSON.stringify(manifest))).toBe(
      '28b597e1bceadf0eabe4229770b8e9118d0a5e8834654c564af5699f9de9ce04',
    )
  })

  it('changes the hash when member order changes', () => {
    const source = curriculumRegistrySources().find((item) => item.blockId === 'add:10')!
    const reordered = { ...source, members: [...source.members].reverse() }
    expect(sha256(curriculumHashInput(reordered))).not.toBe(sha256(curriculumHashInput(source)))
  })
})

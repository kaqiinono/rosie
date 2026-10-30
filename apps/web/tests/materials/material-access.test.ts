import { describe, expect, it } from 'vitest'
import {
  resolveMaterials,
  safeMaterialHref,
  scopeMatchesContent,
} from '../../../../packages/materials/src/resolution'
import type { MaterialAsset, CourseMaterialLink } from '../../../../packages/materials/src/types'
const asset = (id: string, status: MaterialAsset['status'] = 'ready'): MaterialAsset => ({
  id,
  subject: 'math',
  kind: 'text',
  source: 'manual',
  account_id: null,
  fs_id: null,
  path: null,
  version: 1,
  title: id,
  mime_type: 'text/plain',
  size: 0,
  created_by: 'other-user',
  status,
  text_content: 'notes',
  href: null,
})
const link = (
  asset_id: string,
  scope: CourseMaterialLink['scope'] = { kind: 'all' },
): CourseMaterialLink => ({
  id: asset_id,
  user_id: 'u',
  course_id: 'c',
  asset_id,
  scope,
  role: 'review',
  sort_order: 0,
})
const content = {
  lesson: { key: 'math:12', book: 'NY', unit: '12' },
  cursor: { segment_key: 'segment:12:a' },
  problem_keys: ['12:class:real1'],
}
describe('shared material access and resolution', () => {
  it('allows assets created by another user but isolates personal links', () => {
    expect(
      resolveMaterials(
        'u',
        'c',
        { kind: 'auto' },
        content,
        [asset('a')],
        [link('a'), { ...link('b'), user_id: 'v' }],
      ),
    ).toEqual({ status: 'selected', asset_ids: ['a'] })
  })
  it('distinguishes real problem namespaces and current teaching segment', () => {
    expect(
      scopeMatchesContent({ kind: 'problems', problem_keys: ['13:class:real1'] }, content),
    ).toBe(false)
    expect(
      scopeMatchesContent({ kind: 'problems', problem_keys: ['12:class:real1'] }, content),
    ).toBe(true)
    expect(scopeMatchesContent({ kind: 'segments', segment_keys: ['segment:12:a'] }, content)).toBe(
      true,
    )
  })
  it('keeps archived references accessible but excludes them from new resolution', () => {
    expect(
      resolveMaterials(
        'u',
        'c',
        { kind: 'assets', asset_ids: ['old'] },
        content,
        [asset('old', 'archived')],
        [],
      ),
    ).toEqual({ status: 'pending', asset_ids: [] })
    expect(resolveMaterials('u', 'c', { kind: 'none' }, content, [], [])).toEqual({
      status: 'not_required',
      asset_ids: [],
    })
  })
  it('rejects unsafe and credential-bearing links', () => {
    for (const url of [
      'javascript:alert(1)',
      '//evil.test',
      '/\\evil.test',
      'https://u:secret@site.test',
      'https://site.test/?access_token=secret',
    ])
      expect(safeMaterialHref(url)).toBeNull()
    expect(safeMaterialHref('/english/words/reading')).toBe('/english/words/reading')
  })
})

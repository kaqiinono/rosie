import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), '../..')
const cli = resolve(root, 'scripts/task-material-catalog.mjs')
const row = (key: string, visibility = 'shared') => ({ key: `english:${key}`, subject: 'english', visibility, lesson: { key, title: key, book: '5A', unit: '6', kind: 'lesson', resources: [{ kind: 'passage', status: 'missing' }, { kind: 'audio', status: 'unverified' }] }, evidence: 'fixture' })
function fixture(records = [row('5a-u6l1'), row('5a-u6l2'), row('5a-u6l2'), row('private-recording', 'private')]) {
  const dir = mkdtempSync(resolve(tmpdir(), 'task-catalog-test-'))
  const input = resolve(dir, 'input.json'), out = resolve(dir, 'manifest.json'), checkpoint = resolve(dir, 'checkpoint.json')
  writeFileSync(input, JSON.stringify({ records, gaps: [{ key: 'grammar', code: 'remote_unverified' }] }))
  return { dir, input, out, checkpoint }
}
const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }))

describe('resumable material inventory CLI', () => {
  it('deduplicates exact records, reports resource gaps and excludes private recordings', () => {
    const { input } = fixture()
    const result = run('--fixture', input, '--dry-run', '--page-size', '1')
    expect(result.complete).toBe(true)
    expect(result.records.map((record: { key: string }) => record.key)).toEqual(['english:5a-u6l1', 'english:5a-u6l2'])
    expect(result.gaps).toContainEqual({ key: 'english:5a-u6l1', code: 'missing_passage' })
    expect(result.gaps).toContainEqual({ key: 'english:5a-u6l1', code: 'unverified_audio' })
    expect(result.gaps).toContainEqual({ key: 'source', code: 'private_source_excluded' })
    expect(JSON.stringify(result.records)).not.toContain('private-recording')
    expect(run('--fixture', input, '--dry-run')).toEqual(result)
  })
  it('checkpoints partial pages and resumes to exactly the same manifest as a fresh full run', () => {
    const { input, out, checkpoint } = fixture()
    const partial = run('--fixture', input, '--out', out, '--checkpoint', checkpoint, '--page-size', '1', '--max-pages', '1')
    expect(partial.complete).toBe(false)
    expect(partial.records).toHaveLength(1)
    const resumed = run('--fixture', input, '--out', out, '--checkpoint', checkpoint, '--resume', '--page-size', '1')
    expect(resumed).toEqual(run('--fixture', input, '--dry-run'))
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(resumed)
    expect(run('--fixture', input, '--out', out, '--checkpoint', checkpoint, '--resume')).toEqual(resumed)
  })
  it('rejects a changed source on resume and conflicting duplicate identity', () => {
    const { input, out, checkpoint } = fixture()
    run('--fixture', input, '--out', out, '--checkpoint', checkpoint, '--max-pages', '1', '--page-size', '1')
    writeFileSync(input, JSON.stringify({ records: [row('changed')] }))
    expect(spawnSync(process.execPath, [cli, '--fixture', input, '--out', out, '--checkpoint', checkpoint, '--resume'], { encoding: 'utf8' }).stderr).toContain('checkpoint_source_changed')
    const conflicting = fixture([row('same'), { ...row('same'), lesson: { ...row('same').lesson, title: 'different' } }])
    expect(spawnSync(process.execPath, [cli, '--fixture', conflicting.input], { encoding: 'utf8' }).stderr).toContain('conflicting_record')
  })
  it('does not write in dry run and refuses unbounded or implicitly enabled remote reads', () => {
    const { input, out, checkpoint } = fixture()
    run('--fixture', input, '--dry-run', '--out', out, '--checkpoint', checkpoint)
    expect(() => readFileSync(out)).toThrow()
    expect(spawnSync(process.execPath, [cli, '--remote-url', 'https://example.invalid/catalog'], { encoding: 'utf8' }).stderr).toContain('remote_requires_explicit_opt_in')
    expect(spawnSync(process.execPath, [cli, '--page-size', '0'], { encoding: 'utf8' }).stderr).toContain('invalid_page_size')
  })
  it('reports source loading failure as incomplete inventory while retaining its known directory entry', () => {
    const { input } = fixture([row('known')])
    writeFileSync(input, JSON.stringify({ records: [row('known')], gaps: [{ key: 'english:known', code: 'problem_source_failed', detail: 'unreadable source' }] }))
    expect(run('--fixture', input, '--dry-run')).toMatchObject({ scan_complete: true, complete: false, records: [{ key: 'english:known' }] })
  })
  it('bounds remote reads, honors retry-after/rate limits, and rejects changing source revisions using an offline feed', () => {
    const script = `
      import { parseArgs, runInventory } from ${JSON.stringify('file://' + cli)};
      const calls=[], waits=[];
      const pages=[new Response('',{status:429,headers:{'retry-after':'2'}}),new Response(JSON.stringify({records:[${JSON.stringify(row('5a-u6l1'))}],cursor:'next',complete:false,revision:'v1'})),new Response(JSON.stringify({records:[${JSON.stringify(row('5a-u6l2'))}],cursor:null,complete:true,revision:'v1'}))];
      const options=parseArgs(['--remote-url','https://feed.example/catalog','--allow-remote','--max-pages','2','--page-size','1','--rate-ms','150']);
      const result=await runInventory(options,{fetch:async (url)=>{calls.push(url.toString());return pages.shift()},sleep:async(ms)=>{waits.push(ms)}});
      const changing=[{records:[],cursor:'next',complete:false,revision:'v1'},{records:[],cursor:null,complete:true,revision:'v2'}];
      let error;
      try {await runInventory(options,{fetch:async()=>new Response(JSON.stringify(changing.shift())),sleep:async()=>{}})}catch(e){error=e.message}
      console.log(JSON.stringify({result,calls,waits,error}));
    `
    const output = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: root, encoding: 'utf8' }))
    expect(output.result).toMatchObject({ complete: true, scan_complete: true })
    expect(output.calls).toHaveLength(3)
    expect(output.calls[2]).toContain('cursor=next')
    expect(output.waits).toEqual([2000, 150])
    expect(output.error).toBe('remote_revision_changed')
  })

  it('resumes the default checkpoint derived from --out without requiring its path twice', () => {
    const { input, out } = fixture()
    run('--fixture', input, '--out', out, '--page-size', '1', '--max-pages', '1')
    expect(run('--fixture', input, '--out', out, '--resume')).toEqual(run('--fixture', input, '--dry-run'))
  })

  it('does not copy signed/private media references or arbitrary fields from otherwise shared problem records', () => {
    const record = { key: 'math:2-1', subject: 'math', visibility: 'shared', lesson: { key: '2-1', title: '数学', book: '2 年级', unit: '1', kind: 'lesson' }, problems: [{ key: 'lesson:2-1-L1', stable_key: '2-1:lesson:2-1-L1', id: '2-1-L1', lesson_key: '2-1', group: 'lesson', displayId: 'L1', order: 0, tags: [], title: '例题', href: '/api/private-media?secret=private-token', private_recording: 'private-path' }] }
    const { input } = fixture()
    writeFileSync(input, JSON.stringify({ records: [record] }))
    const result = run('--fixture', input, '--dry-run')
    expect(JSON.stringify(result.records)).not.toContain('private-token')
    expect(JSON.stringify(result.records)).not.toContain('private-path')
  })

})

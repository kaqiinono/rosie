import { lessonReplayKey } from '@rosie/math-kit/utils/lesson-registry'
import 'server-only'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import { problemCardDisplayId } from '@rosie/math-kit/utils/problem-display-id'
import { createAdminSupabase } from './api-auth'
import { exactBaiduId } from './baidu-identity'
import { readBaiduDirectoryPage } from './baidu-directory-page'
import { getBaiduAccountContext } from './baidu-token'
import { VIDEO_SOURCES, type MathVideoEditor, type VideoProblem } from './baidu-math-video-report-types'

function lessonProblems(lessonKey: string): VideoProblem[] {
  const bank = SEA_LESSON_MAP[lessonKey]?.problems
  if (!bank) throw Error('invalid_lesson')
  return VIDEO_SOURCES.flatMap(source => (bank[source] ?? []).map(p =>
    ({ id: p.id, label: problemCardDisplayId(p), title: p.title, source })))
}

export function validVersion(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value))
}

function databaseFailure(error: { code: string; message: string }): never {
  if (error.code === 'PGRST202') throw Error('replay_schema_unavailable')
  if (error.code === '23505') throw Error('file_occupied')
  if (error.code === 'P0002') throw Error('account_changed')
  if (['lesson_changed','scan_changed','directory_changed','invalid_file'].includes(error.message)) throw Error(error.message)
  throw Error('storage_unavailable')
}

export async function readVideoEditor(lessonKey: string, directoryId: string | null) {
  const { data, error } = await createAdminSupabase().rpc('math_replay_editor', { p_lesson: lessonKey, p_directory: directoryId })
  if (error) databaseFailure(error)
  if (!data) throw Error('baidu_reauthorize')
  const state = data as Omit<MathVideoEditor, 'lessonKey' | 'problems'>
  if (directoryId && state.selectedId !== directoryId) throw Error('directory_changed')
  return { ...state, lessonKey, problems: lessonProblems(lessonKey) }
}

export async function syncVideoFiles(lessonKey: string, directoryId: string, generation: string, version: string | null) {
  const editor = await readVideoEditor(lessonKey, directoryId)
  const account = await getBaiduAccountContext()
  if (account.generation !== generation || editor.generation !== generation) throw Error('account_changed')
  if (editor.version !== version) throw Error('scan_changed')
  const root = editor.directories.find(d => d.id === directoryId)
  if (!root) throw Error('directory_changed')
  const prefix = root.path === '/' ? '/' : root.path + '/'
  const files: Record<string,string> = {}
  const seen = new Set<string>()
  for (let start = 0; start <= 100_000; start += 1000) {
    const page = await readBaiduDirectoryPage(account.accessToken, root.path, start, 1000)
    for (const item of page) {
      if (typeof item.path !== 'string' || !item.path.startsWith(prefix) || (item.isdir !== 0 && item.isdir !== 1))
        throw Error('scan_incomplete')
      const name = item.path.slice(prefix.length)
      if (!name || name.includes('/') || seen.has(name)) throw Error('scan_incomplete')
      seen.add(name)
      if (item.isdir === 1 || !/\.mp4$/i.test(name)) continue
      const id = exactBaiduId(item.fs_id)
      if (Object.hasOwn(files, id)) throw Error('scan_incomplete')
      files[id] = name
    }
    if (page.length < 1000) {
      const { error } = await createAdminSupabase().rpc('math_replay_store_scan', {
        p_generation: generation, p_directory: directoryId, p_version: version, p_files: files,
      })
      if (error) databaseFailure(error)
      return
    }
  }
  throw Error('scan_incomplete')
}

export async function publishVideoBindings(lessonKey: string, directoryId: string | null, generation: string,
  revision: string | null, version: string | null, picks: unknown) {
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) throw Error('invalid_picks')
  const ids = new Set(lessonProblems(lessonKey).map(p => p.id))
  ids.add(lessonReplayKey(lessonKey))
  const used = new Set<string>()
  for (const [problemId, fileId] of Object.entries(picks)) {
    if (!ids.has(problemId) || typeof fileId !== 'string' || !fileId || used.has(fileId)) throw Error('invalid_picks')
    used.add(fileId)
  }
  const { error } = await createAdminSupabase().rpc('math_replay_publish', {
    p_generation: generation, p_lesson: lessonKey, p_directory: directoryId,
    p_revision: revision, p_version: version, p_picks: picks,
  })
  if (error) databaseFailure(error)
}

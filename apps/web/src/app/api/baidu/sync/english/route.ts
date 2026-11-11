import { NextResponse } from 'next/server'
import { lessonAudioMime } from '@rosie/english/utils/reading-audio-types'
import { readingPassages } from '@rosie/english/utils/reading-data'
import { lessonListeningTargets } from '@rosie/english/utils/listening-clips'
import { BAIDU_AUTH_MESSAGES, baiduAuthErrorCode } from '@rosie/core'
import { createAdminSupabase, getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { readBaiduDirectoryPage } from '@/lib/baidu-directory-page'
import { exactBaiduId } from '@/lib/baidu-identity'
import { directoryPrefix, type LessonAudioDirectory, type LessonAudioEditor, type LessonAudioPick } from '@/lib/english-audio-types'

type PublishedFile = LessonAudioPick & { slot: string }
type PublishedLesson = { revision: string; directory_id: string | null; main_path: string | null; english_audio_bindings: PublishedFile[] }

const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
const fail = (error: string, status: number) => respond({ error }, status)

function validPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && Buffer.byteLength(path) <= 2048 &&
    !/[\\\x00-\x1f\x7f]|%(?:25|2e|2f|5c)/i.test(path) &&
    (path === '/' || path.slice(1).split('/').every(part => part && part !== '.' && part !== '..'))
}

async function manage(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isAdminRequestUser(user)) return fail('需要管理员权限。', user ? 403 : 401)
    const query = new URL(request.url).searchParams
    const key = query.get('lesson')
    if (!key && request.method === 'GET') {
      return respond(readingPassages.map(({ key, stage, unit, lesson, title }) => ({ key, stage, unit, lesson, title })))
    }
    const passage = readingPassages.find(p => p.key === key)
    if (!passage) return fail('课程不存在。', 404)
    const account = await getBaiduAccountContext()
    if (account.generation !== query.get('generation')) return fail('网盘账号已变更，请重新进入英语标签。', 409)
    const db = createAdminSupabase()
    const [words, lesson] = await Promise.all([
      db.from('word_entries').select('word').eq('stage', passage.stage).eq('unit', passage.unit).eq('lesson', passage.lesson).order('word').returns<{ word: string }[]>(),
      db.from('english_audio_lessons').select('revision,directory_id,main_path,english_audio_bindings(slot,directory_id,path,file_id)')
        .eq('account_id', account.accountId).eq('lesson_key', passage.key).returns<PublishedLesson[]>().maybeSingle(),
    ])
    if (words.error || lesson.error) return fail('读取本课资源失败，请检查数据库迁移及连接。', 503)
    const slots = [
      { slot: 'words', label: '全部单词音频' }, { slot: 'narration', label: '课文完整音频' }, { slot: 'recitation', label: '背诵音频' },
      ...words.data.map(({ word }) => ({ slot: 'word:' + word.trim().toLowerCase(), label: word })),
      ...lessonListeningTargets(passage).map(s => ({ slot: 'clip:' + s.target, label: s.english })),
    ]
    const previous = lesson.data?.english_audio_bindings ?? []
    const knownSlots = new Set(slots.map(s => s.slot))
    for (const row of previous) {
      if (!knownSlots.has(row.slot)) slots.push({ slot: row.slot, label: '已移除的条目 · ' + row.slot })
    }
    const revision = lesson.data?.revision ?? null
    const storedMain = lesson.data?.directory_id && lesson.data.main_path
      ? { directory_id: lesson.data.directory_id, path: lesson.data.main_path } : null
    if (request.method === 'GET') return respond({
      slots, revision, mainDirectory: storedMain, picks: Object.fromEntries(previous.map(f => [f.slot, { directory_id: f.directory_id, path: f.path, file_id: f.file_id }])),
    } satisfies LessonAudioEditor)
    const body = await request.json().catch(() => null)
    if (!body || !body.picks || typeof body.picks !== 'object' || Array.isArray(body.picks)) return fail('绑定格式无效。', 400)
    if (revision !== body.revision) return fail('本课绑定已更新，请重新读取后再保存。', 409)
    const roots = await db.from('baidu_sync_directories').select('id,path').eq('account_id', account.accountId)
    if (roots.error) throw roots.error
    const main: LessonAudioDirectory | null = 'mainDirectory' in body ? body.mainDirectory : storedMain
    if (main !== null) {
      const root = roots.data.find(r => r.id === main?.directory_id)
      if (!root || !validPath(main.path) || (main.path !== root.path && !main.path.startsWith(directoryPrefix(root.path))))
        return fail('请选择授权目录中的课程主目录。', 400)
      if (main.path !== storedMain?.path || main.directory_id !== storedMain?.directory_id)
        await readBaiduDirectoryPage(account.accessToken, main.path, 0, 1)
    }
    const files: PublishedFile[] = []
    const toVerify = new Map<string, Map<string, string>>()
    for (const [slot, pick] of Object.entries(body.picks as Record<string, LessonAudioPick>)) {
      const saved = previous.find(f => f.slot === slot)
      if (pick && saved && saved.directory_id === pick.directory_id && saved.path === pick.path && saved.file_id === pick.file_id) {
        files.push(saved)
        continue
      }
      const root = roots.data.find(r => r.id === pick?.directory_id)
      const path = pick?.path
      if (!knownSlots.has(slot) || !root || !validPath(path) || !path.startsWith(directoryPrefix(root.path)) ||
        !lessonAudioMime(path) || typeof pick.file_id !== 'string' || !/^[1-9][0-9]{0,19}$/.test(pick.file_id))
        return fail('请选择授权目录中的音频文件。', 400)
      if ((main || 'mainDirectory' in body) && (!main || root.id !== main.directory_id || !path.startsWith(directoryPrefix(main.path))))
        return fail('新增绑定的音频必须位于本课主目录中。', 400)
      const directory = path.slice(0, path.lastIndexOf('/')) || '/'
      const expected = toVerify.get(directory) ?? new Map<string, string>()
      if (expected.has(path) && expected.get(path) !== pick.file_id) return fail('同一路径对应的文件已变更。', 409)
      expected.set(path, pick.file_id)
      toVerify.set(directory, expected)
      files.push({ slot, directory_id: root.id, path, file_id: pick.file_id })
    }
    for (const [directory, expected] of toVerify) {
      for (let start = 0; expected.size; start += 1000) {
        const page = await readBaiduDirectoryPage(account.accessToken, directory, start, 1000)
        for (const file of page) {
          if (file.isdir === 0 && typeof file.path === 'string' && expected.has(file.path) &&
            expected.get(file.path) === exactBaiduId(file.fs_id)) expected.delete(file.path)
        }
        if (page.length < 1000) break
      }
      if (expected.size) return fail('文件已移动或删除，请刷新文件列表后重新匹配。', 409)
    }
    const result = await db.rpc('save_english_audio_lesson_with_directory', {
      p_account: account.accountId, p_generation: account.generation, p_lesson: key, p_revision: revision,
      p_files: files, p_directory_id: main?.directory_id ?? null, p_main_path: main?.path ?? null,
    })
    if (result.error) return fail('保存失败，请重新读取本课绑定后重试。', 409)
    return respond({ revision: result.data })
  } catch (error) {
    if (error instanceof Error && error.message === 'baidu_directory_missing')
      return fail('目录已移动或无法访问，请刷新文件列表并核对课程主目录。', 409)
    const code = baiduAuthErrorCode(error)
    return fail(code ? BAIDU_AUTH_MESSAGES[code] : '无法读取英语资源，请稍后重试。', code ? 409 : 503)
  }
}

export { manage as GET, manage as PUT }

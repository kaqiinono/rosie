import { baiduAuthErrorCode, BAIDU_AUTH_MESSAGES } from '@rosie/core'
import 'server-only'
import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from './api-auth'
import { validVideoLessonKey } from './baidu-math-video-catalog'
import {
  publishVideoBindings,
  readVideoEditor,
  syncVideoFiles,
  validMainPath,
  validVersion,
} from './baidu-math-video-report'

const headers = { 'Cache-Control': 'private, no-store' }
const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers })

const conflicts: Record<string, string> = {
  account_changed: '共享网盘账号已更换，请重新读取。',
  directory_changed: '授权目录已变更，请重新读取。',
  lesson_changed: '其他管理员已保存本讲，请重新读取后核对草稿。',
  scan_changed: '文件列表已有更新，请重新读取后核对草稿。',
  invalid_file: '所选文件不在当前清单中，请重新读取并选择。',
  file_occupied: '有视频已被其他题目占用，请重新读取后改选。',
}

function readPath(input: Record<string, unknown>, directoryId: string | null) {
  if (directoryId === null) {
    if (input.path != null && input.path !== '') return { error: failure('目录无效。', 400) as NextResponse }
    return { path: null as string | null }
  }
  if (!validMainPath(input.path)) return { error: failure('请选择本讲主目录。', 400) as NextResponse }
  return { path: input.path }
}

export async function mathVideoAdmin(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return failure('登录已过期，请重新登录。', 401)
    if (!isAdminRequestUser(user)) return failure('需要管理员权限。', 403)
    const reading = req.method === 'GET' || req.method === 'HEAD'
    const payload: unknown = reading
      ? Object.fromEntries(new URL(req.url).searchParams)
      : await req.json().catch(() => null)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('请求无效。', 400)
    const input = payload as Record<string, unknown>
    if (!validVideoLessonKey(input.lessonKey)) return failure('请选择有效的讲次。', 400)
    const lesson = input.lessonKey
    const dir = reading ? input.directoryId ?? null : input.directoryId
    if (!validVersion(dir)) return failure('目录无效。', 400)
    const pathResult = readPath(input, typeof dir === 'string' ? dir : null)
    if ('error' in pathResult) return pathResult.error
    const path = pathResult.path
    if (reading) return NextResponse.json(await readVideoEditor(lesson, dir, path), { headers })
    if (!input.generation || !validVersion(input.generation) || !validVersion(input.version))
      return failure('请重新读取网盘目录。', 400)
    if (req.method === 'POST') {
      if (!dir || !path) return failure('请选择已授权路径下的本讲主目录。', 400)
      await syncVideoFiles(lesson, dir, path, input.generation, input.version)
    } else if (req.method === 'PUT') {
      if (!validVersion(input.revision)) return failure('请重新读取本讲。', 400)
      if ((dir === null) !== (path === null)) return failure('目录无效。', 400)
      await publishVideoBindings(lesson, dir, path, input.generation, input.revision, input.version, input.picks)
    } else return failure('请求方式无效。', 405)
    return NextResponse.json(await readVideoEditor(lesson, dir, path), { headers })
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    if (Object.hasOwn(conflicts, code)) return failure(conflicts[code]!, 409)
    if (code === 'replay_schema_unavailable')
      return failure(
        '数学回放绑定接口尚未就绪，请确认已应用回放迁移 20261101033221 与 20261112175729，再重新读取。',
        503,
      )
    if (code === 'invalid_picks') return failure('请核对题目与视频，每个视频只能绑定一道题。', 400)
    const authCode = baiduAuthErrorCode(err)
    if (authCode) return failure(BAIDU_AUTH_MESSAGES[authCode], 409)
    if (code === 'baidu_directory_missing') return failure('在当前网盘中找不到这个目录。', 404)
    if (code === 'scan_incomplete') return failure('文件列表不完整，本次没有替换已保存的清单。', 502)
    return failure('未能确认操作结果，请重新读取后重试。', 503)
  }
}

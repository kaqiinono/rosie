import { baiduAuthErrorCode, BAIDU_AUTH_MESSAGES } from '@rosie/core'
import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { readBaiduDirectoryPage } from '@/lib/baidu-directory-page'
import { getBaiduAccountContext } from '@/lib/baidu-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type SyncDirectory = { id: string; path: string }
export type SyncDirectoryList = { generation: string; directories: SyncDirectory[] }
export type SyncDirectoryPage = {
  path: string
  entries: { name: string; folder: boolean }[]
  previous: number | null
  next: number | null
}

const pageSize = 50
const headers = { 'Cache-Control': 'private, no-store' }
const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers })

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || Buffer.byteLength(value) > 2048 ||
      /[\\\x00-\x1f\x7f]/.test(value) || /%(?:25|2e|2f|5c)/i.test(value)) return null
  const parts = value.split('/').filter(Boolean)
  return parts.some((part) => part === '.' || part === '..') ? null : '/' + parts.join('/')
}

async function manageDirectories(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return failure('登录已过期，请重新登录。', 401)
    if (!isAdminRequestUser(user)) return failure('需要管理员权限。', 403)

    const account = await getBaiduAccountContext()
    const table = createAdminSupabase().from('baidu_sync_directories')
    const query = new URL(request.url).searchParams
    const id = query.get('id')

    if (request.method === 'GET' && id === null) {
      const { data, error } = await table.select('id,path').eq('account_id', account.accountId).order('path')
      if (error) throw Error('baidu_storage_error')
      return NextResponse.json({ generation: account.generation, directories: data } satisfies SyncDirectoryList, { headers })
    }
    if (query.get('generation') !== account.generation) throw Error('baidu_account_changed')

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      const path = normalizePath(body?.path)
      if (!path) return failure('请输入以 / 开头的网盘绝对路径，路径中不能包含上级目录。', 400)
      await readBaiduDirectoryPage(account.accessToken, path, 0, 1)
      if ((await getBaiduAccountContext()).generation !== account.generation) throw Error('baidu_account_changed')
      const { data, error } = await table.insert({ account_id: account.accountId, path }).select('id,path').single()
      if (error?.code === '23505') return failure('该路径已添加。', 409)
      if (error) throw Error('baidu_storage_error')
      return NextResponse.json(data satisfies SyncDirectory, { status: 201, headers })
    }

    if (!id || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return failure('请选择已保存的路径。', 400)
    if (request.method === 'DELETE') {
      const { error } = await table.delete().eq('id', id).eq('account_id', account.accountId)
      if (error?.code === '23503') {
        const { data: lessons } = await createAdminSupabase().from('math_replay_lessons')
          .select('lesson_key').eq('account_id', account.accountId).eq('directory_id', id).order('lesson_key')
        const labels = (lessons ?? []).map(({ lesson_key }) => {
          const [grade, seq] = String(lesson_key).split('-')
          return `${grade} 年级第 ${seq} 讲`
        })
        return failure(`目录仍用于数学回放${labels.length ? '（' + labels.join('、') + '）' : ''}。请先更换或解除本讲目录并保存。`, 409)
      }
      if (error) throw Error('baidu_storage_error')
      return new Response(null, { status: 204, headers })
    }

    const { data: root, error } = await table.select('path').eq('id', id).eq('account_id', account.accountId).maybeSingle()
    if (error) throw Error('baidu_storage_error')
    if (!root) return failure('该授权路径已移除，请刷新路径列表。', 404)
    const path = normalizePath(query.get('path') ?? root.path)
    if (!path || (root.path !== '/' && path !== root.path && !path.startsWith(root.path + '/')))
      return failure('只能查看已保存路径及其子目录。', 400)
    const start = Number(query.get('start') ?? 0)
    if (!Number.isSafeInteger(start) || start < 0 || start % pageSize !== 0) return failure('分页位置无效。', 400)

    const rows = await readBaiduDirectoryPage(account.accessToken, path, start, pageSize + 1)
    const prefix = path === '/' ? '/' : path + '/'
    const entries = rows.slice(0, pageSize).map((row) => {
      if (typeof row.path !== 'string' || !row.path.startsWith(prefix) || (row.isdir !== 0 && row.isdir !== 1))
        throw Error('baidu_list_failed')
      const name = row.path.slice(prefix.length)
      if (!name || name === '.' || name === '..' || name.includes('/')) throw Error('baidu_list_failed')
      return { name, folder: row.isdir === 1 }
    })
    if ((await getBaiduAccountContext()).generation !== account.generation) throw Error('baidu_account_changed')
    return NextResponse.json({
      path, entries, previous: start === 0 ? null : start - pageSize,
      next: rows.length > pageSize ? start + pageSize : null,
    } satisfies SyncDirectoryPage, { headers })
  } catch (error) {
    const authCode = baiduAuthErrorCode(error)
    if (authCode) return failure(BAIDU_AUTH_MESSAGES[authCode], 409)
    switch (error instanceof Error ? error.message : '') {
      case 'baidu_account_changed':
        return failure('共享网盘授权已变更，请重新读取路径列表。', 409)
      case 'baidu_directory_missing':
        return failure('目录不存在或当前网盘无法访问，请核对路径。', 404)
      case 'baidu_storage_error':
        return failure('无法读写授权路径，请检查数据库迁移和连接。', 503)
      default:
        return failure('读取网盘失败，请检查共享授权及网络后重试。', 502)
    }
  }
}

export { manageDirectories as GET, manageDirectories as POST, manageDirectories as DELETE }

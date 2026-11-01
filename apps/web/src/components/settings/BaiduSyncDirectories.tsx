'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase, useAuth } from '@rosie/core'
import type { SyncDirectory, SyncDirectoryList, SyncDirectoryPage } from '@/app/api/baidu/sync/directories/route'
import BaiduMathVideoManager from './BaiduMathVideoManager'

const button = 'min-h-11 rounded-xl border border-border-light bg-surface px-3 text-sm font-semibold text-app-blue-dark hover:bg-surface-dim disabled:opacity-50'
type OpenDirectory = SyncDirectoryPage & { root: SyncDirectory }

async function requestDirectories(
  userId: string, signal: AbortSignal, query: Record<string, string> = {},
  method = 'GET', path?: string,
) {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw Error('登录已过期，请重新登录。')
  const response = await fetch('/api/baidu/sync/directories?' + new URLSearchParams(query), {
    method, cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
    body: path === undefined ? undefined : JSON.stringify({ path }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw Error(typeof result?.error === 'string' ? result.error : '请求失败，请重试。')
  }
  return response
}

export default function BaiduSyncDirectories() {
  const { user } = useAuth()
  const userId = user?.id
  const [list, setList] = useState<SyncDirectoryList | null>(null)
  const [opened, setOpened] = useState<OpenDirectory | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const fileListHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (opened) fileListHeading.current?.focus()
  }, [opened])

  const run = useCallback(async <T,>(load: (signal: AbortSignal) => Promise<T>, apply: (result: T) => void) => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const result = await load(controller.signal)
      if (!controller.signal.aborted) apply(result)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error && cause.name === 'Error' ? cause.message : '请求未完成，请检查网络后重试。')
        setOpened(null)
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (!userId) return
    setOpened(null)
    return run<SyncDirectoryList>(async (signal) => (await requestDirectories(userId, signal)).json(), setList)
  }, [userId, run])

  useEffect(() => {
    void refresh()
    return () => {
      pending.current?.abort()
      pending.current = null
    }
  }, [refresh])

  function add(event: FormEvent) {
    event.preventDefault()
    if (!userId || !list || !input.trim()) return
    void run<SyncDirectory>(async (signal) =>
      (await requestDirectories(userId, signal, { generation: list.generation }, 'POST', input.trim())).json(),
    (directory) => {
      setList({ ...list, directories: [...list.directories, directory].sort((a, b) => a.path.localeCompare(b.path)) })
      setInput('')
    })
  }

  function remove(root: SyncDirectory) {
    if (!userId || !list) return
    void run((signal) => requestDirectories(userId, signal, { generation: list.generation, id: root.id }, 'DELETE'), () => {
      setList({ ...list, directories: list.directories.filter((item) => item.id !== root.id) })
      if (opened?.root.id === root.id) setOpened(null)
    })
  }

  function browse(root: SyncDirectory, path = root.path, start = 0) {
    if (!userId || !list) return
    const query = { generation: list.generation, id: root.id, path, start: String(start) }
    void run<SyncDirectoryPage>(async (signal) => (await requestDirectories(userId, signal, query)).json(),
      (page) => setOpened({ ...page, root }))
  }

  return <>
    <section aria-labelledby="sync-directory-title" className="mt-4 border-t border-border-light pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="sync-directory-title" className="font-bold text-text-primary">授权路径</h4>
        <button type="button" disabled={busy} onClick={() => void refresh()} className={button}>刷新路径列表</button>
      </div>
      <p className="mt-1 text-sm text-text-secondary">添加共享网盘中需要浏览的目录。移除路径仅删除此处的配置。</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 grow text-sm font-semibold text-text-primary">网盘目录
          <input value={input} onChange={(event) => setInput(event.target.value)} required
            disabled={busy || !list} placeholder="/airosie/math" autoComplete="off"
            className="mt-1 block min-h-11 w-full rounded-xl border border-border-light bg-surface px-3 font-normal" />
        </label>
        <button disabled={busy || !list || !input.trim()} className="min-h-11 rounded-xl bg-app-blue-dark px-4 text-sm font-bold text-white disabled:opacity-50">添加路径</button>
      </form>
      {busy && <p role="status" className="mt-2 text-sm text-text-secondary">正在读取网盘…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {list && (list.directories.length === 0
        ? <p className="mt-3 text-sm text-text-secondary">尚未添加授权路径。</p>
        : <ul className="mt-3 divide-y divide-border-light">
          {list.directories.map((root) => <li key={root.id} className="flex items-center gap-2 py-1">
            <button type="button" disabled={busy} onClick={() => browse(root)}
              aria-label={'查看 ' + root.path + ' 的文件列表'}
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl text-left text-sm font-semibold text-app-blue-dark hover:bg-surface-dim disabled:opacity-50">
              <span className="min-w-0 break-all"><span aria-hidden>📁 </span>{root.path}</span>
              <span className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border-light px-3">查看</span>
            </button>
            <button type="button" disabled={busy} onClick={() => remove(root)} aria-label={'移除路径 ' + root.path} className={button}>移除</button>
          </li>)}
        </ul>)}
      {opened && <div className="mt-3 rounded-xl border border-border-light bg-surface-dim p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 ref={fileListHeading} tabIndex={-1} className="min-w-0 scroll-mt-16 break-all text-sm font-bold text-text-primary">文件列表　{opened.path}</h5>
          {opened.path !== opened.root.path && <button type="button" disabled={busy} className={button}
            onClick={() => browse(opened.root, opened.path.slice(0, opened.path.lastIndexOf('/')) || '/')}>返回上一级</button>}
        </div>
        {opened.entries.length === 0 ? <p className="py-3 text-sm text-text-secondary">此目录为空。</p>
          : <ul className="mt-2 divide-y divide-border-light text-sm">
            {opened.entries.map((entry) => <li key={entry.name}>
              {entry.folder ? <button type="button" disabled={busy} className="min-h-11 w-full break-all text-left font-semibold text-app-blue-dark hover:underline"
                onClick={() => browse(opened.root, (opened.path === '/' ? '' : opened.path) + '/' + entry.name)}>
                <span aria-hidden>📁 </span>{entry.name}
              </button> : <span className="block break-all py-2 text-text-primary"><span aria-hidden>📄 </span>{entry.name}</span>}
            </li>)}
          </ul>}
        {(opened.previous !== null || opened.next !== null) && <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy || opened.previous === null} onClick={() => browse(opened.root, opened.path, opened.previous ?? 0)} className={button}>上一页</button>
          <button type="button" disabled={busy || opened.next === null} onClick={() => browse(opened.root, opened.path, opened.next ?? 0)} className={button}>下一页</button>
        </div>}
      </div>}
    </section>
    {list && <BaiduMathVideoManager key={list.generation} paths={list} />}
  </>
}

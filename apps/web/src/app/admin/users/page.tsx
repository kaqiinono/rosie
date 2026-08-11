'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@rosie/core'

interface ManagedUser {
  id: string
  email: string
  recoveryEmail: string
  isAdmin: boolean
  isCurrent: boolean
  createdAt: string
  lastSignInAt: string | null
}

interface UsersResponse {
  users: ManagedUser[]
  page: number
  perPage: number
  total: number
}

type EditMode = 'profile' | 'password' | null

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: '没有管理员权限，请重新登录后再试。',
  invalid_email: '邮箱格式不正确。',
  invalid_password: '密码必须为 8–128 位。',
  cannot_demote_self: '不能取消自己的管理员权限。',
  cannot_delete_self: '不能注销当前登录账户。',
  user_not_found: '用户不存在或已被删除。',
  missing_admin_env: '服务端缺少 Supabase Service Role 配置。',
}

function formatTime(value: string | null): string {
  if (!value) return '从未登录'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function adminFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('请先登录')

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const code = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`
    throw new Error(ERROR_MESSAGES[code] ?? code)
  }
  return payload
}

export default function UsersAdminPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [email, setEmail] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [password, setPassword] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = (await adminFetch('/api/admin/users?perPage=100')) as unknown as UsersResponse
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const users = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return data?.users ?? []
    return (data?.users ?? []).filter(
      (user) =>
        user.email.toLowerCase().includes(normalized) ||
        user.recoveryEmail.toLowerCase().includes(normalized) ||
        user.id.toLowerCase().includes(normalized),
    )
  }, [data, query])

  const runAction = async (userId: string, work: () => Promise<void>) => {
    setBusyId(userId)
    setError(null)
    setNotice(null)
    try {
      await work()
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const openProfile = (user: ManagedUser) => {
    setEditing(user)
    setEditMode('profile')
    setEmail(user.email)
    setRecoveryEmail(user.recoveryEmail)
    setPassword('')
  }

  const openPassword = (user: ManagedUser) => {
    setEditing(user)
    setEditMode('password')
    setPassword('')
  }

  const closeEditor = () => {
    if (busyId) return
    setEditing(null)
    setEditMode(null)
    setPassword('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-amber-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 font-bold text-indigo-700"
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div>
            <h1 className="font-extrabold text-slate-900">用户管理</h1>
            <p className="text-[11px] text-slate-500">账户、权限与密码</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 pb-20">
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800">共 {data?.total ?? 0} 个账户</div>
            <div className="mt-0.5 text-xs text-slate-500">
              修改管理员角色后，目标用户需重新登录才能刷新权限。
            </div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索登录邮箱、恢复邮箱或 ID"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 sm:w-80"
          />
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            刷新
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {loading && !data ? (
          <div className="py-16 text-center text-sm text-slate-500">正在加载用户…</div>
        ) : (
          <div className="grid gap-3">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-slate-900">{user.email}</h2>
                      {user.isAdmin && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                          管理员
                        </span>
                      )}
                      {user.isCurrent && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          当前账户
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      恢复邮箱：{user.recoveryEmail || '未设置'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      <span>注册：{formatTime(user.createdAt)}</span>
                      <span>最近登录：{formatTime(user.lastSignInAt)}</span>
                      <span className="font-mono">{user.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openProfile(user)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      修改邮箱
                    </button>
                    <button
                      type="button"
                      onClick={() => openPassword(user)}
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      重置密码
                    </button>
                    <button
                      type="button"
                      disabled={user.isCurrent || busyId === user.id}
                      onClick={() => {
                        const nextAdmin = !user.isAdmin
                        const confirmed = window.confirm(
                          nextAdmin
                            ? `确定授予 ${user.email} 管理员权限吗？`
                            : `确定取消 ${user.email} 的管理员权限吗？`,
                        )
                        if (!confirmed) return
                        void runAction(user.id, async () => {
                          await adminFetch('/api/admin/users', {
                            method: 'PATCH',
                            body: JSON.stringify({
                              action: 'admin',
                              userId: user.id,
                              isAdmin: nextAdmin,
                            }),
                          })
                          setNotice(nextAdmin ? '已授予管理员权限。' : '已取消管理员权限。')
                        })
                      }}
                      className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {user.isAdmin ? '取消管理员' : '设为管理员'}
                    </button>
                    <button
                      type="button"
                      disabled={user.isCurrent || busyId === user.id}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `确定永久注销 ${user.email} 吗？\n\n关联的学习数据可能会因外键级联一并删除，此操作不可恢复。`,
                        )
                        if (!confirmed) return
                        void runAction(user.id, async () => {
                          await adminFetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
                            method: 'DELETE',
                          })
                          setNotice('用户已注销。')
                        })
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      注销用户
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {users.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-500">没有匹配的用户</div>
            )}
          </div>
        )}
      </main>

      {editing && editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault()
              void runAction(editing.id, async () => {
                if (editMode === 'profile') {
                  await adminFetch('/api/admin/users', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      action: 'profile',
                      userId: editing.id,
                      email,
                      recoveryEmail,
                    }),
                  })
                  setNotice('用户邮箱已更新。')
                } else {
                  await adminFetch('/api/admin/users', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      action: 'password',
                      userId: editing.id,
                      password,
                    }),
                  })
                  setNotice('密码已重置，请通过安全方式告知用户。')
                }
                closeEditor()
              })
            }}
          >
            <h2 className="text-lg font-extrabold text-slate-900">
              {editMode === 'profile' ? '修改用户邮箱' : '重置用户密码'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{editing.email}</p>

            {editMode === 'profile' ? (
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  登录邮箱
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400"
                  />
                  <span className="text-[11px] font-normal text-amber-600">
                    修改后，用户必须用新邮箱登录。
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  恢复邮箱
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400"
                  />
                </label>
              </div>
            ) : (
              <label className="mt-5 grid gap-1.5 text-sm font-semibold text-slate-700">
                新密码
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400"
                />
                <span className="text-[11px] font-normal text-slate-500">至少 8 位。</span>
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={busyId === editing.id}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={busyId === editing.id}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busyId === editing.id ? '保存中…' : '确认保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

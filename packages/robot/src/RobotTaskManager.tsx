'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useRobotTasks } from './useRobotTasks'
import { deriveStatus, STATUS_LABELS } from './robot-status'
import type { RobotTask, RobotTaskInput, RobotTaskStatus } from './robot-types'
import RobotTaskForm from './RobotTaskForm'

type RobotTaskManagerProps = {
  user: User | null
}

const STATUS_CHIP: Record<RobotTaskStatus, { bg: string; fg: string; border: string; emoji: string }> = {
  NOT_STARTED: {
    bg: 'rgba(100,116,139,0.09)',
    fg: '#475569',
    border: 'rgba(100,116,139,0.20)',
    emoji: '🕒',
  },
  IN_PROGRESS: {
    bg: 'rgba(245,158,11,0.13)',
    fg: '#b45309',
    border: 'rgba(245,158,11,0.30)',
    emoji: '🔥',
  },
  EXPIRED: {
    bg: 'rgba(244,63,94,0.10)',
    fg: '#be123c',
    border: 'rgba(244,63,94,0.22)',
    emoji: '⏰',
  },
  COMPLETED: {
    bg: 'rgba(16,185,129,0.11)',
    fg: '#047857',
    border: 'rgba(16,185,129,0.28)',
    emoji: '✅',
  },
}

export default function RobotTaskManager({ user }: RobotTaskManagerProps) {
  const { tasks, loading, addTask, updateTask, deleteTask } = useRobotTasks(user)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RobotTask | null>(null)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (t: RobotTask) => {
    setEditing(t)
    setShowForm(true)
  }
  const handleSubmit = async (input: RobotTaskInput) => {
    if (editing) await updateTask(editing.id, input)
    else await addTask(input)
    setShowForm(false)
    setEditing(null)
  }
  const handleDelete = async (t: RobotTask) => {
    if (confirm(`删除任务「${t.title}」？`)) await deleteTask(t.id)
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}
    >
      {/* Sticky header — matches /admin/* pattern exactly */}
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1.5px solid rgba(245,158,11,0.30)',
            }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-900">
            <span aria-hidden>🤖</span>
            <span>机器人任务</span>
          </div>
          <button
            className="ml-auto rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#fb923c 100%)' }}
            onClick={openAdd}
          >
            ＋ 新增任务
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 py-6 pb-20">
        {/* Section heading */}
        <div className="mb-4">
          <h1 className="text-[20px] font-black text-slate-800">任务列表</h1>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            家长配置 · 时间窗口自动推导状态 · 不可手动修改状态
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">加载中…</p>
          </div>
        ) : tasks.length === 0 ? (
          <div
            className="rounded-3xl border border-dashed border-amber-200 bg-white/60 py-16 text-center"
          >
            <p className="text-2xl">📋</p>
            <p className="mt-3 text-sm font-medium text-slate-600">还没有任务</p>
            <p className="mt-1 text-xs text-slate-400">点击右上角「新增任务」开始添加</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => {
              const status = deriveStatus(t)
              const chip = STATUS_CHIP[status]
              return (
                <li
                  key={t.id}
                  className="group relative overflow-hidden rounded-2xl bg-white/90 p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                  style={{ border: '1.5px solid rgba(245,158,11,0.18)' }}
                >
                  {/* Subtle left accent line based on status */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                    style={{ background: chip.fg, opacity: 0.35 }}
                  />

                  <div className="flex items-start gap-3 pl-3">
                    {/* Task body */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">{t.title}</h3>
                        {/* Status chip */}
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: chip.bg,
                            color: chip.fg,
                            border: `1px solid ${chip.border}`,
                          }}
                        >
                          {chip.emoji} {STATUS_LABELS[status]}
                        </span>
                      </div>

                      {t.content && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {t.content}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="opacity-70">🕐</span>
                          {t.startTime}–{t.endTime}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="opacity-70">🪙</span>
                          {t.rewardCoins} 金币
                        </span>
                        {t.quickLink && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <span className="opacity-70">🔗</span>
                            <span className="font-mono">{t.quickLink}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        onClick={() => openEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        onClick={() => handleDelete(t)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {showForm && (
        <RobotTaskForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

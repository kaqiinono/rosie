'use client'

import { useState } from 'react'
import type { RobotTask, RobotTaskInput } from './robot-types'

type RobotTaskFormProps = {
  /** when set, the form is in edit mode and prefilled */
  initial?: RobotTask
  onSubmit: (input: RobotTaskInput) => void | Promise<void>
  onCancel: () => void
}

const EMPTY: RobotTaskInput = {
  title: '',
  content: '',
  startTime: '09:00',
  endTime: '09:30',
  rewardCoins: 10,
  quickLink: '',
}

export default function RobotTaskForm({ initial, onSubmit, onCancel }: RobotTaskFormProps) {
  const [form, setForm] = useState<RobotTaskInput>(
    initial
      ? {
          title: initial.title,
          content: initial.content,
          startTime: initial.startTime,
          endTime: initial.endTime,
          rewardCoins: initial.rewardCoins,
          quickLink: initial.quickLink,
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof RobotTaskInput>(k: K, v: RobotTaskInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valid = form.title.trim() !== '' && form.startTime !== '' && form.endTime !== ''

  const handleSubmit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSubmit({ ...form, title: form.title.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        style={{ boxShadow: '0 25px 60px rgba(15,23,42,0.18), 0 0 0 1px rgba(245,158,11,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bar — matches /admin/* amber→rose gradient */}
        <div
          className="h-1.5 w-full"
          style={{ background: 'linear-gradient(90deg,#f59e0b 0%,#fb7185 55%,#60a5fa 100%)' }}
        />

        <div className="p-6">
          <h2 className="mb-5 text-[18px] font-extrabold text-slate-800">
            {initial ? '✏️ 编辑任务' : '＋ 新增任务'}
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="robot-task-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                任务标题 <span className="text-rose-400">*</span>
              </label>
              <input
                id="robot-task-title"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="例如：写口算题卡"
              />
            </div>

            {/* Content */}
            <div>
              <label htmlFor="robot-task-content" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                任务内容
              </label>
              <textarea
                id="robot-task-content"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                rows={2}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder="具体要求或描述"
              />
            </div>

            {/* Time row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="robot-task-start-time" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  开始时间 <span className="text-rose-400">*</span>
                </label>
                <input
                  id="robot-task-start-time"
                  type="time"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="robot-task-end-time" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  结束时间 <span className="text-rose-400">*</span>
                </label>
                <input
                  id="robot-task-end-time"
                  type="time"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              </div>
            </div>

            {/* Coins + link row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="robot-task-reward-coins" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  奖励金币 🪙
                </label>
                <input
                  id="robot-task-reward-coins"
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  value={form.rewardCoins}
                  onChange={(e) => set('rewardCoins', Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="robot-task-quick-link" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  打卡页路径 🔗
                </label>
                <input
                  id="robot-task-quick-link"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  value={form.quickLink}
                  onChange={(e) => set('quickLink', e.target.value)}
                  placeholder="/calc"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              className="rounded-xl px-5 py-2 text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
              style={{
                background: valid && !saving
                  ? 'linear-gradient(135deg,#f59e0b 0%,#fb923c 100%)'
                  : 'rgba(203,213,225,1)',
                cursor: valid && !saving ? 'pointer' : 'not-allowed',
              }}
              disabled={!valid || saving}
              onClick={handleSubmit}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

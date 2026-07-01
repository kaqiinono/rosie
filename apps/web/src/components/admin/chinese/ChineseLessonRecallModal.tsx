'use client'

import { useState } from 'react'
import type { ChineseLessonRow } from '@rosie/chinese'

type Props = {
  lesson: ChineseLessonRow
  onCancel: () => void
  onSubmit: (recallPhrases: string[]) => Promise<void>
}

const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'
const inputCls =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-amber-400 focus:outline-none'

export default function ChineseLessonRecallModal({ lesson, onCancel, onSubmit }: Props) {
  const [text, setText] = useState(lesson.recallPhrases.join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const recallPhrases = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    setSaving(true)
    setError(null)
    try {
      await onSubmit(recallPhrases)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-slate-800">读一读记一记</h2>
        <p className="mt-1 text-sm text-slate-600">{lesson.lessonTitle}</p>
        <p className="text-xs text-slate-400">{lesson.lessonKey}</p>

        <label className="mt-4 block">
          <span className={labelCls}>词语（每行一条）</span>
          <textarea
            className={`${inputCls} min-h-[160px] font-mono`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { ChineseLessonRow } from '@rosie/chinese'
import { AppDialog } from '@rosie/ui'
import { Button, TextArea } from '@rosie/ui/themes'

type Props = {
  lesson: ChineseLessonRow
  onCancel: () => void
  onSubmit: (recallPhrases: string[]) => Promise<void>
}

const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'

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
    <AppDialog
      open
      size="form"
      title="读一读记一记"
      closeDisabled={saving}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel()
      }}
    >
      <div>
        <p className="mt-1 text-sm text-slate-600">{lesson.lessonTitle}</p>
        <p className="text-xs text-slate-400">{lesson.lessonKey}</p>

        <label className="mt-4 block">
          <span className={labelCls}>词语（每行一条）</span>
          <TextArea size="2" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onCancel} variant="soft" color="gray" size="2">
            取消
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            variant="solid"
            color="amber"
            size="2"
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </AppDialog>
  )
}

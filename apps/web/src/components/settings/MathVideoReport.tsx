'use client'

import { lessonReplayKey } from '@rosie/math-kit/utils/lesson-registry'
import { useState } from 'react'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'
import { VIDEO_SECONDARY_BUTTON } from './baidu-video-client'

export default function MathVideoReport({ editor }: { editor: MathVideoEditor }) {
  const [open, setOpen] = useState(false)
  const labels = new Map(editor.problems.map(p => [p.id, p.label + ' · ' + p.title]))
  labels.set(lessonReplayKey(editor.lessonKey), '整讲回放')
  const byProblem = new Map(editor.bindings.map(b => [b.problemId, b]))
  const groups: [string, string[]][] = [
    ['已绑定', editor.bindings.filter(b => b.available).map(b => (labels.get(b.problemId) ?? b.problemId) + ' → ' + b.name)],
    ['未绑定', editor.problems.filter(p => !byProblem.has(p.id)).map(p => p.label + ' · ' + p.title)],
    ['其他讲次已占用', Object.entries(editor.occupied).map(([id, owner]) => editor.files[id] + ' → ' + owner.lessonKey + ' / ' + owner.problemId)],
    ['文件缺失', editor.bindings.filter(b => !b.available).map(b => (labels.get(b.problemId) ?? b.problemId) + ' → ' + b.name)],
    ['旧清单待确认', editor.reviewNames],
  ]
  return <div className="mt-4">
    <button type="button" className={VIDEO_SECONDARY_BUTTON} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? '收起匹配报告' : '查看匹配报告'}
    </button>
    {open && <div className="mt-2 rounded-xl bg-surface-dim p-3 text-sm">
      <p className="mb-2 text-text-secondary">本讲按已保存的绑定统计，文件占用按当前所选目录显示。</p>
      {groups.map(([label, rows]) => <details key={label} className="border-t border-border-light py-2">
        <summary className="cursor-pointer font-semibold">{label}（{rows.length}）</summary>
        <ul className="max-h-72 overflow-y-auto">{rows.map((row, i) => <li key={i} className="break-all py-1">{row}</li>)}</ul>
      </details>)}
    </div>}
  </div>
}

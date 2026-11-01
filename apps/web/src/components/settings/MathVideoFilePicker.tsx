'use client'

import { useMemo, useState } from 'react'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'
import { VIDEO_SECONDARY_BUTTON } from './baidu-video-client'

type Props = { editor: MathVideoEditor; picks: Record<string,string>; problemId: string; disabled?: boolean; choose: (id: string) => void }
export default function MathVideoFilePicker({ editor, picks, problemId, disabled, choose }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const used = new Map(Object.entries(picks).map(([problem, file]) => [file, problem]))
  const labels = new Map(editor.problems.map(p => [p.id, p.label]))
  const files = useMemo(() => {
    const collator = new Intl.Collator('zh-CN', { numeric: true })
    return Object.entries(editor.files).sort((a, b) => collator.compare(a[1], b[1]))
  }, [editor.files])
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? files.filter(([, name]) => name.toLowerCase().includes(query)) : files
  }, [files, search])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 30) - 1))
  const offset = currentPage * 30
  return <div className="text-sm">
    <input aria-label="搜索视频文件名" placeholder="搜索视频文件名" value={search}
      onChange={e => { setSearch(e.target.value); setPage(0) }} className="min-h-11 w-full rounded-lg border border-border-light px-3" />
    <ul className="mt-1 max-h-72 divide-y divide-border-light overflow-y-auto">
      {matches.slice(offset, offset + 30).map(([id, name]) => {
        const owner = editor.occupied[id]
        const local = used.get(id)
        const occupied = owner ? owner.lessonKey + ' / ' + owner.problemId
          : local && local !== problemId ? '本讲 ' + (labels.get(local) ?? local) : ''
        const selected = picks[problemId] === id
        return <li key={id}><button type="button" aria-pressed={selected} disabled={disabled || Boolean(occupied)} onClick={() => choose(id)}
          className={'min-h-11 w-full break-all rounded-lg px-2 py-1 text-left text-app-blue-dark disabled:text-text-secondary ' + (selected ? 'bg-blue-50 font-semibold ring-1 ring-inset ring-app-blue' : 'enabled:hover:bg-surface-dim')}>
          {name}{selected && '（当前绑定）'}{occupied && '（已占用：' + occupied + '）'}
        </button></li>
      })}
    </ul>
    {matches.length === 0 && <p className="py-2 text-text-secondary">没有符合条件的视频。</p>}
    {matches.length > 30 && <div className="flex items-center gap-2">
      <button type="button" className={VIDEO_SECONDARY_BUTTON} disabled={!currentPage} onClick={() => setPage(currentPage-1)}>上一页</button>
      <span>{currentPage+1} / {Math.ceil(matches.length/30)}</span>
      <button type="button" className={VIDEO_SECONDARY_BUTTON} disabled={offset+30 >= matches.length} onClick={() => setPage(currentPage+1)}>下一页</button>
    </div>}
  </div>
}

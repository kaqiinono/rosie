'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { bindingValue, type MathVideoEditor, type VideoProblem } from '@/lib/baidu-math-video-report-types'
import { VIDEO_SECONDARY_BUTTON } from './baidu-video-client'
import { lessonReplayKey } from '@rosie/math-kit/utils/lesson-registry'
import MathVideoFilePicker from './MathVideoFilePicker'

type Props = {
  editor: MathVideoEditor
  problems: VideoProblem[]
  picks: Record<string, string>
  busy: boolean
  choose: (problemId: string, fileId: string | null) => void
}

const desktopQuery = '(min-width: 40rem)'
function subscribeLayout(update: () => void) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
const desktopLayout = () => window.matchMedia(desktopQuery).matches
const serverLayout = () => false

export default function MathVideoPairingPanel({ editor, problems, picks, busy, choose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const desktop = useSyncExternalStore(subscribeLayout, desktopLayout, serverLayout)
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selectedRow = useRef<HTMLLIElement>(null)
  const wholeLesson = { id: lessonReplayKey(editor.lessonKey), label: '整讲回放', title: '完整课堂视频' }
  const targets = [wholeLesson, ...problems]
  const active = targets.find(p => p.id === selectedId) ?? problems.find(p => !picks[p.id]) ?? problems[0] ?? wholeLesson
  const bindings = new Map(editor.bindings.map(b => [b.problemId, b]))

  useEffect(() => {
    const container = list.current
    const row = selectedRow.current
    if (!container || !row) return
    const bounds = container.getBoundingClientRect()
    const item = row.getBoundingClientRect()
    if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom
    else if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top
  }, [active?.id])

  function selectProblem(id: string) {
    setSelectedId(id)
    dialog.current?.showModal()
  }

  function assign(fileId: string) {
    if (!active || busy || !editor.version || picks[active.id] === fileId) return
    choose(active.id, fileId)
    const index = targets.findIndex(p => p.id === active.id)
    const remaining = [...targets.slice(index + 1), ...targets.slice(0, index)].filter(p => p.id !== wholeLesson.id)
    const next = remaining.find(p => !picks[p.id])
    setSelectedId(next?.id ?? active.id)
    if (!next && dialog.current?.open) dialog.current.close()
  }

  const videoList = <>
      <p aria-live="polite" className="mb-2 break-words text-sm font-semibold text-app-blue-dark">
        {active ? '当前匹配：' + active.label + ' · ' + active.title : '请先选择题目'}
      </p>
      <MathVideoFilePicker editor={editor} picks={picks} problemId={active?.id ?? ''}
        disabled={busy || !active || !editor.version} choose={assign} />
  </>

  return <div className="grid items-start gap-3 sm:grid-cols-2">
    <section aria-label="题目列表" className="min-w-0 rounded-xl border border-border-light p-3">
      <h5 className="mb-2 text-sm font-bold">整讲回放与题目（{problems.length} 题）</h5>
      <ul ref={list} className="max-h-96 divide-y divide-border-light overflow-y-auto">
        {targets.map(p => {
          const file = picks[p.id]
          const old = bindings.get(p.id)
          const name = file && (editor.files[file] ?? (old && bindingValue(old) === file ? old.name : file))
          const selected = p.id === active?.id
          return <li key={p.id} ref={selected ? selectedRow : undefined}
            className={'flex items-center gap-1 rounded-lg px-1 ' + (selected ? 'bg-blue-50 ring-1 ring-inset ring-app-blue' : '')}>
            <button type="button" aria-pressed={selected} disabled={busy} onClick={() => selectProblem(p.id)}
              className="min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm">
              <span className="block font-semibold">{p.label} · {p.title}</span>
              <span className="block break-all text-xs text-text-secondary">{name || '未绑定'}{file && editor.version && !editor.files[file] && '（文件缺失）'}</span>
              {file && editor.occupied[file] && <span className="text-amber-800">已被 {editor.occupied[file].problemId} 占用，请改选。</span>}
            </button>
            {file && <button type="button" disabled={busy} aria-label={'解绑 ' + p.label}
              onClick={() => { setSelectedId(p.id); choose(p.id, null) }} className={VIDEO_SECONDARY_BUTTON}>解绑</button>}
          </li>
        })}
      </ul>
      {!problems.length && <p className="text-sm text-text-secondary">没有符合筛选条件的题目。</p>}
    </section>
    {desktop ? <section aria-label="视频列表" className="min-w-0 rounded-xl border border-border-light p-3">
      <h5 className="mb-2 text-sm font-bold">视频列表</h5>
      {videoList}
    </section> : <dialog ref={dialog} aria-label="选择回放视频"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto rounded-2xl border border-border-light bg-surface p-4 backdrop:bg-black/40">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="font-bold">选择回放视频</h5>
        <button type="button" className={VIDEO_SECONDARY_BUTTON} onClick={() => dialog.current?.close()}>关闭</button>
      </div>
      {videoList}
    </dialog>}
  </div>
}

'use client'

import { lessonReplayKey, summaryReplayOrder } from '@rosie/math-kit/utils/lesson-registry'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAdminUser, useAuth, SOURCE_LABELS } from '@rosie/core'
import { SelectControl } from '@rosie/ui'
import { LESSONS, lessonByKey, gradesInOrderFromRegistry } from '@rosie/math-kit/utils/lesson-registry'
import { invalidateProblemVideoCatalogs, replaceProblemVideoCatalog } from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import { bindingValue, VIDEO_SOURCES, type MathVideoEditor, type VideoSource } from '@/lib/baidu-math-video-report-types'
import { requestBaiduVideoData, VIDEO_SECONDARY_BUTTON as button, type VideoRequest } from './baidu-video-client'
import { matchMathReplayFiles } from '@/lib/match-math-replay-files'
import MathVideoReport from './MathVideoReport'
import MathVideoPairingPanel from './MathVideoPairingPanel'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'

const grades = gradesInOrderFromRegistry().map(g => ({ value: String(g), label: g + '年级' }))
const defaultLesson = [...LESSONS].sort((a,b) => b.grade - a.grade || b.seq - a.seq)[0]!.lessonKey
const primary = 'min-h-11 rounded-xl bg-app-blue-dark px-4 text-sm font-bold text-white disabled:opacity-50'
type Picks = Record<string,string>

function savedPicks(editor: MathVideoEditor): Picks {
  return editor.selectedId === editor.directoryId
    ? Object.fromEntries(editor.bindings.map(b => [b.problemId, bindingValue(b)])) : {}
}

function LessonEditor({ userId, paths }: { userId: string; paths: SyncDirectoryList }) {
  const [lessonKey, setLesson] = useState(defaultLesson)
  const [editor, setEditor] = useState<MathVideoEditor | null>(null)
  const [picks, setPicks] = useState<Picks>({})
  const [sources, setSources] = useState<VideoSource[]>(['lesson'])
  const [questionSearch, setQuestionSearch] = useState('')
  const [batchIssues, setBatchIssues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const grade = lessonByKey(lessonKey)?.grade
  const options = LESSONS.filter(l => l.grade === grade).map(l => ({ value: l.lessonKey, label: '第 ' + l.seq + ' 讲' }))

  const run = useCallback(async (input: VideoRequest, apply: (value: MathVideoEditor, signal: AbortSignal) => void | Promise<void>) => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setSaving(input.action === 'save'); setSaveError('')
    setBusy(true); setError(''); setMessage('')
    try {
      const next = await requestBaiduVideoData(userId, input, controller.signal)
      if (!controller.signal.aborted) await apply(next, controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted && input.action === 'save') setSaveError(cause instanceof Error ? cause.message : '请重新读取后重试。')
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.name === 'Error'
        ? cause.message : '请求未完成，请重新读取后重试。')
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); setSaving(false) }
    }
  }, [userId])

  const accept = useCallback((next: MathVideoEditor) => {
    setBatchIssues({})
    setEditor(next)
    setPicks(savedPicks(next))
    replaceProblemVideoCatalog(userId, {
      summaryNames: Object.fromEntries(next.bindings
        .filter(b => b.available && summaryReplayOrder(next.lessonKey, b.problemId))
        .map(b => [b.problemId, b.name])),
      lessonKey: next.lessonKey, keys: next.bindings.filter(b => b.available).map(b => b.problemId), syncedAt: next.savedAt,
    })
  }, [userId])

  useEffect(() => {
    void run({ action: 'read', lessonKey }, accept)
    return () => { pending.current?.abort(); pending.current = null }
  }, [lessonKey, run, accept])

  const published = new Map(editor?.bindings.map(b => [b.problemId, b]))
  const query = questionSearch.trim().toLowerCase()
  const visibleProblems = editor?.problems.filter(p => sources.includes(p.source) &&
    [p.id, p.label, p.title].some(value => value.toLowerCase().includes(query))) ?? []
  const bankIds = new Set(editor?.problems.map(p => p.id))
  const fullKey = lessonReplayKey(lessonKey)
  bankIds.add(fullKey)
  const retired = editor?.bindings.filter(b => !bankIds.has(b.problemId) && !summaryReplayOrder(lessonKey, b.problemId) && picks[b.problemId]) ?? []
  const changingDirectory = editor && editor.directoryId !== editor.selectedId
  const dirty = Boolean(changingDirectory || (editor && (Object.keys(picks).length !== editor.bindings.length ||
    editor.bindings.some(b => picks[b.problemId] !== bindingValue(b)))))
  const discard = () => !dirty || window.confirm('放弃本讲尚未保存的修改？选择取消可继续编辑。')
  function changeLesson(key: string) {
    if (busy || key === lessonKey || !discard()) return
    setEditor(null); setPicks({}); setQuestionSearch(''); setLesson(key)
  }
  function changeDirectory(id: string) {
    if (!discard()) return
    if (!id) {
      if (!editor) return
      setBatchIssues({})
      setEditor({ ...editor, selectedId: null, syncedAt: null, version: null, files: {}, occupied: {} })
      setPicks({}); setError(''); setMessage('')
    } else {
      void run({ action: 'read', lessonKey, directoryId: id }, async (snapshot, signal) => {
        if (snapshot.generation !== paths.generation) throw Error('共享网盘账号已变更，请刷新授权路径列表。')
        accept(snapshot)
        const next = await requestBaiduVideoData(userId, {
          action: 'sync', lessonKey, directoryId: id, generation: snapshot.generation, version: snapshot.version,
        }, signal)
        if (signal.aborted) return
        invalidateProblemVideoCatalogs(userId)
        accept(next)
        setMessage('已读取 ' + Object.keys(next.files).length + ' 个视频。')
      })
    }
  }
  function reread() {
    const directoryId = editor?.selectedId ?? undefined
    void run({ action: 'read', lessonKey, directoryId }, next => {
      if (!editor || !dirty) { accept(next); return }
      if (next.generation !== editor.generation) {
        setError('共享网盘账号已变更。请放弃旧账号的草稿后重新读取。')
        return
      }
      // Start with the latest publication and reapply only this editor's changes.
      const latest = !editor.selectedId
        ? { ...next, selectedId: null, version: null, syncedAt: null, files: {}, occupied: {} }
        : next
      const merged = savedPicks(latest)
      const base = savedPicks(editor)
      const overlaps: string[] = []
      for (const id of new Set([...Object.keys(base), ...Object.keys(picks)])) {
        if (base[id] === picks[id]) continue
        if (merged[id] !== base[id] && merged[id] !== picks[id]) overlaps.push(id)
        if (picks[id]) merged[id] = picks[id]!
        else delete merged[id]
      }
      accept(latest)
      setPicks(merged)
      setMessage(overlaps.length ? '已保留草稿。这些题目的已保存绑定也有改动，保存前请核对：' + overlaps.join('、')
        : '已读取最新清单并保留草稿，请核对后保存。')
    })
  }
  function sync() {
    if (!editor?.selectedId) return
    void run({ action: 'sync', lessonKey, directoryId: editor.selectedId, generation: editor.generation,
      version: editor.version }, next => {
      invalidateProblemVideoCatalogs(userId)
      if (next.revision !== editor.revision || next.generation !== editor.generation) {
        setError('本讲绑定或共享账号已变更，草稿已保留。请重新读取后核对。')
        return
      }
      // A legacy path retained in the draft may now have its verified file ID.
      const resolved = { ...picks }
      for (const b of next.bindings) {
        const old = published.get(b.problemId)
        if (old && old.fileId === null && resolved[b.problemId] === bindingValue(old)) resolved[b.problemId] = bindingValue(b)
      }
      accept(next)
      setPicks(resolved)
      setMessage('已同步 ' + Object.keys(next.files).length + ' 个视频。')
    })
  }
  function matchVisible() {
    if (!editor?.version || busy) return
    const { additions, issues } = matchMathReplayFiles(editor, visibleProblems, picks)
    setPicks({ ...picks, ...additions })
    setBatchIssues(issues)
    setMessage('本次匹配 ' + Object.keys(additions).length + ' 道题，' + Object.keys(issues).length + ' 道需手动选择。')
  }
  function choose(problemId: string, fileId: string | null) {
    setPicks(prev => {
      const next = { ...prev }
      if (fileId) next[problemId] = fileId
      else delete next[problemId]
      return next
    })
    setMessage('')
  }
  function save() {
    if (!editor || !dirty) return
    if (changingDirectory && editor.bindings.length &&
        !window.confirm('更换目录将解除原目录的 ' + editor.bindings.length + ' 条绑定。保存本讲修改？')) return
    void run({ action: 'save', lessonKey, directoryId: editor.selectedId, generation: editor.generation,
      version: editor.version, revision: editor.revision, picks }, next => {
      accept(next); setMessage('本讲绑定已保存。')
    })
  }

  return <section className="mt-4 border-t border-border-light pt-4" aria-label="数学视频回放">
    <h4 className="text-base font-bold text-text-primary">数学视频回放</h4>
    <p className="mt-1 text-sm text-text-secondary">从上方已添加的授权路径中选择目录，系统会自动读取其中的 MP4。可批量匹配或逐题选择视频，核对后点击「保存本讲绑定」。</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <SelectControl value={String(grade)} options={grades} disabled={busy} ariaLabel="选择同步年级" label="年级"
        onValueChange={v => { const first = LESSONS.find(l => String(l.grade) === v); if (first) changeLesson(first.lessonKey) }} />
      <SelectControl value={lessonKey} options={options} disabled={busy} ariaLabel="选择同步讲次" label="讲次" onValueChange={changeLesson} />
    </div>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 grow text-sm font-semibold">本讲网盘目录
        <select value={editor?.selectedId ?? ''} disabled={busy || !paths.directories.length} onChange={e => changeDirectory(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl border border-border-light bg-surface px-2">
          <option value="">未选择目录</option>
          {paths.directories.map(d => <option key={d.id} value={d.id}>{d.path}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || !editor?.selectedId} onClick={sync} className={button}>刷新文件列表</button>
      <button type="button" disabled={busy} onClick={reread} className={button}>重新读取</button>
      {dirty && <button type="button" disabled={busy} onClick={() => { if (discard()) void run({ action: 'read', lessonKey }, accept) }}
        className={button}>放弃草稿</button>}
    </div>
    {busy && <p role="status" className="mt-2 text-sm">正在处理…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm text-app-green-dark">{message}</p>}
    {editor && <>
      <p className="mt-2 text-sm text-text-secondary">{!paths.directories.length ? '请先在上方添加授权路径。'
        : editor.syncedAt ? '最近同步：' + new Date(editor.syncedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ' · ' + Object.keys(editor.files).length + ' 个视频'
        : editor.selectedId ? '尚未取得文件列表，请点击「刷新文件列表」重试。' : '请选择本讲使用的授权路径。'}</p>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">题目来源（可多选）</legend>
        <div className="flex flex-wrap gap-2">{VIDEO_SOURCES.map(s => <label key={s} className="inline-flex min-h-11 items-center gap-1">
          <input type="checkbox" checked={sources.includes(s)} onChange={e => setSources(e.target.checked ? [...sources,s] : sources.filter(v => v !== s))} />
          {SOURCE_LABELS[s]}</label>)}</div>
      </fieldset>
      <input aria-label="搜索题号或题目" placeholder="搜索题号或题目" value={questionSearch}
        onChange={e => setQuestionSearch(e.target.value)} className="mb-2 min-h-11 w-full rounded-xl border border-border-light px-3 text-sm" />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !editor.version || !visibleProblems.some(p => !picks[p.id])}
          onClick={matchVisible} className={button}>批量匹配</button>
        <span className="text-sm text-text-secondary">仅匹配当前筛选中的未绑定题目</span>
      </div>
      {visibleProblems.some(p => !picks[p.id] && batchIssues[p.id]) && <details className="mb-3 rounded-xl border border-border-light p-3 text-sm">
        <summary className="cursor-pointer font-semibold">查看需要手动选择的题目</summary>
        <ul className="mt-2 space-y-1">{visibleProblems.filter(p => !picks[p.id] && batchIssues[p.id]).map(p =>
          <li key={p.id} className="break-all">{p.label} · {p.title} — {batchIssues[p.id]}</li>
        )}</ul>
      </details>}
      <p className="mb-2 text-sm text-text-secondary">选择整讲回放、本讲总结视频或题目，再从视频列表添加文件。</p>
      <MathVideoPairingPanel key={lessonKey + ':' + editor.selectedId} editor={editor} problems={visibleProblems}
        picks={picks} busy={busy} choose={choose} />
      {retired.map(b => <p key={b.problemId} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        原题 {b.problemId} 已移出题库 · {b.name}
        <button type="button" disabled={busy} onClick={() => choose(b.problemId,null)} className={button}>解绑</button>
      </p>)}
      {dirty && <p className="mt-3 text-sm text-text-secondary">有尚未保存的修改。{changingDirectory && '更换目录将解除原目录的 ' + editor.bindings.length + ' 条绑定。'}</p>}
      <button type="button" onClick={save} disabled={busy || !dirty || Boolean(editor.selectedId && !editor.version)} className={primary + ' mt-3'}>{saving ? '正在保存…' : '保存本讲绑定'}</button>
      <div aria-live="polite" className="mt-2 rounded-xl bg-surface-dim p-3 text-sm">
        {saveError && <p role="alert" className="text-red-700">保存未确认：{saveError}</p>}
        <p className="font-semibold">{saving ? '正在提交本讲绑定…' : dirty ? '当前修改尚未保存' : editor.savedAt ? '✓ 本讲绑定已保存' : '本讲尚未保存绑定'}</p>
        {editor.savedAt && <p className="mt-1 break-all text-text-secondary">
          最近保存：{new Date(editor.savedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} ·
          目录：{editor.directories.find(d => d.id === editor.directoryId)?.path ?? '未绑定'} ·
          题目绑定 {editor.bindings.filter(b => b.problemId !== fullKey && !summaryReplayOrder(lessonKey, b.problemId)).length} 个 ·
          总结视频 {editor.bindings.filter(b => summaryReplayOrder(lessonKey, b.problemId)).length} 个 ·
          整讲回放：{published.get(fullKey)?.name ?? '未绑定'}
        </p>}
      </div>
      <MathVideoReport editor={editor} />
    </>}
  </section>
}

export default function BaiduMathVideoManager({ paths }: { paths: SyncDirectoryList }) {
  const { user } = useAuth()
  return user && isAdminUser(user) ? <LessonEditor key={user.id} userId={user.id} paths={paths} /> : null
}

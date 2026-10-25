'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SelectControl } from '@rosie/ui'
import type { MathVideoReport as Report, VideoFileReportRow, VideoProblemReportRow, VideoProblemStatus } from '@/lib/baidu-math-video-report-types'
import { requestBaiduVideoData, videoSyncTime, VIDEO_SECONDARY_BUTTON } from './baidu-video-client'

type Props = { userId: string; lessonKey: string; revision: string | null; sources: string[] }
type Filters = { status: string; query: string }
type ReportGroup = 'problems' | 'files' | 'compare'
const PAGE_SIZE = 20
const STATUS_LABELS: Record<VideoProblemStatus, string> = {
  matched: '已匹配', missing: '未匹配', unknown: '待同步', conflict: '编号冲突', invalid_key: '题目编号异常',
}
const PROBLEM_STATUSES = [
  { value: 'missing', label: '未匹配' }, { value: 'matched', label: '已匹配' },
  { value: 'conflict', label: '编号冲突' }, { value: 'invalid_key', label: '题目编号异常' },
  { value: 'unknown', label: '待同步' }, { value: 'all', label: '全部状态' },
]
const FILE_STATUSES = [
  { value: 'all', label: '全部未匹配文件' }, { value: 'orphan', label: '无对应题目' },
  { value: 'invalid_file', label: '命名／格式异常' },
]

export default function MathVideoReport({ userId, lessonKey, revision, sources }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [group, setGroup] = useState<ReportGroup>('files')
  const [filters, setFilters] = useState<Filters>({ status: 'all', query: '' })
  const [comparisonFile, setComparisonFile] = useState<VideoFileReportRow | null>(null)
  const [page, setPage] = useState(1)
  const [copyMessage, setCopyMessage] = useState('')
  const searchId = useId()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPage(1) }, [sources])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setComparisonFile(null)
    void requestBaiduVideoData('report', userId, lessonKey, controller.signal).then((value) => {
      if (controller.signal.aborted) return
      if (!value || typeof value !== 'object') throw new Error('报告格式异常，请重新读取。')
      const body = value as Record<string, unknown>
      if (body.lessonKey !== lessonKey || !Array.isArray(body.problems) || !Array.isArray(body.files) || !body.summary ||
        !(body.syncedAt === null || (typeof body.syncedAt === 'string' && Number.isFinite(Date.parse(body.syncedAt))))) {
        throw new Error('报告格式异常，请重新读取。')
      }
      setReport(value as Report)
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === 'Error'
        ? failure.message : '报告读取超时或网络异常，请重试。')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [userId, lessonKey, revision, attempt])

  function changeFilter(key: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }

  function changeGroup(next: ReportGroup) {
    setGroup(next)
    setFilters({ status: next === 'problems' ? 'missing' : 'all', query: '' })
    setPage(1)
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(`已复制：${value}`)
    } catch {
      setCopyMessage('复制失败，请选中下方显示的文件名或路径手动复制。')
    }
  }

  const sourceProblems = useMemo(() => (report?.problems ?? []).filter((row) => sources.includes(row.section)), [report, sources])

  function compareFile(file: VideoFileReportRow) {
    setComparisonFile(file)
    changeGroup('compare')
  }

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const problems = (report?.problems ?? []).filter((row) => {
      const statusMatches = filters.status === 'all' || (filters.status === 'matched' ? row.hasVideo === true
        : filters.status === 'missing' ? row.hasVideo === false : row.status === filters.status)
      return (group === 'compare' || sources.includes(row.section)) && statusMatches &&
        (!query || [row.problemId, row.displayId, row.title, row.key, row.expectedPath].join(' ').toLowerCase().includes(query))
    })
    const files = (report?.files ?? []).filter((row) =>
      (filters.status === 'all' || row.status === filters.status) && (!query || row.path.toLowerCase().includes(query)))
    return { problems, files }
  }, [report, filters, group, sources])
  const count = group === 'files' ? filtered.files.length : filtered.problems.length
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const offset = (currentPage - 1) * PAGE_SIZE

  return (
    <section className="mt-4 min-w-0 border-t border-border-light pt-4" aria-label="数学回放匹配报告" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-bold text-text-primary">匹配报告</h4>
        <button type="button" disabled={loading} onClick={() => setAttempt((value) => value + 1)} className={VIDEO_SECONDARY_BUTTON}>重新读取报告</button>
      </div>
      {loading && <p role="status" className="py-4 text-sm text-text-secondary">正在读取已保存的快照…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}{report ? ' 下方保留上次读取的报告。' : ''}</p>}
      {report && <>
        <p className="mt-3 text-xs leading-relaxed text-text-secondary">
          {report.syncedAt ? `快照时间：${videoSyncTime(report.syncedAt)}（北京时间）` : '尚无成功同步快照，不能判断视频是否存在。'}
          <br />目录：<span className="break-all font-mono">{report.directory}/</span> · 仅包含以 {lessonKey}- 开头的直接文件，不含子目录。
          <br />对照本讲当前题库；查看报告不会搜索网盘。缺少年级、讲次前缀的文件无法在本讲报告中发现。
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          {[
            ['视频／文件总数', report.summary.files], ['已匹配文件', report.summary.matchedFiles],
            ['未匹配文件', report.files.length],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-surface-dim p-3"><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-1 font-bold tabular-nums text-text-primary">{report.syncedAt ? value : '待同步'}</dd></div>)}
        </dl>
        <p className="mt-2 text-xs text-text-secondary">按文件计数，同一视频对应多个题目只计一次。未匹配包含无对应题目和命名／格式异常；不受题目来源筛选影响。</p>
        <p className="mt-2 text-xs text-text-secondary">本讲冲突编号：{report.summary.conflictKeys} · 题目编号异常：{report.summary.invalidProblems}</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="报告类型">
          <button type="button" aria-pressed={group === 'files'} onClick={() => changeGroup('files')} className={`${VIDEO_SECONDARY_BUTTON} ${group === 'files' ? 'ring-2 ring-app-blue' : ''}`}>未匹配视频／文件</button>
          <button type="button" aria-pressed={group === 'problems'} onClick={() => changeGroup('problems')} className={`${VIDEO_SECONDARY_BUTTON} ${group === 'problems' ? 'ring-2 ring-app-blue' : ''}`}>题目匹配</button>
          <button type="button" aria-pressed={group === 'compare'} onClick={() => changeGroup('compare')} className={`${VIDEO_SECONDARY_BUTTON} ${group === 'compare' ? 'ring-2 ring-app-blue' : ''}`}>本讲编号对照</button>
        </div>
        {group === 'problems' && <p className="mt-3 text-sm text-text-secondary">
          所选来源：{sourceProblems.length} 道题 · 已匹配 {sourceProblems.filter((row) => row.hasVideo === true).length} 道 · 未匹配 {sourceProblems.filter((row) => row.hasVideo === false).length} 道 · 待确认 {sourceProblems.filter((row) => row.hasVideo === null).length} 道
          {sources.length === 0 && '。请在上方选择题目来源。'}
        </p>}
        {group === 'compare' && <div className="mt-3 rounded-xl border border-border-light bg-surface-dim p-3 text-sm text-text-secondary">
          <p>对照本讲全部来源的题目 ID、displayId 和预期文件名，再决定修改哪一端；此处不自动修改。</p>
          {comparisonFile && <>
            <p className="mt-2 break-all font-mono text-text-primary">待排查文件：{comparisonFile.path}</p>
            <p className="mt-1">解析题号：{comparisonFile.parsedQuestionNumber ?? '无法解析'}（仅按文件名解析，不代表已匹配）</p>
            <button type="button" onClick={() => void copy(comparisonFile.path)} className={`mt-2 ${VIDEO_SECONDARY_BUTTON}`}>复制待排查路径</button>
          </>}
        </div>}
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectControl value={filters.status} options={group === 'files' ? FILE_STATUSES : PROBLEM_STATUSES} onValueChange={(value) => changeFilter('status', value)} ariaLabel="按匹配状态筛选" />
        </div>
        <label htmlFor={searchId} className="mt-4 block text-sm font-semibold text-text-primary">搜索编号、题目或文件名</label>
        <div className="mt-1 flex gap-2">
          <input id={searchId} ref={searchRef} type="search" value={filters.query} onChange={(event) => changeFilter('query', event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border-light bg-surface px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-app-blue" />
          {filters.query && <button type="button" aria-label="清空搜索" onClick={() => { changeFilter('query', ''); searchRef.current?.focus() }} className={VIDEO_SECONDARY_BUTTON}>清空</button>}
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 break-all text-xs text-app-green-dark">{copyMessage}</p>
        <p className="mb-2 text-xs text-text-secondary">共 {count} 项 · 每页 {PAGE_SIZE} 项</p>
        <div className="space-y-3">
          {group !== 'files' ? filtered.problems.slice(offset, offset + PAGE_SIZE).map((row) => <ProblemRow key={row.problemId} row={row} onCopy={copy} />)
            : filtered.files.slice(offset, offset + PAGE_SIZE).map((row) => <article key={row.path} className="min-w-0 rounded-xl border border-border-light bg-surface p-4">
              <h5 className="break-all font-mono text-sm font-bold text-text-primary">{row.filename}</h5>
              <p className="mt-2 text-sm font-semibold text-amber-800">{row.status === 'orphan' ? '无对应题目' : '命名／格式异常'}</p>
              <p className="mt-1 text-sm text-text-secondary">{row.reason}</p>
              <p className="mt-2 text-xs text-text-secondary">解析题号：{row.parsedQuestionNumber ?? '无法解析'}（仅按文件名解析）</p>
              <p className="mt-2 break-all font-mono text-sm text-text-primary">实际网盘路径：{row.path}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy(row.path)} className={VIDEO_SECONDARY_BUTTON}>复制实际路径</button>
                <button type="button" onClick={() => void copy(row.filename)} className={VIDEO_SECONDARY_BUTTON}>复制文件名</button>
                <button type="button" onClick={() => compareFile(row)} className={VIDEO_SECONDARY_BUTTON}>对照本讲题目编号</button>
              </div>
            </article>)}
          {count === 0 && <p className="rounded-xl bg-surface-dim p-6 text-center text-sm text-text-secondary">{!report.syncedAt ? '请先点击「同步本讲」，生成首次快照。'
            : group === 'files' && report.summary.files === 0 ? '本讲快照中没有文件。'
            : group === 'files' && report.files.length === 0 ? '本讲清单中的文件均已匹配，无需排查。'
            : '当前筛选下没有记录。'}</p>}
        </div>
        <nav aria-label="匹配报告分页" className="mt-4 flex items-center justify-between gap-2">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className={VIDEO_SECONDARY_BUTTON}>上一页</button>
          <span className="text-sm tabular-nums text-text-secondary">{currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className={VIDEO_SECONDARY_BUTTON}>下一页</button>
        </nav>
      </>}
    </section>
  )
}

function ProblemRow({ row, onCopy }: { row: VideoProblemReportRow; onCopy: (value: string) => Promise<void> }) {
  return <article className="min-w-0 rounded-xl border border-border-light bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h5 className="min-w-0 break-words text-sm font-bold text-text-primary">{row.label} · {row.title}</h5>
      <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${row.status === 'matched' ? 'bg-app-blue-light text-app-blue-dark' : 'bg-amber-50 text-amber-800'}`}>{STATUS_LABELS[row.status]}</span>
    </div>
    <p className="mt-1 text-xs text-text-secondary">{row.lessonLabel} · {row.sectionLabel}</p>
    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <div><dt className="text-text-secondary">实际题目 ID</dt><dd className="break-all font-mono text-text-primary">{row.problemId}</dd></div>
      <div><dt className="text-text-secondary">兼容编号 displayId</dt><dd className="break-all font-mono text-text-primary">{row.displayId ?? '未设置'}</dd></div>
      <div><dt className="text-text-secondary">匹配依据</dt><dd className="text-text-primary">{row.matchBy === 'displayId' ? '年级-讲次-displayId' : '完整题目 ID'}</dd></div>
      <div><dt className="text-text-secondary">预期视频文件名</dt><dd className="break-all font-mono text-text-primary">{row.expectedFilename ?? '无法生成，请修正题目编号'}</dd></div>
      <div className="sm:col-span-2"><dt className="text-text-secondary">预期完整路径</dt><dd className="break-all font-mono text-text-primary">{row.expectedPath ?? '无法生成'}</dd></div>
    </dl>
    <p className="mt-3 text-sm text-text-secondary">{row.reason}</p>
    {row.conflictingIds.length > 0 && <p className="mt-2 break-all text-xs text-amber-800">冲突题目：{row.conflictingIds.join('、')}。快照文件：{row.hasVideo === null ? '尚未确认' : row.hasVideo ? '存在' : '不存在'}。</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <Link href={row.href} target="_blank" rel="noopener noreferrer" className={VIDEO_SECONDARY_BUTTON} aria-label={`打开题目 ${row.label}（新标签页）`}>打开题目 ↗</Link>
      {row.expectedFilename && <button type="button" onClick={() => { if (row.expectedFilename) void onCopy(row.expectedFilename) }} className={VIDEO_SECONDARY_BUTTON}>复制预期文件名</button>}
      {row.expectedPath && <button type="button" onClick={() => { if (row.expectedPath) void onCopy(row.expectedPath) }} className={VIDEO_SECONDARY_BUTTON}>复制预期路径</button>}
    </div>
  </article>
}

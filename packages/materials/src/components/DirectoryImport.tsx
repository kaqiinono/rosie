'use client'
import { useRef, useState } from 'react'
import { supabase } from '@rosie/core'
import { useMaterialData } from '../useMaterialData'
import { suggestCourseMaterialLinks, type MaterialFile } from '../matchCourseMaterials'
import type { MaterialCatalogProjection } from './CourseMaterialList'
import type { MaterialScope, MaterialSubject } from '../types'
import { buttonClass, inputClass } from './styles'
export type DirectoryCourse = {
  id: string
  title: string
  subject: MaterialSubject
  catalog: MaterialCatalogProjection
}
type Page = {
  sessionId: string
  files: MaterialFile[]
  folders: MaterialFile[]
  cursor: string | null
  complete: boolean
  revision: number
  resultOffset: number
  nextResultOffset: number | null
  fileCount: number
  folderCount: number
}
export function DirectoryImport({ courses }: { courses: DirectoryCourse[] }) {
  const initial =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search)
  const api = useMaterialData(),
    lock = useRef(false)
  const [root, setRoot] = useState(initial.get('root') ?? 'english'),
    [path, setPath] = useState(initial.get('directory') ?? ''),
    [recursive, setRecursive] = useState(true)
  const [courseId, setCourseId] = useState(initial.get('course') ?? courses[0]?.id ?? ''),
    [subject, setSubject] = useState<MaterialSubject>(courses[0]?.subject ?? 'english')
  const [page, setPage] = useState<Page | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [choices, setChoices] = useState<Record<string, string>>({}),
    [resume, setResume] = useState(''),
    [limit, setLimit] = useState(20)
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, MaterialFile>>({})
  const course = courses.find((c) => c.id === courseId)
  const suggestions = suggestCourseMaterialLinks(
    page?.files ?? [],
    course?.catalog ?? { lessons: [], segments: [] },
  )
  const options: { label: string; scope: MaterialScope }[] = [
    { label: '课程通用', scope: { kind: 'all' } },
    ...[
      ...new Map(
        (course?.catalog.lessons ?? []).map((l) => [JSON.stringify([l.book, l.unit]), l]),
      ).values(),
    ].map((l) => ({
      label: `${l.book} · ${l.unit}（单元）`,
      scope: { kind: 'unit' as const, book: l.book, unit: l.unit },
    })),
    ...(course?.catalog.lessons ?? []).map((l) => ({
      label: `${l.book} · ${l.unit} · ${l.title}`,
      scope: { kind: 'lessons' as const, lesson_keys: [l.key] },
    })),
    ...(course?.catalog.segments ?? []).map((s) => ({
      label: s.title,
      scope: { kind: 'segments' as const, segment_keys: [s.key] },
    })),
    ...(course?.catalog.problems ?? []).map((p) => ({
      label: p.label,
      scope: { kind: 'problems' as const, problem_keys: [p.stable_key] },
    })),
  ]
  async function request(url: string, input?: unknown) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw Error('请先登录')
    const response = await fetch(url, {
      method: input ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(input ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    })
    const body = await response.json()
    if (!response.ok) throw Error(body.error ?? '读取失败，请重试')
    return body
  }
  function applyPage(result: Page) {
    setPage(result)
    setResume(result.sessionId)
    setLimit(20)
  }
  async function recover(id: string) {
    const result = await request('/api/materials/baidu/scan/' + encodeURIComponent(id))
    setRoot(result.rootId)
    setPath(result.relativePath)
    setRecursive(result.recursive)
    setSubject(result.subject)
    if (page && page.sessionId !== result.sessionId) {
      setChoices({})
      setReviewedFiles({})
    }
    applyPage(result as Page)
  }
  async function browse(offset: number) {
    if (!page) return
    applyPage(
      (await request(
        '/api/materials/baidu/scan/' +
          encodeURIComponent(page.sessionId) +
          '?' +
          new URLSearchParams({
            offset: String(offset),
            revision: String(page.revision),
          }).toString(),
      )) as Page,
    )
  }
  async function work(fn: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">从百度目录关联物料</summary>
      <div className="mt-4 space-y-3">
        <p className="text-sm text-slate-600">
          先读取目录，再核对每份物料的范围。读取中断可续跑，已有课程关联会保留。
        </p>
        <fieldset disabled={busy || !!page} className="grid gap-3 sm:grid-cols-2">
          <label>
            允许的根目录
            <select className={inputClass} value={root} onChange={(e) => setRoot(e.target.value)}>
              <option value="english">英语目录</option>
              <option value="chinese">语文目录</option>
              <option value="math">数学目录</option>
            </select>
          </label>
          <label>
            相对路径
            <input
              className={inputClass}
              value={path}
              placeholder="例如 5A/U3"
              onChange={(e) => setPath(e.target.value)}
            />
          </label>
          <label>
            物料科目
            <select
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value as MaterialSubject)}
            >
              {Object.entries({
                chinese: '语文',
                english: '英语',
                math: '数学',
                art: '美术',
                science: '科学',
                sports: '体育',
                dance: '舞蹈',
                piano: '钢琴',
                swimming: '游泳',
                other: '其他',
              }).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />{' '}
            包含子目录
          </label>
        </fieldset>
        <label className="block">
          目标课程
          <select
            disabled={busy}
            className={inputClass}
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setChoices({})
              setReviewedFiles({})
            }}
          >
            <option value="">请选择课程</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        {!courses.length && <p>请先创建课程并配置内容目录。</p>}
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClass}
            type="button"
            disabled={busy || page?.complete}
            onClick={() =>
              void work(async () => {
                let result = (await request('/api/materials/baidu/scan', {
                  rootId: root,
                  relativePath: path,
                  recursive,
                  subject,
                  ...(page ? { sessionId: page.sessionId, cursor: page.cursor } : {}),
                })) as Page
                applyPage(result)
                if (!page && result.cursor === '0') {
                  result = (await request('/api/materials/baidu/scan', {
                    rootId: root,
                    relativePath: path,
                    recursive,
                    subject,
                    sessionId: result.sessionId,
                    cursor: '0',
                  })) as Page
                  applyPage(result)
                }
                await api.refresh()
              })
            }
          >
            {busy ? '读取中…' : page ? '继续读取' : '开始读取'}
          </button>
          {page && (
            <button
              className={buttonClass}
              type="button"
              disabled={busy}
              onClick={() => {
                setPage(null)
                setChoices({})
                setReviewedFiles({})
                setMessage('可重新选择目录；旧关联保留。')
              }}
            >
              重新选择目录
            </button>
          )}
        </div>
        {page ? (
          <button
            className={buttonClass}
            disabled={busy}
            type="button"
            onClick={() => void work(() => recover(page.sessionId))}
          >
            恢复最新进度
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block">
              恢复扫描编号
              <input
                className={inputClass}
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              />
            </label>
            <button
              className={buttonClass}
              disabled={busy || !resume}
              type="button"
              onClick={() => void work(() => recover(resume))}
            >
              恢复扫描
            </button>
          </div>
        )}
        {page && (
          <>
            <p role="status">
              {page.complete ? '目录读取完成' : '目录尚未读完'} · {page.fileCount} 份文件 ·{' '}
              {page.folderCount} 个文件夹
            </p>
            <p className="text-xs break-all">扫描编号：{page.sessionId}</p>
            <p className="text-sm">
              当前结果批次：从第 {page.resultOffset + 1} 项起；本批 {page.files.length} 份文件、
              {page.folders.length} 个文件夹。
            </p>
            <details>
              <summary>已发现的文件夹</summary>
              {page.folders.map((f) => (
                <p className="text-sm break-all" key={f.fs_id}>
                  {f.path}
                </p>
              ))}
            </details>
            {Object.values(choices).filter(Boolean).length > 200 && (
              <p role="alert">每批最多关联 200 份，请减少选择后确认。</p>
            )}
            {!suggestions.length && <p>尚未发现文件。可继续读取，或检查目录。</p>}
            {suggestions.slice(0, limit).map((s) => (
              <div key={s.file.fs_id} className="space-y-2 border-t border-slate-200 pt-3">
                <p className="font-semibold break-all">{s.file.name}</p>
                <p className="text-xs break-all text-slate-500">{s.file.path}</p>
                <p className="text-sm">
                  {s.reasons.join('；')} · {s.candidates.length} 个候选
                </p>
                <label className="block text-sm">
                  确认关联范围
                  <select
                    disabled={busy || !course}
                    className={inputClass}
                    value={choices[s.file.fs_id] ?? ''}
                    onChange={(e) => {
                      setChoices({ ...choices, [s.file.fs_id]: e.target.value })
                      setReviewedFiles({ ...reviewedFiles, [s.file.fs_id]: s.file })
                    }}
                  >
                    <option value="">暂不关联</option>
                    {options.map((o, i) => (
                      <option key={i} value={JSON.stringify(o.scope)}>
                        {o.label}
                        {s.candidates.some(
                          (c) => JSON.stringify(c.scope) === JSON.stringify(o.scope),
                        )
                          ? '（候选）'
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            {suggestions.length > limit && (
              <button className={buttonClass} type="button" onClick={() => setLimit(limit + 20)}>
                加载更多文件
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              {page.resultOffset > 0 && (
                <button
                  className={buttonClass}
                  type="button"
                  disabled={busy}
                  onClick={() => void work(() => browse(0))}
                >
                  返回首批文件
                </button>
              )}
              {page.nextResultOffset !== null && (
                <button
                  className={buttonClass}
                  type="button"
                  disabled={busy}
                  onClick={() => void work(() => browse(page.nextResultOffset!))}
                >
                  查看下一批文件
                </button>
              )}
            </div>
            {Object.values(choices).some(Boolean) && (
              <details>
                <summary>已审核选择（跨批次保留）</summary>
                {Object.entries(choices)
                  .filter(([, scope]) => scope)
                  .map(([id]) => (
                    <p key={id} className="text-sm break-all">
                      {reviewedFiles[id]?.name}
                      <button
                        className={buttonClass}
                        type="button"
                        disabled={busy}
                        onClick={() => setChoices({ ...choices, [id]: '' })}
                      >
                        取消选择
                      </button>
                    </p>
                  ))}
              </details>
            )}
            <button
              className={buttonClass}
              type="button"
              disabled={
                busy ||
                !course ||
                !Object.values(choices).some(Boolean) ||
                Object.values(choices).filter(Boolean).length > 200
              }
              onClick={() =>
                void work(async () => {
                  await api.refresh()
                  const fresh = await api.readyData()
                  await api.linkCourseMaterials(
                    courseId,
                    Object.entries(choices)
                      .filter(([, scope]) => scope)
                      .map(([id, scope], i) => {
                        const file = reviewedFiles[id]
                        const asset = fresh.assets.find(
                          (a) =>
                            a.account_id === file.account_id &&
                            a.fs_id === file.fs_id &&
                            a.version === 1,
                        )
                        if (!asset) throw Error('文件尚未就绪，请继续读取后重试')
                        return {
                          asset_id: asset.id,
                          scope: JSON.parse(scope) as MaterialScope,
                          role: 'general',
                          sort_order: i,
                        }
                      }),
                  )
                  setChoices({})
                  setReviewedFiles({})
                  setMessage('已批量关联所选物料。')
                })
              }
            >
              {busy
                ? '处理中…'
                : `确认关联 ${Object.values(choices).filter(Boolean).length} 份物料`}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  )
}

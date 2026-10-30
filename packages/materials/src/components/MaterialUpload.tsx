'use client'
import { useRef, useState } from 'react'
import { supabase } from '@rosie/core'
import { uploadFile, type UploadStatus, type UploadProgress } from '../uploadClient'
import { useMaterialData } from '../useMaterialData'
import type { MaterialScope, MaterialSubject } from '../types'
import type { DirectoryCourse } from './DirectoryImport'
import { buttonClass, inputClass } from './styles'
export function MaterialUpload({ courses = [] }: { courses?: DirectoryCourse[] }) {
  const api = useMaterialData(),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null)
  const [subject, setSubject] = useState<MaterialSubject | ''>(''),
    [file, setFile] = useState<File | null>(null),
    [resume, setResume] = useState(''),
    [session, setSession] = useState<UploadStatus | null>(null),
    [progress, setProgress] = useState<UploadProgress | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [courseId, setCourseId] = useState(''),
    [scope, setScope] = useState('0')
  const course = courses.find((c) => c.id === courseId)
  const scopes: { label: string; scope: MaterialScope }[] = [
    { label: '课程通用', scope: { kind: 'all' } },
    ...Array.from(
      new Map(
        (course?.catalog.lessons ?? []).map((l) => [JSON.stringify([l.book, l.unit]), l]),
      ).values(),
    ).map((l) => ({
      label: `${l.book} · ${l.unit}`,
      scope: { kind: 'unit' as const, book: l.book, unit: l.unit },
    })),
    ...(course?.catalog.lessons ?? []).map((l) => ({
      label: l.title,
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
      lock.current = false
      setBusy(false)
    }
  }
  async function token() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw Error('请重新登录')
    return data.session.access_token
  }
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">上传文件</h2>
      <p className="text-sm text-slate-600">
        先选择科目。默认上限 2
        GiB；关闭页面后重新选择原文件并填写会话编号续传。未确认合并可再次核验，或取消并重新开始；取消不会删除网盘文件。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          上传科目
          <select
            className={inputClass}
            disabled={busy}
            value={subject}
            onChange={(e) => setSubject(e.target.value as MaterialSubject | '')}
          >
            <option value="">请选择科目</option>
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
            }).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          选择文件
          <input
            className={inputClass}
            disabled={busy}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="sm:col-span-2">
          续传会话编号（新上传留空）
          <input
            className={inputClass}
            disabled={busy}
            value={resume}
            onChange={(e) => setResume(e.target.value.trim())}
          />
        </label>
      </div>
      <button
        className={buttonClass}
        disabled={busy || !subject || !file}
        onClick={() =>
          void work(async () => {
            if (!file || !subject) return
            abort.current = new AbortController()
            const result = await uploadFile(file, subject, await token(), {
              sessionId: resume || undefined,
              signal: abort.current.signal,
              progress: setProgress,
              session: (s) => {
                setSession(s)
                setResume(s.id)
              },
            })
            await api.refresh()
            setSession(result)
            setMessage('文件已核验并登记，可立即关联课程')
          })
        }
      >
        {busy ? '处理中…' : resume ? '验证文件并续传 / 核验结果' : '校验并上传'}
      </button>
      {session?.state !== 'ready' && (session || busy || resume) && (
        <button
          className={buttonClass}
          onClick={() => {
            abort.current?.abort()
            if (resume)
              void (async () => {
                try {
                  const r = await fetch(`/api/materials/uploads/${encodeURIComponent(resume)}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${await token()}` },
                  })
                  if (!r.ok) throw Error('取消未确认，请重试')
                  setSession(null)
                  setResume('')
                  setMessage('已取消会话，网盘文件保留')
                } catch (e) {
                  setError(e instanceof Error ? e.message : '取消失败')
                }
              })()
          }}
        >
          取消会话
        </button>
      )}
      {session && (
        <p className="text-sm break-all">
          会话：{session.id} · {session.state}
        </p>
      )}
      {progress && busy && (
        <p role="status">
          {progress.phase === 'hashing'
            ? '校验文件'
            : progress.phase === 'uploading'
              ? '上传分片'
              : '核验合并'}{' '}
          {Math.round((progress.done / Math.max(1, progress.total)) * 100)}%
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
      {session?.state === 'ready' && session.asset_id && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            关联课程
            <select
              className={inputClass}
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                setScope('0')
              }}
            >
              <option value="">选择自己的课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            关联范围
            <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)}>
              {scopes.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass}
            disabled={busy || !courseId}
            onClick={() =>
              void work(async () => {
                await api.linkCourseMaterials(courseId, [
                  {
                    asset_id: session.asset_id!,
                    scope: scopes[Number(scope)].scope,
                    role: 'review',
                    sort_order: 0,
                  },
                ])
                setMessage('已关联课程')
              })
            }
          >
            确认关联（复习）
          </button>
        </div>
      )}
    </section>
  )
}

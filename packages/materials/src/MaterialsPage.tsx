'use client'
import { useEffect, useRef, useState } from 'react'
import { useMaterialData } from './useMaterialData'
import type { MaterialAsset, MaterialSubject } from './types'
import { safeMaterialHref } from './resolution'
import { MaterialPreview } from './components/MaterialPreview'
import { materialKindLabels } from './components/labels'
import { buttonClass, inputClass } from './components/styles'
const subjects = {
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
}
export function MaterialsPage() {
  const api = useMaterialData()
  const [subject, setSubject] = useState<MaterialSubject | ' '>(' ')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<MaterialAsset['kind'] | ''>('')
  const [limit, setLimit] = useState(20)
  const [editing, setEditing] = useState<MaterialAsset | null>(null)
  const [archive, setArchive] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const dirty = useRef(false)
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const rows = api.listAssets({
    subject: subject === ' ' ? undefined : subject,
    query,
    kind: kind || undefined,
  })
  async function work(fn: () => Promise<unknown>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      await fn()
      setMessage('已保存')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 pb-28 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <a href="/tasks" className="text-sm text-emerald-800 underline">
            ← 任务管理
          </a>
          <button
            type="button"
            className={buttonClass}
            disabled={busy || api.isLoading}
            onClick={() => void work(api.refresh)}
          >
            刷新物料
          </button>
          <h1 className="mt-3 text-2xl font-extrabold">共享物料库</h1>
          <p className="mt-2 text-sm text-slate-600">
            登录后共享查看；课程关联仅属于自己。私人任务录音仍在原资料页。
          </p>
          <a className="text-sm text-emerald-800 underline" href="/tasks/materials">
            私人学习资料与录音
          </a>
        </header>
        <p id="material-feedback" role="status" className="min-h-6 text-sm">
          {message}
        </p>
        {!api.user ? (
          <p>请先登录。</p>
        ) : (
          <>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">{editing ? '维护物料信息' : '添加文本或链接'}</h2>
              <p className="text-sm text-slate-500">
                替换内容请新增物料，已有任务引用会保留原内容。
              </p>
              <form
                noValidate
                onInput={(event) => {
                  dirty.current = true
                  const field = event.target
                  if (field instanceof HTMLElement) {
                    field.removeAttribute('aria-invalid')
                    field.removeAttribute('aria-describedby')
                  }
                }}
                key={editing?.id ?? 'new'}
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const f = new FormData(form)
                  const title = String(f.get('title') ?? '').trim()
                  const kind = String(f.get('kind')) as 'text' | 'link'
                  const href = String(f.get('href') ?? '').trim()
                  const text = String(f.get('text_content') ?? '').trim()
                  if (
                    !title ||
                    title.length > 240 ||
                    (!editing && (kind === 'text' ? !text : !safeMaterialHref(href)))
                  ) {
                    setMessage('请填写名称和有效内容；链接仅支持站内路径或无凭据的 HTTPS。')
                    const invalid =
                      !title || title.length > 240
                        ? form.querySelector<HTMLInputElement>('input[name="title"]')
                        : kind === 'text'
                          ? form.querySelector<HTMLTextAreaElement>('textarea')
                          : form.querySelector<HTMLInputElement>('input[name="href"]')
                    invalid?.setAttribute('aria-invalid', 'true')
                    invalid?.setAttribute('aria-describedby', 'material-feedback')
                    invalid?.focus()
                    return
                  }
                  void work(async () => {
                    await api.saveAsset({
                      ...(editing ? { id: editing.id } : {}),
                      subject: String(f.get('subject')) as MaterialSubject,
                      title,
                      kind: editing?.kind ?? kind,
                      text_content: editing?.text_content ?? (kind === 'text' ? text : null),
                      href: editing?.href ?? (kind === 'link' ? href : null),
                    })
                    setEditing(null)
                    form.reset()
                    dirty.current = false
                  })
                }}
              >
                <label className="text-sm">
                  科目
                  <select
                    className={inputClass}
                    name="subject"
                    defaultValue={editing?.subject ?? 'chinese'}
                  >
                    {Object.entries(subjects).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  名称
                  <input
                    name="title"
                    className={inputClass}
                    defaultValue={editing?.title ?? ''}
                    required
                    maxLength={240}
                  />
                </label>
                {!editing && (
                  <>
                    <label className="text-sm">
                      类型
                      <select name="kind" className={inputClass}>
                        <option value="text">文本</option>
                        <option value="link">链接</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      链接地址
                      <input name="href" className={inputClass} placeholder="https:// 或站内路径" />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      文本内容
                      <textarea
                        name="text_content"
                        rows={5}
                        className={`${inputClass} resize-none`}
                      />
                    </label>
                  </>
                )}
                <div className="flex gap-2 sm:col-span-2">
                  <button className={buttonClass} disabled={busy}>
                    {busy ? '保存中…' : '保存物料'}
                  </button>
                  {editing && (
                    <button type="button" className={buttonClass} onClick={() => setEditing(null)}>
                      取消编辑
                    </button>
                  )}
                </div>
              </form>
            </section>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">物料目录</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  科目筛选
                  <select
                    className={inputClass}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value as MaterialSubject | ' ')
                      setLimit(20)
                    }}
                  >
                    <option value=" ">全部科目</option>
                    {Object.entries(subjects).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  类型筛选
                  <select
                    className={inputClass}
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as MaterialAsset['kind'] | '')
                      setLimit(20)
                    }}
                  >
                    <option value="">全部类型</option>
                    {['text', 'link', 'file', 'image', 'audio', 'video', 'pdf'].map((k) => (
                      <option key={k} value={k}>
                        {materialKindLabels[k as MaterialAsset['kind']]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  查找名称
                  <input
                    className={inputClass}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setLimit(20)
                    }}
                  />
                </label>
              </div>
              {query && (
                <button className={buttonClass} onClick={() => setQuery('')}>
                  清除查找
                </button>
              )}
              {api.isLoading ? (
                <p role="status">正在读取物料…</p>
              ) : api.error ? (
                <div role="alert">
                  读取失败。
                  <button className={buttonClass} onClick={() => void work(api.refresh)}>
                    重试
                  </button>
                </div>
              ) : !rows.length ? (
                <p className="text-sm text-slate-500">暂无符合筛选的物料。</p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    显示 {Math.min(limit, rows.length)} / {rows.length} 份
                  </p>
                  {rows.slice(0, limit).map((a) => (
                    <article
                      key={a.id}
                      className="space-y-3 rounded-xl border border-slate-200 p-4"
                    >
                      <h3 className="font-semibold break-words">{a.title}</h3>
                      <p className="text-sm text-slate-500">
                        {subjects[a.subject]} · {materialKindLabels[a.kind]} · 版本 {a.version}
                      </p>
                      <MaterialPreview asset={a} />
                      {(a.created_by === api.user?.id ||
                        api.user?.app_metadata.role === 'admin') && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={buttonClass}
                            disabled={busy}
                            onClick={() => setEditing(a)}
                          >
                            编辑信息
                          </button>
                          <button
                            className={buttonClass}
                            disabled={busy}
                            onClick={() => setArchive(a.id)}
                          >
                            归档物料
                          </button>
                          {archive === a.id && (
                            <div className="w-full space-y-2 rounded-xl bg-amber-50 p-3 text-sm">
                              <p>归档“{a.title}”后不再用于新选择，已有引用仍可访问。</p>
                              <button
                                className={buttonClass}
                                disabled={busy}
                                onClick={() =>
                                  void work(async () => {
                                    await api.saveAsset({
                                      id: a.id,
                                      subject: a.subject,
                                      kind: a.kind,
                                      title: a.title,
                                      text_content: a.text_content,
                                      href: a.href,
                                      status: 'archived',
                                    })
                                    setArchive(null)
                                  })
                                }
                              >
                                确认归档
                              </button>{' '}
                              <button className={buttonClass} onClick={() => setArchive(null)}>
                                取消
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {limit < rows.length && (
                    <button className={buttonClass} onClick={() => setLimit((n) => n + 20)}>
                      加载更多
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

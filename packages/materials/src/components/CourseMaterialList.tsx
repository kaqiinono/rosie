'use client'
import { DirectoryImport } from './DirectoryImport'
import { useState } from 'react'
import { materialRoleLabels } from './labels'
import { useMaterialData } from '../useMaterialData'
import type { MaterialContent, MaterialScope, MaterialSubject } from '../types'
import { scopeMatchesContent } from '../resolution'
import { MaterialPicker } from './MaterialPicker'
import { MaterialPreview } from './MaterialPreview'
import { buttonClass, inputClass } from './styles'
export type MaterialCatalogProjection = {
  lessons: { key: string; title: string; book: string; unit: string }[]
  segments: { key: string; title: string }[]
  problems?: { stable_key: string; label: string; aliases?: string[] }[]
}
export function CourseMaterialList({
  courseId,
  subject,
  content,
  catalog,
}: {
  courseId: string
  subject: MaterialSubject
  content: MaterialContent | null
  catalog?: MaterialCatalogProjection
}) {
  const api = useMaterialData()
  const [scope, setScope] = useState<MaterialScope>({ kind: 'all' })
  const [ids, setIds] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [role, setRole] = useState('review')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const links = api.data.links.filter(
    (l) =>
      l.course_id === courseId &&
      (!filter || api.data.assets.find((a) => a.id === l.asset_id)?.title.includes(filter)),
  )
  const work = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  const groups = [
    { title: '课程通用物料', rows: links.filter((l) => l.scope.kind === 'all') },
    {
      title: '当前内容物料',
      rows: links.filter((l) => l.scope.kind !== 'all' && scopeMatchesContent(l.scope, content)),
    },
    {
      title: '其他内容物料',
      rows: links.filter((l) => l.scope.kind !== 'all' && !scopeMatchesContent(l.scope, content)),
    },
  ]
  return (
    <section className="space-y-3">
      <h3 className="font-bold">共享课程物料</h3>
      <DirectoryImport
        courses={[
          {
            id: courseId,
            title: '当前课程',
            subject,
            catalog: catalog ?? { lessons: [], segments: [] },
          },
        ]}
      />
      <label className="block text-sm">
        筛选关联物料
        <input className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      {filter && (
        <button type="button" className={buttonClass} onClick={() => setFilter('')}>
          清除筛选
        </button>
      )}
      {api.isLoading && <p role="status">正在读取…</p>}
      {!!(api.error || error) && (
        <p role="alert">{error || '物料读取失败，请在共享库刷新后重试'}</p>
      )}
      {groups.map((g) => (
        <div key={g.title} className="space-y-2">
          <h4 className="text-sm font-semibold">
            {g.title} · {g.rows.length}
          </h4>
          {!g.rows.length && <p className="text-sm text-slate-500">暂无关联</p>}
          {g.rows.map((l) => {
            const asset = api.data.assets.find((a) => a.id === l.asset_id)
            return (
              <div key={l.id} className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
                <p>
                  {asset?.title ?? '物料暂不可用'} · {materialRoleLabels[l.role] ?? l.role}
                  {asset?.status === 'archived' ? ' · 已归档（保留引用）' : ''}
                </p>
                {asset?.source === 'baidu' && asset.path && (
                  <p className="text-xs break-all">
                    原目录：{asset.path.slice(0, asset.path.lastIndexOf('/'))} ·{' '}
                    {asset.status === 'account_mismatch'
                      ? '授权账户已更换（保留引用）'
                      : asset.status === 'pending'
                        ? '文件尚未就绪'
                        : ''}
                  </p>
                )}
                {asset?.source === 'baidu' &&
                  asset.path &&
                  /^\/airosie\/(english|chinese|math)(\/|$)/.test(asset.path) && (
                    <a
                      className="text-emerald-800 underline"
                      href={
                        '/materials?' +
                        new URLSearchParams({
                          root: asset.path.split('/')[2],
                          directory: asset.path.split('/').slice(3, -1).join('/'),
                          course: courseId,
                        }).toString()
                      }
                    >
                      定位原目录
                    </a>
                  )}
                {asset && <MaterialPreview asset={asset} />}
                <button
                  disabled={busy}
                  type="button"
                  className={buttonClass}
                  onClick={() => void work(() => api.unlinkCourseMaterial(l.id))}
                >
                  解除关联
                </button>
              </div>
            )
          })}
        </div>
      ))}
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold">关联共享物料</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            关联范围
            <select
              className={inputClass}
              value={scope.kind}
              onChange={(e) =>
                setScope(
                  e.target.value === 'all'
                    ? { kind: 'all' }
                    : e.target.value === 'unit'
                      ? { kind: 'unit', book: '', unit: '' }
                      : e.target.value === 'lessons'
                        ? { kind: 'lessons', lesson_keys: [] }
                        : e.target.value === 'segments'
                          ? { kind: 'segments', segment_keys: [] }
                          : { kind: 'problems', problem_keys: [] },
                )
              }
            >
              <option value="all">课程通用</option>
              <option value="unit">书册 / 单元</option>
              <option value="lessons">课文 / Lesson / 讲次</option>
              <option value="segments">教学段</option>
              <option value="problems">真实数学题目</option>
            </select>
          </label>
          {scope.kind === 'unit' && (
            <label className="block text-sm">
              选择单元
              <select
                className={inputClass}
                value={JSON.stringify([scope.book, scope.unit])}
                onChange={(e) => {
                  const [book, unit] = JSON.parse(e.target.value) as string[]
                  setScope({ kind: 'unit', book, unit })
                }}
              >
                <option value='["",""]'>请选择</option>
                {[
                  ...new Map(
                    (catalog?.lessons ?? []).map((l) => [JSON.stringify([l.book, l.unit]), l]),
                  ).entries(),
                ].map(([key, l]) => (
                  <option key={key} value={key}>
                    {l.book} · {l.unit}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope.kind === 'lessons' &&
            (catalog?.lessons ?? []).map((l) => (
              <label key={l.key} className="block text-sm">
                <input
                  type="checkbox"
                  checked={scope.lesson_keys.includes(l.key)}
                  onChange={(e) =>
                    setScope({
                      kind: 'lessons',
                      lesson_keys: e.target.checked
                        ? [...scope.lesson_keys, l.key]
                        : scope.lesson_keys.filter((k) => k !== l.key),
                    })
                  }
                />
                {l.book} · {l.unit} · {l.title}
              </label>
            ))}
          {scope.kind === 'segments' &&
            (catalog?.segments ?? []).map((s) => (
              <label key={s.key} className="block text-sm">
                <input
                  type="checkbox"
                  checked={scope.segment_keys.includes(s.key)}
                  onChange={(e) =>
                    setScope({
                      kind: 'segments',
                      segment_keys: e.target.checked
                        ? [...scope.segment_keys, s.key]
                        : scope.segment_keys.filter((k) => k !== s.key),
                    })
                  }
                />
                {s.title}
              </label>
            ))}
          {scope.kind === 'problems' &&
            (!catalog?.problems?.length ? (
              <p className="text-sm text-amber-800">
                当前内容尚无可关联的真实题目。请选择含题目的教学段。
              </p>
            ) : (
              catalog.problems.map((p) => (
                <label key={p.stable_key} className="block text-sm">
                  <input
                    type="checkbox"
                    checked={scope.problem_keys.includes(p.stable_key)}
                    onChange={(e) =>
                      setScope({
                        kind: 'problems',
                        problem_keys: e.target.checked
                          ? [...scope.problem_keys, p.stable_key]
                          : scope.problem_keys.filter((k) => k !== p.stable_key),
                      })
                    }
                  />
                  {p.label}
                </label>
              ))
            ))}
          <label className="block text-sm">
            用途
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="preview">预习</option>
              <option value="review">复习</option>
              <option value="dictation">听记</option>
              <option value="general">通用</option>
            </select>
          </label>
          <MaterialPicker
            subject={subject}
            value={{ kind: 'assets', asset_ids: ids }}
            onChange={(v) => setIds(v.kind === 'assets' ? v.asset_ids : [])}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !ids.length}
            className={buttonClass}
            onClick={() =>
              void work(async () => {
                await api.linkCourseMaterials(
                  courseId,
                  ids.map((asset_id, sort_order) => ({ asset_id, scope, role, sort_order })),
                )
                setIds([])
              })
            }
          >
            {busy ? '保存中…' : '保存关联'}
          </button>
        </div>
      </details>
    </section>
  )
}

'use client'
import { useState } from 'react'
import { materialKindLabels } from './labels'
import { useMaterialData } from '../useMaterialData'
import type { AssetSelector, MaterialSubject } from '../types'
import { buttonClass, inputClass } from './styles'
export function MaterialPicker({
  subject,
  value,
  onChange,
  disabled = false,
}: {
  subject: MaterialSubject
  value: AssetSelector
  onChange: (v: AssetSelector) => void
  disabled?: boolean
}) {
  const api = useMaterialData()
  const [all, setAll] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)
  const rows = api.listAssets({ subject: all ? undefined : subject, query })
  const ids = value.kind === 'assets' ? value.asset_ids : []
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-semibold">从共享库选择（{ids.length} 份）</legend>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => {
            setAll(e.target.checked)
            setLimit(20)
          }}
        />{' '}
        显示其他科目
      </label>
      <label className="block text-sm">
        查找物料
        <input
          className={inputClass}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(20)
          }}
        />
      </label>
      {query && (
        <button type="button" className={buttonClass} onClick={() => setQuery('')}>
          清除查找
        </button>
      )}
      {api.isLoading ? (
        <p role="status">正在读取物料…</p>
      ) : api.error ? (
        <p role="alert">
          物料读取失败。
          <button type="button" className={buttonClass} onClick={() => void api.refresh()}>
            重试
          </button>
        </p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500">没有可选物料。可在共享物料库添加文本或链接。</p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {rows.slice(0, limit).map((a) => (
            <label key={a.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={ids.includes(a.id)}
                onChange={(e) =>
                  onChange({
                    kind: 'assets',
                    asset_ids: e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id),
                  })
                }
              />
              {a.title} · {materialKindLabels[a.kind]}
            </label>
          ))}
        </div>
      )}
      {rows.length > limit && (
        <button type="button" className={buttonClass} onClick={() => setLimit((n) => n + 20)}>
          加载更多
        </button>
      )}
      <a className="text-sm text-emerald-800 underline" href="/materials">
        管理共享物料
      </a>
    </fieldset>
  )
}

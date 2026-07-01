'use client'

import { useState } from 'react'
import type { ChineseCharProfile, CharEntryPatch } from '@rosie/chinese'

type Props = {
  char: ChineseCharProfile
  onCancel: () => void
  onSubmit: (patch: CharEntryPatch) => Promise<void>
}

const STRUCTURE_OPTIONS = ['上下', '左右', '独体', '半包围', '全包围', '上中下'] as const
const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'
const inputCls =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-amber-400 focus:outline-none'

function splitList(raw: string): string[] {
  return raw
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ChineseCharFormModal({ char, onCancel, onSubmit }: Props) {
  const [pinyin, setPinyin] = useState(char.pinyin)
  const [pinyinAlt, setPinyinAlt] = useState(char.pinyinAlt.join(', '))
  const [radical, setRadical] = useState(char.radical)
  const [radicalName, setRadicalName] = useState(char.radicalName)
  const [structure, setStructure] = useState(char.structure)
  const [phrases, setPhrases] = useState(char.phrases.join(' '))
  const [recognize, setRecognize] = useState(char.tiers.includes('recognize'))
  const [write, setWrite] = useState(char.tiers.includes('write'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!radical.trim() || !radicalName.trim() || !structure.trim()) {
      setError('部首、部首名称与结构不能为空')
      return
    }
    const tiers: ('recognize' | 'write')[] = []
    if (recognize) tiers.push('recognize')
    if (write) tiers.push('write')
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        pinyin: pinyin.trim(),
        pinyinAlt: splitList(pinyinAlt),
        radical: radical.trim(),
        radicalName: radicalName.trim(),
        structure: structure.trim(),
        phrases: splitList(phrases),
        tiers,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-slate-800">
          编辑生字 · <span className="text-2xl">{char.char}</span>
        </h2>
        <p className="mt-1 text-xs text-slate-400">{char.charKey}</p>
        <p className="mt-2 text-[11px] text-slate-400">
          笔顺数据请用 <code className="rounded bg-slate-100 px-1">pnpm --filter @rosie/chinese generate-sql</code>{' '}
          更新后重新导入
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={labelCls}>拼音</span>
            <input className={inputCls} value={pinyin} onChange={(e) => setPinyin(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>备用拼音（逗号分隔）</span>
            <input className={inputCls} value={pinyinAlt} onChange={(e) => setPinyinAlt(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>部首</span>
              <input className={inputCls} value={radical} onChange={(e) => setRadical(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>部首名称</span>
              <input className={inputCls} value={radicalName} onChange={(e) => setRadicalName(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>结构</span>
            <select
              className={inputCls}
              value={structure}
              onChange={(e) => setStructure(e.target.value)}
            >
              {STRUCTURE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>组词（空格或逗号分隔）</span>
            <input className={inputCls} value={phrases} onChange={(e) => setPhrases(e.target.value)} />
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={recognize} onChange={(e) => setRecognize(e.target.checked)} />
              认读
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
              会写
            </label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

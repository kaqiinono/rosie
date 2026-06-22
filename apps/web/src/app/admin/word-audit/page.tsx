'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SAMPLE_WORDS, SYLLABLE_MAP, KW_MAP, CHINESE_DEF_MAP } from '@/utils/english-data'
import type { WordEntry } from '@/utils/type'

type DbRow = {
  stage: string | null
  unit: string
  lesson: string
  word: string
  explanation: string | null
  chinese_def: string | null
  ipa: string | null
  example: string | null
  phonics: string | null
  syllables: string[] | null
  keywords: [string, string][] | null
}

type FieldGap = {
  key: string
  word: string
  stage: string
  unit: string
  lesson: string
  fields: string[]
}

type Report = {
  fileTotal: number
  dbTotal: number
  fileByStage: Record<string, number>
  dbByStage: Record<string, number>
  missingInDb: WordEntry[]
  extraInDb: DbRow[]
  fieldGaps: FieldGap[]
  mapStats: {
    chineseDefMap: number
    syllableMap: number
    kwMap: number
  }
}

function keyOf(w: { stage?: string | null; unit: string; lesson: string; word: string }) {
  return `${w.stage ?? ''}::${w.unit}::${w.lesson}::${w.word}`
}

export default function WordAuditPage() {
  const { user } = useAuth()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const all: DbRow[] = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data, error: qErr } = await supabase
          .from('word_entries')
          .select('stage, unit, lesson, word, explanation, chinese_def, ipa, example, phonics, syllables, keywords')
          .range(from, from + pageSize - 1)
        if (qErr) throw qErr
        if (!data || data.length === 0) break
        all.push(...(data as DbRow[]))
        if (data.length < pageSize) break
        from += pageSize
      }

      const dbMap = new Map<string, DbRow>()
      for (const r of all) {
        dbMap.set(keyOf({ stage: r.stage, unit: r.unit, lesson: r.lesson, word: r.word }), r)
      }

      const fileMap = new Map<string, WordEntry>()
      for (const w of SAMPLE_WORDS) fileMap.set(keyOf(w), w)

      const fileByStage: Record<string, number> = {}
      for (const w of SAMPLE_WORDS) {
        const s = w.stage ?? '(none)'
        fileByStage[s] = (fileByStage[s] ?? 0) + 1
      }
      const dbByStage: Record<string, number> = {}
      for (const r of all) {
        const s = r.stage ?? '(none)'
        dbByStage[s] = (dbByStage[s] ?? 0) + 1
      }

      const missingInDb: WordEntry[] = []
      const fieldGaps: FieldGap[] = []
      for (const w of SAMPLE_WORDS) {
        const k = keyOf(w)
        const row = dbMap.get(k)
        if (!row) {
          missingInDb.push(w)
          continue
        }
        const gaps: string[] = []
        if (w.chineseDef && !row.chinese_def) gaps.push('chinese_def')
        if (w.ipa && !row.ipa) gaps.push('ipa')
        if (w.example && !row.example) gaps.push('example')
        if (w.explanation && !row.explanation) gaps.push('explanation')
        if (w.syllables && w.syllables.length > 0 && (!row.syllables || row.syllables.length === 0)) gaps.push('syllables')
        if (w.keywords && w.keywords.length > 0 && (!row.keywords || row.keywords.length === 0)) gaps.push('keywords')
        if (w.phonics && !row.phonics) gaps.push('phonics')
        if (gaps.length > 0) {
          fieldGaps.push({
            key: k,
            word: w.word,
            stage: w.stage ?? '',
            unit: w.unit,
            lesson: w.lesson,
            fields: gaps,
          })
        }
      }

      const extraInDb: DbRow[] = []
      for (const r of all) {
        const k = keyOf({ stage: r.stage, unit: r.unit, lesson: r.lesson, word: r.word })
        if (!fileMap.has(k)) extraInDb.push(r)
      }

      setReport({
        fileTotal: SAMPLE_WORDS.length,
        dbTotal: all.length,
        fileByStage,
        dbByStage,
        missingInDb,
        extraInDb,
        fieldGaps,
        mapStats: {
          chineseDefMap: Object.keys(CHINESE_DEF_MAP).length,
          syllableMap: Object.keys(SYLLABLE_MAP).length,
          kwMap: Object.keys(KW_MAP).length,
        },
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const downloadMissing = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report.missingInDb, null, 2)], { type: 'application/json' })
    triggerDownload(blob, 'missing-in-db.json')
  }

  const downloadGaps = () => {
    if (!report) return
    const payload = report.fieldGaps.map((g) => {
      const w = SAMPLE_WORDS.find((sw) => keyOf(sw) === g.key)
      return { ...g, fileValues: w }
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    triggerDownload(blob, 'field-gaps.json')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">请先登录后访问</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📊 单词数据对账</h1>
          <Link href="/" className="text-sm text-slate-500 hover:underline">← 返回首页</Link>
        </div>

        <div className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm">
          对比 <code className="rounded bg-slate-100 px-1.5 py-0.5">src/utils/english-data.ts</code>（SAMPLE_WORDS 合并 CHINESE_DEF_MAP / SYLLABLE_MAP / KW_MAP）
          与 Supabase <code className="rounded bg-slate-100 px-1.5 py-0.5">word_entries</code> 表，找出 DB 缺失或字段不全的数据。
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '对账中...' : '🔍 开始对账'}
        </button>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            出错：{error}
          </div>
        )}

        {report && (
          <div className="space-y-5">
            <Section title="总览">
              <KV k="文件总词数 (SAMPLE_WORDS)" v={report.fileTotal} />
              <KV k="DB 总行数 (word_entries)" v={report.dbTotal} />
              <KV k="CHINESE_DEF_MAP 条目" v={report.mapStats.chineseDefMap} />
              <KV k="SYLLABLE_MAP 条目" v={report.mapStats.syllableMap} />
              <KV k="KW_MAP 条目" v={report.mapStats.kwMap} />
            </Section>

            <Section title="按 stage 分布">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-2 text-left">Stage</th>
                    <th className="p-2 text-right">文件</th>
                    <th className="p-2 text-right">DB</th>
                    <th className="p-2 text-right">差 (DB - 文件)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set([...Object.keys(report.fileByStage), ...Object.keys(report.dbByStage)])).sort().map((s) => {
                    const f = report.fileByStage[s] ?? 0
                    const d = report.dbByStage[s] ?? 0
                    const diff = d - f
                    return (
                      <tr key={s} className={diff !== 0 ? 'bg-yellow-50' : ''}>
                        <td className="p-2 font-mono">{s}</td>
                        <td className="p-2 text-right">{f}</td>
                        <td className="p-2 text-right">{d}</td>
                        <td className={`p-2 text-right font-mono ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={`DB 缺失行（文件有 → DB 没有）：${report.missingInDb.length}`}>
              {report.missingInDb.length === 0 ? (
                <p className="text-green-600">✅ 无</p>
              ) : (
                <>
                  <button onClick={downloadMissing} className="mb-3 rounded bg-slate-200 px-3 py-1 text-xs hover:bg-slate-300">
                    下载完整列表 JSON
                  </button>
                  <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                    {report.missingInDb.slice(0, 50).map((w) => (
                      <li key={keyOf(w)} className="font-mono text-xs">
                        {w.stage} / {w.unit} / {w.lesson} / <b>{w.word}</b>
                      </li>
                    ))}
                    {report.missingInDb.length > 50 && (
                      <li className="text-slate-500">... 共 {report.missingInDb.length} 条，仅显示前 50</li>
                    )}
                  </ul>
                </>
              )}
            </Section>

            <Section title={`DB 多余行（DB 有 → 文件没有；可能是 Excel 导入）：${report.extraInDb.length}`}>
              {report.extraInDb.length === 0 ? (
                <p className="text-green-600">✅ 无</p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                  {report.extraInDb.slice(0, 50).map((r) => (
                    <li
                      key={keyOf({ stage: r.stage, unit: r.unit, lesson: r.lesson, word: r.word })}
                      className="font-mono text-xs"
                    >
                      {r.stage ?? '(无)'} / {r.unit} / {r.lesson} / <b>{r.word}</b>
                    </li>
                  ))}
                  {report.extraInDb.length > 50 && (
                    <li className="text-slate-500">... 共 {report.extraInDb.length} 条，仅显示前 50</li>
                  )}
                </ul>
              )}
            </Section>

            <Section title={`字段缺失（DB 行存在但字段为 null/空）：${report.fieldGaps.length}`}>
              {report.fieldGaps.length === 0 ? (
                <p className="text-green-600">✅ 所有字段对齐</p>
              ) : (
                <>
                  <FieldGapSummary gaps={report.fieldGaps} />
                  <button onClick={downloadGaps} className="mb-3 mt-3 rounded bg-slate-200 px-3 py-1 text-xs hover:bg-slate-300">
                    下载完整列表 JSON（含文件中的正确值）
                  </button>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-slate-500">展开示例（前 100 条）</summary>
                    <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm">
                      {report.fieldGaps.slice(0, 100).map((g) => (
                        <li key={g.key} className="font-mono text-xs">
                          {g.stage} / {g.unit} / {g.lesson} / <b>{g.word}</b>
                          <span className="ml-2 text-amber-600">缺: {g.fields.join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function KV({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <span className="text-slate-600">{k}</span>
      <span className="font-mono">{v.toLocaleString()}</span>
    </div>
  )
}

function FieldGapSummary({ gaps }: { gaps: FieldGap[] }) {
  const byField: Record<string, number> = {}
  for (const g of gaps) {
    for (const f of g.fields) byField[f] = (byField[f] ?? 0) + 1
  }
  return (
    <ul className="space-y-1 text-sm">
      {Object.entries(byField)
        .sort((a, b) => b[1] - a[1])
        .map(([f, n]) => (
          <li key={f} className="flex justify-between border-b border-slate-100 py-1">
            <span className="font-mono text-amber-700">{f}</span>
            <span className="font-mono">{n} 条</span>
          </li>
        ))}
    </ul>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

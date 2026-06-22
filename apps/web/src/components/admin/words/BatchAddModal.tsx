'use client'

import { useCallback, useMemo, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { parseWordRows, WORD_TEMPLATE_HEADERS } from '@rosie/english'

type Props = {
  /** Current active 词库; pasted rows without a stage are backfilled with it. */
  defaultStage: string
  onCancel: () => void
  onConfirm: (words: WordEntry[]) => Promise<void>
}

type Tab = 'excel' | 'paste'

const tabBtn = (active: boolean) =>
  `flex-1 cursor-pointer rounded-lg py-2 text-[13px] font-extrabold transition ${
    active ? 'text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
  }`

export default function BatchAddModal({ defaultStage, onCancel, onConfirm }: Props) {
  const [tab, setTab] = useState<Tab>('excel')
  const [parsed, setParsed] = useState<WordEntry[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [status, setStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setStatus({ type: 'info', text: '⏳ 正在解析文件…' })
    try {
      const xlsx = await import('xlsx')
      const { read, utils } = xlsx.default || xlsx
      const buf = await file.arrayBuffer()
      const wb = read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })
      const words = parseWordRows(rows, { hasHeader: true, hasStageColumn: true, defaultStage })
      if (!words.length) {
        setParsed(null)
        setStatus({ type: 'error', text: '❌ 未解析到有效单词（需 Stage/Unit/Lesson/单词 列）' })
        return
      }
      setParsed(words)
      setStatus(null)
    } catch (err) {
      setParsed(null)
      setStatus({ type: 'error', text: `❌ 解析失败：${err instanceof Error ? err.message : '未知错误'}` })
    }
  }, [defaultStage])

  const parsePaste = useCallback(() => {
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean)
    // 含 Tab 的按 Tab 分列（从表格复制最稳，单元格内逗号不会误拆），否则退回逗号
    const rows: unknown[][] = lines.map((line) =>
      (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim()),
    )
    const words = parseWordRows(rows, { hasHeader: false, hasStageColumn: false, defaultStage })
    if (!words.length) {
      setParsed(null)
      setStatus({ type: 'error', text: '❌ 未解析到有效行（每行至少需要 单元 / 课次 / 单词 三列）' })
      return
    }
    setParsed(words)
    setStatus(null)
  }, [pasteText, defaultStage])

  const downloadTemplate = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const sample = [
      [defaultStage || '4B', 'Unit 1', 'Lesson 1', 'apple', 'a round fruit', '苹果', '/ˈæpəl/', 'I eat an apple.', 'a-pp-le', 'ap, ple', 'round|red; fruit|gold'],
    ]
    const ws = utils.aoa_to_sheet([WORD_TEMPLATE_HEADERS, ...sample])
    ws['!cols'] = [
      { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 34 }, { wch: 14 },
      { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 34 },
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库模版.xlsx')
  }, [defaultStage])

  const handleConfirm = useCallback(async () => {
    if (!parsed?.length || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(parsed)
    } finally {
      setSubmitting(false)
    }
  }, [parsed, submitting, onConfirm])

  const stageSummary = useMemo(() => {
    if (!parsed) return ''
    const stages = [...new Set(parsed.map((w) => w.stage || '(无)'))]
    const units = new Set(parsed.map((w) => w.unit)).size
    return `${parsed.length} 个单词 · ${units} 个 Unit · 词库：${stages.join(', ')}`
  }, [parsed])

  const resetParsed = () => {
    setParsed(null)
    setStatus(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-[16px] font-extrabold text-slate-800">批量添加单词</h3>
          <span className="text-[11px] text-slate-400">追加 / 更新，不会清空词库</span>
        </div>
        <p className="mb-4 text-[12px] text-slate-500">
          相同 单词+单元+课次+词库 会被覆盖更新；其余单词保持不变。
        </p>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setTab('excel'); resetParsed() }}
            className={tabBtn(tab === 'excel')}
            style={tab === 'excel' ? { background: 'linear-gradient(135deg,#f59e0b,#b45309)' } : undefined}
          >
            上传 Excel
          </button>
          <button
            type="button"
            onClick={() => { setTab('paste'); resetParsed() }}
            className={tabBtn(tab === 'paste')}
            style={tab === 'paste' ? { background: 'linear-gradient(135deg,#f59e0b,#b45309)' } : undefined}
          >
            粘贴文本
          </button>
        </div>

        {tab === 'excel' ? (
          <div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="mb-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-bold text-slate-600 transition hover:bg-slate-100"
            >
              ⬇ 下载 Excel 模版
            </button>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-5 py-8 text-center transition hover:border-amber-400 hover:bg-amber-50/40"
            >
              {fileName ? (
                <div className="text-[14px] font-bold text-slate-700">📄 {fileName}</div>
              ) : (
                <>
                  <div className="mb-1 text-[28px]">📂</div>
                  <div className="text-[13px] font-bold text-slate-500">点击选择 .xlsx 文件</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">列顺序：Stage / Unit / Lesson / 单词 / 英文释义 / 中文释义 / 音标 / 例句 / phonics / 音节 / 关键词高亮</div>
                </>
              )}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) processFile(f)
                }}
              />
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-[12px] text-slate-500">
              每行一个单词，推荐从表格直接复制（Tab 分隔，单元格内逗号不会误拆）。列顺序：
              <span className="font-bold">单元 · 课次 · 单词 · 英文释义 · 中文释义 · 音标 · 例句 · phonics · 音节 · 关键词高亮</span>
              （靠后的列可留空；词库默认 = {defaultStage || '未选'}）
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder={'Unit 1\tLesson 1\tapple\ta round fruit\t苹果\t/ˈæpəl/\tI eat an apple.\ta-pp-le\tap, ple\tround|red\nUnit 1\tLesson 1\tbanana\ta long yellow fruit\t香蕉\t/bəˈnɑːnə/\tI like bananas.'}
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 font-mono text-[12px] focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={parsePaste}
              disabled={!pasteText.trim()}
              className="mt-2 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-extrabold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              解析预览
            </button>
          </div>
        )}

        {status && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-[12px] font-bold ${
              status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {status.text}
          </div>
        )}

        {parsed && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700">
            ✅ 解析成功：{stageSummary}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!parsed?.length || submitting}
            className="flex-[2] cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', boxShadow: '0 3px 12px rgba(245,158,11,0.4)' }}
          >
            {submitting ? '写入中…' : parsed ? `确认添加 ${parsed.length} 个` : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

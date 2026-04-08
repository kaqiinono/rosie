'use client'

import { useState, useCallback } from 'react'
import type { WordEntry } from '@/utils/type'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (words: WordEntry[]) => void
  onAppend: (words: WordEntry[]) => void
}

export default function ImportModal({ open, onClose, onImport, onAppend }: ImportModalProps) {
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(
    null,
  )
  const [importedVocab, setImportedVocab] = useState<WordEntry[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dzHover, setDzHover] = useState(false)

  const resetState = useCallback(() => {
    setStatus(null)
    setImportedVocab(null)
    setFileName(null)
    setDzHover(false)
  }, [])

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setStatus({ type: 'info', text: '⏳ 正在解析文件…' })

    try {
      const xlsx = await import('xlsx')
      const { read, utils } = xlsx.default || xlsx
      const data = await file.arrayBuffer()
      const wb = read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })

      const vocab: WordEntry[] = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const stage = String(r[0] || '').trim()
        const unit = String(r[1] || '').trim()
        const lesson = String(r[2] || '').trim()
        const word = String(r[3] || '').trim()
        if (!unit || !lesson || !word) continue
        vocab.push({
          stage: stage || undefined,
          unit,
          lesson,
          word,
          explanation: String(r[4] || '').trim(),
          ipa: String(r[5] || '').trim(),
          example: String(r[6] || '').trim(),
        })
      }

      if (!vocab.length) {
        setStatus({
          type: 'error',
          text: '❌ 未找到有效单词，请检查格式（需要 Stage/Unit/Lesson/单词 列）',
        })
        return
      }

      setImportedVocab(vocab)
      const stageSet = new Set(vocab.map(v => v.stage).filter(Boolean))
      const unitCount = new Set(vocab.map(v => v.unit)).size
      setStatus({
        type: 'success',
        text: `✅ 解析成功！Stage: ${[...stageSet].join(', ')} · ${vocab.length} 个单词 · ${unitCount} 个 Unit`,
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: `❌ 文件解析失败：${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDzHover(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleImport = useCallback(() => {
    if (importedVocab) { onImport(importedVocab); resetState(); onClose() }
  }, [importedVocab, onImport, resetState, onClose])

  const handleAppend = useCallback(() => {
    if (importedVocab) { onAppend(importedVocab); resetState(); onClose() }
  }, [importedVocab, onAppend, resetState, onClose])

  const handleClose = useCallback(() => { resetState(); onClose() }, [resetState, onClose])

  const downloadTemplate = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const headers = ['Stage', 'Unit', 'Lesson', '单词 (word)', '释义 (explanation)', '音标 (ipa)', '例句 (example)']
    const sample = [
      ['4B', 'Unit 1', 'Lesson 1', 'example word', 'an example meaning', '/ɪɡˈzɑːmpl/', 'This is an example sentence.'],
    ]
    const ws = utils.aoa_to_sheet([headers, ...sample])
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 50 }]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库模版.xlsx')
  }, [])

  if (!open) return null

  const statusColors = {
    info: 'bg-[rgba(96,165,250,.12)] text-[#93c5fd]',
    success: 'bg-[rgba(74,222,128,.12)] text-[#4ade80]',
    error: 'bg-[rgba(248,113,113,.12)] text-[#fca5a5]',
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-[90%] max-w-[540px] rounded-[20px] border border-white/[.12] bg-[#1a1a2e] p-8">
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-4 cursor-pointer border-0 bg-transparent text-[1.2rem] text-white/40"
        >
          ✕
        </button>
        <div className="font-fredoka mb-1 bg-gradient-to-br from-[#4ade80] to-[#22c55e] bg-clip-text text-[1.3rem] text-transparent">
          📥 导入单词表
        </div>
        <div className="mb-1 text-[.8rem] text-white/40">
          列顺序：Stage / Unit / Lesson / 单词 / 释义 / 音标 / 例句
        </div>
        <button
          onClick={downloadTemplate}
          className="font-nunito mb-4 cursor-pointer rounded-lg border border-white/[.12] bg-white/[.05] px-3 py-1 text-[.75rem] font-bold text-white/50 transition-all hover:border-[#4ade80]/50 hover:text-[#4ade80]"
        >
          ⬇ 下载 Excel 模版
        </button>

        <div
          onClick={() => document.getElementById('import-file-input')?.click()}
          onDragOver={(e) => { e.preventDefault(); setDzHover(true) }}
          onDragLeave={() => setDzHover(false)}
          onDrop={handleDrop}
          className={`mb-4 cursor-pointer rounded-[14px] border-2 border-dashed px-5 py-9 text-center transition-all ${
            dzHover ? 'border-[#4ade80] bg-[rgba(74,222,128,.06)]' : 'border-white/[.15]'
          }`}
        >
          {fileName ? (
            <div className="text-[1.1rem] font-bold text-white/70">📄 {fileName}</div>
          ) : (
            <>
              <div className="mb-2.5 text-[2.2rem]">📂</div>
              <div className="mb-1 font-bold text-white/60">点击选择文件，或拖拽到这里</div>
              <div className="text-[.75rem] text-white/[.28]">.xlsx 格式</div>
            </>
          )}
        </div>
        <input
          id="import-file-input"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />

        {status && (
          <div className={`mb-3.5 rounded-[10px] p-3 px-4 text-[1rem] font-bold ${statusColors[status.type]}`}>
            {status.text}
          </div>
        )}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={handleClose}
            className="font-nunito cursor-pointer rounded-[10px] border-[1.5px] border-white/[.15] bg-transparent px-5 py-2.5 text-[1rem] font-bold text-white/50"
          >
            取消
          </button>
          {importedVocab && (
            <>
              <button
                onClick={handleAppend}
                className="font-nunito cursor-pointer rounded-[10px] border-[1.5px] border-[#a855f7]/60 bg-transparent px-5 py-2.5 text-[1rem] font-bold text-[#c084fc] transition-all hover:bg-[rgba(168,85,247,.1)]"
              >
                + 按Stage追加
              </button>
              <button
                onClick={handleImport}
                className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#16a34a] to-[#4ade80] px-6 py-2.5 text-[1rem] font-extrabold text-white"
              >
                替换全部
              </button>
            </>
          )}
        </div>

        <div className="mt-3.5 rounded-[10px] bg-white/[.04] p-3 text-[.72rem] text-white/30">
          <span className="font-bold text-[#c084fc]">+ 按Stage追加</span>：删除同 Stage 的旧数据并写入新数据，其他 Stage 不受影响
          <span className="mx-2 opacity-40">·</span>
          <span className="font-bold text-[#4ade80]">替换全部</span>：清空所有数据后写入
        </div>
      </div>
    </div>
  )
}

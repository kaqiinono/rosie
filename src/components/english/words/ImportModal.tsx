'use client'

import { useState, useCallback } from 'react'
import type { WordEntry } from '@/utils/type'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (words: WordEntry[]) => void
}

export default function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)
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
        const unit = String(r[0] || '').trim()
        const lesson = String(r[1] || '').trim()
        const word = String(r[2] || '').trim()
        if (!unit || !lesson || !word) continue
        vocab.push({
          unit, lesson, word,
          explanation: String(r[3] || '').trim(),
          ipa: String(r[4] || '').trim(),
          example: String(r[5] || '').trim(),
        })
      }

      if (!vocab.length) {
        setStatus({ type: 'error', text: '❌ 未找到有效单词，请检查文件格式（需要 Unit/Lesson/单词 三列）' })
        return
      }

      setImportedVocab(vocab)
      const unitCount = new Set(vocab.map(v => v.unit)).size
      setStatus({ type: 'success', text: `✅ 解析成功！共 ${vocab.length} 个单词，来自 ${unitCount} 个 Unit` })
    } catch (err) {
      setStatus({ type: 'error', text: `❌ 文件解析失败：${err instanceof Error ? err.message : 'Unknown error'}` })
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDzHover(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleConfirm = useCallback(() => {
    if (importedVocab) {
      onImport(importedVocab)
      resetState()
      onClose()
    }
  }, [importedVocab, onImport, resetState, onClose])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  if (!open) return null

  const statusColors = {
    info: 'bg-[rgba(96,165,250,.12)] text-[#93c5fd]',
    success: 'bg-[rgba(74,222,128,.12)] text-[#4ade80]',
    error: 'bg-[rgba(248,113,113,.12)] text-[#fca5a5]',
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#1a1a2e] border border-white/[.12] rounded-[20px] p-8 max-w-[520px] w-[90%] relative">
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-4 bg-transparent border-0 text-white/40 text-[1.2rem] cursor-pointer"
        >
          ✕
        </button>
        <div className="font-fredoka text-[1.3rem] bg-gradient-to-br from-[#4ade80] to-[#22c55e] bg-clip-text text-transparent mb-1.5">
          📥 导入单词表
        </div>
        <div className="text-[.8rem] text-white/40 mb-5">
          支持 .xlsx 格式，列顺序：Unit / Lesson / 单词 / 释义 / 音标 / 例句
        </div>

        <div
          onClick={() => document.getElementById('import-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); setDzHover(true) }}
          onDragLeave={() => setDzHover(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-[14px] px-5 py-9 text-center cursor-pointer transition-all mb-4 ${
            dzHover ? 'border-[#4ade80] bg-[rgba(74,222,128,.06)]' : 'border-white/[.15]'
          }`}
        >
          {fileName ? (
            <div className="text-[1.1rem] font-bold text-white/70">📄 {fileName}</div>
          ) : (
            <>
              <div className="text-[2.2rem] mb-2.5">📂</div>
              <div className="font-bold text-white/60 mb-1">点击选择文件，或拖拽到这里</div>
              <div className="text-[.75rem] text-white/[.28]">.xlsx 格式</div>
            </>
          )}
        </div>
        <input
          id="import-file-input"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
          }}
        />

        {status && (
          <div className={`p-3 px-4 rounded-[10px] text-[.82rem] font-bold mb-3.5 ${statusColors[status.type]}`}>
            {status.text}
          </div>
        )}

        <div className="flex gap-2.5 justify-end">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 bg-transparent border-[1.5px] border-white/[.15] rounded-[10px] text-white/50 font-nunito font-bold text-[.82rem] cursor-pointer"
          >
            取消
          </button>
          {importedVocab && (
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-gradient-to-br from-[#16a34a] to-[#4ade80] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.82rem] cursor-pointer"
            >
              ✓ 确认导入
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

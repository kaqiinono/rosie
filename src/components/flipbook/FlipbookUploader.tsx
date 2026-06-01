'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import FlipbookUploadProgress, {
  flipbookOverallUploadPercent,
  type FlipbookProgressStep,
} from '@/components/flipbook/FlipbookUploadProgress'
import { flipbookTitleFromFiles } from '@/utils/flipbook-naming'
import { countPdfPages } from '@/utils/flipbook-pdf'
import { sortFlipbookPageImageFiles } from '@/utils/flipbook-page-images'
import { parseSyncManifest, validateManifestAgainstPageCount } from '@/utils/flipbook-sync'
import type { FlipbookCreateBookResult } from '@/hooks/useFlipbookBooks'
import type { FlipbookSyncManifest } from '@/utils/flipbook-types'

export type FlipbookCreateBookInput = {
  title: string
  description?: string
  pageCount?: number
  pdfFile?: File
  pageImageFiles?: File[]
  audioFile?: File
  syncManifest?: FlipbookSyncManifest | null
  batch?: boolean
  onPageRenderProgress?: (rendered: number, total: number) => void
  onPageUploadProgress?: (uploaded: number, total: number) => void
  onAudioUploadPhase?: (phase: 'start' | 'done') => void
}

type FlipbookUploaderProps = {
  onSubmit: (input: FlipbookCreateBookInput) => Promise<FlipbookCreateBookResult>
  onSessionStart?: () => void
}

type SourceMode = 'pdf' | 'images'

export default function FlipbookUploader({ onSubmit, onSessionStart }: FlipbookUploaderProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('pdf')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pageImageFiles, setPageImageFiles] = useState<File[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [syncFile, setSyncFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [parseDone, setParseDone] = useState(false)
  const [renderProgress, setRenderProgress] = useState<FlipbookProgressStep | null>(null)
  const [uploadProgress, setUploadProgress] = useState<FlipbookProgressStep | null>(null)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [saving, setSaving] = useState(false)
  const [titleTouched, setTitleTouched] = useState(false)

  const autoTitle = useMemo(
    () => flipbookTitleFromFiles({ audio: audioFile, sync: syncFile }),
    [audioFile, syncFile],
  )

  useEffect(() => {
    if (titleTouched) return
    if (autoTitle) setTitle(autoTitle)
  }, [autoTitle, titleTouched])

  const sortedPreview = useMemo(
    () => (pageImageFiles.length > 0 ? sortFlipbookPageImageFiles(pageImageFiles) : []),
    [pageImageFiles],
  )

  const overallPercent = useMemo(() => {
    if (!busy) return null
    return flipbookOverallUploadPercent({
      parseDone,
      render: renderProgress,
      upload: uploadProgress,
      audio: audioStatus,
      saving,
    })
  }, [busy, parseDone, renderProgress, uploadProgress, audioStatus, saving])

  const resetProgress = () => {
    setParseDone(false)
    setRenderProgress(null)
    setUploadProgress(null)
    setAudioStatus('idle')
    setSaving(false)
  }

  const switchMode = (mode: SourceMode) => {
    setSourceMode(mode)
    setPdfFile(null)
    setPageImageFiles([])
    setStatus(null)
    setTitleTouched(false)
    resetProgress()
  }

  const handleSubmit = useCallback(async () => {
    const resolvedTitle = flipbookTitleFromFiles({
      manual: title,
      audio: audioFile,
      sync: syncFile,
    })
    if (!resolvedTitle) {
      setStatus({ type: 'error', text: '请填写书名，或先选择讲解音频 / sync.json' })
      return
    }
    if (sourceMode === 'pdf' && !pdfFile) {
      setStatus({ type: 'error', text: '请选择 PDF 文件' })
      return
    }
    if (sourceMode === 'images' && pageImageFiles.length === 0) {
      setStatus({ type: 'error', text: '请至少选择一张页图' })
      return
    }

    onSessionStart?.()
    setBusy(true)
    resetProgress()

    try {
      let pageCount: number

      if (sourceMode === 'pdf' && pdfFile) {
        setStatus({ type: 'info', text: '正在解析 PDF 页数…' })
        const blobUrl = URL.createObjectURL(pdfFile)
        try {
          pageCount = await countPdfPages(blobUrl)
        } finally {
          URL.revokeObjectURL(blobUrl)
        }
      } else {
        pageCount = sortFlipbookPageImageFiles(pageImageFiles).length
        setStatus({ type: 'info', text: `已选 ${pageCount} 张页图，准备处理…` })
      }
      setParseDone(true)

      let syncManifest: FlipbookSyncManifest | null = null
      if (syncFile) {
        setStatus({ type: 'info', text: '正在校验 sync.json…' })
        const text = await syncFile.text()
        const parsed = parseSyncManifest(JSON.parse(text) as unknown)
        if (!parsed) {
          setStatus({ type: 'error', text: 'sync.json 格式无效' })
          resetProgress()
          setBusy(false)
          return
        }
        const err = validateManifestAgainstPageCount(parsed, pageCount)
        if (err) {
          setStatus({ type: 'error', text: err })
          resetProgress()
          setBusy(false)
          return
        }
        syncManifest = parsed
      }

      setRenderProgress({ current: 0, total: pageCount })
      setStatus({
        type: 'info',
        text:
          sourceMode === 'pdf'
            ? `正在生成 ${pageCount} 张页图…`
            : `正在处理 ${pageCount} 张页图…`,
      })

      const result = await onSubmit({
        title: resolvedTitle,
        description: description.trim() || undefined,
        pageCount: sourceMode === 'pdf' ? pageCount : undefined,
        pdfFile: sourceMode === 'pdf' ? (pdfFile ?? undefined) : undefined,
        pageImageFiles:
          sourceMode === 'images' ? sortFlipbookPageImageFiles(pageImageFiles) : undefined,
        audioFile: audioFile ?? undefined,
        syncManifest,
        onPageRenderProgress: (rendered, total) => {
          setRenderProgress({ current: rendered, total })
          setStatus({
            type: 'info',
            text:
              rendered >= total
                ? `页图处理完成（${total} 张）`
                : `正在处理页图 ${rendered}/${total}`,
          })
        },
        onPageUploadProgress: (uploaded, total) => {
          setUploadProgress({ current: uploaded, total })
          setStatus({
            type: 'info',
            text:
              uploaded >= total
                ? `页图上传完成（${total}/${total}）`
                : `正在上传页图 ${uploaded}/${total}`,
          })
        },
        onAudioUploadPhase: (phase) => {
          if (phase === 'start') {
            setAudioStatus('uploading')
            setStatus({ type: 'info', text: '正在上传讲解音频…' })
          } else {
            setAudioStatus('done')
          }
        },
      })

      if (result.outcome === 'aborted') {
        setStatus({
          type: 'info',
          text: result.error ?? '已放弃上传',
        })
        resetProgress()
      } else if (result.outcome === 'skipped') {
        setStatus({ type: 'info', text: '已跳过（重复）' })
        resetProgress()
      } else if (result.error) {
        setStatus({ type: 'error', text: result.error })
        resetProgress()
      } else {
        setSaving(true)
        setStatus({ type: 'success', text: `上传成功（${pageCount} 页）` })
        setTitle('')
        setTitleTouched(false)
        setDescription('')
        setPdfFile(null)
        setPageImageFiles([])
        setAudioFile(null)
        setSyncFile(null)
        resetProgress()
      }
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '上传失败',
      })
      resetProgress()
    } finally {
      setBusy(false)
      setSaving(false)
    }
  }, [title, description, sourceMode, pdfFile, pageImageFiles, audioFile, syncFile, onSubmit, onSessionStart])

  const progressHeadline = busy
    ? status?.type === 'info'
      ? status.text
      : '处理中…'
    : undefined

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <div>
        <h2 className="text-base font-bold text-white">单本上传</h2>
        <p className="mt-1 text-xs text-white/40">选择 PDF 或整组页图（二选一）</p>
      </div>

      <div className="flex rounded-xl border border-white/10 p-1">
        <button
          type="button"
          onClick={() => switchMode('pdf')}
          className={clsx(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            sourceMode === 'pdf'
              ? 'bg-orange-500 text-white'
              : 'text-white/50 hover:text-white/80',
          )}
        >
          PDF 讲义
        </button>
        <button
          type="button"
          onClick={() => switchMode('images')}
          className={clsx(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            sourceMode === 'images'
              ? 'bg-orange-500 text-white'
              : 'text-white/50 hover:text-white/80',
          )}
        >
          整组页图
        </button>
      </div>

      <FileField
        label="讲解音频（可选，用于自动填书名）"
        accept="audio/mpeg,audio/mp4,audio/*,.mp3,.m4a"
        multiple={false}
        file={audioFile}
        files={[]}
        onFile={(f) => {
          setAudioFile(f)
          if (!f) setTitleTouched(false)
        }}
        onFiles={() => {}}
      />
      <FileField
        label="同步配置 sync.json（可选，无音频时用于书名）"
        accept="application/json,.json"
        multiple={false}
        file={syncFile}
        files={[]}
        onFile={(f) => {
          setSyncFile(f)
          if (!f) setTitleTouched(false)
        }}
        onFiles={() => {}}
        hint='格式：{ "version": 1, "mode": "auto_turn", "pages": [{ "page": 1, "start": 0, "end": 8.2 }] }'
      />

      <div>
        <label className="mb-1 block text-xs font-semibold text-white/50">
          书名{autoTitle && !titleTouched ? '（已从音频/sync 填充）' : ''}
        </label>
        <input
          value={title}
          onChange={(e) => {
            setTitleTouched(true)
            setTitle(e.target.value)
          }}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-orange-400/50"
          placeholder={
            audioFile || syncFile
              ? '可修改自动填充的书名'
              : '无音频/sync 时请手动填写，如：第 43 讲 课前测'
          }
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-white/50">简介（可选）</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-orange-400/50"
        />
      </div>

      {sourceMode === 'pdf' ? (
        <FileField
          label="PDF 讲义（本地转图）"
          accept="application/pdf,.pdf"
          multiple={false}
          file={pdfFile}
          files={[]}
          onFile={setPdfFile}
          onFiles={() => {}}
        />
      ) : (
        <FileField
          label="页图（可多选，命名须为 0001.png、0002.png…）"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          file={null}
          files={pageImageFiles}
          onFile={() => {}}
          onFiles={setPageImageFiles}
          hint={
            sortedPreview.length > 0
              ? `已按页码排列 ${sortedPreview.length} 张：${sortedPreview
                  .map((f) => f.name)
                  .slice(0, 4)
                  .join('、')}${sortedPreview.length > 4 ? '…' : ''}`
              : '与云端一致：0001.png、0002.jpg（四位数字）'
          }
        />
      )}

      {busy && (
        <FlipbookUploadProgress
          headline={progressHeadline}
          overallPercent={overallPercent}
          renderLabel={sourceMode === 'pdf' ? '生成页图' : '准备页图'}
          render={renderProgress}
          upload={uploadProgress}
          audioStatus={audioFile ? audioStatus : null}
        />
      )}

      {status && !busy && (
        <p
          className={clsx(
            'text-sm',
            status.type === 'error' && 'text-red-300',
            status.type === 'success' && 'text-emerald-300',
            status.type === 'info' && 'text-white/60',
          )}
        >
          {status.text}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSubmit()}
        className="rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-400 disabled:opacity-50"
      >
        {busy ? '处理中…' : '上传书籍'}
      </button>
    </div>
  )
}

function FileField({
  label,
  accept,
  multiple,
  file,
  files,
  onFile,
  onFiles,
  hint,
}: {
  label: string
  accept: string
  multiple: boolean
  file: File | null
  files: File[]
  onFile: (f: File | null) => void
  onFiles: (files: File[]) => void
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-white/50">{label}</label>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          if (multiple) onFiles(list)
          else onFile(list[0] ?? null)
        }}
        className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
      />
      {file && <p className="mt-1 truncate text-xs text-white/40">{file.name}</p>}
      {multiple && files.length > 0 && (
        <p className="mt-1 text-xs text-white/40">已选 {files.length} 个文件</p>
      )}
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

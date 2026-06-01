'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import FlipbookUploadProgress, {
  flipbookOverallUploadPercent,
  type FlipbookProgressStep,
} from '@/components/flipbook/FlipbookUploadProgress'
import type { FlipbookCreateBookInput } from '@/components/flipbook/FlipbookUploader'
import type { FlipbookCreateBookResult } from '@/hooks/useFlipbookBooks'
import { countPdfPages } from '@/utils/flipbook-pdf'
import { flipbookTitleFromFiles } from '@/utils/flipbook-naming'
import {
  isFlipbookRasterImageFile,
  isValidCloudPageImageFilename,
} from '@/utils/flipbook-page-images'
import { matchFlipbookBatchFiles } from '@/utils/flipbook-batch-match'
import { parseSyncManifest, validateManifestAgainstPageCount } from '@/utils/flipbook-sync'
import type { FlipbookSyncManifest } from '@/utils/flipbook-types'

type FlipbookBatchUploaderProps = {
  onSubmit: (input: FlipbookCreateBookInput) => Promise<FlipbookCreateBookResult>
  onSessionStart?: () => void
}

type PairRow = {
  stem: string
  title: string
  source: 'pdf' | 'images'
  pdf: File | null
  pageImages: File[]
  audio: File | null
  sync: File | null
}

export default function FlipbookBatchUploader({ onSubmit, onSessionStart }: FlipbookBatchUploaderProps) {
  const [allFiles, setAllFiles] = useState<File[]>([])
  const [rows, setRows] = useState<PairRow[]>([])
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [bookIndex, setBookIndex] = useState(0)
  const [bookTotal, setBookTotal] = useState(0)
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [currentHasAudio, setCurrentHasAudio] = useState(false)
  const [currentSource, setCurrentSource] = useState<'pdf' | 'images'>('pdf')
  const [parseDone, setParseDone] = useState(false)
  const [renderProgress, setRenderProgress] = useState<FlipbookProgressStep | null>(null)
  const [uploadProgress, setUploadProgress] = useState<FlipbookProgressStep | null>(null)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [failedStems, setFailedStems] = useState<string[]>([])
  const [summary, setSummary] = useState<{ ok: number; fail: number } | null>(null)

  const { pdfFiles, pageImages, audioFiles, syncFiles, ignoredFiles, invalidImages } = useMemo(() => {
    const pdfs: File[] = []
    const images: File[] = []
    const audios: File[] = []
    const syncs: File[] = []
    const ignored: File[] = []
    const invalidImg: File[] = []

    for (const file of allFiles) {
      const name = file.name.toLowerCase()
      if (name.endsWith('.pdf')) {
        pdfs.push(file)
      } else if (isFlipbookRasterImageFile(file.name)) {
        if (isValidCloudPageImageFilename(file.name)) {
          images.push(file)
        } else {
          invalidImg.push(file)
        }
      } else if (
        name.endsWith('.mp3') ||
        name.endsWith('.m4a') ||
        name.endsWith('.wav') ||
        name.endsWith('.aac') ||
        name.endsWith('.ogg')
      ) {
        audios.push(file)
      } else if (name.endsWith('.sync.json') || name.endsWith('.json')) {
        syncs.push(file)
      } else {
        ignored.push(file)
      }
    }

    return {
      pdfFiles: pdfs,
      pageImages: images,
      audioFiles: audios,
      syncFiles: syncs,
      ignoredFiles: ignored,
      invalidImages: invalidImg,
    }
  }, [allFiles])

  const matchPreview = useMemo(
    () => matchFlipbookBatchFiles(pdfFiles, pageImages, audioFiles, syncFiles),
    [pdfFiles, pageImages, audioFiles, syncFiles],
  )

  const batchPercent = bookTotal > 0 ? Math.round((bookIndex / bookTotal) * 100) : 0

  const bookOverallPercent = useMemo(() => {
    if (!busy || !currentTitle) return null
    const inner = flipbookOverallUploadPercent({
      parseDone,
      render: renderProgress,
      upload: uploadProgress,
      audio: audioStatus,
    })
    if (bookTotal <= 0) return inner
    const bookSlice = 100 / bookTotal
    const base = (bookIndex - 1) * bookSlice
    return Math.min(99, Math.round(base + (inner / 100) * bookSlice))
  }, [
    busy,
    currentTitle,
    parseDone,
    renderProgress,
    uploadProgress,
    audioStatus,
    bookIndex,
    bookTotal,
  ])

  const resetBookProgress = () => {
    setParseDone(false)
    setRenderProgress(null)
    setUploadProgress(null)
    setAudioStatus('idle')
  }

  const applyMatch = useCallback(() => {
    setRows(
      matchPreview.pairs.map((p) => ({
        stem: p.stem,
        title: p.title,
        source: p.source,
        pdf: p.pdf,
        pageImages: p.pageImages,
        audio: p.audio,
        sync: p.sync,
      })),
    )
    setLog(null)
    setFailedStems([])
    setSummary(null)
    setBookIndex(0)
    setBookTotal(0)
    setCurrentTitle(null)
    resetBookProgress()
  }, [matchPreview.pairs])

  const updateTitle = (stem: string, title: string) => {
    setRows((prev) => prev.map((r) => (r.stem === stem ? { ...r, title } : r)))
  }

  const runBatch = useCallback(
    async (retryOnlyFailed = false) => {
      const targetRows = retryOnlyFailed
        ? rows.filter((r) => failedStems.includes(r.stem))
        : rows

      if (targetRows.length === 0) {
        setLog('请先选择文件并点击「预览配对」')
        return
      }

      onSessionStart?.()
      setBusy(true)
      setBookIndex(0)
      setBookTotal(targetRows.length)
      setCurrentTitle(null)
      resetBookProgress()
      const lines: string[] = []
      let ok = 0
      let fail = 0
      const nextFailed: string[] = []

      for (let index = 0; index < targetRows.length; index++) {
        const row = targetRows[index]
        setBookIndex(index + 1)
        setCurrentTitle(row.title)
        setCurrentHasAudio(Boolean(row.audio))
        setCurrentSource(row.source)
        resetBookProgress()
        lines.push(`[${index + 1}/${targetRows.length}] ${row.title}`)
        setLog(lines.join('\n'))

        try {
          let pageCount: number
          if (row.source === 'pdf' && row.pdf) {
            const blobUrl = URL.createObjectURL(row.pdf)
            try {
              pageCount = await countPdfPages(blobUrl)
            } finally {
              URL.revokeObjectURL(blobUrl)
            }
          } else if (row.pageImages.length > 0) {
            pageCount = row.pageImages.length
          } else {
            throw new Error('缺少 PDF 或页图')
          }
          setParseDone(true)

          let syncManifest: FlipbookSyncManifest | null = null
          if (row.sync) {
            const text = await row.sync.text()
            const parsed = parseSyncManifest(JSON.parse(text) as unknown)
            if (!parsed) {
              throw new Error('sync.json 格式无效')
            }
            const err = validateManifestAgainstPageCount(parsed, pageCount)
            if (err) throw new Error(err)
            syncManifest = parsed
          }

          setRenderProgress({ current: 0, total: pageCount })

          const resolvedTitle = flipbookTitleFromFiles({
            manual: row.title,
            audio: row.audio,
            sync: row.sync,
          })
          if (!resolvedTitle) {
            throw new Error('请填写书名，或为该书提供音频 / sync 文件')
          }

          const result = await onSubmit({
            title: resolvedTitle,
            pageCount: row.source === 'pdf' ? pageCount : undefined,
            pdfFile: row.pdf ?? undefined,
            pageImageFiles: row.pageImages.length > 0 ? row.pageImages : undefined,
            audioFile: row.audio ?? undefined,
            syncManifest,
            batch: true,
            onPageRenderProgress: (rendered, total) => {
              setRenderProgress({ current: rendered, total })
            },
            onPageUploadProgress: (uploaded, total) => {
              setUploadProgress({ current: uploaded, total })
            },
            onAudioUploadPhase: (phase) => {
              setAudioStatus(phase === 'start' ? 'uploading' : 'done')
            },
          })

          if (result.outcome === 'aborted') {
            lines[lines.length - 1] =
              `⛔ [${index + 1}/${targetRows.length}] ${row.title}：已放弃上传${result.error ? `（${result.error}）` : ''}`
            setLog(lines.join('\n'))
            break
          }
          if (result.outcome === 'skipped') {
            lines[lines.length - 1] =
              `⏭ [${index + 1}/${targetRows.length}] ${row.title}：已跳过（重复）`
            continue
          }
          if (result.error) throw new Error(result.error)
          ok++
          const src =
            row.source === 'pdf' ? 'PDF' : `${row.pageImages.length} 张页图`
          lines[lines.length - 1] =
            `✅ [${index + 1}/${targetRows.length}] ${row.title}（${pageCount} 页 · ${src}）`
        } catch (err) {
          fail++
          nextFailed.push(row.stem)
          const msg = err instanceof Error ? err.message : '失败'
          lines[lines.length - 1] = `❌ [${index + 1}/${targetRows.length}] ${row.title}：${msg}`
        }
        setLog(lines.join('\n'))
      }

      lines.push(`\n完成：成功 ${ok}，失败 ${fail}`)
      setLog(lines.join('\n'))
      setSummary({ ok, fail })
      setFailedStems(nextFailed)
      setCurrentTitle(null)
      resetBookProgress()
      setBusy(false)
    },
    [rows, failedStems, onSubmit, onSessionStart],
  )

  const previewCount = matchPreview.pairs.length

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <div>
        <h2 className="text-base font-bold text-white">批量上传</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          页图命名为 <code className="text-orange-300/90">0001.png</code>（与云端一致）；书名取自音频或
          sync 文件名。多本书请用子文件夹或见上方说明。
        </p>
      </div>

      <MultiFileField
        label="选择文件（PDF / 页图 / 音频 / sync 混选）"
        accept="application/pdf,image/png,image/jpeg,image/webp,audio/*,.pdf,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.wav,.aac,.ogg,.json"
        files={allFiles}
        onFiles={setAllFiles}
      />
      <MultiFileField
        label="或：选择文件夹（保留子目录，适合多本书）"
        accept="application/pdf,image/png,image/jpeg,image/webp,audio/*,.pdf,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.wav,.aac,.ogg,.json"
        files={allFiles}
        onFiles={(picked) => setAllFiles((prev) => mergeFileLists(prev, picked))}
        directory
      />
      {allFiles.length > 0 && (
        <p className="text-xs text-white/45">
          已识别：PDF {pdfFiles.length} · 页图 {pageImages.length} · 音频 {audioFiles.length} · sync{' '}
          {syncFiles.length}
        </p>
      )}
      {invalidImages.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          页图命名须与云端一致（四位页码，如 <code>0001.png</code>）：{' '}
          {invalidImages.map((f) => f.name).join('、')}
        </div>
      )}
      {matchPreview.flatImageErrors.map((msg) => (
        <div
          key={msg}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90"
        >
          {msg}
        </div>
      ))}
      {ignoredFiles.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          已忽略不支持文件：{ignoredFiles.map((f) => f.name).join('、')}
        </div>
      )}
      {matchPreview.conflicts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100/90">
          同一本书不能同时有 PDF 和页图：{matchPreview.conflicts.join('、')}
        </div>
      )}

      {(matchPreview.unmatchedAudios.length > 0 || matchPreview.unmatchedSyncs.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {matchPreview.unmatchedAudios.length > 0 && (
            <p>未配对的音频：{matchPreview.unmatchedAudios.map((f) => f.name).join('、')}</p>
          )}
          {matchPreview.unmatchedSyncs.length > 0 && (
            <p className="mt-1">
              未配对的 sync：{matchPreview.unmatchedSyncs.map((f) => f.name).join('、')}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={previewCount === 0 || busy}
        onClick={applyMatch}
        className="rounded-xl border border-white/15 bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
      >
        预览配对（{previewCount} 本）
      </button>

      {rows.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 p-2">
          {rows.map((row) => (
            <li key={row.stem} className="rounded-lg bg-black/25 p-3 text-xs">
              <input
                value={row.title}
                onChange={(e) => updateTitle(row.stem, e.target.value)}
                className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                placeholder={
                  row.audio || row.sync ? '默认来自音频/sync，可改' : '无音频/sync 时请填写书名'
                }
              />
              <div className="text-white/50">
                {row.source === 'pdf' && row.pdf ? (
                  <div className="truncate">📄 {row.pdf.name}</div>
                ) : (
                  <div className="truncate">
                    🖼 {row.pageImages.length} 张页图（{row.pageImages[0]?.name}
                    {row.pageImages.length > 1 ? ' …' : ''}）
                  </div>
                )}
                <div className={clsx('truncate', !row.audio && 'text-amber-300/80')}>
                  {row.audio ? `🎧 ${row.audio.name}` : '🎧 （无音频）'}
                </div>
                <div className="truncate">
                  {row.sync ? `⏱ ${row.sync.name}` : '⏱ （无 sync）'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {busy && bookTotal > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="truncate font-medium text-white/85">
              {currentTitle ? `正在处理：${currentTitle}` : '准备中…'}
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              书本 {bookIndex}/{bookTotal}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/25 transition-all duration-300"
              style={{ width: `${batchPercent}%` }}
            />
          </div>
          <FlipbookUploadProgress
            headline="当前书本"
            overallPercent={bookOverallPercent}
            renderLabel={currentSource === 'pdf' ? '生成页图' : '准备页图'}
            render={renderProgress}
            upload={uploadProgress}
            audioStatus={currentHasAudio ? audioStatus : null}
          />
        </div>
      )}

      {!busy && summary && bookTotal > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/60">
          上次批量：成功 {summary.ok} 本，失败 {summary.fail} 本
        </div>
      )}

      {log && (
        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-xs text-white/70">
          {log}
        </pre>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy || rows.length === 0}
          onClick={() => void runBatch(false)}
          className="rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-400 disabled:opacity-50"
        >
          {busy ? `批量上传中 ${bookIndex}/${bookTotal}…` : `开始上传 ${rows.length} 本`}
        </button>
        <button
          type="button"
          disabled={busy || failedStems.length === 0}
          onClick={() => void runBatch(true)}
          className="rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
        >
          重试失败项（{failedStems.length}）
        </button>
      </div>
    </div>
  )
}

function mergeFileLists(prev: File[], picked: File[]): File[] {
  const key = (f: File) =>
    `${(f as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''}|${f.name}|${f.size}|${f.lastModified}`
  const seen = new Set(prev.map(key))
  const merged = [...prev]
  for (const f of picked) {
    const k = key(f)
    if (!seen.has(k)) {
      seen.add(k)
      merged.push(f)
    }
  }
  return merged
}

function MultiFileField({
  label,
  accept,
  files,
  onFiles,
  directory = false,
}: {
  label: string
  accept: string
  files: File[]
  onFiles: (files: File[]) => void
  directory?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-white/50">{label}</label>
      <input
        type="file"
        accept={accept}
        multiple
        {...(directory ? { webkitdirectory: '', directory: '' } : {})}
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
        className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
      />
      {files.length > 0 && !directory && (
        <p className="mt-1 text-xs text-white/40">已选 {files.length} 个文件</p>
      )}
    </div>
  )
}

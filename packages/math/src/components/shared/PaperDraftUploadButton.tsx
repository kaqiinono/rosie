'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useProblemScratchContext } from '@rosie/math/components/shared/ScratchPad/ProblemScratchContext'
import {
  appendPaperImageToWorking,
  submitPaperWorkingArchive,
} from '@rosie/math/utils/paper-scratch'

type PaperDraftUploadButtonProps = {
  problem: Problem
  paperId?: string | null
  variant?: 'compact' | 'labeled'
  className?: string
  onUploaded?: () => void
  onFlash?: (message: string) => void
}

type PendingUpload = {
  files: File[]
}

export default function PaperDraftUploadButton({
  problem,
  paperId = null,
  variant = 'compact',
  className = '',
  onUploaded,
  onFlash,
}: PaperDraftUploadButtonProps) {
  const { user } = useAuth()
  const scratchCtx = useProblemScratchContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<PendingUpload | null>(null)

  if (!user) return null

  async function uploadWithMark(correct: boolean, archiveNow: boolean) {
    if (!user || !pending) return
    setUploading(true)
    let ok = 0
    let lastError: string | null = null

    for (const file of pending.files) {
      const { error } = await appendPaperImageToWorking(
        user.id,
        problem.id,
        file,
        correct,
        paperId,
      )
      if (error) lastError = error
      else ok++
    }

    if (lastError && ok === 0) {
      setUploading(false)
      setPending(null)
      onFlash?.(lastError)
      return
    }

    if (archiveNow && scratchCtx?.section) {
      const { error, correct: archivedCorrect } = await submitPaperWorkingArchive({
        userId: user.id,
        problemId: problem.id,
        section: scratchCtx.section,
        paperId,
      })
      setUploading(false)
      setPending(null)
      if (error) {
        onFlash?.(error)
        return
      }
      onFlash?.(archivedCorrect ? '纸质练习已提交（做对）' : '纸质练习已提交（做错）')
      onUploaded?.()
      return
    }

    setUploading(false)
    setPending(null)
    if (ok > 0) {
      onFlash?.(
        ok === 1
          ? `已加入纸质草稿（${correct ? '做对' : '做错'}），检查答案后归档`
          : `已加入 ${ok} 张纸质草稿（${correct ? '做对' : '做错'}）`,
      )
      onUploaded?.()
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length > 0) setPending({ files })
        }}
      />
      <button
        type="button"
        disabled={uploading}
        title="拍照或上传纸质草稿"
        onClick={() => inputRef.current?.click()}
        className={
          variant === 'compact'
            ? `flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-base transition-all hover:bg-amber-100 active:scale-95 disabled:opacity-60 ${className}`
            : `flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 shadow-sm transition-all hover:from-amber-100 hover:to-orange-100 active:scale-95 disabled:opacity-60 ${className}`
        }
      >
        <span className="text-sm leading-none">📷</span>
        {variant !== 'compact' && (
          <span>{uploading ? '上传中…' : '纸质草稿'}</span>
        )}
      </button>

      {pending && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">标记练习结果</h3>
            <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
              已选 {pending.files.length} 张图片。请标记这次纸上练习是做对还是做错，避免以后参考到错误草稿。
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => void uploadWithMark(true, false)}
                className="rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-[13px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                ✅ 做对了
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => void uploadWithMark(false, false)}
                className="rounded-xl border border-rose-200 bg-rose-50 py-3 text-[13px] font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
              >
                ❌ 做错了
              </button>
            </div>
            <p className="mb-2 text-[10px] font-semibold text-slate-400">仅纸质练习、不在 app 里答题：</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={uploading || !scratchCtx?.section}
                onClick={() => void uploadWithMark(true, true)}
                className="rounded-xl bg-emerald-600 py-2 text-[11px] font-bold text-white disabled:opacity-50"
              >
                提交记录（对）
              </button>
              <button
                type="button"
                disabled={uploading || !scratchCtx?.section}
                onClick={() => void uploadWithMark(false, true)}
                className="rounded-xl bg-rose-600 py-2 text-[11px] font-bold text-white disabled:opacity-50"
              >
                提交记录（错）
              </button>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setPending(null)}
              className="w-full rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}

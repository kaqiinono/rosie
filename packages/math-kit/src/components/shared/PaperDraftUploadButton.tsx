'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useProblemScratchContext } from '@rosie/math-kit/components/shared/ScratchPad/ProblemScratchContext'
import {
  appendPaperImageToWorking,
  submitPaperWorkingArchive,
} from '@rosie/math-kit/utils/paper-scratch'
import { useLessonScratchActions } from '@rosie/math-kit/components/shared/ScratchPad/LessonScratchActionsContext'
import ProblemActionIcon from './ProblemActionIcon'
import { StickerCard } from '@rosie/ui'
import { Button, IconButton } from '@rosie/ui/themes'

type PaperDraftUploadButtonProps = {
  problem: Problem
  paperId?: string | null
  variant?: 'compact' | 'labeled' | 'toolbar'
  className?: string
  onUploaded?: () => void
  onFlash?: (message: string) => void
  onArchived?: (correct: boolean) => void | Promise<void>
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
  onArchived,
}: PaperDraftUploadButtonProps) {
  const { user } = useAuth()
  const scratchCtx = useProblemScratchContext()
  const scratchActions = useLessonScratchActions()
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
        scratchCtx?.section ?? 'lesson',
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
      if (archivedCorrect) {
        if (onArchived) void onArchived(true)
        else void scratchActions?.onSolve?.(problem.id)
      } else {
        if (onArchived) void onArchived(false)
        else scratchActions?.onWrong?.(problem.id)
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
      {variant === 'labeled' ? (
        <Button
          type="button"
          size="1"
          radius="full"
          variant="soft"
          color="amber"
          className={className || undefined}
          disabled={uploading}
          aria-busy={uploading}
          title="拍照或上传纸质草稿"
          aria-label="上传草稿"
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-sm leading-none">📷</span>
          <span>{uploading ? '上传中…' : '纸质草稿'}</span>
        </Button>
      ) : (
        <IconButton
          type="button"
          size="2"
          radius="full"
          variant={variant === 'toolbar' ? 'ghost' : 'soft'}
          color={variant === 'toolbar' ? 'gray' : 'amber'}
          className={className || undefined}
          disabled={uploading}
          aria-busy={uploading}
          title="拍照或上传纸质草稿"
          aria-label="上传草稿"
          onClick={() => inputRef.current?.click()}
        >
          {variant === 'toolbar' ? (
            <ProblemActionIcon name="upload" />
          ) : (
            <span className="text-sm leading-none">📷</span>
          )}
        </IconButton>
      )}

      {pending && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <StickerCard elevation="lg" radius="md" className="w-full max-w-sm">
            <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">标记练习结果</h3>
            <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
              已选 {pending.files.length}{' '}
              张图片。请标记这次纸上练习是做对还是做错，避免以后参考到错误草稿。
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                disabled={uploading}
                onClick={() => void uploadWithMark(true, false)}
                variant="soft"
                color="jade"
                size="3"
              >
                ✅ 做对了
              </Button>
              <Button
                type="button"
                disabled={uploading}
                onClick={() => void uploadWithMark(false, false)}
                variant="soft"
                color="ruby"
                size="3"
              >
                ❌ 做错了
              </Button>
            </div>
            <p className="mb-2 text-[10px] font-semibold text-slate-400">
              仅纸质练习、不在 app 里答题：
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                disabled={uploading || !scratchCtx?.section}
                onClick={() => void uploadWithMark(true, true)}
                variant="solid"
                color="jade"
                size="1"
              >
                提交记录（对）
              </Button>
              <Button
                type="button"
                disabled={uploading || !scratchCtx?.section}
                onClick={() => void uploadWithMark(false, true)}
                variant="solid"
                color="ruby"
                size="1"
              >
                提交记录（错）
              </Button>
            </div>
            <Button
              type="button"
              disabled={uploading}
              onClick={() => setPending(null)}
              variant="outline"
              color="gray"
              size="1"
              className="w-full"
            >
              取消
            </Button>
          </StickerCard>
        </div>
      )}
    </>
  )
}

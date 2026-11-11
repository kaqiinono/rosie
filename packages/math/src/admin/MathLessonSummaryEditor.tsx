'use client'

import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@rosie/core'
import { lessonSummaryProblemId } from '@rosie/math-kit/constants'
import { uploadLessonSummaryContentImage } from '@rosie/math-kit/hooks/useMathProblemImages'
import type { useMathProblemNotesAdmin } from '@rosie/math-kit/hooks/useMathProblemNotesAdmin'
import RichTextEditor from '@rosie/math-kit/components/shared/RichTextEditor'
import LessonSummaryBody from '@rosie/math-kit/components/shared/LessonSummaryBody'
import { isRichBodyEmpty, sanitizeRichHtml } from '@rosie/math-kit/utils/sanitize-summary-html'
import { Button } from '@rosie/ui/themes'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  lessonId: string
  admin: AdminApi
  onFlash: (msg: string) => void
  onDirtyChange?: (dirty: boolean) => void
  bodyHtml?: string
  onBodyHtmlChange?: (html: string) => void
  onOpenModal?: () => void
  /** Called after a successful save (modal uses this to close). */
  onSaveSuccess?: () => void
  modal?: boolean
}

export default function MathLessonSummaryEditor({
  lessonId,
  admin,
  onFlash,
  onDirtyChange,
  bodyHtml: controlledBodyHtml,
  onBodyHtmlChange,
  onOpenModal,
  onSaveSuccess,
  modal = false,
}: Props) {
  const { user } = useAuth()
  const summaryProblemId = lessonSummaryProblemId(lessonId)
  const existing = admin.getNotes(summaryProblemId)[0] ?? null

  const [internalBodyHtml, setInternalBodyHtml] = useState(existing?.bodyHtml ?? '<p></p>')
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isControlled = controlledBodyHtml !== undefined && onBodyHtmlChange !== undefined
  const bodyHtml = isControlled
    ? controlledBodyHtml
    : dirty
      ? internalBodyHtml
      : (existing?.bodyHtml ?? '<p></p>')

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const setBodyHtml = useCallback(
    (html: string) => {
      if (isControlled) onBodyHtmlChange!(html)
      else setInternalBodyHtml(html)
      setDirty(true)
    },
    [isControlled, onBodyHtmlChange],
  )

  const handleUploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!user) {
        onFlash('请先登录')
        return null
      }
      const { error, url } = await uploadLessonSummaryContentImage(lessonId, file)
      if (error || !url) {
        onFlash(error ? `图片上传失败：${error}` : '图片上传失败')
        return null
      }
      return url
    },
    [user, lessonId, onFlash],
  )

  const handleSave = async () => {
    const toSave = sanitizeRichHtml(bodyHtml)
    if (isRichBodyEmpty(toSave)) {
      onFlash('总结不能为空（可输入文字、插图或粘贴图片）')
      return
    }

    if (existing) {
      const { error } = await admin.saveNote(existing, {
        bodyHtml: toSave,
        expectedUpdatedAt: existing.updatedAt,
      })
      if (error) {
        if (error === '内容已在别处更新，请刷新后再保存') {
          void admin.reload()
          onFlash('总结已有新附加内容，已避免覆盖；请刷新后合并再保存')
        } else {
          onFlash(`保存失败：${error}`)
        }
      } else {
        onFlash('总结已保存')
        if (isControlled) onBodyHtmlChange!(toSave)
        else setInternalBodyHtml(toSave)
        setDirty(false)
        setShowPreview(false)
        onSaveSuccess?.()
      }
      return
    }

    const { error } = await admin.addNote(summaryProblemId, { bodyHtml: toSave })
    if (error) onFlash(`保存失败：${error}`)
    else {
      onFlash('总结已保存')
      if (isControlled) onBodyHtmlChange!(toSave)
      else setInternalBodyHtml(toSave)
      setDirty(false)
      setShowPreview(false)
      onSaveSuccess?.()
    }
  }

  const handleClear = async () => {
    if (!existing) {
      setBodyHtml('<p></p>')
      setDirty(false)
      return
    }
    if (!window.confirm('确定删除本讲内容总结？')) return
    const { error } = await admin.removeNote(existing)
    if (error) onFlash(`删除失败：${error}`)
    else {
      onFlash('总结已删除')
      setBodyHtml('<p></p>')
      setDirty(false)
      setShowPreview(false)
    }
  }

  return (
    <div className={modal ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden' : 'space-y-3'}>
      <div
        className={clsx(modal ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'overflow-hidden')}
      >
        {showPreview ? (
          <div
            className={clsx(
              'border-kid-line overflow-y-auto rounded-xl border-2 bg-white',
              modal ? 'min-h-0 flex-1' : 'max-h-[180px]',
            )}
          >
            <div className="border-kid-line border-b bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500">
              首页预览（紧凑显示）
            </div>
            <div className={clsx('p-2', modal && '[&_.lesson-summary-content]:max-h-none')}>
              {isRichBodyEmpty(bodyHtml) ? (
                <div className="rounded-xl border border-dashed border-teal-200 py-6 text-center text-[11px] text-slate-400">
                  暂无内容
                </div>
              ) : (
                <LessonSummaryBody bodyHtml={bodyHtml} preview={!modal} />
              )}
            </div>
          </div>
        ) : (
          <RichTextEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            onUploadImage={handleUploadImage}
            placeholder="输入文字、点插图、或粘贴图片…"
            disabled={admin.isSaving}
            fillHeight={modal}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          disabled={admin.isSaving}
          onClick={() => void handleSave()}
          variant="solid"
          color="violet"
          size="1"
          className="min-w-0 flex-1"
        >
          {admin.isSaving ? '保存中…' : existing ? '保存总结' : '创建总结'}
        </Button>
        {onOpenModal && (
          <Button type="button" onClick={onOpenModal} variant="outline" color="violet" size="1">
            编辑
          </Button>
        )}
        <Button
          type="button"
          disabled={!showPreview && isRichBodyEmpty(bodyHtml)}
          onClick={() => setShowPreview((v) => !v)}
          variant="outline"
          color="teal"
          size="1"
        >
          {showPreview ? '返回编辑' : '预览'}
        </Button>
        {(existing || dirty) && (
          <Button
            type="button"
            disabled={admin.isSaving}
            onClick={() => void handleClear()}
            variant="outline"
            color="red"
            size="1"
          >
            删除
          </Button>
        )}
      </div>
    </div>
  )
}

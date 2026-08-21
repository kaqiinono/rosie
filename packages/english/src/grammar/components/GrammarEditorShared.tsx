'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GrammarPageImage } from '../types'
import { grammarPageImageUrl } from '../types'

export function moveEditorItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function useEditorDismissGuard({
  dirty,
  saving,
  onClose,
  escapeEnabled = true,
}: {
  dirty: boolean
  saving: boolean
  onClose: () => void
  escapeEnabled?: boolean
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || saving) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty, saving])

  const requestClose = useCallback(() => {
    if (saving) return
    if (dirty && !window.confirm('还有未保存的修改，确定要放弃吗？')) return
    onClose()
  }, [dirty, onClose, saving])

  useEffect(() => {
    if (!escapeEnabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      requestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [escapeEnabled, requestClose])

  return requestClose
}

export function GrammarEditorReferencePane({
  pageImages,
  page,
  imageType,
  preview,
  previewEmpty = false,
}: {
  pageImages: GrammarPageImage[]
  page?: number
  imageType: GrammarPageImage['type']
  preview: ReactNode
  previewEmpty?: boolean
}) {
  const [viewerMode, setViewerMode] = useState<'source' | 'preview'>('source')
  const referenceImage = useMemo(
    () =>
      pageImages.find((image) => image.page === page && image.type === imageType)
      ?? pageImages.find((image) => image.page === page)
      ?? pageImages.find((image) => image.type === imageType)
      ?? pageImages[0],
    [imageType, page, pageImages],
  )
  const referenceImageUrl = referenceImage ? grammarPageImageUrl(referenceImage.path) : ''

  return (
    <aside className="order-first min-w-0 border-b border-border-light bg-surface-dim/45 p-4 lg:order-none lg:overflow-y-auto lg:border-b-0">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-surface p-1 ring-1 ring-border-light" role="tablist" aria-label="查看区域">
        <button
          type="button"
          role="tab"
          aria-selected={viewerMode === 'source'}
          onClick={() => setViewerMode('source')}
          className={`min-h-10 rounded-lg px-3 text-sm font-bold transition-colors ${viewerMode === 'source' ? 'bg-app-blue text-white shadow-sm' : 'text-text-secondary hover:bg-surface-dim'}`}
        >
          原书对照{referenceImage ? ` · p.${referenceImage.page}` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewerMode === 'preview'}
          onClick={() => setViewerMode('preview')}
          className={`min-h-10 rounded-lg px-3 text-sm font-bold transition-colors ${viewerMode === 'preview' ? 'bg-app-blue text-white shadow-sm' : 'text-text-secondary hover:bg-surface-dim'}`}
        >
          实时预览
        </button>
      </div>

      {viewerMode === 'source' ? (
        <section role="tabpanel" aria-label="原书对照">
          {referenceImageUrl ? (
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface ring-1 ring-border-light">
              {/* Storage 域名随环境变化，沿用原书预览的直接图片加载方式。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referenceImageUrl} alt={`原书第 ${referenceImage?.page ?? ''} 页`} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="rounded-xl bg-surface p-6 text-center text-sm text-text-muted ring-1 ring-border-light">本单元暂无可对照的原书图片</div>
          )}
        </section>
      ) : (
        <section role="tabpanel" aria-label="学生端实时预览">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-text-primary">学生端实时预览</h3>
            <span className="rounded-full bg-app-green-light px-2 py-1 text-[10px] font-bold text-app-green-dark">自动更新</span>
          </div>
          {previewEmpty ? <p className="text-sm text-text-muted">暂无可预览内容</p> : preview}
        </section>
      )}
    </aside>
  )
}

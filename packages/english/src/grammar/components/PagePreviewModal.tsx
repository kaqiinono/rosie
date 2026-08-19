'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GrammarPageImage } from '../types'
import { grammarPageImageUrl } from '../types'

interface PagePreviewModalProps {
  /** 当前要展示的书内页码 */
  page: number | null
  /** 该单元全部原文图片 */
  images: GrammarPageImage[]
  onClose: () => void
}

/**
 * 原文图片预览弹窗 — 点击页码角标后弹出。
 * 展示 page 对应的 Storage 图片；若无匹配图片则显示提示。
 */
export function PagePreviewModal({ page, images, onClose }: PagePreviewModalProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  // page 变化时重置加载状态
  useEffect(() => {
    setLoaded(false)
    setErrored(false)
  }, [page])

  // ESC 关闭
  useEffect(() => {
    if (page === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [page, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (page === null) return null

  const match = images.find((img) => img.page === page)
  const imgUrl = match ? grammarPageImageUrl(match.path) : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-[600px] flex-col items-center gap-3 rounded-2xl bg-surface p-4 shadow-2xl ring-1 ring-border-light">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">
            📄 原书 p.{page}
            {match ? (
              <span className="ml-2 text-xs font-normal text-text-muted">
                {match.type === 'lesson' ? '讲解页' : '练习页'}
              </span>
            ) : null}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-dim hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Image */}
        {imgUrl ? (
          <div className="relative flex w-full flex-1 items-center justify-center overflow-auto rounded-xl bg-surface-dim">
            {!loaded && !errored && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-app-blue border-t-transparent" />
              </div>
            )}
            <img
              src={imgUrl}
              alt={`原书 p.${page}`}
              className={`max-h-[70vh] w-auto rounded-xl object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
            {errored && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
                <span className="text-3xl">🖼️</span>
                <span className="text-xs">图片加载失败，请检查网络</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-text-muted">
            <span className="text-3xl">📷</span>
            <span className="text-sm">该页原文图片尚未上传</span>
          </div>
        )}
      </div>
    </div>
  )
}

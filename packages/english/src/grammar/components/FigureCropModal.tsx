'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface FigureCropModalProps {
  /** 整页原图 URL */
  imageUrl: string
  /** 弹窗标题，如「裁切插图 · p.33」 */
  title: string
  /** 父级保存中（上传+写库）；期间确认按钮显示保存中且不可关闭 */
  saving: boolean
  /** 父级保存失败信息；非空时展示并允许重试/取消 */
  error: string | null
  onConfirm: (blob: Blob) => void
  onClose: () => void
}

/** 显示像素最小选区，低于视为误点 */
const MIN_SELECT = 20

/**
 * 插图裁切弹窗 — 在整页原图上框选区域，按自然分辨率导出 PNG。
 * 选区遮罩用 box-shadow 大范围扩散实现（选区内清晰、选区外变暗）。
 * 弹窗只负责交互并产出 Blob，不负责上传与写库。
 */
export function FigureCropModal({ imageUrl, title, saving, error, onConfirm, onClose }: FigureCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, saving])

  const sel: Rect | null =
    start && end
      ? {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x),
          h: Math.abs(end.y - start.y),
        }
      : null
  const selValid = sel !== null && sel.w >= MIN_SELECT && sel.h >= MIN_SELECT
  const busy = saving || exporting

  const localPoint = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (busy) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const p = localPoint(e)
      dragRef.current = p
      setStart(p)
      setEnd(p)
    },
    [busy, localPoint],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || busy) return
      setEnd(localPoint(e))
    },
    [busy, localPoint],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img || !sel || !selValid || busy) return
    setExporting(true)
    setExportError(null)
    try {
      // 显示坐标 → 原图自然分辨率坐标
      const scaleX = img.naturalWidth / img.clientWidth
      const scaleY = img.naturalHeight / img.clientHeight
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(sel.w * scaleX))
      canvas.height = Math.max(1, Math.round(sel.h * scaleY))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setExporting(false)
        setExportError('浏览器不支持 canvas 裁切')
        return
      }
      ctx.drawImage(
        img,
        sel.x * scaleX,
        sel.y * scaleY,
        sel.w * scaleX,
        sel.h * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      )
      canvas.toBlob((blob) => {
        setExporting(false)
        if (blob) {
          onConfirm(blob)
        } else {
          setExportError('裁切导出失败，请重试')
        }
      }, 'image/png')
    } catch (err) {
      // 无 crossOrigin 时画跨源图会污染 canvas，toBlob 招同步 SecurityError
      setExporting(false)
      setExportError(err instanceof Error ? `裁切失败：${err.message}` : '裁切失败，请重试')
    }
  }, [sel, selValid, busy, onConfirm])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="relative mx-4 flex max-h-[92vh] w-full max-w-[640px] flex-col gap-3 rounded-2xl bg-surface p-4 shadow-2xl ring-1 ring-border-light">
        <div className="flex w-full items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">✂️ {title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-dim hover:text-text-primary disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="flex w-full flex-1 items-center justify-center overflow-auto rounded-xl bg-surface-dim p-2">
          {!loaded && !errored && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-app-blue border-t-transparent" />
            </div>
          )}
          {errored ? (
            <div className="flex flex-col items-center gap-2 py-12 text-text-muted">
              <span className="text-3xl">🖼️</span>
              <span className="text-xs">页面图片加载失败，无法裁切</span>
            </div>
          ) : (
            <div
              className={`relative select-none ${loaded ? '' : 'hidden'}`}
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="裁切底图"
                crossOrigin="anonymous"
                draggable={false}
                className="block max-h-[62vh] w-auto cursor-crosshair"
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
              />
              {loaded && sel && (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-app-blue"
                  style={{
                    left: sel.x,
                    top: sel.y,
                    width: sel.w,
                    height: sel.h,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  }}
                />
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-text-muted">
          {selValid ? '松开后可继续拖拽重画选区' : '在图片上拖拽框选要插入的插图区域'}
        </p>
        {error && <p className="text-center text-xs font-semibold text-app-red">{error}</p>}
        {exportError && <p className="text-center text-xs font-semibold text-app-red">{exportError}</p>}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-1.5 text-sm font-bold text-text-secondary ring-1 ring-border-light transition-colors hover:bg-surface-dim disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selValid || busy}
            className="rounded-full bg-app-blue px-5 py-1.5 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {saving ? '保存中…' : exporting ? '裁切中…' : '裁切并插入'}
          </button>
        </div>
      </div>
    </div>
  )
}

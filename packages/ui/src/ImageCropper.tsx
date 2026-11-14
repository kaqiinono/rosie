'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Flex, Text, TextField } from './themes'
import LoadingOverlay from './LoadingOverlay'

export type ImageCropRegion = { x: number; y: number; width: number; height: number }
export type ImageCropperProps = {
  imageUrl: string
  initialRegion?: ImageCropRegion | null
  saving?: boolean
  disabled?: boolean
  error?: string | null
  confirmLabel?: string
  onConfirm: (blob: Blob, region: ImageCropRegion) => void
  onPreview?: (blob: Blob | null) => void
  onDirtyChange?: (dirty: boolean) => void
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
function normalize(r?: ImageCropRegion | null): ImageCropRegion | null {
  if (!r || !Object.values(r).every(Number.isFinite)) return null
  const x = clamp(r.x, 0, 0.999), y = clamp(r.y, 0, 0.999)
  return { x, y, width: clamp(r.width, 0.001, 1 - x), height: clamp(r.height, 0.001, 1 - y) }
}

/** Same source pixels for grammar and exams. URLs must be CORS-safe or authenticated blobs. */
export function ImageCropper(props: ImageCropperProps) {
  return <CropSurface key={props.imageUrl} {...props} />
}

function CropSurface({ imageUrl, initialRegion, saving: uploading = false, disabled = false, error, confirmLabel = '确认裁切并保存',
  onConfirm, onPreview, onDirtyChange }: ImageCropperProps) {
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const sequence = useRef(0)
  const callbacks = useRef({ onPreview, onDirtyChange })
  callbacks.current = { onPreview, onDirtyChange }
  const saving = uploading || disabled
  const [region, setRegion] = useState<ImageCropRegion | null>(() => normalize(initialRegion))
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const valid = !!region && !!img.current && region.width * img.current.naturalWidth >= 8 && region.height * img.current.naturalHeight >= 8

  function change(next: ImageCropRegion | null) {
    sequence.current += 1
    setRegion(next); setBlob(null); setExportError(null)
    callbacks.current.onPreview?.(null)
    callbacks.current.onDirtyChange?.(true)
  }

  useEffect(() => {
    const current = ++sequence.current
    setBlob(null)
    callbacks.current.onPreview?.(null)
    if (!loaded || !region || !valid) { setExporting(false); return }
    setExporting(true)
    const timer = setTimeout(() => {
      try {
        const source = img.current
        if (!source) return
        const x = Math.round(region.x * source.naturalWidth), y = Math.round(region.y * source.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.min(source.naturalWidth - x, Math.round(region.width * source.naturalWidth)))
        canvas.height = Math.max(1, Math.min(source.naturalHeight - y, Math.round(region.height * source.naturalHeight)))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('浏览器无法裁图，请换用支持 Canvas 的浏览器。')
        ctx.drawImage(source, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(result => {
          if (sequence.current !== current) return
          setExporting(false)
          if (!result) { setExportError('裁切失败，请重新框选。'); return }
          setBlob(result); callbacks.current.onPreview?.(result)
        }, 'image/png')
      } catch {
        if (sequence.current === current) { setExporting(false); setExportError('原图无法导出，请重新加载原页后再试。') }
      }
    }, 120)
    return () => { clearTimeout(timer); sequence.current += 1 }
  }, [loaded, region, valid])

  function point(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: clamp((event.clientX - box.left) / box.width, 0, 1), y: clamp((event.clientY - box.top) / box.height, 0, 1) }
  }
  function draw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || saving) return
    const end = point(event), start = drag.current
    change({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) })
  }

  return <Flex direction="column" gap="3">
    <Flex gap="2" wrap="wrap" align="center">
      <Button size="2" variant="soft" disabled={saving || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.25))}>缩小</Button>
      <Text size="2">{Math.round(zoom * 100)}%</Text>
      <Button size="2" variant="soft" disabled={saving || zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}>放大</Button>
      <Button size="2" variant="soft" disabled={saving || !initialRegion} onClick={() => change(normalize(initialRegion))}>恢复参考框</Button>
    </Flex>
    <div className="relative min-h-64 max-h-[65dvh] overflow-auto">
      <LoadingOverlay visible={!loaded && !failed} placement="content" appearance="quiet" />
      {failed && <Text as="p" color="red" role="alert">原书页加载失败，请重新加载。</Text>}
      <div style={{ width: `${zoom * 100}%` }}>
        <div className="relative w-full select-none" style={{ touchAction: saving ? 'auto' : 'none' }}
          onPointerDown={event => {
            if (saving || !loaded || event.button !== 0) return
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = point(event); draw(event)
          }}
          onPointerMove={draw} onPointerUp={event => { draw(event); drag.current = null }}
          onPointerCancel={() => { drag.current = null }}>
          {/* Native image is required to export its original pixels, not a Next optimized derivative. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={imageUrl} crossOrigin="anonymous" alt="原书页：拖动框选，或用下方百分比输入微调选区"
            draggable={false} className="block h-auto w-full" onLoad={() => { setLoaded(true); setFailed(false) }}
            onError={() => { setFailed(true); setLoaded(false); setBlob(null); callbacks.current.onPreview?.(null) }} />
          {loaded && region && <div aria-hidden="true" className="pointer-events-none absolute border-2 border-[var(--accent-9)]"
            style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
        </div>
      </div>
    </div>
    <Text size="2" color="gray">拖动重画选区；放大后可滚动原页。参考框需人工核对，百分比输入可用于精确调整。</Text>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {([['x', '左'], ['y', '上'], ['width', '宽'], ['height', '高']] as const).map(([key, label]) => <label key={key}>
        <Text size="2">{label}（%）</Text>
        <TextField.Root aria-label={`裁切${label}百分比`} type="number" min="0" max="100" step="0.1" disabled={saving || !loaded}
          value={region ? Number((region[key] * 100).toFixed(3)) : ''} onChange={event => {
            if (!event.target.value || !Number.isFinite(Number(event.target.value))) return
            change(normalize({ ...(region ?? { x: 0, y: 0, width: 0.2, height: 0.2 }), [key]: Number(event.target.value) / 100 }))
          }} />
      </label>)}
    </div>
    {(error || exportError) && <Text as="p" color="red" role="alert">{error || exportError}</Text>}
    <Button loading={uploading || exporting} disabled={saving || exporting || !blob || !valid || failed}
      onClick={() => { if (blob && region) onConfirm(blob, region) }}>{confirmLabel}</Button>
  </Flex>
}

'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser, Keyboard, Undo2 } from 'lucide-react'
import { StickerCard } from './StickerCard'
import type { HandwritingStroke } from './HandwritingField'
import { Flex, IconButton } from './themes'

/** Original ink shared by previews and exams. A completed stroke commits without a confirmation popover. */
export function InlineHandwritingPad({ label, strokes, onChange, readOnly, word = false, onDrawingChange, canvasSize, onKeyboardRequest, landscape = false, fullWidth = false }: {
  label: string; strokes: readonly HandwritingStroke[]; onChange: (strokes: readonly HandwritingStroke[]) => void
  readOnly: boolean; word?: boolean; onDrawingChange: (drawing: boolean) => void
  canvasSize?: { width: number; height: number }
  onKeyboardRequest?: () => void
  /** Fill the available width, including the tool rail, preserving the ink aspect ratio. */
  fullWidth?: boolean
  /** Wider symbol pad; grows with its question row up to 96px. */
  landscape?: boolean
}) {
  const width = canvasSize?.width ?? (word ? 600 : landscape ? 320 : 200)
  const height = canvasSize?.height ?? 200
  const pointer = useRef<number | null>(null)
  const ink = useRef(strokes)
  const [draft, setDraft] = useState(strokes)
  const [drawing, setDrawing] = useState(false)
  const callback = useRef(onDrawingChange)
  useEffect(() => {
    callback.current = onDrawingChange
  }, [onDrawingChange])
  const [syncedStrokes, setSyncedStrokes] = useState(strokes)
  if (strokes !== syncedStrokes) {
    setSyncedStrokes(strokes)
    if (!drawing) setDraft(strokes)
  }
  useEffect(() => { if (pointer.current === null) ink.current = strokes }, [strokes])
  useEffect(() => () => callback.current(false), [])
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / width, rect.height / height)
    return { x: Math.max(0, Math.min(width, (event.clientX - rect.left - (rect.width - width * scale) / 2) / scale)),
      y: Math.max(0, Math.min(height, (event.clientY - rect.top - (rect.height - height * scale) / 2) / scale)) }
  }
  const show = (next: readonly HandwritingStroke[]) => { ink.current = next; setDraft(next) }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (readOnly || pointer.current !== event.pointerId) return
    const last = ink.current.at(-1)
    if (last && last.length < 2000 && ink.current.reduce((count, stroke) => count + stroke.length, 0) < 10000) show([...ink.current.slice(0, -1), [...last, point(event)]])
  }
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return
    if (event.type === 'pointerup') move(event)
    const next = event.type === 'pointercancel' ? ink.current.slice(0, -1) : ink.current
    pointer.current = null
    setDrawing(false); callback.current(false); show(next)
    if (!readOnly) onChange(next)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <Flex align="stretch" className={fullWidth ? 'w-full min-w-0' : landscape ? 'w-fit max-w-full shrink-0 min-h-20 max-h-24' : 'w-fit max-w-full'}>
    <div className={fullWidth ? 'min-w-0 flex-1' : word ? 'w-40 max-w-full' : landscape ? 'w-32 shrink-0' : 'w-14 shrink-0'}>
      <StickerCard size="none" elevation="flat" radius={readOnly ? 'md' : 'left'} className="relative h-full overflow-hidden">
        <svg role="img" aria-label={`${label}，直接手写区域`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
          className={fullWidth ? 'block h-auto w-full' : landscape ? 'absolute inset-0 block h-full w-full' : 'block h-20 w-full'} style={{ touchAction: readOnly ? 'auto' : 'none', userSelect: 'none' }}
          onPointerDown={event => {
            if (readOnly || pointer.current !== null || !event.isPrimary || event.button !== 0 || ink.current.length >= 250 || ink.current.reduce((count, stroke) => count + stroke.length, 0) >= 10000) return
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
            pointer.current = event.pointerId; setDrawing(true); callback.current(true)
            show([...ink.current, [point(event)]])
          }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
          <line x1="8" y1={height * 0.775} x2={width - 8} y2={height * 0.775} stroke="var(--gray-5)" strokeDasharray="6 6" />
          <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
            {draft.map((stroke, index) => stroke.length === 1
              ? <circle key={index} cx={stroke[0].x} cy={stroke[0].y} r="3.5" fill="currentColor" stroke="none" />
              : <path key={index} d={stroke.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')} />)}
          </g>
        </svg>
      </StickerCard>
    </div>
    {!readOnly && <StickerCard size="none" elevation="flat" radius="none" className="-ml-0.5 shrink-0">
      <Flex direction="column" justify="between" align="center" height="100%" p="1" aria-label={`${label}书写操作`}>
      <IconButton size="1" variant="ghost" color="gray" title="撤销最后一笔" aria-label={`撤销${label}最后一笔`} disabled={drawing || !strokes.length} onClick={() => onChange(strokes.slice(0, -1))}><Undo2 size={16} strokeWidth={1.5} aria-hidden="true" /></IconButton>
      <IconButton size="1" variant="ghost" color="gray" title="清除本格" aria-label={`清除${label}`} disabled={drawing || !strokes.length} onClick={() => onChange([])}><Eraser size={16} strokeWidth={1.5} aria-hidden="true" /></IconButton>
      {onKeyboardRequest && <IconButton size="1" variant="ghost" color="gray" title={strokes.length ? '清除笔迹后可切换键盘' : '键盘输入'} aria-label={`${label}切换键盘输入`} disabled={drawing || strokes.length > 0} onClick={onKeyboardRequest}><Keyboard size={16} strokeWidth={1.5} aria-hidden="true" /></IconButton>}
      </Flex>
    </StickerCard>}
  </Flex>
}

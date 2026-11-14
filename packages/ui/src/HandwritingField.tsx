'use client'

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { HandwritingAnchor } from './HandwritingAnchor'
import { AppDialog } from './AppDialog'
import { StickerCard } from './StickerCard'
import { Box, Button, Flex, Text, TextField } from './themes'

export type HandwritingPoint = { x: number; y: number }
export type HandwritingStroke = readonly HandwritingPoint[]
export type HandwritingAnswer =
  | { kind: 'ink'; strokes: readonly HandwritingStroke[] }
  | { kind: 'text'; text: string }
export type HandwritingFieldProps = {
  label: string
  value: HandwritingAnswer | null
  onChange: (answer: HandwritingAnswer | null) => void
  readOnly?: boolean
  maxWords?: number
  presentation?: 'dialog' | 'anchored'
  /** Empty block after the complete question, used when no unobstructed floating position fits. */
  inlineTarget?: RefObject<HTMLDivElement | null>
  onEditingChange?: (editing: boolean) => void
}

const WIDTH = 600
const HEIGHT = 440
function strokePath(stroke: HandwritingStroke) {
  return stroke.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
}
function Ink({ strokes }: { strokes: readonly HandwritingStroke[] }) {
  return <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {strokes.map((stroke, index) => stroke.length === 1
      ? <circle key={index} cx={stroke[0].x} cy={stroke[0].y} r="1.5" fill="currentColor" stroke="none" />
      : <path key={index} d={strokePath(stroke)} />)}
  </g>
}
function inkBounds(strokes: readonly HandwritingStroke[]) {
  let left = Infinity, top = Infinity, right = 0, bottom = 0
  for (const stroke of strokes) for (const point of stroke) {
    left = Math.min(left, point.x); top = Math.min(top, point.y)
    right = Math.max(right, point.x); bottom = Math.max(bottom, point.y)
  }
  if (!Number.isFinite(left)) return `0 0 ${WIDTH} ${HEIGHT}`
  return `${left - 12} ${top - 12} ${Math.max(36, right - left + 24)} ${Math.max(36, bottom - top + 24)}`
}

/** Saves original pen strokes or typed text; never recognizes, corrects or grades an answer. */
export function HandwritingField({ label, value, onChange, readOnly = false, maxWords, presentation = 'dialog', inlineTarget, onEditingChange }: HandwritingFieldProps) {
  const compact = presentation === 'anchored'
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'ink' | 'text'>('ink')
  const [strokes, setStrokes] = useState<readonly HandwritingStroke[]>([])
  const [text, setText] = useState('')
  const [drawing, setDrawing] = useState(false)
  const strokesRef = useRef<readonly HandwritingStroke[]>([])
  const pointer = useRef<number | null>(null)
  const previouslyReadOnly = useRef(readOnly)
  const editingCallback = useRef(onEditingChange)
  useEffect(() => {
    editingCallback.current = onEditingChange
  }, [onEditingChange])
  useEffect(() => {
    editingCallback.current?.(open && !readOnly)
    return () => editingCallback.current?.(false)
  }, [open, readOnly])
  useEffect(() => {
    if (readOnly && !previouslyReadOnly.current) {
      // Submission/deadline locks must never display an unconfirmed draft as the saved answer.
      pointer.current = null; setDrawing(false); setOpen(false)
    }
    previouslyReadOnly.current = readOnly
  }, [readOnly])
  const writeStrokes = (next: readonly HandwritingStroke[]) => { strokesRef.current = next; setStrokes(next) }
  const changeOpen = (next: boolean) => {
    pointer.current = null; setDrawing(false)
    if (next) {
      writeStrokes(value?.kind === 'ink' ? value.strokes : [])
      setText(value?.kind === 'text' ? value.text : '')
      setMode(value?.kind === 'text' ? 'text' : 'ink')
    }
    setOpen(next)
  }
  // Older tall-canvas answers remain fully visible; new compact answers use a 2:1 canvas.
  const canvasHeight = compact && !strokes.some(stroke => stroke.some(point => point.y > 300)) ? 300 : HEIGHT
  const point = (event: PointerEvent<SVGSVGElement>): HandwritingPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(WIDTH, (event.clientX - rect.left) / rect.width * WIDTH)),
      y: Math.max(0, Math.min(canvasHeight, (event.clientY - rect.top) / rect.height * canvasHeight)),
    }
  }
  const appendPoint = (event: PointerEvent<SVGSVGElement>) => {
    if (readOnly || pointer.current !== event.pointerId) return
    const previous = strokesRef.current
    const last = previous[previous.length - 1]
    if (!last) return
    writeStrokes([...previous.slice(0, -1), [...last, point(event)]])
  }
  const finishStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return
    if (event.type === 'pointerup') appendPoint(event)
    pointer.current = null; setDrawing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const tooManyWords = !!maxWords && words > maxWords
  const draftEmpty = mode === 'ink' ? !strokes.length : !text.trim()
  const save = () => {
    if (readOnly || drawing || (mode === 'text' && tooManyWords)) return
    onChange(draftEmpty ? null : mode === 'ink' ? { kind: 'ink', strokes } : { kind: 'text', text: text.trim() })
    changeOpen(false)
  }

  const trigger = <Button size="3" variant="soft" aria-label={`第 ${label} 空，${value ? readOnly ? '查看答案' : '点击编辑答案' : '点击手写'}`}>
      {label} · {value?.kind === 'ink'
        ? <svg viewBox={inkBounds(value.strokes)} width="100" height="30" role="img" aria-label="已填写的手写笔迹"><Ink strokes={value.strokes} /></svg>
        : value?.kind === 'text' ? value.text : '手写'}
    </Button>
  const editor = <Flex direction="column" gap={compact ? '2' : '4'}>
      {compact && <Text size="2" weight="bold">第 {label} 空 · {readOnly ? '查看笔迹' : maxWords === 1 ? '写一个单词' : maxWords ? `最多 ${maxWords} 词` : '手写答案'}</Text>}
      {!readOnly && <Flex gap="2" wrap="wrap" aria-label="输入方式">
        <Button size={compact ? '2' : '3'} variant={mode === 'ink' ? 'solid' : 'soft'} aria-pressed={mode === 'ink'} disabled={drawing} onClick={() => setMode('ink')}>手写</Button>
        <Button size={compact ? '2' : '3'} variant={mode === 'text' ? 'solid' : 'soft'} aria-pressed={mode === 'text'} disabled={drawing} onClick={() => setMode('text')}>键盘输入</Button>
      </Flex>}
      {mode === 'ink' ? <>
        <StickerCard size="none" elevation="flat">
          {/* Freehand drawing surface: Radix controls own the surrounding actions. */}
          <svg viewBox={`0 0 ${WIDTH} ${canvasHeight}`} preserveAspectRatio="xMidYMid meet" role="img"
            aria-label={`第 ${label} 空手写区域；可切换键盘输入`} className="block w-full"
            style={{ aspectRatio: `${WIDTH} / ${canvasHeight}`, touchAction: readOnly ? 'auto' : 'none', userSelect: 'none' }}
            onPointerDown={event => {
              if (readOnly || pointer.current !== null || !event.isPrimary || event.button !== 0) return
              event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
              pointer.current = event.pointerId; setDrawing(true)
              writeStrokes([...strokesRef.current, [point(event)]])
            }}
            onPointerMove={appendPoint} onPointerUp={finishStroke} onPointerCancel={finishStroke}
            onLostPointerCapture={finishStroke}>
            {(canvasHeight === 300 ? [80, 150, 220] : [130, 220, 310]).map((y, index) => <line key={y} x1="12" y1={y} x2="588" y2={y} stroke="var(--gray-5)" strokeDasharray={index === 1 ? '5 5' : undefined} />)}
            <Ink strokes={strokes} />
          </svg>
        </StickerCard>
        {!readOnly && <Flex gap="3" wrap="wrap"><Button size={compact ? '2' : '3'} variant="soft" disabled={drawing || !strokes.length} onClick={() => writeStrokes(strokesRef.current.slice(0, -1))}>撤销一笔</Button><Button size={compact ? '2' : '3'} variant="soft" disabled={drawing || !strokes.length} onClick={() => writeStrokes([])}>清空</Button></Flex>}
        {!compact && <Text size="2" color="gray">保留原始笔迹，不识别文字、不自动纠正拼写。</Text>}
      </> : <Box><TextField.Root size="3" aria-label={`第 ${label} 空键盘输入`} value={text} readOnly={readOnly} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} onChange={event => setText(event.target.value)} />{tooManyWords && <Text color="red" role="alert">本空最多填写 {maxWords} 个单词。</Text>}</Box>}
      <Flex justify="end" gap="3" wrap="wrap">
        <Button size={compact ? '2' : '3'} variant="soft" onClick={() => changeOpen(false)}>{readOnly ? '关闭' : '取消'}</Button>
        {!readOnly && <Button size={compact ? '2' : '3'} disabled={drawing || (mode === 'text' && tooManyWords) || (draftEmpty && !value)} onClick={save}>{draftEmpty ? '清除答案' : '写好了'}</Button>}
      </Flex>
    </Flex>
  if (compact) return <HandwritingAnchor open={open} onOpenChange={changeOpen} trigger={trigger}
    label={`第 ${label} 空手写`} inlineTarget={inlineTarget}>{editor}</HandwritingAnchor>
  return <AppDialog title={`第 ${label} 空`} size="form" open={open} onOpenChange={changeOpen}
    description={readOnly ? '已提交的答案，可放大查看。' : `用手指或触控笔书写${maxWords === 1 ? '一个英文单词' : '答案'}，写好后确认。`}
    trigger={trigger}>{editor}</AppDialog>
}

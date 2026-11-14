'use client'

import { useState, type RefObject } from 'react'
import { InlineHandwritingPad, type HandwritingStroke } from '@rosie/ui'
import { Box, Button, Flex, TextField } from '@rosie/ui/themes'
import type { ExamAnswer } from '../types/attempts'

const EMPTY: readonly HandwritingStroke[] = []

export function ExamGapAnswer({ label, gapId, maxWords, answer, onChange, readOnly, handwritingEnabled, onEditingChange, letter = false, fullWidth = false }: {
  label: string; gapId: string; maxWords?: number; answer?: Extract<ExamAnswer, { type: 'gap_fill' }>
  onChange: (answer: ExamAnswer) => void; readOnly: boolean; handwritingEnabled?: boolean
  inlineTarget?: RefObject<HTMLDivElement | null>
  onEditingChange?: (editing: boolean) => void
  fullWidth?: boolean
  letter?: boolean
}) {
  const [keyboard, setKeyboard] = useState(false)
  const ink = answer?.ink?.[gapId]
  const text = answer?.values[gapId] ?? ''
  const oversized = Boolean(ink?.strokes.some(stroke => stroke.some(point => point.y > 200 || (letter && point.x > 200))))
  const [legacyCanvas, setLegacyCanvas] = useState(oversized)
  if (oversized && !legacyCanvas) setLegacyCanvas(true)
  if ((!handwritingEnabled || keyboard || text) && !ink) return <Box display="inline-block" width={fullWidth ? '100%' : letter ? '80px' : maxWords === 1 ? '160px' : '220px'}>
    <TextField.Root size="2" aria-label={`第 ${label} 空${maxWords ? `，最多 ${maxWords} 词` : ''}`} placeholder={label}
      value={text} readOnly={readOnly} autoComplete="off" spellCheck={false}
      onChange={event => onChange({ type: 'gap_fill', ...answer, values: { ...answer?.values, [gapId]: event.target.value } })} />
    {handwritingEnabled && !readOnly && !text && <Button size="1" variant="ghost" onClick={() => setKeyboard(false)}>手写</Button>}
  </Box>
  return <Box display={fullWidth ? 'block' : 'inline-block'} width={fullWidth ? '100%' : undefined}>
    <Flex direction="column" gap="1">
      <InlineHandwritingPad fullWidth={fullWidth} label={label} canvasSize={legacyCanvas ? { width: 600, height: 440 } : undefined} word={!letter} strokes={ink?.strokes ?? EMPTY}
        readOnly={readOnly || !handwritingEnabled}
        onDrawingChange={active => onEditingChange?.(active)}
        onKeyboardRequest={() => setKeyboard(true)}
        onChange={strokes => {
          const nextInk = { ...answer?.ink }
          if (strokes.length) nextInk[gapId] = { strokes }
          else delete nextInk[gapId]
          onChange({ type: 'gap_fill', values: { ...answer?.values, [gapId]: '' },
            ...(Object.keys(nextInk).length ? { ink: nextInk } : {}) })
        }} />
    </Flex>
  </Box>
}

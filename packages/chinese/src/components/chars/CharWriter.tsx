'use client'

import { useEffect, useRef } from 'react'
import type HanziWriter from 'hanzi-writer'
import type { StrokeOrderData } from '../../types/chineseCharData'

function toHanziCharData(strokeOrder: StrokeOrderData) {
  return {
    strokes: strokeOrder.strokes,
    medians: strokeOrder.medians,
    radStrokes: strokeOrder.radStrokes ?? [],
  }
}

export interface CharWriterProps {
  char: string
  strokeOrder: StrokeOrderData
  /** animate = demo stroke order; quiz = trace practice */
  mode: 'animate' | 'quiz'
  size?: number
  onQuizComplete?: (summary: { totalMistakes: number }) => void
}

export default function CharWriter({
  char,
  strokeOrder,
  mode,
  size = 220,
  onQuizComplete,
}: CharWriterProps) {
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const onCompleteRef = useRef(onQuizComplete)
  onCompleteRef.current = onQuizComplete

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    let cancelled = false
    el.innerHTML = ''

    void import('hanzi-writer').then(({ default: HanziWriterLib }) => {
      if (cancelled || !targetRef.current) return

      const charData = toHanziCharData(strokeOrder)
      const writer = HanziWriterLib.create(targetRef.current, char, {
        width: size,
        height: size,
        padding: 14,
        showOutline: true,
        outlineColor: '#cbd5e1',
        strokeColor: '#c2410c',
        radicalColor: '#059669',
        drawingColor: '#1e40af',
        drawingWidth: 5,
        showHintAfterMisses: 3,
        highlightOnComplete: true,
        charDataLoader: (_c, onComplete) => {
          onComplete(charData)
        },
      })
      writerRef.current = writer

      if (mode === 'animate') {
        writer.animateCharacter()
      } else {
        writer.quiz({
          onComplete: (summary) =>
            onCompleteRef.current?.({ totalMistakes: summary.totalMistakes }),
        })
      }
    })

    return () => {
      cancelled = true
      writerRef.current?.cancelQuiz()
      writerRef.current?.hideCharacter()
      writerRef.current = null
      if (targetRef.current) targetRef.current.innerHTML = ''
    }
  }, [char, strokeOrder, mode, size])

  return (
    <div className="flex justify-center">
      <div
        className="cn-grid-cell relative overflow-hidden !h-auto !w-auto p-2"
        style={{ width: size + 24, height: size + 24 }}
      >
        <div ref={targetRef} className="mx-auto" />
      </div>
    </div>
  )
}

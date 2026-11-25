'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, Slider } from '@rosie/ui/themes'
import { cueIndexAtOrBefore, theaterTime } from '@/lib/theater/subtitle-timeline'
import type { TheaterCue } from '@/lib/theater/types'

const batchSize = 40
const maxBufferedCues = batchSize * 3
const loadThreshold = 160
const timeBubbleDelayMs = 650

type CueRange = { start: number; end: number }
type ScrollAdjustment =
  | { kind: 'jump'; index: number }
  | { kind: 'anchor'; row: HTMLElement; offset: number }

export type SubtitlePositionRequest = { positionMs: number }

function cueAtScrollTop(list: HTMLUListElement) {
  let low = 0
  let high = list.children.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const row = list.children[middle] as HTMLElement
    if (row.offsetTop + row.offsetHeight <= list.scrollTop) low = middle + 1
    else high = middle
  }
  return low
}

export default function TheaterSubtitleTimeline({ cues, positionRequest, children }: {
  cues: TheaterCue[]
  positionRequest: SubtitlePositionRequest | null
  children: (cue: TheaterCue, previous: TheaterCue | undefined) => ReactNode
}) {
  const [range, setRange] = useState<CueRange>({ start: 0, end: batchSize })
  const [positionIndex, setPositionIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [timeVisible, setTimeVisible] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const sliderRef = useRef<HTMLSpanElement>(null)
  const dragging = useRef(false)
  const hideTimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmedScroll = useRef<number | null>(null)
  const adjustment = useRef<ScrollAdjustment | null>(null)
  const handledRequest = useRef<SubtitlePositionRequest | null>(null)
  const end = Math.min(range.end, cues.length)
  const start = Math.min(range.start, Math.max(0, end - Math.floor(batchSize / 2)))

  useEffect(() => () => {
    if (hideTimeTimer.current !== null) clearTimeout(hideTimeTimer.current)
  }, [])

  function revealTime() {
    if (hideTimeTimer.current !== null) clearTimeout(hideTimeTimer.current)
    setTimeVisible(true)
    hideTimeTimer.current = dragging.current ? null : setTimeout(() => setTimeVisible(false), timeBubbleDelayMs)
  }

  const scrollListTo = useCallback((list: HTMLUListElement, top: number) => {
    list.scrollTop = top
    programmedScroll.current = list.scrollTop
  }, [])

  const jumpToCue = useCallback((index: number) => {
    setPreviewIndex(null)
    setPositionIndex(index)
    if (index < start || index >= end) {
      adjustment.current = { kind: 'jump', index }
      setRange({
        start: Math.max(0, index - Math.floor(batchSize / 2)),
        end: index + Math.ceil(batchSize / 2),
      })
      return
    }
    const list = listRef.current
    const row = list?.children[index - start] as HTMLElement | undefined
    if (list && row) scrollListTo(list, row.offsetTop)
  }, [end, scrollListTo, start])

  useEffect(() => {
    if (!positionRequest || handledRequest.current === positionRequest) return
    const frame = requestAnimationFrame(() => {
      handledRequest.current = positionRequest
      jumpToCue(Math.max(0, cueIndexAtOrBefore(cues, positionRequest.positionMs)))
    })
    return () => cancelAnimationFrame(frame)
  }, [cues, jumpToCue, positionRequest])

  useLayoutEffect(() => {
    const list = listRef.current
    const pending = adjustment.current
    if (!list || !pending) return
    adjustment.current = null
    if (pending.kind === 'anchor') {
      if (list.contains(pending.row)) scrollListTo(list, pending.row.offsetTop - pending.offset)
      return
    }
    const row = list.children[pending.index - start] as HTMLElement | undefined
    if (row) scrollListTo(list, row.offsetTop)
  }, [end, scrollListTo, start])

  function handleScroll(list: HTMLUListElement) {
    if (adjustment.current || !list.children.length) return
    const { clientHeight, scrollHeight, scrollTop } = list
    const distanceToEnd = scrollHeight - clientHeight - scrollTop
    const firstVisible = cueAtScrollTop(list)
    if (programmedScroll.current !== scrollTop) {
      setPositionIndex(distanceToEnd <= 1 && end === cues.length ? end - 1 : start + firstVisible)
      if (cues.length > 1) revealTime()
    }
    programmedScroll.current = null
    let next: CueRange
    if (scrollTop < loadThreshold && start > 0) {
      const nextStart = Math.max(0, start - batchSize)
      next = { start: nextStart, end: Math.min(end, nextStart + maxBufferedCues) }
    } else if (distanceToEnd < loadThreshold && end < cues.length) {
      const nextEnd = Math.min(cues.length, end + batchSize)
      next = { start: Math.max(start, nextEnd - maxBufferedCues), end: nextEnd }
    } else return

    if (next.start !== start) {
      const row = list.children[firstVisible] as HTMLElement
      adjustment.current = { kind: 'anchor', row, offset: row.offsetTop - scrollTop }
    }
    setRange(next)
  }

  const lastIndex = cues.length - 1
  const sliderIndex = Math.min(lastIndex, previewIndex ?? positionIndex)
  const time = theaterTime(cues[sliderIndex]?.startMs ?? 0).padStart(5, '0')
  const hasTimeline = lastIndex > 0
  useEffect(() => {
    // Themes 的 Slider 将 ARIA 属性放在容器上，实际获得焦点的是内部滑块。
    const thumb = sliderRef.current?.querySelector('[role="slider"]')
    thumb?.setAttribute('aria-label', '定位字幕时间')
    thumb?.setAttribute('aria-valuetext', time)
  }, [hasTimeline, time])

  function stopPreview() {
    dragging.current = false
    setPreviewIndex(null)
    revealTime()
  }

  return (
    <div className="relative min-w-0">
      <ul ref={listRef} tabIndex={0} aria-label="全片字幕时间线"
        className={`relative max-h-[32rem] min-w-0 overflow-y-auto overscroll-contain px-0.5 [overflow-anchor:none]
          ${hasTimeline ? 'pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
        onScroll={event => handleScroll(event.currentTarget)}>
        {cues.slice(start, end).map((cue, offset) => children(cue, cues[start + offset - 1]))}
      </ul>
      {hasTimeline && <div className="absolute inset-y-1 right-0 z-10 w-5">
        <Slider ref={sliderRef} size="1" color="gray" orientation="vertical" inverted
          className={`h-full! w-full! [--slider-track-size:2px]! transition-opacity
            motion-reduce:transition-none hover:opacity-100 has-[:focus-visible]:opacity-100
            ${timeVisible ? 'opacity-100' : 'opacity-50'}`}
          min={0} max={lastIndex} value={[sliderIndex]}
          onPointerDown={() => { dragging.current = true; revealTime() }}
          onPointerUp={stopPreview} onPointerCancel={stopPreview}
          onValueChange={values => { if (dragging.current) setPreviewIndex(values[0]) }}
          onValueCommit={values => { jumpToCue(values[0]); revealTime() }} />
        <Badge aria-hidden="true" size="1" color="gray" variant="solid" radius="full"
          className={`pointer-events-none absolute right-full -translate-y-1/2 tabular-nums
            transition-opacity motion-reduce:transition-none ${timeVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ top: `clamp(0.75rem, ${(sliderIndex / lastIndex) * 100}%, calc(100% - 0.75rem))` }}>
          {time}
        </Badge>
      </div>}
    </div>
  )
}

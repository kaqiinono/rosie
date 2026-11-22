'use client'

import { useEffect, useRef } from 'react'
import { Button, Checkbox } from '@rosie/ui/themes'
import { toggleListeningRange } from '../../utils/listening-range'

type Props = {
  id: string
  texts: readonly string[]
  currentIndex: number
  selected: readonly number[]
  onChange: (indices: number[]) => void
  onDismiss: () => void
  unit?: '段' | '句'
  largeText?: boolean
}

export default function ListeningClipPicker({ id, texts, currentIndex, selected, onChange, onDismiss, unit = '段', largeText = false }: Props) {
  const list = useRef<HTMLDivElement>(null)
  const first = selected[0]
  const last = selected.at(-1)

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-current-clip]')?.focus()
  }, [])

  return (
    <div id={id} role="group" aria-label="听记片段" className="my-2 flex min-h-24 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onDismiss()
        }
      }}>
      <div className={`flex items-center justify-between gap-2 pb-1 ${largeText ? 'text-base' : 'text-sm'}`}>
        <span role="status" className="text-text-secondary font-bold tabular-nums">
          {first === undefined || last === undefined ? `已选 0 ${unit}`
            : `已选第 ${first + 1}${last === first ? '' : `–${last + 1}`} ${unit}`}
        </span>
        <Button type="button" variant="soft" color="gray" size="2" className={largeText ? 'text-base' : undefined} disabled={first === undefined}
          onClick={() => onChange([])}>
          清空
        </Button>
      </div>
      <div ref={list} className="min-h-12 overflow-y-auto overscroll-contain rounded-xl border border-kid-line p-1">
        {texts.map((text, index) => (
          <label key={index} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 ${largeText ? 'text-base' : 'text-sm'} text-text-primary hover:bg-amber-50 has-[button[data-state=checked]]:bg-amber-100`}>
            <Checkbox color="orange" checked={first !== undefined && last !== undefined && index >= first && index <= last}
              data-current-clip={index === currentIndex ? '' : undefined}
              onCheckedChange={() => onChange(toggleListeningRange(selected, index))} />
            <span className="text-text-secondary font-bold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
            <span lang="en" className="min-w-0 flex-1 truncate">{text}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

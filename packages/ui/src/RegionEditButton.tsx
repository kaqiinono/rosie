'use client'

import { Pencil } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { IconButton } from './themes'

type Props = {
  label: string
  tone: 'text' | 'image' | 'question'
  disabled?: boolean
  onClick: () => void
}

/** The relative parent owns the region dimensions; this rail occupies no layout space. */
export function RegionEditButton({ label, tone, disabled, onClick }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const button = buttonRef.current
    const region = button?.parentElement
    if (!button || !region) return
    const resize = (height: number) => {
      const side = `${Math.min(height, 32)}px`
      button.style.height = side
      button.style.width = side
    }
    resize(region.offsetHeight)
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) resize(entry.borderBoxSize[0]?.blockSize ?? region.offsetHeight)
    })
    observer.observe(region, { box: 'border-box' })
    return () => observer.disconnect()
  }, [])

  return <IconButton ref={buttonRef} className="rosie-RegionEditButton" size="1" radius="none" variant="soft"
    color={tone === 'text' ? 'sky' : tone === 'image' ? 'green' : 'violet'}
    aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <Pencil size={14} aria-hidden="true" />
  </IconButton>
}

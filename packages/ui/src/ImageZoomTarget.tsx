'use client'

import { Expand } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { IconButton } from './themes'

/** A separate image action, never nested inside a choice label or radio button. */
export function ImageZoomTarget({ children, label, maxWidth, onOpen }: {
  children: ReactNode; label: string; maxWidth?: number
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return <div className="rosie-ImageZoomTarget" style={{ maxWidth }}>
    {children}
    <IconButton type="button" variant="ghost" className="rosie-ImageZoomTarget-trigger"
      aria-label={label} title={label} onClick={onOpen}>
      <Expand size={20} aria-hidden="true" />
    </IconButton>
  </div>
}

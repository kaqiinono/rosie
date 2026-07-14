'use client'

import type { ReactNode } from 'react'

type FilterRowProps = {
  label: string
  children: ReactNode
  className?: string
}

export default function FilterRow({ label, children, className = '' }: FilterRowProps) {
  return (
    <div className={`flex flex-wrap items-start gap-2 ${className}`}>
      <span className="min-w-[62px] pt-1.5 text-[.7rem] font-extrabold tracking-wider text-[var(--wm-text-dim)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

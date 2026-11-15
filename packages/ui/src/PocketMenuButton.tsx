'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { StickerCard } from './StickerCard'

/** Child-facing menu trigger; forwards Radix trigger props and its anchor ref. */
export const PocketMenuButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function PocketMenuButton({ className, children, type = 'button', ...props }, ref) {
    return (
      <StickerCard asChild interactive tone="paper" size="none" elevation="md" radius="lg">
        <button
          {...props}
          ref={ref}
          type={type}
          className={clsx(
            'group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 py-2 text-base font-bold text-text-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-9)]',
            'active:shadow-sticker-pressed disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
        >
          <span aria-hidden="true" className="text-2xl leading-none transition-transform duration-200 ease-spring group-data-[state=open]:rotate-12 motion-reduce:transition-none motion-reduce:transform-none">🌼</span>
          {children ?? '小口袋'}
        </button>
      </StickerCard>
    )
  },
)

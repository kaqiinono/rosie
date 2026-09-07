'use client'

import { useEffect, useId, useRef, useState } from 'react'

type SelectControlOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectControlProps = {
  value: string
  options: SelectControlOption[]
  onValueChange: (value: string) => void
  ariaLabel: string
  label?: string
  disabled?: boolean
  className?: string
  selectClassName?: string
  appearance?: 'amber' | 'violet-dark'
}

export default function SelectControl({
  value,
  options,
  onValueChange,
  ariaLabel,
  label,
  disabled = false,
  className = '',
  selectClassName = '',
  appearance = 'amber',
}: SelectControlProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selectedOption = options[selectedIndex]
  const dark = appearance === 'violet-dark'

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [open])

  const selectOption = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onValueChange(option.value)
    setActiveIndex(index)
    setOpen(false)
  }

  const moveActive = (direction: 1 | -1) => {
    if (options.length === 0) return
    let next = activeIndex
    for (let step = 0; step < options.length; step += 1) {
      next = (next + direction + options.length) % options.length
      if (!options[next]?.disabled) {
        setActiveIndex(next)
        return
      }
    }
  }

  return (
    <div
      ref={rootRef}
      className={`inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-500 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
    >
      {label && <span className="shrink-0">{label}</span>}
      <span className="relative inline-flex min-w-0 flex-1">
        <button
          type="button"
          role="combobox"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
          onClick={() => {
            setActiveIndex(selectedIndex)
            setOpen((current) => !current)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) {
                setActiveIndex(selectedIndex)
                setOpen(true)
              } else {
                moveActive(event.key === 'ArrowDown' ? 1 : -1)
              }
              return
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (open) selectOption(activeIndex)
              else setOpen(true)
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
            if (event.key === 'Tab') setOpen(false)
          }}
          className={`inline-flex min-h-11 w-full cursor-pointer items-center rounded-xl border py-2 pr-9 pl-3 text-left text-sm font-extrabold whitespace-nowrap shadow-sm outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed ${
            dark
              ? 'border-violet-300/25 bg-slate-950/70 text-violet-100 shadow-violet-950/20 hover:border-violet-300/45 hover:bg-violet-950/40 focus-visible:border-violet-300/70 focus-visible:ring-violet-400/25 disabled:bg-slate-900 disabled:text-slate-500'
              : 'border-amber-200 bg-white text-amber-950 hover:border-amber-300 hover:bg-amber-50/50 focus-visible:border-amber-400 focus-visible:ring-amber-300 focus-visible:ring-offset-1 disabled:bg-slate-100 disabled:text-slate-400'
          } ${selectClassName}`}
        >
          {selectedOption?.label ?? '请选择'}
        </button>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-transform ${
            dark ? 'text-violet-300' : 'text-amber-700'
          } ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path d="m6 8 4 4 4-4" />
        </svg>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            style={dark ? { backgroundColor: '#0f172a' } : undefined}
            className={`absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 max-h-72 min-w-max overflow-y-auto rounded-2xl border p-1.5 ${
              dark
                ? 'isolate border-violet-300/30 bg-slate-950 shadow-[0_20px_52px_rgba(2,6,23,0.92)]'
                : 'border-amber-200 bg-white shadow-[0_16px_40px_rgba(120,53,15,0.18)]'
            }`}
          >
            {options.map((option, index) => {
              const selected = option.value === value
              const active = index === activeIndex
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => {
                    if (!option.disabled) setActiveIndex(index)
                  }}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(index)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap transition ${
                    option.disabled
                      ? dark
                        ? 'cursor-not-allowed text-slate-600'
                        : 'cursor-not-allowed text-slate-300'
                      : selected
                        ? dark
                          ? 'bg-violet-500 text-white'
                          : 'bg-amber-500 text-white'
                        : active
                          ? dark
                            ? 'bg-violet-400/15 text-violet-100'
                            : 'bg-amber-50 text-amber-900'
                          : dark
                            ? 'text-slate-300 hover:bg-violet-400/10 hover:text-violet-100'
                            : 'text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="flex-1">{option.label}</span>
                  {selected && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-4 w-4"
                    >
                      <path d="m5 10 3 3 7-7" />
                    </svg>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </span>
    </div>
  )
}

export type { SelectControlOption, SelectControlProps }

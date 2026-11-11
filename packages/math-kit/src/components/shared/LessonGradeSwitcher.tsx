'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GRADE_LABEL, gradesInOrder } from '@rosie/math-kit/utils/lesson-grade'
import { firstLessonRouteForGrade, lessonFromHref } from '@rosie/math-kit/utils/lesson-registry'
import { Button } from '@rosie/ui/themes'

type Props = {
  basePath: string
  activeColor: string
}

type DropdownPosition = {
  top: number
  left: number
}

export default function LessonGradeSwitcher({ basePath, activeColor }: Props) {
  const pathname = usePathname()
  const current = lessonFromHref(basePath)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)

  const grades = gradesInOrder()

  const updateDropdownPos = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    window.addEventListener('resize', updateDropdownPos)
    window.addEventListener('scroll', updateDropdownPos, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPos)
      window.removeEventListener('scroll', updateDropdownPos, true)
    }
  }, [open, updateDropdownPos])

  const [previousPath, setPreviousPath] = useState(pathname)
  if (previousPath !== pathname) {
    setPreviousPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (!current || grades.length <= 1) return null

  const currentLabel = GRADE_LABEL[current.grade] ?? `${current.grade} 年级`

  return (
    <div className="relative shrink-0">
      <Button
        ref={buttonRef}
        type="button"
        size="2"
        variant="outline"
        color="gray"
        radius="large"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="切换年级"
        onClick={() => {
          if (!open) updateDropdownPos()
          setOpen(!open)
        }}
      >
        <span className="max-w-[4.5rem] truncate sm:max-w-none">{currentLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Button>

      {open &&
        dropdownPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            className="border-border-light shadow-sticker fixed z-[200] min-w-[8.5rem] overflow-hidden rounded-xl border bg-white py-1"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {grades.map((grade) => {
              const href = firstLessonRouteForGrade(grade)
              if (!href) return null
              const label = GRADE_LABEL[grade] ?? `${grade} 年级`
              const isCurrent = grade === current.grade
              return (
                <Link
                  key={grade}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-[12px] font-medium no-underline transition-colors sm:text-[13px] ${
                    isCurrent
                      ? `${activeColor} bg-gray-50 font-bold`
                      : 'text-text-secondary hover:bg-gray-50'
                  }`}
                >
                  {label}
                  {isCurrent && <span className="text-text-muted ml-auto text-[10px]">当前</span>}
                </Link>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

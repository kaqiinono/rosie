'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COURSES } from '@rosie/math-kit/utils/courses-data'
import {
  lessonFromHref,
  lessonsForGradeRegistry,
  routeForLesson,
} from '@rosie/math-kit/utils/lesson-registry'
import { LESSON_HEADER_MORE_BTN } from './lesson-header-chrome'

type Props = {
  basePath: string
  activeColor: string
}

type Lecture = {
  href: string
  icon: string
  label: string
  title: string
}

type DropdownPosition = {
  top: number
  left: number
}

/** 窄屏的同年级讲次选择器，避免顶栏挤出一排独立讲次入口。 */
export default function LessonLectureSwitcher({ basePath, activeColor }: Props) {
  const pathname = usePathname()
  const current = lessonFromHref(basePath)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)

  const lectures = useMemo<Lecture[]>(() => {
    if (!current) return []
    return lessonsForGradeRegistry(current.grade)
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((entry) => {
        const href = routeForLesson(entry)
        const course = COURSES.find((item) => item.href === href)
        return {
          href,
          icon: course?.icon ?? '📘',
          label: course?.lectureNum ?? `第 ${entry.seq} 讲`,
          title: course?.title ?? `第 ${entry.seq} 讲`,
        }
      })
  }, [current])

  const updateDropdownPos = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null)
      return
    }
    updateDropdownPos()
    window.addEventListener('resize', updateDropdownPos)
    window.addEventListener('scroll', updateDropdownPos, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPos)
      window.removeEventListener('scroll', updateDropdownPos, true)
    }
  }, [open, updateDropdownPos])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

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

  if (!current || lectures.length === 0) return null

  const activeLecture = lectures.find((lecture) => pathname === lecture.href || pathname.startsWith(`${lecture.href}/`))

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="切换讲次"
        onClick={() => setOpen((value) => !value)}
        className={`${LESSON_HEADER_MORE_BTN} ${activeColor}`}
      >
        <span className="max-w-[5.5rem] truncate">{activeLecture?.label ?? '选择讲次'}</span>
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
      </button>

      {open && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          className="border-border-light fixed z-[200] max-h-64 min-w-[10rem] overflow-y-auto rounded-xl border bg-white py-1 shadow-lg"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {lectures.map((lecture) => {
            const isCurrent = lecture.href === activeLecture?.href
            return (
              <Link
                key={lecture.href}
                href={lecture.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-[12px] font-medium no-underline transition-colors ${
                  isCurrent ? `${activeColor} bg-gray-50 font-bold` : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                <span className="text-base leading-none">{lecture.icon}</span>
                <span className="min-w-0 truncate">{lecture.label} · {lecture.title}</span>
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

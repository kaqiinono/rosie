'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COURSES } from '@rosie/math/utils/courses-data'
import {
  lessonFromHref,
  lessonsForGradeRegistry,
  routeForLesson,
} from '@rosie/math/utils/lesson-registry'
import {
  lessonHeaderNavActive,
  LESSON_HEADER_MORE_BTN,
  LESSON_HEADER_NAV_IDLE,
} from './lesson-header-chrome'

type Props = {
  basePath: string
  activeColor: string
  activeBorderColor: string
}

type NavItem = {
  href: string
  icon: string
  lectureNum: string
  shortTitle: string
}

type NavItemLinkProps = {
  item: NavItem
  active: boolean
  activeColor: string
  onNavigate?: () => void
}

type DropdownPosition = {
  top: number
  right: number
}

function NavItemLink({ item, active, activeColor, onNavigate }: NavItemLinkProps) {
  return (
    <Link
      href={item.href}
      title={item.shortTitle}
      onClick={onNavigate}
      className={active ? lessonHeaderNavActive(activeColor) : LESSON_HEADER_NAV_IDLE}
    >
      <span className="text-sm leading-none sm:text-base">{item.icon}</span>
      <span>{item.lectureNum}</span>
      <span className="hidden text-text-secondary xl:inline">· {item.shortTitle}</span>
    </Link>
  )
}

/** 顶栏同行讲次菜单：空间不足时收起为「更多」下拉，不横向滚动。 */
export default function LessonGradeNav({ basePath, activeColor }: Props) {
  const pathname = usePathname()
  const current = lessonFromHref(basePath)
  const navRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreMeasureRef = useRef<HTMLButtonElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)

  const items = useMemo<NavItem[]>(() => {
    if (!current) return []
    return lessonsForGradeRegistry(current.grade)
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((entry) => {
        const href = routeForLesson(entry)
        const course = COURSES.find((c) => c.href === href)
        const shortTitle = course?.title.replace(/探险$/, '') ?? `第 ${entry.seq} 讲`
        return {
          href,
          icon: course?.icon ?? '📘',
          lectureNum: course?.lectureNum ?? `第 ${entry.seq} 讲`,
          shortTitle,
        }
      })
  }, [current])

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  )

  const recompute = useCallback(() => {
    const nav = navRef.current
    const measure = measureRef.current
    const moreBtn = moreMeasureRef.current
    if (!nav || !measure || items.length === 0) return

    const widths = Array.from(measure.children, (child) => (child as HTMLElement).offsetWidth)
    const totalWidth = nav.clientWidth
    const gap = window.matchMedia('(min-width: 640px)').matches ? 6 : 4
    const moreWidth = moreBtn?.offsetWidth ?? 52

    const itemsWidth = (count: number) =>
      widths
        .slice(0, count)
        .reduce((sum, width, index) => sum + width + (index > 0 ? gap : 0), 0)

    if (itemsWidth(items.length) <= totalWidth) {
      setVisibleCount(items.length)
      return
    }

    let count = items.length
    while (count > 0 && itemsWidth(count) + gap + moreWidth > totalWidth) {
      count -= 1
    }

    setVisibleCount(Math.max(count, 0))
  }, [items])

  const updateDropdownPos = useCallback(() => {
    const button = moreButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useLayoutEffect(() => {
    recompute()
    const nav = navRef.current
    if (!nav) return

    const ro = new ResizeObserver(recompute)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [recompute])

  useLayoutEffect(() => {
    if (!moreOpen) {
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
  }, [moreOpen, updateDropdownPos, visibleCount])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (moreButtonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [moreOpen])

  if (!current || items.length === 0) return null

  const resolvedVisible = visibleCount ?? items.length
  const overflowItems = items.slice(resolvedVisible)
  const hasOverflow = overflowItems.length > 0
  const overflowHasActive = overflowItems.some((item) => isActive(item.href))

  return (
    <div ref={navRef} className="relative flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
        {items.slice(0, resolvedVisible).map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            activeColor={activeColor}
          />
        ))}
      </div>

      {hasOverflow && (
        <div className="relative shrink-0">
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={`${LESSON_HEADER_MORE_BTN} ${
              overflowHasActive
                ? `${activeColor} border-gray-300 font-bold shadow-sm`
                : ''
            }`}
          >
            更多
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -z-10 flex h-0 gap-1 overflow-hidden opacity-0 sm:gap-1.5"
      >
        {items.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            active={false}
            activeColor={activeColor}
          />
        ))}
        <button ref={moreMeasureRef} type="button" tabIndex={-1} className={LESSON_HEADER_MORE_BTN}>
          更多
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {moreOpen &&
        dropdownPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            className="border-border-light fixed z-[200] max-h-64 min-w-[11rem] overflow-y-auto rounded-xl border bg-white py-1 shadow-lg"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            {overflowItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                title={item.shortTitle}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-[12px] font-medium no-underline transition-colors sm:text-[13px] ${
                  isActive(item.href)
                    ? `${activeColor} bg-gray-50 font-bold`
                    : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="min-w-0 truncate">
                  {item.lectureNum}
                  <span className="text-text-muted"> · {item.shortTitle}</span>
                </span>
              </Link>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

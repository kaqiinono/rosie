'use client'

import Link from 'next/link'
import type { ProblemSet } from '@rosie/core'
import { AccountBar } from '@rosie/ui'
import type { LessonContextType } from './createLessonProvider'
import {
  LESSON_HEADER_TEXT_BTN,
} from './lesson-header-chrome'
import LessonGradeNav from './LessonGradeNav'
import LessonGradeSwitcher from './LessonGradeSwitcher'

type LessonHeaderConfig = {
  basePath: string
  emoji: string
  titleShort: string
  titleFull: string
  titleColor: string
  navActiveColor: string
  navActiveBorderColor: string
  /** Back button uses SVG arrow by default; set to text like '←' to override */
  backIcon?: React.ReactNode
}

type Props = {
  config: LessonHeaderConfig
  problems?: ProblemSet
  useLessonContext?: () => LessonContextType
}

const defaultBackIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export default function LessonAppHeader({ config }: Props) {
  return (
    <div className="border-border-light sticky top-0 z-30 shrink-0 overflow-visible border-b bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.06)] backdrop-blur-sm">
      <div className="flex h-12 w-full items-center gap-1.5 px-3 sm:h-14 sm:gap-2 sm:px-4">
        <Link
          href="/math"
          className={`${LESSON_HEADER_TEXT_BTN} w-8 justify-center gap-0 p-0 sm:w-auto sm:justify-start sm:gap-1.5 sm:px-3`}
        >
          <span className="flex items-center justify-center">{config.backIcon ?? defaultBackIcon}</span>
          <span className="hidden sm:inline">课程列表</span>
        </Link>

        <div className="bg-border-light/70 mx-0.5 hidden h-5 w-px shrink-0 sm:block" aria-hidden />

        <LessonGradeSwitcher
          basePath={config.basePath}
          activeColor={config.navActiveColor}
        />

        <LessonGradeNav
          basePath={config.basePath}
          activeColor={config.navActiveColor}
          activeBorderColor={config.navActiveBorderColor}
        />

        <div className="bg-border-light/70 mx-0.5 hidden h-5 w-px shrink-0 md:block" aria-hidden />

        <div className="ml-auto shrink-0 pl-1">
          <AccountBar variant="header" />
        </div>
      </div>
    </div>
  )
}

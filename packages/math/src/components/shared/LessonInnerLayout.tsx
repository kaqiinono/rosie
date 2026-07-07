'use client'

import type { ReactNode } from 'react'

type LessonInnerLayoutProps = {
  sidebar: ReactNode
  children: ReactNode
}

/** Full-width lesson body: sidebar flush left, scrollable main column on the right. */
export default function LessonInnerLayout({ sidebar, children }: LessonInnerLayoutProps) {
  return (
    <div className="flex w-full min-h-0 flex-1 pb-[60px] md:pb-0">
      {sidebar}
      <div className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
        {children}
      </div>
    </div>
  )
}

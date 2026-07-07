'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson38-data'
import Lesson38Provider, { useLesson38 } from '@rosie/math/components/lesson38/Lesson38Provider'
import AppHeader from '@rosie/math/components/lesson38/AppHeader'
import Sidebar from '@rosie/math/components/lesson38/Sidebar'
import LessonInnerLayout from '@rosie/math/components/shared/LessonInnerLayout'
import BottomNav from '@rosie/math/components/lesson38/BottomNav'
import CongratsModal from '@rosie/math/components/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  pretest: PROBLEMS.pretest.length,
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
  supplement: PROBLEMS.supplement?.length ?? 0,
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/38/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson38()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f5f3ff] text-[15px] text-text-primary"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <AppHeader problems={PROBLEMS} />
      <LessonInnerLayout sidebar={<Sidebar problems={PROBLEMS} />}>{children}</LessonInnerLayout>
      <BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} nextHref={nextHref} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson38Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson38Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson38Provider>
  )
}

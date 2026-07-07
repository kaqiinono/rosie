'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson47-data'
import Lesson47Provider, { useLesson47 } from '@rosie/math/components/lesson47/Lesson47Provider'
import AppHeader from '@rosie/math/components/lesson47/AppHeader'
import Sidebar from '@rosie/math/components/lesson47/Sidebar'
import LessonInnerLayout from '@rosie/math/components/shared/LessonInnerLayout'
import BottomNav from '@rosie/math/components/lesson47/BottomNav'
import CongratsModal from '@rosie/math/components/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/47/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson47()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[#fdf4ff] text-[15px] text-text-primary"
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

export default function Lesson47Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson47Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson47Provider>
  )
}

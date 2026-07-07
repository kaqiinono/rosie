'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import Lesson29Provider, { useLesson29 } from '@rosie/math/components/lesson29/Lesson29Provider'
import AppHeader from '@rosie/math/components/lesson29/AppHeader'
import Sidebar from '@rosie/math/components/lesson29/Sidebar'
import LessonInnerLayout from '@rosie/math/components/shared/LessonInnerLayout'
import BottomNav from '@rosie/math/components/lesson29/BottomNav'
import CongratsModal from '@rosie/math/components/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/29/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson29()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-rose-50 text-[15px] text-text-primary"
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

export default function Lesson29Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson29Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson29Provider>
  )
}

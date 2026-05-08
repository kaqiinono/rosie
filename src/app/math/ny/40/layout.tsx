'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson40-data'
import Lesson40Provider, { useLesson40 } from '@/components/math/lesson40/Lesson40Provider'
import AppHeader from '@/components/math/lesson40/AppHeader'
import Sidebar from '@/components/math/lesson40/Sidebar'
import BottomNav from '@/components/math/lesson40/BottomNav'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  pretest:    PROBLEMS.pretest.length,
  lesson:     PROBLEMS.lesson.length,
  homework:   PROBLEMS.homework.length,
  workbook:   PROBLEMS.workbook.length,
  supplement: PROBLEMS.supplement?.length ?? 0,
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/40/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson40()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f0fdf4] text-[15px] text-text-primary"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <AppHeader problems={PROBLEMS} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pb-[60px] md:pb-0">
        <Sidebar problems={PROBLEMS} />
        <div className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      <BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} nextHref={nextHref} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson40Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson40Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson40Provider>
  )
}

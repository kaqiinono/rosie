'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson37-data'
import Lesson37Provider, { useLesson37 } from '@/components/math/lesson37/Lesson37Provider'
import AppHeader from '@/components/math/lesson37/AppHeader'
import Sidebar from '@/components/math/lesson37/Sidebar'
import BottomNav from '@/components/math/lesson37/BottomNav'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
  pretest: PROBLEMS.pretest.length,
  supplement: PROBLEMS.supplement?.length ?? 0,
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/37/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson37()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f0f7ff] text-[15px] text-text-primary"
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

export default function Lesson37Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson37Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson37Provider>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson44-data'
import Lesson44Provider, { useLesson44 } from '@rosie/math/components/lesson44/Lesson44Provider'
import AppHeader from '@rosie/math/components/lesson44/AppHeader'
import Sidebar from '@rosie/math/components/lesson44/Sidebar'
import BottomNav from '@rosie/math/components/lesson44/BottomNav'
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
  return `/math/ny/44/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson44()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-indigo-50 text-[15px] text-text-primary"
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

export default function Lesson44Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson44Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson44Provider>
  )
}

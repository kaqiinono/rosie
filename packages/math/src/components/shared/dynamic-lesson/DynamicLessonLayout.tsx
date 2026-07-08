'use client'

import { usePathname } from 'next/navigation'
import LessonInnerLayout from '@rosie/math/components/shared/LessonInnerLayout'
import CongratsModal from '@rosie/math/components/lesson/g1/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson/g1/lesson35/Toast'
import { nextProblemHref } from '@rosie/math/utils/lesson-route-utils'
import { LessonRouteProvider, useLessonRoute } from './LessonRouteContext'
import { usePracticeQueueOptional } from '@rosie/math/components/shared/practice-queue/PracticeQueueContext'

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { module } = useLessonRoute()
  const { toast, setToast, showCongrats, setShowCongrats } = module.useLesson()
  const pathname = usePathname()
  const nextHref = nextProblemHref(pathname, module.PROBLEMS)
  const practiceQueue = usePracticeQueueOptional()
  const practiceActive = practiceQueue?.isActive ?? false

  if (practiceActive) {
    return (
      <div className="fixed inset-0 z-40 bg-white">
        {children}
      </div>
    )
  }

  return (
    <div
      className={`flex min-h-screen flex-col overflow-x-hidden ${module.layoutBgClass} text-text-primary text-[15px]`}
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <module.AppHeader problems={module.PROBLEMS} />
      <LessonInnerLayout sidebar={<module.Sidebar problems={module.PROBLEMS} />}>
        {children}
      </LessonInnerLayout>
      <module.BottomNav />
      <CongratsModal
        visible={showCongrats}
        onClose={() => setShowCongrats(false)}
        nextHref={nextHref}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function LayoutBody({ children }: { children: React.ReactNode }) {
  const { module } = useLessonRoute()
  const { Provider } = module

  return (
    <Provider>
      <InnerLayout>{children}</InnerLayout>
    </Provider>
  )
}

export default function DynamicLessonLayout({
  grade,
  seq,
  children,
}: {
  grade: number
  seq: number
  children: React.ReactNode
}) {
  return (
    <LessonRouteProvider grade={grade} seq={seq}>
      <LayoutBody>{children}</LayoutBody>
    </LessonRouteProvider>
  )
}

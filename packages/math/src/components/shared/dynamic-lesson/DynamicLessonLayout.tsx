'use client'

import { usePathname } from 'next/navigation'
import LessonInnerLayout from '@rosie/math/components/shared/LessonInnerLayout'
import CongratsModal from '@rosie/math/components/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson35/Toast'
import { nextProblemHref } from '@rosie/math/utils/lesson-route-utils'
import { LessonRouteProvider, useLessonRoute } from './LessonRouteContext'

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { module } = useLessonRoute()
  const { toast, setToast, showCongrats, setShowCongrats } = module.useLesson()
  const pathname = usePathname()
  const nextHref = nextProblemHref(pathname, module.PROBLEMS)

  return (
    <div
      className={`flex min-h-screen flex-col overflow-x-hidden ${module.layoutBgClass} text-[15px] text-text-primary`}
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <module.AppHeader problems={module.PROBLEMS} />
      <LessonInnerLayout sidebar={<module.Sidebar problems={module.PROBLEMS} />}>{children}</LessonInnerLayout>
      <module.BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} nextHref={nextHref} />
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

'use client'

import { PROBLEMS } from '@/utils/lesson35-data'
import Lesson35Provider, { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import AppHeader from '@/components/math/lesson35/AppHeader'
import Sidebar from '@/components/math/lesson35/Sidebar'
import BottomNav from '@/components/math/lesson35/BottomNav'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { solved, toast, setToast, showCongrats, setShowCongrats } = useLesson35()

  return (
    <div
      className="flex min-h-screen flex-col bg-[#fef9f0] text-[15px] text-text-primary"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <AppHeader solved={solved} problems={PROBLEMS} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pb-[60px] md:pb-0">
        <Sidebar solved={solved} problems={PROBLEMS} />
        <div className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      <BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson35Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson35Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson35Provider>
  )
}

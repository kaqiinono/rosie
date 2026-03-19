'use client'

import { PROBLEMS } from '@/utils/lesson36-data'
import Lesson36Provider, { useLesson36 } from '@/components/math/lesson36/Lesson36Provider'
import AppHeader from '@/components/math/lesson36/AppHeader'
import Sidebar from '@/components/math/lesson36/Sidebar'
import BottomNav from '@/components/math/lesson36/BottomNav'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson36()

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
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson36Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson36Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson36Provider>
  )
}

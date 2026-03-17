'use client'

export default function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-8 py-6 shadow-2xl dark:bg-slate-800/90">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-blue-500" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">加载中...</p>
      </div>
    </div>
  )
}

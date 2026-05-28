'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateSettings } from '@/hooks/useCalculateSettings'
import Link from 'next/link'

export default function SettingsPage() {
  const { user } = useAuth()
  const { settings, update } = useCalculateSettings(user)

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/calculate" className="text-white/60 hover:text-white">
          ◀
        </Link>
        <h1 className="text-lg font-bold text-white">设置</h1>
      </div>

      <div className="flex flex-col gap-3">
        {/* Sound */}
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] p-4">
          <div>
            <div className="text-sm font-medium text-white">音效</div>
            <div className="text-xs text-white/40">答题时播放正确/错误音效</div>
          </div>
          <button
            onClick={() => update({ soundEnabled: !settings.soundEnabled })}
            className={`h-7 w-12 rounded-full transition ${
              settings.soundEnabled ? 'bg-blue-600' : 'bg-white/20'
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Focus mode */}
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] p-4">
          <div>
            <div className="text-sm font-medium text-white">专注模式</div>
            <div className="text-xs text-white/40">隐藏计时器，不计速度奖励</div>
          </div>
          <button
            onClick={() => update({ focusMode: !settings.focusMode })}
            className={`h-7 w-12 rounded-full transition ${
              settings.focusMode ? 'bg-blue-600' : 'bg-white/20'
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.focusMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Daily target */}
        <div className="rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-3 text-sm font-medium text-white">每日目标</div>
          <div className="flex gap-2">
            {[10, 20, 30, 50].map((n) => (
              <button
                key={n}
                onClick={() => update({ dailyTarget: n })}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                  settings.dailyTarget === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.06] text-white/50 hover:text-white'
                }`}
              >
                {n}题
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-2 text-sm font-medium text-white">已解锁关卡</div>
          <div className="text-xs text-white/50">
            {settings.unlockedLevels.length} 个关卡已解锁
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  useAuth,
  countLocalPendingSessions,
  syncAllLocalPendingToCloud,
  PRACTICE_PENDING_CHANGED_EVENT,
} from '@rosie/core'
import TodayPlanOverview from '@/components/today/TodayPlanOverview'

export default function HomeTodayPanel() {
  const { user } = useAuth()
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const refreshCount = useCallback(() => {
    const { total, unsynced } = countLocalPendingSessions()
    setTotalPending(total)
    setUnsyncedCount(unsynced)
  }, [])

  useEffect(() => {
    refreshCount()
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshCount()
    }
    window.addEventListener('storage', refreshCount)
    window.addEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshCount)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('storage', refreshCount)
      window.removeEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshCount)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshCount])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleSync = useCallback(async () => {
    if (!user || syncing) return
    const { total, unsynced } = countLocalPendingSessions()
    setTotalPending(total)
    setUnsyncedCount(unsynced)
    if (total === 0) {
      setToast('暂无未完成的练习进度')
      return
    }
    if (unsynced === 0) {
      setToast('进度已全部备份到云端')
      return
    }
    setSyncing(true)
    try {
      const result = await syncAllLocalPendingToCloud(user.id)
      refreshCount()
      if (result.synced === 0 && result.failed === 0) {
        setToast('进度已全部备份到云端')
      } else if (result.failed === 0) {
        setToast(`已备份 ${result.synced} 项进度到云端`)
      } else if (result.synced === 0) {
        setToast('备份失败，请检查网络后重试')
      } else {
        setToast(`已备份 ${result.synced} 项，${result.failed} 项失败`)
      }
    } catch {
      setToast('备份失败，请检查网络后重试')
    } finally {
      setSyncing(false)
    }
  }, [user, syncing, refreshCount])

  const allSynced = totalPending > 0 && unsyncedCount === 0
  const label = syncing ? '备份中…' : allSynced ? '进度已备份' : '备份进度'
  const title = allSynced
    ? '本机未完成练习已全部备份到云端'
    : unsyncedCount > 0
      ? `有 ${unsyncedCount} 项未备份到云端，点击同步`
      : '把本机未完成练习备份到云端，换设备可继续'

  return (
    <section className="w-full max-w-[1040px]">
      <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-text-primary text-[13px] font-extrabold tracking-wide">
          🗓️ 今日计划
        </h2>
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              title={title}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 ${
                allSynced
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-800'
                  : unsyncedCount > 0
                    ? 'border-amber-200/80 bg-amber-50 text-amber-800'
                    : 'border-slate-200/80 bg-slate-50 text-slate-600'
              }`}
            >
              <span aria-hidden>{syncing ? '⏳' : allSynced ? '✓' : '☁️'}</span>
              <span>{label}</span>
              {!syncing && unsyncedCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-extrabold text-white">
                  {unsyncedCount}
                </span>
              )}
            </button>
          )}
          <Link
            href="/today/records"
            className="text-[12px] font-bold text-slate-600 no-underline transition-opacity hover:opacity-70"
          >
            练习记录
          </Link>
          <Link
            href="/today"
            className="text-[12px] font-bold text-amber-700 no-underline transition-opacity hover:opacity-70"
          >
            查看全部 →
          </Link>
        </div>
      </div>
      {toast && (
        <div
          className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900"
          role="status"
        >
          {toast}
        </div>
      )}
      <TodayPlanOverview
        linkable
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        loadingFallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[108px] animate-pulse rounded-2xl bg-slate-100/80"
              />
            ))}
          </div>
        }
      />
    </section>
  )
}

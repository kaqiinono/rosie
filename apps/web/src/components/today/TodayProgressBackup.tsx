'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  useAuth,
  countLocalPendingSessions,
  syncAllLocalPendingToCloud,
  PRACTICE_PENDING_CHANGED_EVENT,
} from '@rosie/core'

export default function TodayProgressBackup() {
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

  if (!user) return null

  return (
    <div className="mx-auto mb-3 max-w-[960px] px-4 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-text-primary">各科进度</h2>
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
      </div>
      {toast && (
        <div
          className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

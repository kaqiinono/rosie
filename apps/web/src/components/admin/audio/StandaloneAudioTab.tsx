'use client'

import { useRef, useState } from 'react'
import CollectionPills from '@/components/audio/CollectionPills'
import type { CollectionMembership } from '@/hooks/useAudioCollections'
import { AUDIO_MEDIA_BUCKET, type AudioAsset, type AudioPlaylistItem } from '@rosie/player'

type Props = {
  assets: AudioAsset[]
  isLoading: boolean
  getAssetUrl: (storagePath: string) => string
  onPlayAsset: (asset: AudioAsset) => void
  onUpload: (file: File) => Promise<void>
  onDelete: (asset: AudioAsset) => Promise<void>
  onRename: (assetId: string, label: string) => Promise<void>
  onAddAssetToCollection: (asset: AudioAsset) => void
  membership: (bucket: string, path: string) => CollectionMembership[]
  onRemoveItem: (item: AudioPlaylistItem) => void
}

export default function StandaloneAudioTab({
  assets,
  isLoading,
  getAssetUrl,
  onPlayAsset,
  onUpload,
  onDelete,
  onRename,
  onAddAssetToCollection,
  membership,
  onRemoveItem,
}: Props) {
  const MAX_FILE_MB = 500
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [oversizedNames, setOversizedNames] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? [])
    if (all.length === 0) return

    const valid = all.filter((f) => f.size <= MAX_FILE_BYTES)
    const oversized = all.filter((f) => f.size > MAX_FILE_BYTES)
    if (oversized.length > 0) setOversizedNames(oversized.map((f) => f.name))

    if (valid.length > 0) {
      setUploadProgress({ current: 0, total: valid.length })
      for (let i = 0; i < valid.length; i++) {
        await onUpload(valid[i]!)
        setUploadProgress({ current: i + 1, total: valid.length })
      }
      setUploadProgress(null)
    }
    e.target.value = ''
  }

  async function commitRename(assetId: string) {
    if (editLabel.trim()) await onRename(assetId, editLabel.trim())
    setEditingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
        <div className="text-[13px] text-slate-400">加载中…</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Upload */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        <button
          type="button"
          disabled={uploadProgress !== null}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-white shadow-md transition hover:-translate-y-px hover:shadow-lg disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}
        >
          {uploadProgress !== null ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {uploadProgress.current}/{uploadProgress.total} 上传中…
            </span>
          ) : (
            '+ 批量上传媒体'
          )}
        </button>
        <span className="text-[11px] text-slate-400">
          支持音频 & 视频，可多选，单文件最大 {MAX_FILE_MB} MB
        </span>
      </div>

      {oversizedNames.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.2)' }}
        >
          <span className="shrink-0 text-[14px]">⚠️</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-red-600">
              以下文件超过 {MAX_FILE_MB} MB，已跳过：
            </div>
            <div className="mt-0.5 space-y-0.5">
              {oversizedNames.map((name) => (
                <div key={name} className="truncate text-[11px] text-red-500">
                  {name}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOversizedNames([])}
            className="shrink-0 text-[12px] text-red-300 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      )}

      {assets.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="text-4xl opacity-25">🎬</div>
          <div className="text-[13px] text-slate-400">还没有独立媒体文件</div>
          <div className="text-[11px] text-slate-300">点击上方按钮上传音频或视频</div>
        </div>
      )}

      {assets.map((a) => {
        const isEditing = editingId === a.id
        const isVideo = a.mediaType === 'video'
        const pills = membership(AUDIO_MEDIA_BUCKET, a.storagePath)
        return (
          <div
            key={a.id}
            className="group rounded-2xl bg-white px-4 py-3.5 transition-all hover:shadow-md"
            style={{
              borderLeft: `3px solid ${isVideo ? '#6366f1' : '#f59e0b'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{
                  background: isVideo
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(79,70,229,0.08))'
                    : 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(180,83,9,0.08))',
                }}
              >
                {isVideo ? '🎬' : '🎵'}
              </div>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={() => void commitRename(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(a.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full rounded-lg border border-amber-400 bg-amber-50/50 px-2 py-0.5 text-[13px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                ) : (
                  <button
                    type="button"
                    className="cursor-text text-left text-[13px] font-extrabold text-slate-800 hover:text-amber-700"
                    title="点击编辑名称"
                    onClick={() => {
                      setEditingId(a.id)
                      setEditLabel(a.label)
                    }}
                  >
                    {a.label}
                  </button>
                )}
                <div className="mt-0.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase"
                    style={{
                      background: isVideo ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
                      color: isVideo ? '#6366f1' : '#b45309',
                    }}
                  >
                    {isVideo ? 'VIDEO' : 'AUDIO'}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlayAsset(a)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[13px] text-white transition hover:scale-110"
                  style={{
                    background: isVideo
                      ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                      : 'linear-gradient(135deg,#f59e0b,#b45309)',
                    boxShadow: isVideo
                      ? '0 2px 8px rgba(99,102,241,0.35)'
                      : '0 2px 8px rgba(245,158,11,0.35)',
                  }}
                  title="播放"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => onAddAssetToCollection(a)}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-amber-700 transition hover:bg-amber-50"
                  style={{ border: '1.5px solid rgba(245,158,11,0.35)' }}
                  title="加入收藏夹"
                >
                  + 加入收藏夹
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`确定删除「${a.label}」？`)) await onDelete(a)
                  }}
                  className="cursor-pointer rounded-full p-1 text-[12px] text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>

            {pills.length > 0 && (
              <div className="mt-2 pl-12">
                <CollectionPills entries={pills} onRemove={onRemoveItem} theme="light" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

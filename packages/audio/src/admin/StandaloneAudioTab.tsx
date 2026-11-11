'use client'

import { useRef, useState } from 'react'
import CollectionPills from '../components/CollectionPills'
import type { CollectionMembership } from '../hooks/useAudioCollections'
import { AUDIO_MEDIA_BUCKET, type AudioAsset, type AudioPlaylistItem } from '@rosie/player'
import { Button, IconButton, TextField } from '@rosie/ui/themes'

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
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
        <Button
          type="button"
          disabled={uploadProgress !== null}
          loading={uploadProgress !== null}
          onClick={() => inputRef.current?.click()}
          variant="solid"
          color="amber"
          size="3"
          radius="full"
        >
          {uploadProgress !== null
            ? `${uploadProgress.current}/${uploadProgress.total} 上传中…`
            : '+ 批量上传媒体'}
        </Button>
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
          <IconButton
            type="button"
            onClick={() => setOversizedNames([])}
            variant="ghost"
            color="red"
            size="1"
            className="shrink-0"
          >
            ✕
          </IconButton>
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
            className="group hover:shadow-sticker rounded-2xl bg-white px-4 py-3.5 transition-all"
            style={{
              borderLeft: `3px solid ${isVideo ? '#6366f1' : '#f59e0b'}`,
              boxShadow: '0 3px 0 rgba(0,0,0,.3), 0 3px 0 rgba(0,0,0,.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{
                  background: isVideo ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
                }}
              >
                {isVideo ? '🎬' : '🎵'}
              </div>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <TextField.Root
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={() => void commitRename(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(a.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    size="1"
                    className="w-full"
                  />
                ) : (
                  <Button
                    type="button"
                    title="点击编辑名称"
                    onClick={() => {
                      setEditingId(a.id)
                      setEditLabel(a.label)
                    }}
                    variant="ghost"
                    color="gray"
                    size="2"
                  >
                    {a.label}
                  </Button>
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
                <IconButton
                  type="button"
                  onClick={() => onPlayAsset(a)}
                  variant="solid"
                  color={isVideo ? 'indigo' : 'amber'}
                  size="2"
                  radius="full"
                  title="播放"
                  aria-label="播放"
                >
                  ▶
                </IconButton>
                <Button
                  type="button"
                  onClick={() => onAddAssetToCollection(a)}
                  variant="outline"
                  color="amber"
                  size="1"
                  radius="full"
                  title="加入收藏夹"
                >
                  + 加入收藏夹
                </Button>
                <IconButton
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`确定删除「${a.label}」？`)) await onDelete(a)
                  }}
                  title="删除"
                  variant="ghost"
                  color="gray"
                  size="1"
                >
                  ✕
                </IconButton>
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

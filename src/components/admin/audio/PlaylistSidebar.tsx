'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AudioPlaylist, AudioPlaylistItem } from '@/utils/audio-manager-types'

type Props = {
  playlists: AudioPlaylist[]
  itemsByPlaylist: Record<string, AudioPlaylistItem[]>
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRemoveItem: (item: AudioPlaylistItem) => Promise<void>
  onPlayPlaylist: (id: string) => void
}

const MEDIA_ICON: Record<string, string> = { audio: '🎵', video: '🎬' }

export default function PlaylistSidebar({
  playlists,
  itemsByPlaylist,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onRemoveItem,
  onPlayPlaylist,
}: Props) {
  const [creatingName, setCreatingName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  async function handleCreate() {
    if (!creatingName.trim()) {
      setCreating(false)
      return
    }
    await onCreate(creatingName.trim())
    setCreatingName('')
    setCreating(false)
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
          收藏夹
        </span>
        {playlists.length > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            {playlists.length}
          </span>
        )}
      </div>

      {/* Create input or button */}
      {creating ? (
        <div>
          <input
            autoFocus
            value={creatingName}
            onChange={(e) => setCreatingName(e.target.value)}
            onBlur={() => void handleCreate()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
              if (e.key === 'Escape') { setCreating(false); setCreatingName('') }
            }}
            placeholder="收藏夹名称…"
            className="w-full rounded-xl border border-amber-400 bg-amber-50/50 px-3 py-2 text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="cursor-pointer rounded-xl py-2 text-[12px] font-bold text-amber-700 transition hover:bg-amber-50"
          style={{ border: '1.5px dashed rgba(245,158,11,0.4)' }}
        >
          + 新建收藏夹
        </button>
      )}

      {/* Playlist list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {playlists.length === 0 && (
          <div className="py-6 text-center text-[11px] text-slate-300">暂无收藏夹</div>
        )}

        {playlists.map((pl) => {
          const items = itemsByPlaylist[pl.id] ?? []
          const isSelected = selectedId === pl.id
          const isRenaming = renamingId === pl.id

          return (
            <div key={pl.id}>
              {/* Playlist header card */}
              <div
                className="cursor-pointer rounded-xl px-3 py-2.5 transition-all"
                style={
                  isSelected
                    ? {
                        background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(180,83,9,0.06))',
                        border: '1.5px solid rgba(245,158,11,0.4)',
                        boxShadow: '0 2px 8px rgba(245,158,11,0.12)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.85)',
                        border: '1.5px solid rgba(15,23,42,0.06)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }
                }
                onClick={() => onSelect(pl.id)}
              >
                <div className="flex items-center gap-1.5">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={async () => {
                        if (renameVal.trim()) await onRename(pl.id, renameVal.trim())
                        setRenamingId(null)
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          if (renameVal.trim()) await onRename(pl.id, renameVal.trim())
                          setRenamingId(null)
                        }
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="flex-1 rounded border border-amber-400 px-1 text-[12px] font-extrabold focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="flex-1 truncate text-[12px] font-extrabold text-slate-800"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setRenamingId(pl.id)
                        setRenameVal(pl.name)
                      }}
                    >
                      {pl.name}
                    </span>
                  )}

                  {/* Item count badge */}
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{
                      background: isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.06)',
                      color: isSelected ? '#b45309' : '#94a3b8',
                    }}
                  >
                    {items.length}
                  </span>

                  {/* Play */}
                  <button
                    type="button"
                    title="播放收藏夹"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPlayPlaylist(pl.id)
                    }}
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[10px] text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
                  >
                    ▶
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    title="删除收藏夹"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDelete(pl.id)
                    }}
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[10px] text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded item list */}
              {isSelected && items.length > 0 && (
                <div className="ml-2 mt-1 space-y-0.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                      style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}
                    >
                      <span className="shrink-0 text-[11px]">
                        {MEDIA_ICON[item.mediaType] ?? '🎵'}
                      </span>
                      <span className="flex-1 truncate text-[11px] font-semibold text-slate-700">
                        {item.label}
                      </span>
                      {item.refLink && (
                        <Link
                          href={item.refLink}
                          className="shrink-0 flex h-4 w-4 items-center justify-center rounded text-[10px] text-slate-300 hover:text-slate-500"
                          title="跳转"
                        >
                          →
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRemoveItem(item)}
                        className="shrink-0 flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[10px] text-slate-200 hover:bg-red-50 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isSelected && items.length === 0 && (
                <div className="ml-2 mt-1 rounded-lg px-3 py-2 text-center text-[10px] text-slate-300"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px dashed rgba(15,23,42,0.08)' }}
                >
                  暂无内容，去添加吧
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

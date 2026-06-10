'use client'

import { useState } from 'react'
import type { AudioCollection, AudioCollectionKind } from '@/utils/audio-manager-types'

type Props = {
  collections: AudioCollection[]
  selectedId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (collection: AudioCollection, name: string) => Promise<void>
  onDelete: (collection: AudioCollection) => Promise<void>
  onPlay: (collection: AudioCollection) => void
  onEnqueue: (collection: AudioCollection) => void
}

const KIND_ICON: Record<AudioCollectionKind, string> = {
  favorites: '❤️',
  reading: '📖',
  flipbook: '📚',
  playlist: '🎵',
}

export default function PlaylistSidebar({
  collections,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onPlay,
  onEnqueue,
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
    <aside className="flex w-full shrink-0 flex-col gap-3 md:w-56">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
          收藏夹
        </span>
      </div>

      {creating ? (
        <input
          autoFocus
          value={creatingName}
          onChange={(e) => setCreatingName(e.target.value)}
          onBlur={() => void handleCreate()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
            if (e.key === 'Escape') {
              setCreating(false)
              setCreatingName('')
            }
          }}
          placeholder="收藏夹名称…"
          className="w-full rounded-xl border border-amber-400 bg-amber-50/50 px-3 py-2 text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
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

      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {collections.map((c) => {
          const isSelected = selectedId === c.id
          const isRenaming = renamingId === c.id
          return (
            <div
              key={c.id}
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
              onClick={() => onSelect(c.id)}
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[13px]">{KIND_ICON[c.kind]}</span>
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={async () => {
                      if (renameVal.trim()) await onRename(c, renameVal.trim())
                      setRenamingId(null)
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        if (renameVal.trim()) await onRename(c, renameVal.trim())
                        setRenamingId(null)
                      }
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="min-w-0 flex-1 rounded border border-amber-400 px-1 text-[12px] font-extrabold focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-slate-800"
                    onDoubleClick={(e) => {
                      if (!c.removable) return
                      e.stopPropagation()
                      setRenamingId(c.id)
                      setRenameVal(c.name)
                    }}
                  >
                    {c.name}
                  </span>
                )}

                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{
                    background: isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.06)',
                    color: isSelected ? '#b45309' : '#94a3b8',
                  }}
                >
                  {c.tracks.length}
                </span>

                <button
                  type="button"
                  title="播放收藏夹"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPlay(c)
                  }}
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[10px] text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
                >
                  ▶
                </button>
                <button
                  type="button"
                  title="加入播放列表"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEnqueue(c)
                  }}
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[12px] text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
                >
                  ＋
                </button>
                {c.removable && (
                  <button
                    type="button"
                    title="删除收藏夹"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDelete(c)
                    }}
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[10px] text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

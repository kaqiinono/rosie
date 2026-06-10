'use client'

import clsx from 'clsx'
import type { CollectionMembership } from '@/hooks/useAudioCollections'
import type { AudioPlaylistItem } from '@/utils/audio-manager-types'

type Props = {
  entries: CollectionMembership[] // 来自 collections.membership(bucket, path)
  onRemove: (item: AudioPlaylistItem) => void
  theme?: 'dark' | 'light'
}

export default function CollectionPills({ entries, onRemove, theme = 'dark' }: Props) {
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((e) => (
        <span
          key={e.collectionId}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1',
            e.kind === 'favorites'
              ? 'bg-pink-500/15 text-pink-600 ring-pink-300'
              : theme === 'dark'
                ? 'bg-white/10 text-white/80 ring-white/15'
                : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}
        >
          {e.kind === 'favorites' ? '❤️' : '🎵'} {e.collectionName}
          <button
            type="button"
            aria-label={`从「${e.collectionName}」移除`}
            onClick={(ev) => {
              ev.preventDefault()
              ev.stopPropagation()
              onRemove(e.item)
            }}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

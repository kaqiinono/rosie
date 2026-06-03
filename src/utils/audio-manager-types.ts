export const AUDIO_MEDIA_BUCKET = 'media'

export type MediaType = 'audio' | 'video'

export function mediaAssetStoragePath(assetId: string, ext: string): string {
  return `standalone/${assetId}.${ext}`
}

export function audioAssetStoragePath(assetId: string): string {
  return `standalone/${assetId}.mp3`
}

export type AudioItemType = 'standalone' | 'reading' | 'flipbook'

export interface AudioAsset {
  id: string
  userId: string
  label: string
  storagePath: string
  mediaType: MediaType
  durationSec: number | null
  createdAt: string
  updatedAt: string
}

export interface AudioPlaylist {
  id: string
  userId: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AudioPlaylistItem {
  id: string
  playlistId: string
  userId: string
  itemType: AudioItemType
  mediaType: MediaType
  label: string
  storageBucket: string
  storagePath: string
  refLink: string | null
  assetId: string | null
  sortOrder: number
  createdAt: string
}

export interface AddPlaylistItemInput {
  itemType: AudioItemType
  mediaType: MediaType
  label: string
  storageBucket: string
  storagePath: string
  refLink: string | null
  assetId: string | null
}

export type LoopMode = 'none' | 'one' | 'all'

export interface PlayerTrack {
  url: string
  label: string
  refLink: string | null
  mediaType: MediaType
}

export interface PlayerState {
  tracks: PlayerTrack[]
  currentIndex: number
  isPlaying: boolean
  loopMode: LoopMode
}

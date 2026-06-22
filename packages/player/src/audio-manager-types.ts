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
  isFavorite: boolean
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

export type LoopMode = 'order' | 'one' | 'all'

export const LOOP_COUNTS = [3, 5, 10, 15, 20, Infinity] as const
export type LoopCount = (typeof LOOP_COUNTS)[number]

export interface PlayerTrack {
  url: string
  label: string
  refLink: string | null
  mediaType: MediaType
  /** 可写回 audio_playlist_items 的来源描述；用于桃心收藏 / 收藏夹胶囊。 */
  source: AddPlaylistItemInput | null
}

export type AudioCollectionKind = 'favorites' | 'reading' | 'flipbook' | 'playlist'

export interface AudioCollection {
  id: 'favorites' | 'reading' | 'flipbook' | `pl:${string}`
  name: string
  kind: AudioCollectionKind
  removable: boolean // 三个预设(favorites/reading/flipbook)=false，用户歌单=true
  acceptsItems: boolean // favorites + 用户歌单=true；reading/flipbook(虚拟)=false
  tracks: PlayerTrack[]
}

/** track 去重键：bucket + path 唯一定位一条音频。 */
export function trackKey(bucket: string, path: string): string {
  return `${bucket}|${path}`
}

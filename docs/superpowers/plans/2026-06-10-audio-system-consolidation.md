# 音频系统整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库里分裂的音频基础设施整合成统一的"收藏夹模型 + 单一播放引擎 + 底部停靠条播放器"，并新增孩子端 `/audio` 听歌页与「我的最爱」收藏体系。

**Architecture:** 新增 `useAudioCollections`（聚合 reading 虚拟 / flipbook 虚拟 / 我的最爱 / 用户歌单）+ `usePlaylistPlayer`（单一 `<audio>` 引擎，三循环模式 + 次数）+ `<PlayerDock>`（共享底部播放器，含桃心收藏）。reading / flipbook / admin 三处旧播放器全部改接共享层；新增 `/audio` 页。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript（无 any）、Tailwind v4（CSS 变量，无 config）、Supabase（public buckets `media`/`reading`/`flipbook`）、clsx。

> **验证约定（本项目特例）：** 仓库无测试套件。每个任务的验证 = **用户手动跑 `pnpm lint`（逻辑改动后）/ `pnpm build`（UI 改动后）** + 浏览器行为核对。Agent 不主动跑 pnpm 命令，只在任务末尾提示用户跑。提交信息结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

## File Structure

**新增**
- `docs/sql/audio-favorites-migration.sql` — favorites 列 + 每用户唯一索引
- `src/hooks/useAudioCollections.ts` — 聚合收藏夹 + favorites 自动创建 + membership 反查 + toggleFavorite
- `src/hooks/usePlaylistPlayer.ts` — 单一 `<audio>` 播放引擎（模式 + 次数 + prev/next/enqueue）
- `src/components/audio/PlayerDock.tsx` — 共享底部播放器（全站唯一播放器视图，含桃心）
- `src/components/audio/CollectionPills.tsx` — 音频卡片上的"所属收藏夹胶囊 + ×删除"
- `src/app/audio/page.tsx` — 孩子端听歌页
- `src/components/audio/AudioPageView.tsx` — `/audio` 主体（切换区 + 卡片网格）

**改造**
- `src/utils/audio-manager-types.ts` — `PlayerTrack` 加 `source`；新增 `AudioCollection` / `AudioCollectionKind` / `LoopCount` / `LOOP_COUNTS`
- `src/components/admin/audio/AudioManagerPage.tsx` — 去 tab、接 `useAudioCollections` + `usePlaylistPlayer`、上传入选中收藏夹、底部 `<PlayerDock>`
- `src/components/admin/audio/PlaylistSidebar.tsx` — 消费 `AudioCollection[]`、每收藏夹 ▶/➕、预设锁定
- `src/components/admin/audio/StandaloneAudioTab.tsx` — 内容成为 admin 主体；卡片加 `<CollectionPills>`
- `src/app/english/words/reading/page.tsx` — 移除内联播放器，接共享引擎/dock
- `src/app/flipbook/page.tsx` — 移除内联播放器，接共享引擎/dock
- `src/app/page.tsx` — 加 `/audio` 入口卡片

**删除**
- `src/components/admin/audio/ReadingAudioTab.tsx`
- `src/components/admin/audio/FlipbookAudioTab.tsx`
- `src/components/admin/audio/AudioPlayerBar.tsx`

---

## Task 1: 数据库迁移（favorites 列）

**Files:**
- Create: `docs/sql/audio-favorites-migration.sql`

- [ ] **Step 1: 写迁移 SQL**

```sql
-- audio_playlists: 标记"我的最爱"特殊歌单
alter table audio_playlists
  add column if not exists is_favorite boolean not null default false;

-- 每个用户至多一个 favorites 歌单
create unique index if not exists audio_playlists_one_favorite_per_user
  on audio_playlists(user_id) where is_favorite;
```

- [ ] **Step 2: 提示用户在 Supabase SQL editor 执行**

在任务说明里写明：该 SQL 需用户手动在 Supabase 控制台执行（项目约定）。代码侧 `useAudioCollections` 会兜底自动创建 favorites 行，但列必须先存在。

- [ ] **Step 3: 提交**

```bash
git add docs/sql/audio-favorites-migration.sql
git commit -m "feat(audio): add is_favorite migration for favorites playlist"
```

---

## Task 2: 扩展类型（PlayerTrack.source / AudioCollection / LoopCount）

**Files:**
- Modify: `src/utils/audio-manager-types.ts`

- [ ] **Step 1: 给 `PlayerTrack` 加 `source` 字段**

把现有 `PlayerTrack` 改成（替换 60–74 行附近的 `LoopMode`/`PlayerTrack`/`PlayerState`）：

```ts
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
```

> 注意：旧代码用 `loopMode: 'none'` 表示顺序，这里统一改名 `'order'`。`PlayerState` 不再被引擎使用（引擎自带状态），可删除该 interface；若有残留引用，Task 7/10/11 会清掉。先删除 `PlayerState`。

- [ ] **Step 2: 新增 `AudioCollection` 模型**

在文件末尾追加：

```ts
export type AudioCollectionKind = 'favorites' | 'reading' | 'flipbook' | 'playlist'

export interface AudioCollection {
  id: 'favorites' | 'reading' | 'flipbook' | `pl:${string}`
  name: string
  kind: AudioCollectionKind
  removable: boolean    // 三个预设=false，用户歌单=true
  acceptsItems: boolean // favorites + 用户歌单=true；reading/flipbook=false
  tracks: PlayerTrack[]
}

/** track 去重键：bucket + path 唯一定位一条音频。 */
export function trackKey(bucket: string, path: string): string {
  return `${bucket}|${path}`
}
```

- [ ] **Step 3: 提示用户 `pnpm lint`**

预期会有 `'none'`/`PlayerState` 的残留报错（Task 7/10/11 修复前），属正常。本任务范围内类型文件本身应无语法错误。

- [ ] **Step 4: 提交**

```bash
git add src/utils/audio-manager-types.ts
git commit -m "feat(audio): extend PlayerTrack with source, add AudioCollection + LoopCount"
```

---

## Task 3: `useAudioCollections` 聚合 hook

**Files:**
- Create: `src/hooks/useAudioCollections.ts`

依赖现有：`useReadingPassageMedia`（`mediaByKey`、`getUrlForPassage`）、`useFlipbookBooks`（`books`，`getSignedAudioUrl` 实为同步 public url）、`useAudioPlaylists`（`playlists`、`itemsByPlaylist`、`createPlaylist`、`addItem`、`removeItem`...）。常量：`READING_AUDIO_BUCKET`（`@/utils/reading-audio-types`）、`FLIPBOOK_BUCKET`（`@/utils/flipbook-types`）、`AUDIO_MEDIA_BUCKET`（`@/utils/audio-manager-types`）。

- [ ] **Step 1: 写 hook**

```ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useReadingPassageMedia } from '@/hooks/useReadingPassageMedia'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import { useAudioPlaylists } from '@/hooks/useAudioPlaylists'
import { readingPassages } from '@/utils/reading-data'
import { READING_AUDIO_BUCKET } from '@/utils/reading-audio-types'
import { FLIPBOOK_BUCKET } from '@/utils/flipbook-types'
import {
  AUDIO_MEDIA_BUCKET,
  trackKey,
  type AddPlaylistItemInput,
  type AudioCollection,
  type AudioPlaylistItem,
  type PlayerTrack,
} from '@/utils/audio-manager-types'

const FAVORITES_NAME = '我的最爱'

function itemToTrack(item: AudioPlaylistItem): PlayerTrack {
  const url = supabase.storage.from(item.storageBucket).getPublicUrl(item.storagePath).data.publicUrl
  return {
    url,
    label: item.label,
    refLink: item.refLink,
    mediaType: item.mediaType,
    source: {
      itemType: item.itemType,
      mediaType: item.mediaType,
      label: item.label,
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      refLink: item.refLink,
      assetId: item.assetId,
    },
  }
}

export function useAudioCollections(user: User | null) {
  const reading = useReadingPassageMedia(user)
  const flipbook = useFlipbookBooks(user)
  const playlists = useAudioPlaylists(user)
  const [favoriteId, setFavoriteId] = useState<string | null>(null)

  // 找/建 favorites 歌单
  useEffect(() => {
    if (!user || playlists.playlists.length === 0) return
    const existing = playlists.playlists.find((p) => p.isFavorite)
    if (existing) {
      setFavoriteId(existing.id)
      return
    }
    // 没有 favorites 行：尝试创建（唯一索引兜底并发）
    void (async () => {
      const { data } = await supabase
        .from('audio_playlists')
        .insert({ user_id: user.id, name: FAVORITES_NAME, is_favorite: true, sort_order: -1 })
        .select()
        .single()
      if (data) {
        await playlists.reload()
        setFavoriteId((data as { id: string }).id)
      } else {
        await playlists.reload()
      }
    })()
  }, [user, playlists])

  // reading 虚拟收藏夹
  const readingTracks = useMemo<PlayerTrack[]>(() => {
    return readingPassages
      .filter((p) => reading.hasAudio(p.key))
      .map((p) => {
        const url = reading.getUrlForPassage(p.key)
        const media = reading.mediaByKey[p.key]
        if (!url || !media) return null
        const refLink = `/english/words/reading/${p.key}`
        const source: AddPlaylistItemInput = {
          itemType: 'reading',
          mediaType: 'audio',
          label: p.title,
          storageBucket: READING_AUDIO_BUCKET,
          storagePath: media.audioPath,
          refLink,
          assetId: null,
        }
        return { url, label: p.title, refLink, mediaType: 'audio' as const, source }
      })
      .filter((t): t is PlayerTrack => t !== null)
  }, [reading])

  // flipbook 虚拟收藏夹
  const flipbookTracks = useMemo<PlayerTrack[]>(() => {
    return flipbook.books
      .filter((b) => b.audioPath)
      .map((b) => {
        const path = b.audioPath as string
        const url = supabase.storage.from(FLIPBOOK_BUCKET).getPublicUrl(path).data.publicUrl
        const refLink = `/flipbook/${b.id}`
        const source: AddPlaylistItemInput = {
          itemType: 'flipbook',
          mediaType: 'audio',
          label: b.title,
          storageBucket: FLIPBOOK_BUCKET,
          storagePath: path,
          refLink,
          assetId: null,
        }
        return { url, label: b.title, refLink, mediaType: 'audio' as const, source }
      })
  }, [flipbook.books])

  const collections = useMemo<AudioCollection[]>(() => {
    const presets: AudioCollection[] = []
    const favItems = favoriteId ? playlists.itemsByPlaylist[favoriteId] ?? [] : []
    presets.push({
      id: 'favorites',
      name: FAVORITES_NAME,
      kind: 'favorites',
      removable: false,
      acceptsItems: true,
      tracks: favItems.map(itemToTrack),
    })
    presets.push({
      id: 'reading', name: '阅读', kind: 'reading',
      removable: false, acceptsItems: false, tracks: readingTracks,
    })
    presets.push({
      id: 'flipbook', name: '绘本', kind: 'flipbook',
      removable: false, acceptsItems: false, tracks: flipbookTracks,
    })
    const userPls: AudioCollection[] = playlists.playlists
      .filter((p) => !p.isFavorite)
      .map((p) => ({
        id: `pl:${p.id}` as const,
        name: p.name,
        kind: 'playlist' as const,
        removable: true,
        acceptsItems: true,
        tracks: (playlists.itemsByPlaylist[p.id] ?? []).map(itemToTrack),
      }))
    return [...presets, ...userPls]
  }, [favoriteId, playlists.playlists, playlists.itemsByPlaylist, readingTracks, flipbookTracks])

  const favoriteKeySet = useMemo<Set<string>>(() => {
    if (!favoriteId) return new Set()
    const items = playlists.itemsByPlaylist[favoriteId] ?? []
    return new Set(items.map((i) => trackKey(i.storageBucket, i.storagePath)))
  }, [favoriteId, playlists.itemsByPlaylist])

  const toggleFavorite = useCallback(
    async (track: PlayerTrack): Promise<void> => {
      if (!favoriteId || !track.source) return
      const key = trackKey(track.source.storageBucket, track.source.storagePath)
      const items = playlists.itemsByPlaylist[favoriteId] ?? []
      const existing = items.find((i) => trackKey(i.storageBucket, i.storagePath) === key)
      if (existing) await playlists.removeItem(existing)
      else await playlists.addItem(favoriteId, track.source)
    },
    [favoriteId, playlists],
  )

  const membership = useCallback(
    (bucket: string, path: string) => {
      const key = trackKey(bucket, path)
      const out: { collectionId: string; collectionName: string; kind: string; item: AudioPlaylistItem }[] = []
      for (const p of playlists.playlists) {
        const items = playlists.itemsByPlaylist[p.id] ?? []
        const item = items.find((i) => trackKey(i.storageBucket, i.storagePath) === key)
        if (item) {
          out.push({
            collectionId: p.id,
            collectionName: p.isFavorite ? FAVORITES_NAME : p.name,
            kind: p.isFavorite ? 'favorites' : 'playlist',
            item,
          })
        }
      }
      return out
    },
    [playlists.playlists, playlists.itemsByPlaylist],
  )

  const isLoading = reading.isLoading || flipbook.isLoading

  return {
    collections,
    isLoading,
    favoriteId,
    favoriteKeySet,
    toggleFavorite,
    membership,
    // 透传歌单 CRUD（仅对 removable / acceptsItems 调用方负责约束）
    createPlaylist: playlists.createPlaylist,
    renamePlaylist: playlists.renamePlaylist,
    deletePlaylist: playlists.deletePlaylist,
    addItem: playlists.addItem,
    removeItem: playlists.removeItem,
    reloadPlaylists: playlists.reload,
  }
}
```

- [ ] **Step 2: 给 `useAudioPlaylists` 增加 `isFavorite` 字段**

`AudioPlaylist`（`audio-manager-types.ts` 第 26–33 行）加 `isFavorite: boolean`；`useAudioPlaylists.ts` 的 `RawPlaylist` 加 `is_favorite: boolean`，`rowToPlaylist` 映射 `isFavorite: r.is_favorite ?? false`；`select('*')` 已带新列无需改查询。`createPlaylist` 的 insert 不含 is_favorite（默认 false）即可。

```ts
// audio-manager-types.ts —— AudioPlaylist 内追加
isFavorite: boolean
```

```ts
// useAudioPlaylists.ts —— RawPlaylist 内追加
is_favorite: boolean
// rowToPlaylist 内追加
isFavorite: r.is_favorite ?? false,
```

- [ ] **Step 3: 提示用户 `pnpm lint`**

预期：本 hook + 类型改动无报错（消费方未改的旧 admin 仍可能报 `PlayerState`/`'none'`，下个任务处理）。

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useAudioCollections.ts src/hooks/useAudioPlaylists.ts src/utils/audio-manager-types.ts
git commit -m "feat(audio): add useAudioCollections aggregator with favorites + membership"
```

---

## Task 4: `usePlaylistPlayer` 引擎 hook

**Files:**
- Create: `src/hooks/usePlaylistPlayer.ts`

引擎自持一个 `<audio>`（DOM 由 `<PlayerDock>` 渲染并把 ref 传进来；这里用受控 ref 模式：hook 暴露 `audioRef` 给 dock 绑定）。

- [ ] **Step 1: 写引擎**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LOOP_COUNTS,
  trackKey,
  type LoopCount,
  type LoopMode,
  type PlayerTrack,
} from '@/utils/audio-manager-types'

export interface PlaylistPlayer {
  audioRef: React.RefObject<HTMLAudioElement | null>
  queue: PlayerTrack[]
  index: number
  current: PlayerTrack | null
  isPlaying: boolean
  isPaused: boolean
  loopMode: LoopMode
  loopCount: LoopCount
  play: (tracks: PlayerTrack[], startIndex?: number) => void
  enqueue: (tracks: PlayerTrack[]) => void
  togglePause: () => void
  prev: () => void
  next: () => void
  jumpTo: (i: number) => void
  setLoopMode: (m: LoopMode) => void
  cycleLoopMode: () => void
  cycleLoopCount: () => void
  stop: () => void
  onEnded: () => void
}

const LOOP_MODE_NEXT: Record<LoopMode, LoopMode> = { order: 'one', one: 'all', all: 'order' }

export function usePlaylistPlayer(): PlaylistPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [loopMode, setLoopModeState] = useState<LoopMode>('order')
  const [loopCount, setLoopCount] = useState<LoopCount>(5)
  const loopsDoneRef = useRef(0)

  const queueRef = useRef<PlayerTrack[]>([])
  queueRef.current = queue

  const playAt = useCallback((tracks: PlayerTrack[], i: number) => {
    const el = audioRef.current
    const track = tracks[i]
    if (!el || !track) return
    el.src = track.url
    void el.play().catch(() => {})
    setIndex(i)
    setIsPlaying(true)
    setIsPaused(false)
  }, [])

  const play = useCallback((tracks: PlayerTrack[], startIndex = 0) => {
    if (tracks.length === 0) return
    loopsDoneRef.current = 0
    setQueue(tracks)
    queueRef.current = tracks
    playAt(tracks, startIndex)
  }, [playAt])

  const enqueue = useCallback((tracks: PlayerTrack[]) => {
    const existing = queueRef.current
    const seen = new Set(existing.map((t) => trackKey(t.source?.storageBucket ?? t.url, t.source?.storagePath ?? '')))
    const additions = tracks.filter(
      (t) => !seen.has(trackKey(t.source?.storageBucket ?? t.url, t.source?.storagePath ?? '')),
    )
    if (additions.length === 0) return
    const merged = [...existing, ...additions]
    setQueue(merged)
    queueRef.current = merged
    if (existing.length === 0) playAt(merged, 0)
  }, [playAt])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (el) { el.pause(); el.removeAttribute('src') }
    loopsDoneRef.current = 0
    setQueue([]); queueRef.current = []
    setIndex(0); setIsPlaying(false); setIsPaused(false)
  }, [])

  const togglePause = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()
  }, [])

  const jumpTo = useCallback((i: number) => {
    const q = queueRef.current
    if (i < 0 || i >= q.length) return
    loopsDoneRef.current = 0
    playAt(q, i)
  }, [playAt])

  const prev = useCallback(() => {
    const len = queueRef.current.length
    if (!len) return
    loopsDoneRef.current = 0
    playAt(queueRef.current, (index - 1 + len) % len)
  }, [index, playAt])

  const next = useCallback(() => {
    const len = queueRef.current.length
    if (!len) return
    loopsDoneRef.current = 0
    playAt(queueRef.current, (index + 1) % len)
  }, [index, playAt])

  const setLoopMode = useCallback((m: LoopMode) => setLoopModeState(m), [])
  const cycleLoopMode = useCallback(() => setLoopModeState((m) => LOOP_MODE_NEXT[m]), [])
  const cycleLoopCount = useCallback(() => {
    setLoopCount((prev) => {
      const i = LOOP_COUNTS.indexOf(prev)
      return LOOP_COUNTS[(i + 1) % LOOP_COUNTS.length]
    })
  }, [])

  const onEnded = useCallback(() => {
    const q = queueRef.current
    if (q.length === 0) return
    if (loopMode === 'one') {
      loopsDoneRef.current += 1
      if (loopsDoneRef.current < loopCount) {
        const el = audioRef.current
        if (el) { el.currentTime = 0; void el.play().catch(() => {}) }
      } else stop()
      return
    }
    if (loopMode === 'all') {
      if (index < q.length - 1) { playAt(q, index + 1); return }
      loopsDoneRef.current += 1
      if (loopsDoneRef.current < loopCount) playAt(q, 0)
      else stop()
      return
    }
    // order
    if (index < q.length - 1) playAt(q, index + 1)
    else setIsPlaying(false)
  }, [loopMode, loopCount, index, playAt, stop])

  // 卸载即停
  useEffect(() => () => {
    const el = audioRef.current
    if (el) { el.pause(); el.removeAttribute('src') }
  }, [])

  return {
    audioRef,
    queue,
    index,
    current: queue[index] ?? null,
    isPlaying,
    isPaused,
    loopMode,
    loopCount,
    play, enqueue, togglePause, prev, next, jumpTo,
    setLoopMode, cycleLoopMode, cycleLoopCount, stop, onEnded,
  }
}
```

> `enqueue` 去重键用 `source.storageBucket|source.storagePath`，无 source 时退化用 url，足够稳。

- [ ] **Step 2: 提示用户 `pnpm lint`**

预期：本 hook 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/hooks/usePlaylistPlayer.ts
git commit -m "feat(audio): add usePlaylistPlayer engine (loop modes + count + enqueue)"
```

---

## Task 5: `<PlayerDock>` 共享底部播放器

**Files:**
- Create: `src/components/audio/PlayerDock.tsx`

> **先做：** 调 `frontend-design` skill，目标"深色 playful、面向 7 岁的底部音乐播放停靠条"，沿用现有橙色拟物控件视觉（均衡器、白色主拨钮）。下方代码为结构骨架，视觉细节按 frontend-design 产出落地。

- [ ] **Step 1: 调 frontend-design skill 获取视觉规范**

记录配色/圆角/阴影 token（深色底 + 橙色高光，复用 `flipbook/page.tsx` 里 `PlaylistBar` 的拟物风）。

- [ ] **Step 2: 写组件**

Props：

```ts
type Props = {
  player: PlaylistPlayer                 // 来自 usePlaylistPlayer
  isFavorite: boolean                    // 当前曲是否在我的最爱
  onToggleFavorite: () => void           // 调 collections.toggleFavorite(player.current)
  theme?: 'dark' | 'light'               // /audio+flipbook+reading=dark，admin=light
}
```

结构（用现有 reading/flipbook `PlaylistBar` 的子部件作蓝本：`Equalizer`、`PrimaryDial`、`GhostButton`、各 Icon，可直接搬运到本文件）：

- 固定 `fixed bottom-0 inset-x-0 z-50`，`player.queue.length===0` 时返回 `null`。
- 绑定 `<audio ref={player.audioRef} className="hidden" preload="none" onEnded={player.onEnded} onPlay={...setIsPaused(false)} onPause={...} />` —— 实际 isPaused 同步在引擎里用 `onPlay/onPause` 回调；dock 内补两个 handler 调 `player`（若需要，在引擎暴露 `setPaused`；或 dock 本地读 `el.paused`）。简单做法：`<audio>` 的 `onPlay={() => {}} onPause={() => {}}`，dock 显示用 `player.isPlaying`，暂停态由 `togglePause` 维护——**为避免外部暂停不同步，引擎在 Step 1 已用 isPaused 状态；这里 onPlay/onPause 直接 set**。改：在引擎里把 `setIsPaused` 也暴露，或在 dock 用 `onPlay={() => player.__setPaused(false)}`。**最简：** 在 `usePlaylistPlayer` 返回里加 `notifyPlay: () => setIsPaused(false)` 与 `notifyPause: () => setIsPaused(true)`，dock 的 `<audio onPlay={player.notifyPlay} onPause={player.notifyPause} />`。（执行时把这两个加入引擎接口。）
- 当前曲信息：`player.current?.label`、`refLink` 快链、`player.index+1 / player.queue.length`。
- 传输：`prev` / 暂停-继续(`togglePause`，图标按 `player.isPaused`) / `next`。
- 模式芯片：`cycleLoopMode`，文字 `{order:'顺序',one:'单曲',all:'列表'}[loopMode]`。
- 次数芯片：`cycleLoopCount`，显示 `loopCount===Infinity ? '∞' : '×'+loopCount`。
- **桃心**：`onToggleFavorite`，`isFavorite` 时实心高亮，否则空心。
- 关闭：`stop`。
- video 兜底：若 `player.current?.mediaType==='video'`，复用旧 `AudioPlayerBar` 的浮层 `<video>`（把 `audioRef` 换成 `videoRef` 逻辑合并；MVP 可仅 admin 用，标 `theme==='light'` 时启用浮层）。

- [ ] **Step 3: 提示用户 `pnpm build`**（含 UI）

人工核对：dock 渲染、按钮可点、桃心切换图标。

- [ ] **Step 4: 提交**

```bash
git add src/components/audio/PlayerDock.tsx src/hooks/usePlaylistPlayer.ts
git commit -m "feat(audio): add shared PlayerDock (transport + loop + favorite heart)"
```

---

## Task 6: `<CollectionPills>` 卡片所属收藏夹胶囊

**Files:**
- Create: `src/components/audio/CollectionPills.tsx`

- [ ] **Step 1: 写组件**

```ts
'use client'

import clsx from 'clsx'
import type { AudioPlaylistItem } from '@/utils/audio-manager-types'

type Entry = { collectionId: string; collectionName: string; kind: string; item: AudioPlaylistItem }

type Props = {
  entries: Entry[]                         // 来自 collections.membership(bucket, path)
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
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onRemove(e.item) }}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/10"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/audio/CollectionPills.tsx
git commit -m "feat(audio): add CollectionPills for card membership + remove"
```

---

## Task 7: 改造 `/admin/audio`（去 tab + 接共享层 + 上传入选中收藏夹）

**Files:**
- Modify: `src/components/admin/audio/AudioManagerPage.tsx`
- Modify: `src/components/admin/audio/StandaloneAudioTab.tsx`
- Modify: `src/components/admin/audio/PlaylistSidebar.tsx`
- Delete: `ReadingAudioTab.tsx`, `FlipbookAudioTab.tsx`, `AudioPlayerBar.tsx`

- [ ] **Step 1: 重写 `AudioManagerPage`**

关键改动：
- 删 `Tab` 状态、`TABS`、tab strip 与 `ReadingAudioTab`/`FlipbookAudioTab`/`AudioPlayerBar` import。
- 用 `const col = useAudioCollections(user)` 取代 `useAudioPlaylists`；保留 `useAudioAssets`。
- 用 `const player = usePlaylistPlayer()`。
- 新增 `selectedCollectionId` 状态，默认 `'favorites'`。
- `playSingle(track)` → `player.play([track])`。
- 收藏夹播放/入队：`onPlayCollection(c) => player.play(c.tracks)`、`onEnqueueCollection(c) => player.enqueue(c.tracks)`。
- 上传：`onUpload(file)`：
  ```ts
  const { error, asset } = await assetHook.uploadAsset(file)
  if (error) { showFlash(`上传失败：${error}`); return }
  const selected = col.collections.find((c) => c.id === selectedCollectionId)
  if (asset && selected?.acceptsItems && selected.id !== 'reading' && selected.id !== 'flipbook') {
    const plId = selected.id === 'favorites' ? col.favoriteId : selected.id.replace(/^pl:/, '')
    if (plId) {
      await col.addItem(plId, {
        itemType: 'standalone', mediaType: asset.mediaType, label: asset.label,
        storageBucket: AUDIO_MEDIA_BUCKET, storagePath: asset.storagePath,
        refLink: null, assetId: asset.id,
      })
      showFlash(`已加入「${selected.name}」`)
    }
  }
  ```
- 底部渲染 `<PlayerDock player={player} theme="light" isFavorite={!!player.current?.source && col.favoriteKeySet.has(trackKey(player.current.source.storageBucket, player.current.source.storagePath))} onToggleFavorite={() => player.current && col.toggleFavorite(player.current)} />`。
- 删掉旧 `pendingAdd` 模态对应的"多歌单选择"逻辑——改为"加入选中收藏夹"语义后不再需要询问；`StandaloneAudioTab` 的 `onAddToPlaylist` 改为加入当前选中收藏夹（同上传逻辑抽成 `addAssetToSelected(input)`）。

- [ ] **Step 2: 改 `PlaylistSidebar` 消费 `AudioCollection[]`**

Props 改为：`collections: AudioCollection[]`、`selectedId`、`onSelect`、`onCreate`、`onRename`、`onDelete`、`onPlay(c)`、`onEnqueue(c)`。渲染：
- 每个 collection 一行：名字（点击 `onSelect`）、▶（`onPlay`）、➕（`onEnqueue`）。
- `removable===false`（favorites/reading/flipbook）不渲染改名/删除按钮。
- `kind==='favorites'` 加 ❤️ 前缀，reading/flipbook 加 📖/📚。
- 底部"新建收藏夹"输入仍调 `onCreate`。

- [ ] **Step 3: 改 `StandaloneAudioTab`（成为 admin 主体）**

- 卡片下方加 `<CollectionPills entries={col.membership(AUDIO_MEDIA_BUCKET, asset.storagePath)} onRemove={col.removeItem} theme="light" />`（需把 `col` 或 membership/removeItem 透传进来）。
- `onAddToPlaylist` 按钮文案改"加入当前收藏夹"，调上面的 `addAssetToSelected`。
- 组件可保留文件名，仅作为页面主体被 `AudioManagerPage` 直接渲染（去掉 tab 包裹）。

- [ ] **Step 4: 删除废弃文件**

```bash
git rm src/components/admin/audio/ReadingAudioTab.tsx \
       src/components/admin/audio/FlipbookAudioTab.tsx \
       src/components/admin/audio/AudioPlayerBar.tsx
```

- [ ] **Step 5: 提示用户 `pnpm lint && pnpm build`**

人工核对：无 tab；默认选中"我的最爱"；选中某用户歌单后上传音频→自动入该歌单并 flash；预设无改名删除；每收藏夹 ▶/➕ 生效；卡片胶囊可删；底部 dock 播放。

- [ ] **Step 6: 提交**

```bash
git add src/components/admin/audio/
git commit -m "refactor(audio): rebuild admin/audio on shared collections + player, drop tabs"
```

---

## Task 8: 新增 `/audio` 孩子端听歌页

**Files:**
- Create: `src/app/audio/page.tsx`
- Create: `src/components/audio/AudioPageView.tsx`

> **先做：** 调 `frontend-design` skill，目标"孩子端深色 playful 听歌页：顶部收藏夹切换 + 音频卡片网格 + 底部停靠条"。

- [ ] **Step 1: `page.tsx` 薄壳**

```tsx
'use client'
import { useAuth } from '@/contexts/AuthContext'
import AudioPageView from '@/components/audio/AudioPageView'

export default function AudioPage() {
  const { user } = useAuth()
  return <AudioPageView user={user} />
}
```

- [ ] **Step 2: `AudioPageView` 主体**

- `const col = useAudioCollections(user)`、`const player = usePlaylistPlayer()`。
- `selectedId` 默认 `'favorites'`。
- 顶部：返回首页 + 标题"🎧 音频"。
- 切换区：`col.collections.map` 成 chip；每个 chip 含名字（`onSelect`）+ ▶（`player.play(c.tracks)`）+ ➕（`player.enqueue(c.tracks)`）。
- 选中收藏夹 `selected = col.collections.find(c => c.id === selectedId)`；网格列出 `selected.tracks`：
  - 卡片：label、refLink 快链、单播按钮（`player.play([track])`）、➕加入播放列表（`player.enqueue([track])`）。
  - 卡片胶囊：`track.source && <CollectionPills entries={col.membership(track.source.storageBucket, track.source.storagePath)} onRemove={col.removeItem} theme="dark" />`。
- 底部：`<PlayerDock player={player} theme="dark" isFavorite={...favoriteKeySet.has(...)} onToggleFavorite={() => player.current && col.toggleFavorite(player.current)} />`。
- 空态：collection 无 tracks 时占位。

- [ ] **Step 3: 提示用户 `pnpm build`**

人工核对：默认我的最爱；切收藏夹换列表；卡片/批量入队；桃心；胶囊删除。

- [ ] **Step 4: 提交**

```bash
git add src/app/audio/ src/components/audio/AudioPageView.tsx
git commit -m "feat(audio): add /audio kid-facing listening page"
```

---

## Task 9: 改造 reading 页接共享引擎/dock

**Files:**
- Modify: `src/app/english/words/reading/page.tsx`

- [ ] **Step 1: 移除内联播放器，接共享层**

- 删除：内联 `<audio>`、`queueRef`/`loopCountRef`/`queueMode`/`queueIndex`/`isPaused`/`playingKey`/`loopLimit` 等状态、`PlaylistBar` 及其全部子组件（`Equalizer`/`PrimaryDial`/`GhostButton`/`LoopDial`/Icons —— 已迁入 PlayerDock）、`startQueue`/`playQueueAt`/`handleQueueEnded`/`togglePause`/`goPrev`/`goNext`/`cycleLoopLimit`/`stopQueue` 等。
- 新增 `const col = useAudioCollections(user)`（或仅复用 reading 媒体 + 单独构造 tracks）。**推荐**：用 `col.collections.find(c => c.id === 'reading')!.tracks` 拿到含 source 的 reading tracks。
- 新增 `const player = usePlaylistPlayer()`，在页面 return 末尾渲染 `<PlayerDock player={player} theme="dark" isFavorite={...} onToggleFavorite={...} />`（reading 页是浅色主题，但 dock 固定底部，用 `theme="light"` 或 `"dark"` 取决 frontend-design；reading 主体浅色，dock 建议 `theme="light"`）。
- header 的播放 pill 改为单一触发按钮：保留 `queueIds`（选中集）即可——"播放全部/选中"调 `player.play(selectedTracks.length ? selectedTracks : readingTracks)`，"停止"调 `player.stop()`。
- 每课卡片"加入队列"按钮 → 改为 `player.enqueue([trackForKey(p.key)])`，或保留 `queueIds` 选择语义（二选一；**推荐保留选择语义**：`queueIds` 决定 `player.play` 的子集，卡片按钮仍 toggle `queueIds`）。
- 单课"循环播放"按钮（`ReadingAudioButton mode=loop`）→ 改为 `player.play([trackForKey(p.key)])` 并 `player.setLoopMode('one')`，确保不另起 `<audio>`。
- `playingKey` 高亮 → 改用 `player.current?.refLink === '/english/words/reading/'+p.key` 判断。

- [ ] **Step 2: 提示用户 `pnpm build`**

人工核对：底部 dock 连播、循环次数、单课循环；全站仅一个 `<audio>`（DevTools 搜 `audio` 标签）。

- [ ] **Step 3: 提交**

```bash
git add src/app/english/words/reading/page.tsx
git commit -m "refactor(audio): reading page uses shared player engine + dock"
```

---

## Task 10: 改造 flipbook 页接共享引擎/dock

**Files:**
- Modify: `src/app/flipbook/page.tsx`

- [ ] **Step 1: 移除内联播放器，接共享层**

- 删除内联 `<audio>` + `PlaylistBar` + 子组件 + `queueRef`/`loopCountRef`/`queueMode` 等队列状态 + `startQueue`/`playQueueAt`/`handleQueueEnded`/`togglePause`/`goPrev`/`goNext`/`cycleLoopLimit`/`stopQueue`/`playQueueAt`。
- 保留绘本书架渲染 + 单本"播放讲解"（`handlePlayAudio`）改为 `player.play([bookTrack(book)])`。
- 用 `const col = useAudioCollections(user)` 取 `flipbook` 收藏夹 tracks（含 source）；`const player = usePlaylistPlayer()`。
- header 的 `PlaylistBar` → 触发按钮："播放全部/选中"调 `player.play(selectedBooksTracks.length ? selected : flipbookTracks)`。`queueIds` 选择语义保留。
- `playingBookId` 高亮 → 用 `player.current?.refLink === '/flipbook/'+book.id`。
- 末尾渲染 `<PlayerDock player={player} theme="dark" isFavorite={...} onToggleFavorite={...} />`。
- 注意 `useImmersive`/`onRead` 跳转时 `player.stop()`。

- [ ] **Step 2: 提示用户 `pnpm build`**

人工核对：书架连播、循环、单本播放；进入阅读时停播。

- [ ] **Step 3: 提交**

```bash
git add src/app/flipbook/page.tsx
git commit -m "refactor(audio): flipbook page uses shared player engine + dock"
```

---

## Task 11: 首页加 `/audio` 入口

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 加入口卡片**

在首页卡片菜单里加一张"🎧 音频"卡片，`Link href="/audio"`，沿用现有卡片样式（参照同文件其它入口卡片的 className）。

- [ ] **Step 2: 提示用户 `pnpm build`**

人工核对：首页出现音频入口，点击进入 `/audio`。

- [ ] **Step 3: 提交**

```bash
git add src/app/page.tsx
git commit -m "feat(audio): add /audio entry card on home"
```

---

## Task 12: 更新 CLAUDE.md + 收尾

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 文档同步**

在 Architecture 段补：`/audio`（孩子端听歌页）、统一播放器（`usePlaylistPlayer` + `PlayerDock`）、`useAudioCollections`（favorites/reading/flipbook/用户歌单）、`/admin/audio` 已去 tab 只管独立媒体。Environment 段 SQL 提 `docs/sql/audio-favorites-migration.sql`。

- [ ] **Step 2: 提示用户 `pnpm lint && pnpm build` 全量**

确认全绿。

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for unified audio system"
```

---

## Self-Review 结果

**Spec 覆盖：**
- 统一收藏夹模型 → Task 2/3 ✓
- favorites 默认/可收藏 + 迁移 → Task 1/3 ✓
- 统一播放器引擎 + 三模式 + 次数 → Task 4 ✓
- PlayerDock + 桃心 → Task 5 ✓
- 收藏夹胶囊 + 删除 → Task 6（组件）+ Task 7/8（接入）✓
- admin 去 tab + 上传入选中收藏夹 + 每收藏夹 ▶/➕ → Task 7 ✓
- /audio 孩子端默认我的最爱 + 临时队列 → Task 8 ✓
- reading/flipbook 接共享 → Task 9/10 ✓
- 首页入口 → Task 11 ✓
- 删除三处旧播放器 → Task 7 ✓

**类型一致性：** `PlayerTrack.source`（Task2）→ 各 hook 构造（Task3）→ 引擎去重/桃心（Task4/5）→ 胶囊（Task6）一致；`LoopMode='order'|'one'|'all'` 全程统一（已弃 `'none'`）；`isFavorite` 字段 Task3 同步加到 `AudioPlaylist` 与 `useAudioPlaylists`。

**已知执行注意：** Task5 需在引擎接口补 `notifyPlay/notifyPause`（Step2 已标注）；reading/flipbook 主体浅/深主题与 dock `theme` 由 frontend-design 最终定。

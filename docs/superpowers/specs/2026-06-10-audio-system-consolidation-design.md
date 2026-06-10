# 音频系统整合设计

**日期：** 2026-06-10
**状态：** 已确认，待写实现计划

## 背景

仓库里已有一套音频基础设施（上个会话搭的）：

- **表**：`audio_assets`（独立媒体）、`audio_playlists`（收藏夹）、`audio_playlist_items`（收藏夹条目，多态）
- **Hook**：`useAudioPlaylists`（收藏夹 CRUD + items）、`useAudioAssets`（独立媒体 CRUD）、`useReadingPassageMedia`、`useFlipbookBooks`
- **三处重复/分裂的播放器**：
  - `/english/words/reading` 页内联 `PlaylistBar`（橙色拟物、header 内嵌、有"循环次数 ×N"但只支持"整列重复 N 次"语义）
  - `/flipbook` 页内联 `PlaylistBar`（与 reading 几乎逐行重复）
  - `/admin/audio` 的 `AudioPlayerBar`（底部固定条、支持顺序/单曲/列表三模式 + prev/next，但**没有循环次数**，浅色 admin 风，含 video 浮层）
- `/admin/audio` 当前是 3 个 tab：阅读朗读 / 绘本 / 独立媒体，左侧收藏夹侧栏。

本设计把这套东西**整合 + 收敛**：统一收藏夹概念、统一播放器、新增孩子端 `/audio` 听歌页、改造 admin。

## 目标

1. 抽象统一的 `AudioCollection` 模型，消除"收藏夹"概念在 admin tab / 用户歌单 / 虚拟来源之间的分裂。
2. 把三处播放器收敛成"一个引擎 hook + 一个底部停靠条组件"，全站只存在一个 `<audio>` 元素。
3. 播放器支持：单曲循环 / 顺序播放 / 列表循环三模式 + 循环次数（次数作用于当前模式）+ 手动上一首/下一首 + 桃心收藏当前曲。
4. 改造 `/admin/audio`：去掉 3 个 tab，主体只做独立媒体 CRUD；侧栏改为统一收藏夹列表。
5. 新增 `/audio`（孩子端深色主题）：浏览收藏夹音频、构建临时播放队列、连播。

## 核心抽象（新增）

### `AudioCollection` 统一模型

```ts
type AudioCollectionKind = 'favorites' | 'reading' | 'flipbook' | 'playlist'

type AudioCollection = {
  id: 'favorites' | 'reading' | 'flipbook' | `pl:${string}`
  name: string
  kind: AudioCollectionKind
  removable: boolean    // 三个预设(favorites/reading/flipbook)=false，用户歌单=true
  acceptsItems: boolean // favorites + 用户歌单=true；reading/flipbook(虚拟)=false
  tracks: PlayerTrack[] // 已解析好的可播曲目
}
```

三个**预设收藏夹**，固定排在用户歌单之前，顺序：

| id | 名称 | kind | removable | acceptsItems | 数据来源 |
|----|------|------|-----------|--------------|---------|
| `favorites` | 我的最爱 | favorites | false | **true** | DB 持久特殊歌单（`audio_playlists.is_favorite=true`） |
| `reading` | 阅读 | reading | false | false | 虚拟：`useReadingPassageMedia` 有音频的课文 |
| `flipbook` | 绘本 | flipbook | false | false | 虚拟：`useFlipbookBooks` 有 `audioPath` 的绘本 |
| `pl:{uuid}` | 用户自定义 | playlist | true | true | `useAudioPlaylists` 用户歌单 |

**进入 `/admin/audio` 与 `/audio` 默认选中「我的最爱」。**

### `PlayerTrack`（扩展现有类型）

为支持"桃心收藏当前曲"和"收藏夹→队列"，`PlayerTrack` 必须携带足以持久化成 `audio_playlist_items` 的来源描述：

```ts
interface PlayerTrack {
  url: string
  label: string
  refLink: string | null
  mediaType: MediaType
  // 新增：可写回 playlist 的来源描述（== AddPlaylistItemInput）
  source: AddPlaylistItemInput | null  // null 表示不可收藏（理论上不出现）
}
```

各来源构建 `source` 的方式：
- reading：`{ itemType:'reading', mediaType:'audio', label:title, storageBucket:READING_AUDIO_BUCKET, storagePath:audioPath, refLink:'/english/words/reading/{key}', assetId:null }`
- flipbook：`{ itemType:'flipbook', mediaType:'audio', label:title, storageBucket:FLIPBOOK_BUCKET, storagePath:audioPath, refLink:'/flipbook/{id}', assetId:null }`
- 用户歌单 / favorites item：直接由 `AudioPlaylistItem` 还原（含 `assetId`）。
- 所有 URL 均为 public bucket，可同步解析，无需异步签名。

### `useAudioCollections(user)`（新 hook）

聚合层，内部组合 `useReadingPassageMedia` + `useFlipbookBooks` + `useAudioPlaylists`：

- 返回 `collections: AudioCollection[]`（favorites, reading, flipbook, ...用户歌单）。
- **首次加载若该用户没有 favorites 歌单 → 自动创建**（`name:'我的最爱', is_favorite:true`）。
- 透传并封装收藏夹操作：`createPlaylist / renamePlaylist / deletePlaylist`（仅 `removable` 歌单）、`addItem / removeItem`（仅 `acceptsItems` 收藏夹）。
- 暴露便捷：`favorites: AudioCollection`、`favoriteKeySet: Set<string>`（`'{bucket}|{path}'`，给桃心高亮用）、`toggleFavorite(track: PlayerTrack)`。
- **成员反查** `membership(bucket, path): Array<{ collectionId, collectionName, kind, item: AudioPlaylistItem }>`：返回包含该曲目的全部**可收藏收藏夹**（我的最爱 + 用户歌单）及其对应 item（拿 `item.id` 才能 `removeItem`）。虚拟的阅读/绘本不参与反查（无法移除）。供卡片渲染"所属收藏夹胶囊 + 删除"。

## 统一播放器（新增，替换三处）

拆成**引擎 hook + 展示组件**两层。

### `usePlaylistPlayer()` 引擎

独占一个 `<audio>`（保留 video 兜底给 admin 的独立媒体）。状态：

```ts
{
  queue: PlayerTrack[]
  index: number
  isPlaying: boolean
  isPaused: boolean
  loopMode: 'one' | 'order' | 'all'   // 单曲 / 顺序 / 列表
  loopCount: LoopCount                 // [3,5,10,15,20,Infinity]
  loopsDone: number
}
```

方法：`play(tracks, startIndex=0)`（替换队列开播）、`enqueue(tracks)`（去重追加；队列空则等同 play）、`togglePause`、`prev`、`next`、`jumpTo(i)`、`setLoopMode`、`cycleLoopCount`、`stop`。

`onEnded` 逻辑（**循环次数作用于当前模式**）：
- **单曲 `one`**：放完当前曲 `loopsDone++`；`loopsDone < loopCount` 则 `currentTime=0` 重放本曲，否则 `stop`。
- **列表 `all`**：到队尾时 `loopsDone++`；`loopsDone < loopCount` 回到 index 0，否则 `stop`；未到队尾则 index+1。
- **顺序 `order`**：index+1；到尾停（忽略次数）。
- 手动 `prev/next/jumpTo` 始终可用；切曲时把 `one` 模式的 `loopsDone` 归零。
- `loopCount = Infinity` 表示无限循环（不因次数停止）。

### `<PlayerDock>` 展示组件

固定底部停靠条，**深色 playful 骨架**（复用现有橙色拟物控件视觉：均衡器动画、白色主拨钮、橙色高光）。Props 由引擎状态 + 收藏能力驱动：

- 当前曲信息（label、`refLink` 快链、`index+1 / total`）。
- 传输控件：上一首 / 暂停-继续 / 下一首。
- 模式切换芯片：单曲 / 顺序 / 列表（点击循环切换）。
- 次数芯片：×N（点击在 `[3,5,10,15,20,∞]` 间循环）。
- **桃心开关**：高亮 = 当前曲已在「我的最爱」。点击 `toggleFavorite(currentTrack)`，写入/移出 favorites 歌单。`favoriteKeySet` 决定亮灭。
- 关闭按钮（`stop`）。
- admin 场景下若当前曲是 video，沿用现有 video 浮层逻辑（折叠进同一组件）。
- `queue.length===0` 时不渲染。

**视觉收敛点（已确认）**：reading / flipbook 现有的"header 内嵌橙色 pill + 播放时原地变传输控件"被移除，统一为底部停靠条。各页 header 只保留"播放全部 / 选中 / 停止"这一**触发**按钮（负责组队列并调 `player.play()`），播放控制全交给共享 dock。

## 页面改造

### `/admin/audio`（家长端浅色）

- **删除 3 个 tab**（`ReadingAudioTab`、`FlipbookAudioTab` 删除，取数逻辑迁入 `useAudioCollections`）。
- 页面主体 = 独立媒体 CRUD（`StandaloneAudioTab` 内容提为页面主体）：上传 / 改名 / 删除 / 单播 / 加入收藏夹。
- **维持"当前选中收藏夹"状态**。上传独立媒体时：
  1. 永远先创建 `audio_assets`；
  2. 若当前选中收藏夹 `acceptsItems`（我的最爱或用户歌单）→ 同时 `addItem` 加入该收藏夹；
  3. 选中虚拟收藏夹（阅读/绘本）或未选中 → 仅独立媒体；
  4. flash 提示结果。
- **`PlaylistSidebar` 改为消费 `AudioCollection[]`**：
  - 顶部三个预设（我的最爱 / 阅读 / 绘本），`removable=false` 不显示改名/删除。
  - 下方用户歌单，完整 CRUD。
  - **每个收藏夹两个动作按钮**：▶ 播放（`player.play(collection.tracks)`）、➕ 加入播放列表（`player.enqueue(collection.tracks)`）。三个预设同样可播放/入队。
  - "加入收藏夹"目标下拉只列 `acceptsItems` 的收藏夹。
- 底部播放器换成共享 `<PlayerDock>`。

### `/audio`（孩子端深色，新增）

- Header：返回首页 + 标题（🎧 音频）。
- 收藏夹切换 chips：我的最爱（默认选中）/ 阅读 / 绘本 / ...用户歌单。每个 chip 区带 ▶播放 + ➕加入播放列表两个动作。
- 选中收藏夹 → 网格列出其音频卡片；卡片含「单播」+「➕ 加入播放列表」。
- **卡片显示所属收藏夹胶囊**：每张音频卡片用 `membership(bucket, path)` 渲染它所属的可收藏收藏夹胶囊（如「我的最爱」「晚安歌单」），每个胶囊带 × 删除图标，单击 `removeItem(item)` 把该曲从对应收藏夹移除（不删独立媒体本身）。虚拟收藏夹（阅读/绘本）不显示胶囊。同一能力也用于 admin 独立媒体卡片。
- **播放列表 = 临时播放队列**（不入 DB），由卡片 / 收藏夹批量填充，交给共享引擎连播；底部 `<PlayerDock>`（模式 + 次数 + prev/next + 桃心）控制。
- 从首页 `src/app/page.tsx` 加入口卡片。
- 说明：独立媒体（`audio_assets`）通过在 admin 加入某收藏夹后，在 `/audio` 以该收藏夹形式出现；`/audio` 预设收藏夹保留 我的最爱 + 阅读 + 绘本 + 用户歌单。

## 数据库迁移

新增 `docs/sql/audio-favorites-migration.sql`：

```sql
alter table audio_playlists
  add column if not exists is_favorite boolean not null default false;

-- 每用户至多一个 favorites 歌单（部分唯一索引）
create unique index if not exists audio_playlists_one_favorite_per_user
  on audio_playlists(user_id) where is_favorite;
```

`useAudioCollections` 首次加载若用户无 favorites 行则插入一条 `is_favorite=true, name='我的最爱'`。`audio_playlist_items.item_type` 现有 check 约束已含 standalone/reading/flipbook，favorites 复用这些 item_type（收藏的是某来源曲目），无需改约束。

## 组件/文件清单

**新增**
- `src/hooks/useAudioCollections.ts`
- `src/hooks/usePlaylistPlayer.ts`
- `src/components/audio/PlayerDock.tsx`（共享，全站唯一播放器视图）
- `src/app/audio/page.tsx` + 其卡片/切换子组件
- `docs/sql/audio-favorites-migration.sql`

**改造**
- `src/utils/audio-manager-types.ts`：`PlayerTrack` 加 `source`；`AudioCollection` 类型；`LoopCount`。
- `src/components/admin/audio/AudioManagerPage.tsx`：去 tab、接 `useAudioCollections`、上传入选中收藏夹、底部 `<PlayerDock>`。
- `src/components/admin/audio/PlaylistSidebar.tsx`：消费 `AudioCollection[]`、每收藏夹 ▶/➕ 动作、预设锁定。
- `src/components/admin/audio/StandaloneAudioTab.tsx`：内容提为 admin 页面主体（可保留组件名或重命名）。
- `src/app/english/words/reading/page.tsx`：移除内联 `PlaylistBar` + `<audio>` + 队列逻辑，改用共享引擎/dock；header 留触发按钮 + 每课卡片"加入队列"。
- `src/app/flipbook/page.tsx`：同上。
- `src/app/page.tsx`：加 `/audio` 入口卡片。

**删除**
- `src/components/admin/audio/ReadingAudioTab.tsx`
- `src/components/admin/audio/FlipbookAudioTab.tsx`
- `src/components/admin/audio/AudioPlayerBar.tsx`（逻辑并入 `usePlaylistPlayer` + `<PlayerDock>`）

## 测试与验收

无测试套件。验收：
1. `pnpm lint` 无类型错误；`pnpm build` 通过。
2. `/admin/audio`：无 tab；选中"我的最爱"上传音频 → 自动入"我的最爱"；预设不可改删；每收藏夹 ▶/➕ 生效。
3. `/audio`：默认"我的最爱"；切换收藏夹换列表；卡片/批量入队；卡片显示所属收藏夹胶囊、× 可从对应收藏夹移除；dock 三模式 + 次数 + prev/next + 桃心生效。
4. reading / flipbook：底部停靠条连播、循环次数、桃心一致工作；全站仅一个 `<audio>`。

## 风险/注意

- **单一 `<audio>`**：单卡片"单播"也必须走引擎（播 1 曲队列），避免出现第二个 audio 元素互相打架。
- **桃心写回**：依赖 `PlayerTrack.source` 完整；reading/flipbook 构建 track 时务必带上 `source`。
- **favorites 自动创建并发**：用部分唯一索引兜底，重复插入时吞掉唯一冲突错误。
- UI 改动前按项目约定先调 `frontend-design` skill（深色 playful、面向 7 岁）。

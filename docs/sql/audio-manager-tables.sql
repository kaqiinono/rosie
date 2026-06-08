-- ============================================================
-- audio_assets: 独立音频文件元数据（仅 standalone 类型使用）
-- ============================================================
create table if not exists audio_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null,
  storage_path text not null,   -- path in 'media' bucket, e.g. standalone/{id}.mp3
  duration_sec numeric,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists audio_assets_user_id_idx on audio_assets(user_id);

alter table audio_assets enable row level security;
create policy "authenticated can read audio_assets"
  on audio_assets for select using (auth.role() = 'authenticated');
create policy "users insert own audio_assets"
  on audio_assets for insert with check (auth.uid() = user_id);
create policy "users update own audio_assets"
  on audio_assets for update using (auth.uid() = user_id);
create policy "users delete own audio_assets"
  on audio_assets for delete using (auth.uid() = user_id);

-- ============================================================
-- audio_playlists: 收藏夹
-- ============================================================
create table if not exists audio_playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audio_playlists_user_id_idx on audio_playlists(user_id);

alter table audio_playlists enable row level security;
create policy "authenticated can read audio_playlists"
  on audio_playlists for select using (auth.role() = 'authenticated');
create policy "users insert own audio_playlists"
  on audio_playlists for insert with check (auth.uid() = user_id);
create policy "users update own audio_playlists"
  on audio_playlists for update using (auth.uid() = user_id);
create policy "users delete own audio_playlists"
  on audio_playlists for delete using (auth.uid() = user_id);

-- ============================================================
-- audio_playlist_items: 收藏夹内的音频条目（多态设计）
--   item_type:      'standalone' | 'reading' | 'flipbook'
--   label:          展示名，插入时写死（不依赖外表 join）
--   storage_bucket: 'media' | 'reading' | 'flipbook'
--   storage_path:   bucket 内路径
--   ref_link:       可选快链路由（阅读 / 绘本详情页）
--   asset_id:       仅 standalone 有值，用于级联删除
-- ============================================================
create table if not exists audio_playlist_items (
  id             uuid primary key default gen_random_uuid(),
  playlist_id    uuid not null references audio_playlists(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  item_type      text not null check (item_type in ('standalone', 'reading', 'flipbook')),
  label          text not null,
  storage_bucket text not null,
  storage_path   text not null,
  ref_link       text,
  asset_id       uuid references audio_assets(id) on delete cascade,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists audio_playlist_items_playlist_id_idx on audio_playlist_items(playlist_id);

alter table audio_playlist_items enable row level security;
create policy "authenticated can read audio_playlist_items"
  on audio_playlist_items for select using (auth.role() = 'authenticated');
create policy "users insert own audio_playlist_items"
  on audio_playlist_items for insert with check (auth.uid() = user_id);
create policy "users delete own audio_playlist_items"
  on audio_playlist_items for delete using (auth.uid() = user_id);

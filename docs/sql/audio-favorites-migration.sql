-- audio_playlists: 标记"我的最爱"特殊歌单
alter table audio_playlists
  add column if not exists is_favorite boolean not null default false;

-- 每个用户至多一个 favorites 歌单
create unique index if not exists audio_playlists_one_favorite_per_user
  on audio_playlists(user_id) where is_favorite;

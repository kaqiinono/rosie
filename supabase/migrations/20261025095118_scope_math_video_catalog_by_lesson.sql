create table public.math_video_lesson_catalog (
  lesson_key text primary key check (lesson_key ~ '^[1-9][0-9]*-[1-9][0-9]*$'),
  file_paths text[] not null,
  keys text[] not null,
  synced_at timestamptz not null default now(),
  constraint math_video_lesson_paths_no_null check (array_position(file_paths, null) is null),
  constraint math_video_lesson_keys_no_null check (array_position(keys, null) is null)
);

alter table public.math_video_lesson_catalog enable row level security;
revoke all on table public.math_video_lesson_catalog from public, anon, authenticated;
grant select, insert, update, delete on table public.math_video_lesson_catalog to service_role;

-- Preserve the old complete snapshot for every lesson registered at this migration.
-- An empty lesson in a successful full snapshot is still a synced lesson.
-- Keep the original table as an archive, including filenames without a lesson prefix.
with lessons(lesson_key) as (
  values ('1-12'), ('1-13'), ('1-15'), ('1-18'), ('1-23'), ('1-29'), ('1-30'),
    ('1-34'), ('1-35'), ('1-36'), ('1-37'), ('1-38'), ('1-39'), ('1-40'),
    ('1-41'), ('1-42'), ('1-43'), ('1-44'), ('1-46'), ('1-47'),
    ('2-1'), ('2-2'), ('2-3'), ('2-4'), ('2-5'), ('2-6'), ('2-7'), ('2-9'), ('2-10')
)
insert into public.math_video_lesson_catalog (lesson_key, file_paths, keys, synced_at)
select l.lesson_key,
  array(select p from unnest(c.file_paths) as paths(p)
    where left(p, length('/airosie/math/ny/' || l.lesson_key || '-')) = '/airosie/math/ny/' || l.lesson_key || '-'
    order by p),
  array(select k from unnest(c.keys) as video_keys(k)
    where left(k, length(l.lesson_key) + 1) = l.lesson_key || '-' order by k),
  c.synced_at
from lessons l cross join public.math_video_catalog c
where c.id = 'primary'
on conflict (lesson_key) do nothing;

comment on table public.math_video_lesson_catalog is
  'Per-lesson manual video snapshot. Existing lessons are reused unless explicitly resynced.';

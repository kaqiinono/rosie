-- Preserve explicit catalog origin/progression for runtime; old math is conservative segment progression.
begin;
alter table public.task_course_catalog_snapshots
 add column source text not null default 'builtin' check(source in ('builtin','manual')),
 add column progression_mode text check(progression_mode in ('lesson','segment'));
update public.task_course_catalog_snapshots
 set progression_mode = case when subject = 'math' then 'segment' else 'lesson' end;
alter table public.task_course_catalog_snapshots alter column progression_mode set not null;
-- No default: new writers must declare progression; an empty segment list is never course completion.
commit;

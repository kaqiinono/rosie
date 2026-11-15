-- Preserve existing definitions; only newly inserted rows default to weekdays.
alter table public.task_homework
  add column if not exists include_weekends boolean not null default true;

alter table public.task_homework
  alter column include_weekends set default false;

comment on column public.task_homework.include_weekends is
  'Daily homework only: include Saturday and Sunday. Existing rows retain true; new rows default false.';

NOTIFY pgrst, 'reload schema';

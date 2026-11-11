alter table public.task_homework
  add column priority text not null default 'P2'
  check (priority in ('P0', 'P1', 'P2', 'P3', 'P4'));

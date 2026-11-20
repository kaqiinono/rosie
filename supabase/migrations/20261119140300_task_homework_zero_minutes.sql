alter table public.task_homework
  drop constraint task_homework_estimated_minutes_check,
  add constraint task_homework_estimated_minutes_check check (estimated_minutes between 0 and 120);

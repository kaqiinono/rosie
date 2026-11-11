alter table public.task_homework
  add column times_per_cycle integer check (times_per_cycle > 0),
  drop constraint task_homework_cycle_check,
  drop constraint task_homework_check,
  add constraint task_homework_schedule_check check (
    case cycle
      when 'daily' then
        times_per_week is null and times_per_cycle is null
        and start_weekday is null and end_weekday is null
        and start_date is null and end_date is null
      when 'weekly' then
        times_per_week is not null and times_per_cycle is null
        and start_weekday is not null and end_weekday is not null
        and times_per_week <= ((end_weekday - start_weekday + 7) % 7) + 1
        and start_date is null and end_date is null
      when 'custom' then
        times_per_week is not null and times_per_cycle is null
        and start_weekday is null and end_weekday is null
        and start_date is not null and end_date is not null and end_date >= start_date
      else
        cycle in ('biweekly', 'three_weekly', 'monthly')
        and times_per_week is null and times_per_cycle is not null
        and start_weekday is null and end_weekday is null and end_date is null
        and ((cycle = 'monthly') = (start_date is null))
    end
  );

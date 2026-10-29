begin;
insert into auth.users(id) values ('60000000-0000-0000-0000-000000000001');
insert into public.task_course_catalog_snapshots(user_id,version,subject,source,progression_mode,ordered_lessons,teaching_segments)
values ('60000000-0000-0000-0000-000000000001','manual-school-math','math','manual','lesson','[{"key":"school:chapter1","title":"第一课","book":"校内数学","unit":"1","kind":"lesson"}]','[]');
do $$ begin
 if not exists(select 1 from public.task_course_catalog_snapshots where version='manual-school-math' and source='manual' and progression_mode='lesson' and teaching_segments='[]'::jsonb) then raise exception 'manual math progression was inferred from subject'; end if;
 begin
  insert into public.task_course_catalog_snapshots(user_id,version,subject,source,progression_mode) values ('60000000-0000-0000-0000-000000000001','bad-source','math','private','lesson');
  raise exception 'invalid source accepted';
 exception when check_violation then null; end;
 begin
  insert into public.task_course_catalog_snapshots(user_id,version,subject,source,progression_mode) values ('60000000-0000-0000-0000-000000000001','bad-mode','math','manual','finished');
  raise exception 'invalid progression accepted';
 exception when check_violation then null; end;
 begin
  insert into public.task_course_catalog_snapshots(user_id,version,subject,source) values ('60000000-0000-0000-0000-000000000001','missing-mode','english','builtin');
  raise exception 'missing progression accepted';
 exception when not_null_violation then null; end;
end $$;
rollback;

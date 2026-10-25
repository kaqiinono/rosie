alter table public.task_courses drop constraint task_courses_subject_check;

alter table public.task_courses add constraint task_courses_subject_check
  check (subject in ('chinese', 'english', 'math', 'art', 'science', 'sports', 'dance', 'piano', 'swimming', 'other'));

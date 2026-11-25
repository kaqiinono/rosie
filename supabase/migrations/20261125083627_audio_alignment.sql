begin;

create table public.audio_alignments (
  account_id text not null,
  content_key text not null,
  slot text not null,
  source_signature text not null check (source_signature ~ '^[a-f0-9]{64}$'),
  marks jsonb not null check (jsonb_typeof(marks) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (account_id, content_key, slot)
);

alter table public.audio_alignments enable row level security;
revoke all on public.audio_alignments from public, anon, authenticated;
grant select, insert, update on public.audio_alignments to service_role;

create function public.apply_audio_alignment_mark(
  p_account_id text,
  p_content_key text,
  p_slot text,
  p_source_signature text,
  p_target text,
  p_duration_ms integer,
  p_expected jsonb,
  p_mark jsonb,
  p_initial jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.audio_alignments%rowtype;
  current_marks jsonb;
  current_mark jsonb;
  start_ms integer;
  end_ms integer;
begin
  if p_duration_ms is null or p_duration_ms not between 1 and 86400000 then
    raise exception 'alignment_invalid_bounds';
  end if;
  if p_mark is distinct from '{"status":"skipped"}'::jsonb then
    if p_mark->>'status' is distinct from 'timed'
      or jsonb_typeof(p_mark->'startMs') is distinct from 'number'
      or jsonb_typeof(p_mark->'endMs') is distinct from 'number' then
      raise exception 'alignment_invalid_bounds';
    end if;
    start_ms := (p_mark->>'startMs')::integer;
    end_ms := (p_mark->>'endMs')::integer;
    if start_ms < 0 or end_ms <= start_ms or end_ms > p_duration_ms then
      raise exception 'alignment_invalid_bounds';
    end if;
  end if;

  insert into public.audio_alignments (account_id, content_key, slot, source_signature, marks)
    values (p_account_id, p_content_key, p_slot, p_source_signature, p_initial)
    on conflict (account_id, content_key, slot) do nothing;

  select * into strict saved from public.audio_alignments
    where account_id = p_account_id and content_key = p_content_key and slot = p_slot
    for update;
  current_marks := case when saved.source_signature = p_source_signature then saved.marks else '{}'::jsonb end;
  current_mark := current_marks->p_target;
  if current_mark = p_mark then return current_marks; end if;
  if current_mark is distinct from nullif(p_expected, 'null'::jsonb) then
    raise exception 'alignment_mark_changed';
  end if;
  if start_ms is not null and exists (
    select 1 from jsonb_each(current_marks) as other(target, mark)
    where other.target <> p_target and other.mark->>'status' = 'timed'
      and (other.mark->>'startMs')::integer < end_ms
      and (other.mark->>'endMs')::integer > start_ms
  ) then raise exception 'alignment_overlap'; end if;

  current_marks := jsonb_set(current_marks, array[p_target], p_mark, true);
  update public.audio_alignments
    set source_signature = p_source_signature, marks = current_marks, updated_at = now()
    where account_id = p_account_id and content_key = p_content_key and slot = p_slot;
  return current_marks;
end $$;

revoke all on function public.apply_audio_alignment_mark(text,text,text,text,text,integer,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_audio_alignment_mark(text,text,text,text,text,integer,jsonb,jsonb,jsonb)
  to service_role;

create function public.save_english_audio_alignment_mark(
  p_account_id text,
  p_lesson_key text,
  p_slot text,
  p_file_id text,
  p_path text,
  p_source_signature text,
  p_target text,
  p_duration_ms integer,
  p_expected jsonb,
  p_mark jsonb,
  p_initial jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.baidu_oauth_credentials
    where id = 'primary' and account_id = p_account_id for share;
  if not found then raise exception 'alignment_source_changed'; end if;

  perform 1 from public.english_audio_bindings
    where account_id = p_account_id and lesson_key = p_lesson_key and slot = p_slot
      and file_id = p_file_id and path = p_path for share;
  if not found then raise exception 'alignment_source_changed'; end if;

  return public.apply_audio_alignment_mark(p_account_id, p_lesson_key, p_slot,
    p_source_signature, p_target, p_duration_ms, p_expected, p_mark, p_initial);
end $$;

revoke all on function public.save_english_audio_alignment_mark(text,text,text,text,text,text,text,integer,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_english_audio_alignment_mark(text,text,text,text,text,text,text,integer,jsonb,jsonb,jsonb)
  to service_role;

create function public.read_english_audio_alignments(p_lesson_key text, p_slot text)
returns table (slot text, file_id text, path text, source_signature text, marks jsonb)
language sql stable security invoker set search_path = '' as $$
  select binding.slot, binding.file_id, binding.path, alignment.source_signature, alignment.marks
  from public.baidu_oauth_credentials as credentials
  join public.english_audio_bindings as binding on binding.account_id = credentials.account_id
  left join public.audio_alignments as alignment
    on alignment.account_id = binding.account_id and alignment.content_key = binding.lesson_key
    and alignment.slot = binding.slot
  where credentials.id = 'primary' and binding.lesson_key = p_lesson_key
    and (p_slot is null or binding.slot = p_slot)
$$;

revoke all on function public.read_english_audio_alignments(text,text) from public, anon, authenticated;
grant execute on function public.read_english_audio_alignments(text,text) to service_role;

commit;

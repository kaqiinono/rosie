begin;

-- Human visual review is separate from a successful crop upload/media binding.
create table public.exam_image_task_reviews (
  content_revision_id text not null references public.exam_content_revisions(id),
  slot_id text not null,
  status text not null check (status in ('pending','approved','flagged')),
  file_snapshot jsonb not null check (jsonb_typeof(file_snapshot) = 'object'),
  actor_id uuid not null references auth.users(id),
  version uuid not null default pg_catalog.gen_random_uuid(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (content_revision_id, slot_id)
);
alter table public.exam_image_task_reviews enable row level security;
revoke all on public.exam_image_task_reviews from public, anon, authenticated;
grant select, insert, update on public.exam_image_task_reviews to service_role;

create function public.review_exam_image_task(
  p_revision text, p_slot text, p_actor uuid, p_status text, p_file jsonb, p_expected_review uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_review public.exam_image_task_reviews%rowtype;
  v_file jsonb;
begin
  if p_status is null or p_status not in ('pending','approved','flagged')
    or pg_catalog.jsonb_typeof(p_file) is distinct from 'object' or p_actor is null
  then raise exception 'exam_invalid_request'; end if;
  select * into v_revision from public.exam_content_revisions where id=p_revision for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
  if exists(select 1 from public.exam_image_task_states
    where content_revision_id=p_revision and slot_id=p_slot and retired)
  then raise exception 'exam_image_task_removed'; end if;
  select f into v_file from public.exam_media_binding_revisions b,
    lateral pg_catalog.jsonb_array_elements(b.files) f
    where b.id::text=v_revision.content->>'mediaBindingRevisionId'
      and b.content_revision_id=p_revision and f->>'slot_id'=p_slot
      and f#>>'{slot,purpose}'='question_image'
      and exists(select 1 from pg_catalog.jsonb_array_elements(v_revision.content->'mediaSlots') s
        where s=f->'slot');
  if v_file is null or v_file is distinct from p_file then raise exception 'exam_image_review_changed'; end if;
  select * into v_review from public.exam_image_task_reviews
    where content_revision_id=p_revision and slot_id=p_slot for update;
  -- Repeating a lost response is harmless and does not create another approval.
  if found and v_review.file_snapshot=p_file and v_review.status=p_status and v_review.actor_id=p_actor then
    return pg_catalog.jsonb_build_object('status',v_review.status,'version',v_review.version);
  end if;
  if v_review.version is distinct from p_expected_review then raise exception 'exam_image_review_changed'; end if;
  insert into public.exam_image_task_reviews(content_revision_id,slot_id,status,file_snapshot,actor_id)
    values(p_revision,p_slot,p_status,p_file,p_actor)
    on conflict(content_revision_id,slot_id) do update set status=excluded.status,
      file_snapshot=excluded.file_snapshot,actor_id=excluded.actor_id,
      version=pg_catalog.gen_random_uuid(),updated_at=pg_catalog.clock_timestamp()
    returning * into v_review;
  return pg_catalog.jsonb_build_object('status',v_review.status,'version',v_review.version);
end $$;
revoke all on function public.review_exam_image_task(text,text,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.review_exam_image_task(text,text,uuid,text,jsonb,uuid) to service_role;

commit;

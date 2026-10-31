-- A SELECT INTO with no rows leaves a composite whose fields are all null.
-- Return JSON null for the absent snapshot instead of serializing that composite.
create or replace function public.task_planning_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.task_planning_snapshots; begin
 if u is null then raise insufficient_privilege; end if;
 select * into s from public.task_planning_snapshots where user_id=u;
 return jsonb_build_object('snapshot',case when s.user_id is null then null else to_jsonb(s) end,'stale',s.user_id is null or s.next_recompute_at<=statement_timestamp() or s.input_revision<>coalesce((select revision from public.task_user_planning_revisions where user_id=u),0) or s.shared_revision<>(select revision from private.task_planning_shared_epoch),
 'settings',jsonb_build_object('tight_ratio',coalesce((select tight_ratio from public.task_planning_settings where user_id=u),.2)),
 'alerts',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.task_planning_alerts a where user_id=u),
 'background',private.task_planning_background_status());
end $$;

notify pgrst, 'reload schema';

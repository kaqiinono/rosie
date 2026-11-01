-- Keep the owner-scoped schedule. Retire execution and asset metadata atomically.
do $$ begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname in ('tasks-background-generation','tasks-planning-recompute');
  end if;
end $$;

lock table public.task_courses, public.task_timetable_rules, public.task_course_exceptions, public.task_course_occurrences in access exclusive mode;

drop trigger task_block_guard on public.task_time_blocks;
drop trigger task_state_reminder_update on public.task_instances;
drop trigger task_course_history_guard on public.task_courses;
drop trigger task_block_timetable_guard on public.task_time_blocks;
drop trigger task_progress_dirty on public.task_instances;
drop trigger task_execution_insert on public.task_instances;
drop trigger task_execution_seed on public.task_instances;
drop trigger material_snapshot_selector on public.task_instances;
drop trigger task_capacity_dirty on public.task_availability_day_states;
drop trigger task_capacity_dirty on public.task_availability_windows;
drop trigger task_capacity_dirty on public.task_time_blocks;
drop trigger task_capacity_dirty on public.task_timetable_rules;
drop trigger task_capacity_dirty on public.task_course_exceptions;
drop trigger task_capacity_dirty on public.task_course_events;
drop trigger task_capacity_dirty on public.task_courses;
drop trigger task_planning_enqueue on public.task_user_planning_revisions;
drop trigger task_planning_shared_dirty on public.material_assets;
drop trigger task_planning_dependency_dirty on public.task_templates;
drop trigger task_planning_dependency_dirty on public.task_course_pool_bindings;
drop trigger task_planning_dependency_dirty on public.task_course_catalog_snapshots;
drop trigger task_planning_dependency_dirty on public.course_material_links;
drop trigger task_planning_dependency_dirty on public.task_course_occurrences;
drop trigger task_planning_dependency_dirty on public.task_planning_settings;
drop trigger task_planning_delete_dirty on public.task_instances;
drop trigger task_planning_account_dirty on public.baidu_oauth_credentials;

-- Preserve genuine schedule differences. A future occurrence retired by its rule
-- already disappears through disabled_from. Do not resurrect it as a moved lesson.
insert into public.task_course_exceptions(user_id,rule_id,original_date,cancelled,starts_at,ends_at)
select o.user_id,o.rule_id,o.original_date,o.status='cancelled',o.starts_at,o.ends_at
from public.task_course_occurrences o
join public.task_timetable_rules r on r.user_id=o.user_id and r.id=o.rule_id
where (o.ends_at<=now() or public.task_rule_occurs(r,o.original_date))
  and (o.status='cancelled' or not public.task_rule_occurs(r,o.original_date)
    or o.starts_at is distinct from ((o.original_date+r.start_time) at time zone 'Asia/Shanghai')
    or o.ends_at is distinct from ((o.original_date+r.end_time) at time zone 'Asia/Shanghai'))
on conflict(user_id,rule_id,original_date) do nothing;

CREATE OR REPLACE FUNCTION public.baidu_store_verified_credentials(p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior public.baidu_oauth_credentials;g uuid;begin
 if coalesce(p_input->>'account_id','') !~ '^[1-9][0-9]{0,19}$' then raise exception 'invalid_identity';end if;
 perform pg_advisory_xact_lock(819233);
 select * into prior from public.baidu_oauth_credentials where id='primary' for update;
 g:=case when prior.account_id=p_input->>'account_id' and prior.account_generation is not null then prior.account_generation else gen_random_uuid() end;
 insert into public.baidu_oauth_credentials(id,app_key,access_token,refresh_token,expires_at,scope,authorized_by,updated_at,account_id,account_generation)
 values('primary',p_input->>'app_key',p_input->>'access_token',p_input->>'refresh_token',(p_input->>'expires_at')::timestamptz,p_input->>'scope',(p_input->>'authorized_by')::uuid,now(),p_input->>'account_id',g)
 on conflict(id) do update set app_key=excluded.app_key,access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,scope=excluded.scope,authorized_by=excluded.authorized_by,updated_at=now(),account_id=excluded.account_id,account_generation=g,refresh_lock_id=null,refresh_lock_until=null;
end $function$;

alter table public.task_courses
  drop column auto_assign,
  drop column auto_advance,
  drop column catalog_snapshot_id,
  drop column cursor,
  drop column rules_revision,
  drop column effective_from,
  drop column automation_enabled_at,
  drop column default_deadline,
  drop column cursor_revision,
  drop column generation_date,
  drop column generation_state,
  drop column generation_issue,
  drop column reminder_minutes;

drop function
  private.material_refresh_pending(uuid,uuid),
  private.material_scope_matches(jsonb,jsonb),
  private.material_snapshot_selector(),
  private.task_advance(jsonb,jsonb),
  private.task_candidates(uuid,uuid,date,date),
  private.task_capacity_dirty(),
  private.task_complete_event(uuid,uuid,integer,timestamp with time zone),
  private.task_content(jsonb,jsonb),
  private.task_deadline(jsonb,jsonb,jsonb,jsonb,text),
  private.task_emit_event(uuid,uuid,text,timestamp with time zone,boolean),
  private.task_emit_independent(uuid,uuid,text,uuid,jsonb,jsonb,timestamp with time zone,uuid),
  private.task_execution(uuid,text,jsonb,integer),
  private.task_execution_insert(),
  private.task_execution_seed(),
  private.task_finish_phase(uuid,uuid,timestamp with time zone,boolean),
  private.task_install_planning_cron(),
  private.task_matches(jsonb,jsonb,jsonb,jsonb,jsonb),
  private.task_materialize(uuid,uuid,jsonb,jsonb),
  private.task_next_candidate(uuid,uuid,jsonb),
  private.task_planning_background_status(),
  private.task_planning_dispatch(),
  private.task_planning_enqueue(),
  private.task_planning_shared_dirty(),
  private.task_process_due_user(uuid,timestamp with time zone,integer),
  private.task_progress_dirty(),
  private.task_reconcile(uuid,timestamp with time zone),
  private.task_reconcile_previews(uuid,uuid,timestamp with time zone),
  private.task_resolve_materials(uuid,uuid,jsonb,jsonb,jsonb),
  private.task_revise_event(uuid,uuid,jsonb,integer,timestamp with time zone,boolean),
  private.task_run_due(timestamp with time zone,integer,integer),
  private.task_scope_matches(jsonb,jsonb),
  private.task_uri(text),
  public.material_link_course(uuid,jsonb),
  public.material_publish_scan(uuid,uuid,integer,text,uuid,jsonb),
  public.material_refresh_pending(uuid),
  public.material_save_asset(jsonb),
  public.material_scan_file_type(text),
  public.material_unlink_course(uuid),
  public.material_upload_transition(uuid,uuid,text,uuid,text,jsonb),
  public.task_accept_plan(bigint,jsonb),
  public.task_archive_course(uuid),
  public.task_archive_course_runtime(uuid),
  public.task_assert_owner(uuid),
  public.task_backfill(uuid,jsonb),
  public.task_cancel_event(uuid,integer),
  public.task_check_units(uuid,uuid),
  public.task_claim_planning_jobs(integer,uuid),
  public.task_claim_reminders(),
  public.task_complete_event(uuid,integer),
  public.task_confirm_course(uuid,jsonb),
  public.task_course_before_configuration_change(uuid,uuid),
  public.task_effective_execution_window(timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone),
  public.task_emit(uuid,uuid,text,uuid,jsonb,jsonb,timestamp with time zone,uuid),
  public.task_ensure_next(uuid,uuid,timestamp with time zone),
  public.task_fail_planning_job(uuid,uuid),
  public.task_import_timetable(jsonb,uuid,text,text),
  public.task_initialize(jsonb),
  public.task_makeup_event(uuid,uuid,date),
  public.task_planning_input(uuid),
  public.task_planning_status(),
  public.task_preserve_course_history(),
  public.task_publish_planning(uuid,uuid,bigint,jsonb,jsonb,jsonb,timestamp with time zone),
  public.task_read_planning_alert(text,text),
  public.task_renew_planning_job(uuid,uuid),
  public.task_replace_rule(uuid,date,integer,time without time zone,time without time zone,date),
  public.task_request_planning(),
  public.task_restore_course(uuid),
  public.task_revise_event(uuid,jsonb,integer),
  public.task_rule_occurs(task_timetable_rules,date),
  public.task_runtime_status(),
  public.task_save_course(jsonb,jsonb,date),
  public.task_save_execution(jsonb,integer),
  public.task_set_availability(integer,date,text,time without time zone,time without time zone),
  public.task_set_completion(uuid,integer,integer),
  public.task_set_course_progress(uuid,jsonb,integer),
  public.task_set_estimate(uuid,integer,integer),
  public.task_set_item_done(uuid,text,boolean),
  public.task_set_planning_settings(numeric),
  public.task_state_reminders(),
  public.task_tick(uuid),
  public.task_update_preview(uuid,jsonb),
  public.task_user_lock(uuid),
  public.task_valid_course_deadline(jsonb),
  public.task_validate_block(),
  public.task_validate_timetable_block();

drop table
  private.task_event_revisions,
  private.task_planning_shared_epoch,
  private.task_runtime_config,
  private.task_worker_log,
  private.task_worker_state,
  public.course_material_links,
  public.material_assets,
  public.material_scan_sessions,
  public.material_upload_sessions,
  public.task_availability_day_states,
  public.task_availability_windows,
  public.task_course_catalog_snapshots,
  public.task_course_events,
  public.task_course_occurrences,
  public.task_course_pool_bindings,
  public.task_instance_items,
  public.task_instances,
  public.task_lesson_progress,
  public.task_materials,
  public.task_planning_alerts,
  public.task_planning_jobs,
  public.task_planning_settings,
  public.task_planning_snapshots,
  public.task_progress_events,
  public.task_push_deliveries,
  public.task_push_subscriptions,
  public.task_reminders,
  public.task_templates,
  public.task_time_blocks,
  public.task_timetable_imports,
  public.task_timetable_preferences,
  public.task_timetable_snapshots,
  public.task_unit_scopes,
  public.task_user_planning_revisions;

drop policy task_audio_owner on storage.objects;
-- The empty task-audio bucket is removed via the Storage API.
drop policy own_rows on public.task_courses;
revoke all on public.task_courses from public, anon, authenticated;
grant select on public.task_courses to authenticated;
create policy own_schedule on public.task_courses for select to authenticated using ((select auth.uid()) = user_id);
drop policy own_rows on public.task_course_exceptions;
revoke all on public.task_course_exceptions from public, anon, authenticated;
grant select on public.task_course_exceptions to authenticated;
create policy own_schedule on public.task_course_exceptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy own_rows on public.task_timetable_rules;
revoke all on public.task_timetable_rules from public, anon, authenticated;
grant select on public.task_timetable_rules to authenticated;
create policy own_schedule on public.task_timetable_rules for select to authenticated using ((select auth.uid()) = user_id);
drop policy own_rows on public.task_calendars;
revoke all on public.task_calendars from public, anon, authenticated;
grant select on public.task_calendars to authenticated;
create policy own_schedule on public.task_calendars for select to authenticated using ((select auth.uid()) = user_id);

begin;
insert into auth.users values('13131313-1313-4313-8313-131313131313'),('13131313-1313-4313-8313-131313131314');
select set_config('request.jwt.claim.sub','13131313-1313-4313-8313-131313131313',true);
set local role authenticated;
select public.task_request_planning();
select public.task_set_planning_settings(.3);
do $$begin
 if has_function_privilege('authenticated','public.task_planning_input(uuid)','execute') or has_function_privilege('anon','public.task_accept_plan(bigint,jsonb)','execute') or has_function_privilege('authenticated','public.task_claim_planning_jobs(integer,uuid)','execute') then raise exception 'worker_grant_leak'; end if;
 if (public.task_planning_status()->'settings'->>'tight_ratio')::numeric<>.3 then raise exception 'settings_lost'; end if;
 if (public.task_planning_status()->'background'->>'configured')::boolean then raise exception 'fake_scheduler'; end if;
end $$;
select public.task_save_execution('{"title":"recover","subject":"other","due_at":"2020-01-01T00:00:00Z"}',null);
do $$declare t public.task_instances; updated jsonb; begin
 select * into t from public.task_instances where user_id=auth.uid();
 updated:=public.task_save_execution(jsonb_build_object('id',t.id,'recovery_due_at',now()+interval '1 day'),t.revision);
 if updated->>'due_at'<>to_jsonb(t)->>'due_at' or (updated->>'revision')::int<>t.revision+1 or updated->>'completion_percent'<>to_jsonb(t)->>'completion_percent' then raise exception 'recovery_changed_history'; end if;
 begin perform public.task_save_execution(jsonb_build_object('id',t.id,'recovery_due_at',now()+interval '2 days'),t.revision);raise exception 'accepted_stale';exception when serialization_failure then null;end;
 if not exists(select 1 from public.task_progress_events where task_id=t.id and payload->'change' ? 'recovery_due_at') then raise exception 'recovery_not_audited';end if;
end $$;
reset role;
do $$declare j public.task_planning_jobs; snap jsonb; inp jsonb; epoch bigint; begin
 select * into j from public.task_claim_planning_jobs(1,'13131313-1313-4313-8313-131313131313');
 snap:=public.task_planning_input(j.user_id); epoch:=(snap->>'shared_revision')::bigint;
 inp:=jsonb_build_object('input_revision',snap->'input_revision','now',clock_timestamp(),'horizon_end',now()+interval '1 day','demands','[]'::jsonb);
 if not public.task_publish_planning(j.user_id,j.lease_id,epoch,inp,'{"allow_weekend":{"allocations":[]}}','{}',now()+interval '1 minute') then raise exception 'publish_failed';end if;
 if (public.task_planning_status()->>'stale')::boolean then raise exception 'fresh_is_stale';end if;
 update private.task_planning_shared_epoch set revision=revision+1;
 if not (public.task_planning_status()->>'stale')::boolean then raise exception 'shared_change_not_stale';end if;
 begin perform public.task_accept_plan((inp->>'input_revision')::bigint,'[]');raise exception 'accepted_stale_epoch';exception when serialization_failure then null;end;
end $$;
-- Actual adoption runs existing triggers; forecast-only and duplicate blocks are rejected atomically.
do $$declare u uuid:=auth.uid(); t public.task_instances; j public.task_planning_jobs; snap jsonb; inp jsonb; a jsonb; st timestamptz; en timestamptz; risks jsonb; saved_updated timestamptz; begin
 st:=(((now() at time zone 'Asia/Shanghai')::date+1)+time '09:00') at time zone 'Asia/Shanghai'; en:=st+interval '20 minutes';
 select * into t from public.task_instances where user_id=u;
 perform public.task_save_execution(jsonb_build_object('id',t.id,'due_at',en+interval '1 hour'),t.revision);
 perform public.task_set_availability(null,(st at time zone 'Asia/Shanghai')::date,'configured','09:00','10:00');
 select * into j from public.task_claim_planning_jobs(1,u); snap:=public.task_planning_input(u);
 a:=jsonb_build_object('demand_key',t.source_key,'start',st,'end',en,'minutes',20,'kind','regular','fixed',false);
 inp:=jsonb_build_object('input_revision',snap->'input_revision','now',clock_timestamp(),'horizon_end',en,'demands',jsonb_build_array(jsonb_build_object('key',t.source_key,'task_id',t.id,'origin','forecast')));
 risks:='{"batch":{"status":"weekend_required","unallocated_minutes":0,"weekend_minutes":10,"time_near":false}}';
 if not public.task_publish_planning(u,j.lease_id,(snap->>'shared_revision')::bigint,inp,jsonb_build_object('allow_weekend',jsonb_build_object('allocations',jsonb_build_array(a))),risks,now()+interval '1 minute') then raise exception 'publish_adoption_fixture';end if;
 begin perform public.task_accept_plan((snap->>'input_revision')::bigint,jsonb_build_array(a));raise exception 'forecast_was_accepted';exception when others then if sqlerrm<>'forecast_only_allocation' then raise;end if;end;
 update public.task_planning_snapshots set input=jsonb_set(input,'{demands,0,origin}','"actual"');
 begin perform public.task_accept_plan((snap->>'input_revision')::bigint,jsonb_build_array(a,a));raise exception 'duplicate_accepted';exception when others then if sqlerrm<>'time_conflict' then raise;end if;end;
 if exists(select 1 from public.task_time_blocks where user_id=u) then raise exception 'partial_accept_not_rolled_back';end if;
 if public.task_accept_plan((snap->>'input_revision')::bigint,jsonb_build_array(a))<>1 then raise exception 'adoption_missing';end if;
 if not (public.task_planning_status()->>'stale')::boolean then raise exception 'adoption_not_dirty';end if;
 perform public.task_read_planning_alert('batch','capacity');
 if not exists(select 1 from public.task_planning_alerts where user_id=u and read_at is not null and resolved_at is null) then raise exception 'read_resolved_alert';end if;
 select updated_at into saved_updated from public.task_planning_alerts where user_id=u;
 -- Repeated publication preserves notification timestamp/read state.
 select * into j from public.task_claim_planning_jobs(1,u); snap:=public.task_planning_input(u);
 inp:=jsonb_set(jsonb_set(inp,'{input_revision}',snap->'input_revision'),'{now}',to_jsonb(clock_timestamp()));
 perform public.task_publish_planning(u,j.lease_id,(snap->>'shared_revision')::bigint,inp,'{"allow_weekend":{"allocations":[]}}',risks,now()+interval '1 minute');
 if exists(select 1 from public.task_planning_alerts where user_id=u and (updated_at<>saved_updated or read_at is null)) then raise exception 'duplicate_notification';end if;
 -- Force time due locally; increased reserve updates, then removal resolves.
 update public.task_planning_snapshots set next_recompute_at=now()-interval '1 minute' where user_id=u;
 update public.task_planning_jobs set next_attempt_at=now() where user_id=u;
 select * into j from public.task_claim_planning_jobs(1,u);
 inp:=jsonb_set(inp,'{now}',to_jsonb(clock_timestamp())); risks:=jsonb_set(risks,'{batch,weekend_minutes}','20');
 perform public.task_publish_planning(u,j.lease_id,(snap->>'shared_revision')::bigint,inp,'{"allow_weekend":{"allocations":[]}}',risks,now()+interval '1 minute');
 if exists(select 1 from public.task_planning_alerts where user_id=u and (updated_at<=saved_updated or read_at is not null)) then raise exception 'reserve_not_notified';end if;
 update public.task_planning_snapshots set next_recompute_at=now()-interval '1 minute' where user_id=u;
 update public.task_planning_jobs set next_attempt_at=now() where user_id=u;
 select * into j from public.task_claim_planning_jobs(1,u); inp:=jsonb_set(inp,'{now}',to_jsonb(clock_timestamp()));
 perform public.task_publish_planning(u,j.lease_id,(snap->>'shared_revision')::bigint,inp,'{"allow_weekend":{"allocations":[]}}','{}',now()+interval '1 minute');
 if exists(select 1 from public.task_planning_alerts where user_id=u and resolved_at is null) then raise exception 'risk_not_resolved';end if;
end $$;
select set_config('request.jwt.claim.sub','13131313-1313-4313-8313-131313131314',true);
set local role authenticated;
do $$begin if (public.task_planning_status()->'snapshot'->>'user_id') is not null or exists(select 1 from public.task_planning_snapshots) or exists(select 1 from public.task_planning_alerts) then raise exception 'cross_owner_read';end if;end $$;
rollback;

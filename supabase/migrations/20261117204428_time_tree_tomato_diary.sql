create or replace function public.commit_time_tree(p_user uuid, p_revision bigint, p_garden jsonb, p_action text, p_ticket uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  current_rev bigint;
  home_pending uuid;
  prize public.draw_pool_entries;
  tomato_box_cost constant bigint := 100;
  tomato_spent bigint;
begin
  insert into public.time_tree_gardens(user_id,garden) values(p_user,'{}')
    on conflict do nothing;
  select revision into current_rev from public.time_tree_gardens where user_id=p_user for update;
  if current_rev <> p_revision then raise exception 'tree_changed'; end if;
  if p_action in ('openBox','openTomatoBox','acceptBox') then
    insert into public.draw_pool_state(user_id,kind) values(p_user,'reward') on conflict do nothing;
    select pending_id into home_pending from public.draw_pool_state where user_id=p_user and kind='reward' for update;
    if p_action in ('openBox','openTomatoBox') and p_garden->>'prize' is null then
      if p_action='openTomatoBox' then
        tomato_spent := (p_garden #>> '{tomatoWallet,spent}')::bigint;
        if tomato_spent is null or coalesce((p_garden #>> '{tomatoWallet,earned}')::bigint,0) - tomato_spent < tomato_box_cost then
          raise exception 'tomatoes_short';
        end if;
      end if;

      select * into prize from public.draw_pool_entries where user_id=p_user and kind='reward'
        and tree_eligible and enabled and tree_ticket is null and id is distinct from home_pending
        order by -ln(greatest(random(),1e-15))/weight limit 1;
      if found then
        update public.draw_pool_entries set tree_ticket=gen_random_uuid() where id=prize.id returning * into prize;
        insert into public.draw_wheel_history(id,user_id,entry_id,kind,name,emoji,color,weight,probability)
        select prize.tree_ticket,p_user,prize.id,'reward',prize.name,prize.emoji,prize.color,prize.weight,
          100.0*prize.weight/sum(e.weight) from public.draw_pool_entries e
          where e.user_id=p_user and e.kind='reward' and e.tree_eligible and e.enabled
            and (e.tree_ticket is null or e.id=prize.id) and e.id is distinct from home_pending;
        update public.draw_pool_entries set enabled=false where id=prize.id
          and coalesce((select (preferences->>'noRepeatMode')::boolean from public.draw_wheel_profiles where user_id=p_user),false);
        p_garden := jsonb_set(p_garden,'{prize}',jsonb_build_object('ticket',prize.tree_ticket,'name',prize.name));

        if p_action='openTomatoBox' then
          p_garden := jsonb_set(p_garden,'{prize,source}',to_jsonb('tomato'::text));
          p_garden := jsonb_set(p_garden,'{tomatoWallet,spent}',to_jsonb(tomato_spent + tomato_box_cost));
          p_garden := jsonb_set(p_garden,'{tomatoSpends}',
            jsonb_build_array(jsonb_build_object(
              'id',prize.tree_ticket,'t',now(),'kind','box','prize',prize.name,'amount',tomato_box_cost
            )) || coalesce(p_garden->'tomatoSpends','[]'::jsonb));
        end if;
      end if;
    elsif p_action='acceptBox' then
      update public.draw_pool_entries set tree_ticket=null where user_id=p_user and kind='reward' and tree_ticket=p_ticket;
      if not found then raise exception 'draw_changed'; end if;
      update public.draw_wheel_history set done=true where user_id=p_user and id=p_ticket;
    end if;
  end if;
  update public.time_tree_gardens set garden=p_garden, revision=current_rev+1 where user_id=p_user;
  return jsonb_build_object('tree',p_garden,'revision',current_rev+1);
end $$;

revoke all on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) to service_role;

create function public.read_time_tree_box_wheel(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'text', e.name, 'kind', e.kind, 'emoji', e.emoji,
        'color', e.color, 'weight', e.weight, 'enabled', true
      ) order by e.position, e.id)
      from public.draw_pool_entries e
      left join public.draw_pool_state s on s.user_id=e.user_id and s.kind=e.kind
      where e.user_id=p_user and e.kind='reward' and e.enabled
        and e.tree_ticket is null and e.id is distinct from s.pending_id
    ), '[]'::jsonb),
    'preferences', coalesce((select p.preferences from public.draw_wheel_profiles p where p.user_id=p_user), '{}')
  )
$$;
revoke all on function public.read_time_tree_box_wheel(uuid) from public,anon,authenticated;
grant execute on function public.read_time_tree_box_wheel(uuid) to service_role;

create or replace function private.tree_draw(p_user uuid,p_action text,p_ticket uuid,p_garden jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  prize public.draw_pool_entries;
  items jsonb;
  winner uuid;
  probability numeric;
  tomato_box_cost bigint;
  tomato_spent bigint;
begin
  if p_action in ('openBox','openTomatoBox','acceptBox') then
    insert into public.draw_pool_state(user_id,kind) values(p_user,'reward') on conflict do nothing;
    perform 1 from public.draw_pool_state where user_id=p_user and kind='reward' for update;
    if p_action in ('openBox','openTomatoBox') and p_garden->>'prize' is null then
      if p_action='openTomatoBox' then
        tomato_box_cost := coalesce((p_garden #>> '{rules,tomatoPrices,box}')::bigint,100);
        if tomato_box_cost not between 1 and 9007199254740991 then
          raise exception 'tomato_price_invalid';
        end if;
        tomato_spent := (p_garden #>> '{tomatoWallet,spent}')::bigint;
        if tomato_spent is null or coalesce((p_garden #>> '{tomatoWallet,earned}')::bigint,0) - tomato_spent < tomato_box_cost then
          raise exception 'tomatoes_short';
        end if;
      end if;

      items := public.read_time_tree_box_wheel(p_user)->'entries';
      select (item->>'id')::uuid into winner from jsonb_array_elements(items) item
        order by -ln(greatest(random(),1e-15))/(item->>'weight')::int limit 1;
      if found then
        update public.draw_pool_entries set tree_ticket=gen_random_uuid()
          where user_id=p_user and kind='reward' and id=winner returning * into prize;
        select 100.0*prize.weight/sum((item->>'weight')::int) into probability
          from jsonb_array_elements(items) item;
        insert into public.draw_wheel_history(id,user_id,entry_id,kind,name,emoji,color,weight,probability)
          values(prize.tree_ticket,p_user,prize.id,'reward',prize.name,prize.emoji,prize.color,prize.weight,probability);
        update public.draw_pool_entries set enabled=false where id=prize.id
          and coalesce((select (preferences->>'noRepeatMode')::boolean from public.draw_wheel_profiles where user_id=p_user),false);
        p_garden := jsonb_set(p_garden,'{prize}',jsonb_build_object(
          'ticket',prize.tree_ticket,'name',prize.name,
          'wheel',jsonb_build_object('entryId',prize.id,'emoji',prize.emoji,'pct',round(probability,1),'items',items)
        ));

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
  return p_garden;
end $$;
revoke all on function private.tree_draw(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.tree_draw(uuid,text,uuid,jsonb) to service_role;

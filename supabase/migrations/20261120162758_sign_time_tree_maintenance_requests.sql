create or replace function private.dispatch_time_tree_maintenance()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  today text := to_char(now() at time zone 'Asia/Shanghai', 'YYYY-MM-DD');
  issued_at text;
  endpoint text;
  secret text;
  signature text;
begin
  if to_regclass('vault.decrypted_secrets') is null
    or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;

  if not exists (select 1 from public.list_due_time_tree_owners(today, null, null, null, 1)) then
    return;
  end if;

  execute $vault$
    select max(decrypted_secret) filter (where name = 'time_tree_maintenance_url'),
           max(decrypted_secret) filter (where name = 'time_tree_maintenance_secret')
    from vault.decrypted_secrets
    where name in ('time_tree_maintenance_url', 'time_tree_maintenance_secret')
  $vault$ into endpoint, secret;
  if endpoint is null or endpoint !~ '^https://[^/?#[:space:]]+/api/internal/time-tree-maintenance$'
    or secret is null or btrim(secret) = '' then
    return;
  end if;

  -- pg_net stores request headers in its queue. Send a short-lived signature instead of the signing key.
  issued_at := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature := encode(extensions.hmac(convert_to('time-tree-maintenance:' || issued_at, 'UTF8'),
    convert_to(secret, 'UTF8'), 'sha256'), 'hex');
  execute $http$
    select net.http_post(
      url := $1,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || $2),
      timeout_milliseconds := 50000
    )
  $http$ using endpoint, issued_at || '.' || signature;
end;
$$;

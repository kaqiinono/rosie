begin;
alter table public.baidu_oauth_credentials
  add column refresh_lock_id uuid,
  add column refresh_lock_until timestamptz,
  add constraint baidu_refresh_lease_pair check (
    (refresh_lock_id is null) = (refresh_lock_until is null)
  );
comment on column public.baidu_oauth_credentials.refresh_lock_id is
  'Compare-and-set owner for rotating-token refresh. Ambiguous failures require reauthorization.';
commit;

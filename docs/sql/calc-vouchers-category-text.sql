-- Convert calc_vouchers.category from the legacy enum (voucher_category) to
-- plain text so newly-created voucher_templates slugs can be redeemed/granted.
--
-- Why: voucher_templates.category is free-text, but calc_vouchers.category was
-- left as the original 12-value enum. Redeeming/granting any *custom* template
-- (slug not in the original enum) failed the insert → "兑换失败，请重试".
--
-- Run once in the Supabase SQL Editor. Idempotent.

-- 1. Widen the column to text. Casting an enum to text is implicit & lossless.
--    If the column is already text this is a harmless no-op.
alter table public.calc_vouchers
  alter column category type text using category::text;

-- 2. Drop any leftover CHECK constraint that restricted category values.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'calc_vouchers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.calc_vouchers drop constraint %I', c.conname);
  end loop;
end $$;

-- 3. Drop the now-unused enum type if nothing else references it.
do $$
begin
  if exists (select 1 from pg_type where typname = 'voucher_category') then
    begin
      drop type voucher_category;
    exception when dependent_objects_still_exist then
      raise notice 'voucher_category still referenced elsewhere; left in place';
    end;
  end if;
end $$;

-- Add 'free' column to calc_vouchers to mark admin-granted vouchers
-- that should NOT count toward the star "spent" totals.
-- Run in Supabase SQL Editor. Idempotent.

alter table public.calc_vouchers
  add column if not exists free boolean not null default false;

-- Backfill: existing vouchers were paid for, so free=false (default already covers this).
-- New admin-granted vouchers insert with free=true and coins_spent=0.

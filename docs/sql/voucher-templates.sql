-- voucher_templates: shared catalog of voucher templates that the admin can curate.
-- The /admin page provides CRUD over this table; /vouchers shop and admin
-- "grant" grid both read from it; per-user redeemed vouchers in calc_vouchers
-- reference rows here by `category` slug.
-- Run in Supabase SQL Editor. Idempotent.

create table if not exists public.voucher_templates (
  category      text        primary key,
  label         text        not null,
  emoji         text        not null default '🎁',
  gradient      text        not null,
  price_yellow  integer     not null default 0 check (price_yellow >= 0),
  price_red     integer     not null default 0 check (price_red >= 0),
  price_blue    integer     not null default 0 check (price_blue >= 0),
  sort_order    integer     not null default 0,
  archived      boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists voucher_templates_archived_idx
  on public.voucher_templates (archived, sort_order);

alter table public.voucher_templates enable row level security;

-- Single-family app: all authenticated users see + manage the same catalog.
-- (matches the existing /admin "security-through-obscurity" model.)
drop policy if exists "voucher_templates_all_authenticated" on public.voucher_templates;
create policy "voucher_templates_all_authenticated" on public.voucher_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed: migrate the 12 originally-hardcoded categories so the existing
-- /vouchers shop + already-redeemed history continues to work.
insert into public.voucher_templates (category, label, emoji, gradient, price_yellow, price_red, price_blue, sort_order)
values
  ('play10',    '玩十分钟',   '⏱️', 'from-green-500 to-teal-500',     50,  10, 0,  10),
  ('dance',     '舞蹈券',     '💃', 'from-pink-500 to-rose-400',      50,  10, 0,  20),
  ('dog',       '遛狗券',     '🐶', 'from-yellow-500 to-amber-400',   50,  10, 0,  30),
  ('popcorn',   '爆米花券',   '🍿', 'from-yellow-400 to-orange-400',  20,  10, 0,  40),
  ('snack',     '零食券',     '🍿', 'from-orange-500 to-rose-500',   100,  50, 5,  50),
  ('cartoon',   '动画券',     '📺', 'from-teal-500 to-emerald-500',  120,  20, 2,  60),
  ('movie',     '电影券',     '🎬', 'from-indigo-500 to-purple-500', 150,  20, 3,  70),
  ('toy',       '玩具券',     '🧸', 'from-pink-500 to-fuchsia-500',  200,  20, 2,  80),
  ('shopping',  '购物券',     '🛍️', 'from-violet-500 to-purple-400', 200,  50, 3,  90),
  ('wish',      '心愿券',     '🌠', 'from-amber-500 to-violet-500',  300,  20, 4, 100),
  ('generic',   '通用券',     '🎁', 'from-slate-500 to-zinc-500',    500, 100, 10, 110),
  ('universal', '环球影城',   '🎡', 'from-blue-500 to-cyan-400',     500, 100, 10, 120)
on conflict (category) do nothing;

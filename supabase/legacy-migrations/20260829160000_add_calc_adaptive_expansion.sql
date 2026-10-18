-- Parent-controlled permission for adaptive scheduling to introduce the next block.
alter table public.calc_settings
  add column if not exists adaptive_expansion_enabled boolean not null default false;

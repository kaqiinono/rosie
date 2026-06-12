-- Phase 2: vertical (竖式) answer mode for big-number blocks.
-- Additive, backward-compatible, default ON. Run manually in Supabase.
alter table calc_settings
  add column if not exists vertical_for_big_numbers boolean not null default true;

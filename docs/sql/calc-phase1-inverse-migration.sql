-- Phase 1: optional inverse blank-form questions (48 + □ = 105).
-- Additive, backward-compatible. Run manually in Supabase.
alter table calc_settings
  add column if not exists include_inverse boolean not null default false;

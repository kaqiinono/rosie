-- Immersive mode: no answer feedback, auto-advance; wrong-queue makeup unchanged.
-- Additive, backward-compatible, default OFF. Run manually in Supabase.
alter table calc_settings
  add column if not exists immersive_mode boolean not null default false;

-- Timed-answer master toggle for per-type seconds limits.
-- Additive, backward-compatible, default OFF. Run manually in Supabase.
alter table calc_settings
  add column if not exists timed_answer_enabled boolean not null default false;

-- Phase 5: store the child's wrong answer + a deterministic error classification.
-- Additive + backward-compatible. Run manually in Supabase.
alter table calc_mistakes
  add column if not exists user_answer text,
  add column if not exists error_tag text;

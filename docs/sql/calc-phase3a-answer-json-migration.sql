-- Phase 3a: store the full structured answer (CalcAnswer) for mistakes.
-- Additive + backward-compatible: the legacy numeric `answer` column stays; reads
-- fall back to {kind:'int', value:answer} when answer_json is null. Run manually.
alter table calc_mistakes
  add column if not exists answer_json jsonb;

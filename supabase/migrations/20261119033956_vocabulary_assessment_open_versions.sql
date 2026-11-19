-- Keep a child's existing V1 attempt resumable while they try the V2 pilot.
-- The bank foreign key, owner, revision checks and unique start receipts stay in place.
create unique index vocabulary_assessments_open_by_model
  on public.vocabulary_assessment_attempts
  (user_id, (coalesce(state->>'modelVersion', 'stratified-v1')))
  where submitted_at is null;

drop index public.vocabulary_assessments_one_open;

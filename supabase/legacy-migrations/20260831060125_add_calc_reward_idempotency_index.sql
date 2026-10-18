-- Add the reviewed reward idempotency guard as a separate rollback boundary.
--
-- Production read-only audit on 2026-08-31 found no duplicate groups for
-- (user_id, source, ref_id) where ref_id is not null. Keep the user boundary
-- in the key because ref_id is only business-scoped, not globally unique.
CREATE UNIQUE INDEX star_sessions_user_source_ref_id_unique_idx
  ON public.star_sessions (user_id, source, ref_id)
  WHERE ref_id IS NOT NULL;

-- Activation is intentionally separate from seeding so registry contents and
-- hashes can be reviewed before clients are allowed to settle against them.
UPDATE public.calc_curriculum_registry
SET status = 'active', activated_at = now()
WHERE curriculum_version = 'v1' AND status = 'draft';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.calc_curriculum_registry
    WHERE curriculum_version = 'v1' AND status <> 'active'
  ) THEN
    RAISE EXCEPTION 'not all calc v1 curricula activated';
  END IF;
END;
$$;

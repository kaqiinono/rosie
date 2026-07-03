-- Soft-resolve for math wrong answers (enables unified mistakes "已改正" history).
-- Run in Supabase SQL editor before deploying the unified mistakes page.

ALTER TABLE math_wrong
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;

ALTER TABLE math_wrong
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Re-open a mistake when the learner gets it wrong again.
CREATE OR REPLACE FUNCTION math_wrong_clear_resolved_on_insert()
RETURNS trigger AS $$
BEGIN
  NEW.resolved := false;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS math_wrong_reset_resolved ON math_wrong;
CREATE TRIGGER math_wrong_reset_resolved
  BEFORE INSERT ON math_wrong
  FOR EACH ROW
  EXECUTE FUNCTION math_wrong_clear_resolved_on_insert();

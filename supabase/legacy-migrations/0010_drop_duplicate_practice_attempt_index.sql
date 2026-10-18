-- Both indexes had the exact key definition
-- (user_id, problem_id, attempted_at DESC) and neither backed a constraint.
-- Keep idx_practice_attempts_user_problem_time (450 observed scans versus 5).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP INDEX IF EXISTS public.idx_math_practice_attempts_user_problem;

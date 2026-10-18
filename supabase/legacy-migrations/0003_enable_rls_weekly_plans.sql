-- Migration: Enable RLS on weekly_plans and math_weekly_plans
-- These tables were missing RLS, allowing any authenticated user to read/write all plans.

-- Enable Row Level Security
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.math_weekly_plans ENABLE ROW LEVEL SECURITY;

-- Policies for weekly_plans (English weekly plans)
CREATE POLICY "Users can read own weekly_plans"
  ON public.weekly_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_plans"
  ON public.weekly_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_plans"
  ON public.weekly_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly_plans"
  ON public.weekly_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for math_weekly_plans
CREATE POLICY "Users can read own math_weekly_plans"
  ON public.math_weekly_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own math_weekly_plans"
  ON public.math_weekly_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own math_weekly_plans"
  ON public.math_weekly_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own math_weekly_plans"
  ON public.math_weekly_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

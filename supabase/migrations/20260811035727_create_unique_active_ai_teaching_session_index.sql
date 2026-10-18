SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE UNIQUE INDEX IF NOT EXISTS ai_teaching_sessions_one_active_conversation_idx
  ON public.ai_teaching_sessions (user_id, conversation_id, subject)
  WHERE status = 'active' AND conversation_id IS NOT NULL;

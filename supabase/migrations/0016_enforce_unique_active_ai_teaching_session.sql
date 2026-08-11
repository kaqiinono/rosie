-- A conversation can have separate subject sessions, but never two active
-- sessions for the same subject. NULL conversation_id sessions are explicit
-- standalone sessions and intentionally remain outside this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_teaching_sessions_active_conversation_subject
  ON public.ai_teaching_sessions (user_id, conversation_id, subject)
  WHERE status = 'active' AND conversation_id IS NOT NULL;

-- 0004_rag_knowledge_base.sql
-- RAG knowledge base + Rosie Agent conversation storage (P0 subset)
-- Idempotent: safe to re-run if objects already exist.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject      text NOT NULL CHECK (subject IN ('english', 'math', 'chinese')),
  source_type  text NOT NULL CHECK (source_type IN ('db_sync', 'catalog_sync', 'import')),
  source_ref   text,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL,
  content      text NOT NULL,
  content_hash text NOT NULL,
  metadata     jsonb DEFAULT '{}' NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT knowledge_documents_source_ref_unique UNIQUE (source_ref)
);

CREATE INDEX IF NOT EXISTS knowledge_documents_subject_idx
  ON public.knowledge_documents (subject);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (subject IN ('english', 'math', 'chinese')),
  chunk_index smallint NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  content_tsv tsvector,
  metadata    jsonb DEFAULT '{}' NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx
  ON public.knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_idx
  ON public.knowledge_chunks USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm_idx
  ON public.knowledge_chunks USING gin (content gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.knowledge_chunks_update_content_tsv()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject = 'english' THEN
    NEW.content_tsv := to_tsvector('english', NEW.content);
  ELSE
    NEW.content_tsv := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_chunks_update_content_tsv ON public.knowledge_chunks;
CREATE TRIGGER trg_knowledge_chunks_update_content_tsv
  BEFORE INSERT OR UPDATE OF content, subject ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_chunks_update_content_tsv();

CREATE TABLE IF NOT EXISTS public.knowledge_imports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (subject IN ('english', 'math', 'chinese')),
  file_name   text,
  file_path   text,
  file_type   text,
  content     text NOT NULL DEFAULT '',
  chunk_count integer DEFAULT 0 NOT NULL,
  status      text DEFAULT 'pending' NOT NULL,
  error_msg   text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.knowledge_sync_state (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_key      text NOT NULL UNIQUE,
  last_synced_at  timestamptz,
  records_synced  integer DEFAULT 0 NOT NULL,
  chunks_created  integer DEFAULT 0 NOT NULL,
  chunks_deleted  integer DEFAULT 0 NOT NULL,
  status          text DEFAULT 'idle' NOT NULL,
  error_msg       text,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  blocks      jsonb DEFAULT '[]' NOT NULL,
  actions     jsonb DEFAULT '[]' NOT NULL,
  sources     jsonb DEFAULT '[]' NOT NULL,
  subject     text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_conversations_session_idx
  ON public.ai_conversations (session_id, created_at);

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  query_text text DEFAULT NULL,
  match_subject text DEFAULT NULL,
  match_grade smallint DEFAULT NULL,
  match_metadata jsonb DEFAULT NULL,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.65,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  subject text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT c.*
    FROM public.knowledge_chunks c
    WHERE c.user_id IS NULL OR c.user_id = auth.uid()
  ),
  filtered AS (
    SELECT a.*
    FROM accessible a
    WHERE (match_subject IS NULL OR a.subject = match_subject)
      AND (
        match_grade IS NULL
        OR NULLIF(a.metadata ->> 'grade', '') IS NULL
        OR (
          (a.metadata ->> 'grade') ~ '^\d+$'
          AND (a.metadata ->> 'grade')::int = match_grade
        )
      )
      AND (match_metadata IS NULL OR a.metadata @> match_metadata)
  ),
  vector_hits AS (
    SELECT
      f.id,
      f.document_id,
      f.subject,
      f.content,
      f.metadata,
      ROW_NUMBER() OVER (ORDER BY f.embedding <=> query_embedding) AS rn,
      (1 - (f.embedding <=> query_embedding))::float AS vec_sim
    FROM filtered f
    WHERE f.embedding IS NOT NULL
      AND (1 - (f.embedding <=> query_embedding)) >= match_threshold
    ORDER BY f.embedding <=> query_embedding
    LIMIT 50
  ),
  text_hits AS (
    SELECT
      f.id,
      f.document_id,
      f.subject,
      f.content,
      f.metadata,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN f.subject = 'english' AND query_text IS NOT NULL AND query_text <> ''
              THEN ts_rank(f.content_tsv, plainto_tsquery('english', query_text))
            WHEN query_text IS NOT NULL AND query_text <> ''
              THEN similarity(f.content, query_text)
            ELSE 0
          END DESC
      ) AS rn,
      CASE
        WHEN f.subject = 'english' AND query_text IS NOT NULL AND query_text <> ''
          THEN ts_rank(f.content_tsv, plainto_tsquery('english', query_text))::float
        WHEN query_text IS NOT NULL AND query_text <> ''
          THEN similarity(f.content, query_text)::float
        ELSE 0
      END AS text_sim
    FROM filtered f
    WHERE query_text IS NOT NULL
      AND query_text <> ''
      AND (
        (f.subject = 'english' AND f.content_tsv @@ plainto_tsquery('english', query_text))
        OR (f.subject <> 'english' AND f.content % query_text)
      )
    ORDER BY text_sim DESC
    LIMIT 50
  ),
  rrf AS (
    SELECT
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS document_id,
      COALESCE(v.subject, t.subject) AS subject,
      COALESCE(v.content, t.content) AS content,
      COALESCE(v.metadata, t.metadata) AS metadata,
      (COALESCE(1.0 / (rrf_k + v.rn), 0) + COALESCE(1.0 / (rrf_k + t.rn), 0))::float AS score,
      COALESCE(v.vec_sim, 0) AS vec_sim,
      COALESCE(t.text_sim, 0) AS text_sim
    FROM vector_hits v
    FULL OUTER JOIN text_hits t ON v.id = t.id
  ),
  deduped AS (
    SELECT DISTINCT ON (id)
      id,
      document_id,
      subject,
      content,
      metadata,
      score,
      vec_sim,
      text_sim
    FROM rrf
    ORDER BY id, score DESC
  )
  SELECT
    d.id AS chunk_id,
    d.document_id,
    d.subject,
    d.content,
    d.metadata,
    GREATEST(d.score, d.vec_sim, d.text_sim) AS similarity
  FROM deduped d
  ORDER BY d.score DESC, d.vec_sim DESC
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.search_knowledge(
  vector(1536), text, text, smallint, jsonb, int, float, int
) TO authenticated;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_documents_select ON public.knowledge_documents;
CREATE POLICY knowledge_documents_select ON public.knowledge_documents
  FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());

DROP POLICY IF EXISTS knowledge_documents_insert_import ON public.knowledge_documents;
CREATE POLICY knowledge_documents_insert_import ON public.knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (source_type = 'import' AND owner_id = auth.uid());

DROP POLICY IF EXISTS knowledge_chunks_select ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_chunks_insert_import ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_insert_import ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_imports_own ON public.knowledge_imports;
CREATE POLICY knowledge_imports_own ON public.knowledge_imports
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS knowledge_sync_state_select ON public.knowledge_sync_state;
CREATE POLICY knowledge_sync_state_select ON public.knowledge_sync_state
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_conversations_own ON public.ai_conversations;
CREATE POLICY ai_conversations_own ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

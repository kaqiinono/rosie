-- Harden RAG search permissions, improve CJK lexical recall, and make
-- long-running catalog/database syncs observable and resumable.

ALTER TABLE public.knowledge_sync_state
  ADD COLUMN IF NOT EXISTS cursor_position integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_records integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS knowledge_documents_owner_idx
  ON public.knowledge_documents (owner_id)
  WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_chunks_user_idx
  ON public.knowledge_chunks (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_chunks_subject_idx
  ON public.knowledge_chunks (subject);
CREATE INDEX IF NOT EXISTS knowledge_imports_user_idx
  ON public.knowledge_imports (user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx
  ON public.ai_conversations (user_id);

CREATE OR REPLACE FUNCTION public.knowledge_chunks_update_content_tsv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH accessible AS (
    SELECT c.*
    FROM public.knowledge_chunks c
    WHERE c.user_id IS NULL OR c.user_id = (SELECT auth.uid())
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
            WHEN lower(f.content) LIKE '%' || lower(query_text) || '%' THEN 1.0
            WHEN f.subject = 'english'
              THEN ts_rank(f.content_tsv, plainto_tsquery('english', query_text))
            ELSE similarity(f.content, query_text)
          END DESC
      ) AS rn,
      CASE
        WHEN lower(f.content) LIKE '%' || lower(query_text) || '%' THEN 1.0::float
        WHEN f.subject = 'english'
          THEN ts_rank(f.content_tsv, plainto_tsquery('english', query_text))::float
        ELSE similarity(f.content, query_text)::float
      END AS text_sim
    FROM filtered f
    WHERE query_text IS NOT NULL
      AND btrim(query_text) <> ''
      AND (
        lower(f.content) LIKE '%' || lower(query_text) || '%'
        OR (
          f.subject = 'english'
          AND f.content_tsv @@ plainto_tsquery('english', query_text)
        )
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
      id, document_id, subject, content, metadata, score, vec_sim, text_sim
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
  ORDER BY d.score DESC, d.vec_sim DESC, d.text_sim DESC
  LIMIT GREATEST(match_count, 1);
$$;

GRANT SELECT ON public.knowledge_chunks TO authenticated;

REVOKE ALL ON FUNCTION public.search_knowledge(
  vector(1536), text, text, smallint, jsonb, int, float, int
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge(
  vector(1536), text, text, smallint, jsonb, int, float, int
) TO authenticated, service_role;

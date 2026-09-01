--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_api_rate_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_api_rate_limit(p_key_hash text, p_route text, p_limit integer, p_window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '2s'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64
     OR p_route IS NULL OR length(p_route) > 160
     OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_rate_limit_input';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  -- Serialize only the same key+route. Different users/routes remain concurrent.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash || ':' || p_route, 0));

  DELETE FROM public.api_rate_limits
  WHERE key_hash = p_key_hash
    AND route = p_route
    AND window_start < v_window_start;

  INSERT INTO public.api_rate_limits (
    key_hash,
    route,
    window_start,
    request_count,
    updated_at
  )
  VALUES (p_key_hash, p_route, v_window_start, 1, clock_timestamp())
  ON CONFLICT (key_hash, route, window_start)
  DO UPDATE SET
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = clock_timestamp()
  RETURNING request_count INTO v_count;

  RETURN v_count > p_limit;
END;
$$;


--
-- Name: increment_math_solved(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_math_solved(p_user_id uuid, p_prob_id text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.math_solved (user_id, problem_id, solve_count, solved_at)
  VALUES (p_user_id, p_prob_id, 1, pg_catalog.now())
  ON CONFLICT (user_id, problem_id)
  DO UPDATE SET
    solve_count = public.math_solved.solve_count + 1,
    solved_at = pg_catalog.now()
  RETURNING solve_count INTO new_count;

  RETURN new_count;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;


--
-- Name: knowledge_chunks_update_content_tsv(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_chunks_update_content_tsv() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.subject = 'english' THEN
    NEW.content_tsv := pg_catalog.to_tsvector(
      'pg_catalog.english'::pg_catalog.regconfig,
      NEW.content
    );
  ELSE
    NEW.content_tsv := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: math_wrong_clear_resolved_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.math_wrong_clear_resolved_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.resolved := false;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;


--
-- Name: search_knowledge(public.vector, text, text, smallint, jsonb, integer, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_knowledge(query_embedding public.vector, query_text text DEFAULT NULL::text, match_subject text DEFAULT NULL::text, match_grade smallint DEFAULT NULL::smallint, match_metadata jsonb DEFAULT NULL::jsonb, match_count integer DEFAULT 10, match_threshold double precision DEFAULT 0.65, rrf_k integer DEFAULT 60) RETURNS TABLE(chunk_id uuid, document_id uuid, subject text, content text, metadata jsonb, similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
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
$_$;


--
-- Name: upsert_math_scratch_working(text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_math_scratch_working(p_problem_id text, p_paper_scope text, p_objects jsonb, p_answer_draft jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.math_scratch_working AS w (
    user_id, problem_id, paper_scope, objects, answer_draft, updated_at
  ) VALUES (
    uid,
    p_problem_id,
    COALESCE(p_paper_scope, ''),
    COALESCE(p_objects, '[]'::jsonb),
    p_answer_draft,
    NOW()
  )
  ON CONFLICT (user_id, problem_id, paper_scope)
  DO UPDATE SET
    objects = EXCLUDED.objects,
    answer_draft = EXCLUDED.answer_draft,
    updated_at = EXCLUDED.updated_at;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adaptive_plan_word_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adaptive_plan_word_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    word_key character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'NOT_STARTED'::character varying NOT NULL,
    box_index integer,
    target_box integer,
    streak_wrong integer DEFAULT 0 NOT NULL,
    next_review_date date,
    introduced_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT adaptive_progress_box_chk CHECK (((box_index IS NULL) OR ((box_index >= 1) AND (box_index <= 5)))),
    CONSTRAINT adaptive_progress_status_chk CHECK (((status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'LEARNING_PENDING'::character varying, 'LEARNING'::character varying, 'MASTERED'::character varying])::text[]))),
    CONSTRAINT adaptive_progress_target_box_chk CHECK (((target_box IS NULL) OR (target_box = ANY (ARRAY[1, 3]))))
);


--
-- Name: adaptive_word_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adaptive_word_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    scope jsonb NOT NULL,
    new_words_per_day integer DEFAULT 10 NOT NULL,
    review_cap integer DEFAULT 40 NOT NULL,
    review_batch_size integer DEFAULT 20 NOT NULL,
    backlog_fuse integer DEFAULT 50 NOT NULL,
    boss_every_n_new integer DEFAULT 50 NOT NULL,
    boss_stubborn_threshold integer DEFAULT 15 NOT NULL,
    mode character varying(50) DEFAULT 'normal'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    stats jsonb DEFAULT '{"bossFailStreak": 0, "bossQuestionTier": 1, "everActivatedCount": 0, "totalActivatedCount": 0, "lastBossActivatedCount": 0}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    boss_pack_limit integer DEFAULT 50 NOT NULL,
    CONSTRAINT adaptive_word_plans_mode_chk CHECK (((mode)::text = ANY ((ARRAY['normal'::character varying, 'review_only'::character varying, 'boss'::character varying])::text[]))),
    CONSTRAINT adaptive_word_plans_status_chk CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    subject text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_conversations_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: ai_teaching_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_teaching_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    subject text NOT NULL,
    content_ref text,
    teaching_stage text DEFAULT 'understand'::text NOT NULL,
    hint_level smallint DEFAULT 0 NOT NULL,
    attempt_count smallint DEFAULT 0 NOT NULL,
    latest_answer text,
    error_kind text,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT ai_teaching_sessions_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT ai_teaching_sessions_hint_level_check CHECK (((hint_level >= 0) AND (hint_level <= 3))),
    CONSTRAINT ai_teaching_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text]))),
    CONSTRAINT ai_teaching_sessions_subject_check CHECK ((subject = ANY (ARRAY['english'::text, 'math'::text, 'chinese'::text]))),
    CONSTRAINT ai_teaching_sessions_teaching_stage_check CHECK ((teaching_stage = ANY (ARRAY['understand'::text, 'attempt'::text, 'hint'::text, 'check'::text, 'transfer'::text, 'summary'::text])))
);


--
-- Name: api_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_rate_limits (
    key_hash text NOT NULL,
    route text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    request_count integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_rate_limits_request_count_check CHECK ((request_count > 0))
);


--
-- Name: audio_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text NOT NULL,
    storage_path text NOT NULL,
    duration_sec numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    media_type text DEFAULT 'audio'::text NOT NULL,
    CONSTRAINT audio_assets_media_type_check CHECK ((media_type = ANY (ARRAY['audio'::text, 'video'::text])))
);


--
-- Name: audio_playlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_playlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    playlist_id uuid NOT NULL,
    user_id uuid NOT NULL,
    item_type text NOT NULL,
    label text NOT NULL,
    storage_bucket text NOT NULL,
    storage_path text NOT NULL,
    ref_link text,
    asset_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    media_type text DEFAULT 'audio'::text NOT NULL,
    CONSTRAINT audio_playlist_items_item_type_check CHECK ((item_type = ANY (ARRAY['standalone'::text, 'reading'::text, 'flipbook'::text]))),
    CONSTRAINT audio_playlist_items_media_type_check CHECK ((media_type = ANY (ARRAY['audio'::text, 'video'::text])))
);


--
-- Name: audio_playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_playlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL
);


--
-- Name: calc_problem_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_problem_state (
    user_id uuid NOT NULL,
    signature text NOT NULL,
    level smallint NOT NULL,
    proficiency smallint DEFAULT 0 NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    appearance_count integer DEFAULT 0 NOT NULL,
    recent_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    short_mastered_at date,
    review_r1_due date,
    review_r2_due date,
    review_r3_due date,
    long_mastered boolean DEFAULT false NOT NULL,
    last_seen_session integer,
    times_seen_this_round integer DEFAULT 0 NOT NULL,
    consecutive_wrong integer DEFAULT 0 NOT NULL,
    forced_next boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    block_id text,
    mixed_op_id text,
    consecutive_correct integer DEFAULT 0 NOT NULL,
    last_within_limit boolean,
    CONSTRAINT calc_problem_state_proficiency_check CHECK (((proficiency >= 0) AND (proficiency <= 5))),
    CONSTRAINT calc_problem_state_status_check CHECK ((status = ANY (ARRAY['active'::text, 'review'::text, 'mastered'::text, 'forced'::text])))
);


--
-- Name: calc_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone NOT NULL,
    count smallint NOT NULL,
    correct_count smallint DEFAULT 0 NOT NULL,
    retry_count smallint DEFAULT 0 NOT NULL,
    wrong_count smallint DEFAULT 0 NOT NULL,
    challenge_correct smallint DEFAULT 0 NOT NULL,
    time_spent_sec integer DEFAULT 0 NOT NULL,
    mode text NOT NULL,
    max_streak smallint DEFAULT 0 NOT NULL,
    top_level text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    question_times_ms jsonb DEFAULT '[]'::jsonb NOT NULL,
    question_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT calc_sessions_mode_check CHECK ((mode = ANY (ARRAY['daily'::text, 'free'::text, 'mistakes'::text])))
);


--
-- Name: calc_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_settings (
    user_id uuid NOT NULL,
    enable_addsub boolean DEFAULT true NOT NULL,
    enable_muldiv boolean DEFAULT true NOT NULL,
    enable_mixed boolean DEFAULT true NOT NULL,
    current_level smallint DEFAULT 1 NOT NULL,
    adaptive boolean DEFAULT true NOT NULL,
    sound_enabled boolean DEFAULT true NOT NULL,
    last_count smallint DEFAULT 20 NOT NULL,
    last_time_limit smallint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_counter integer DEFAULT 0 NOT NULL,
    time_limit_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    free_mode boolean DEFAULT false NOT NULL,
    free_mode_levels jsonb DEFAULT '[]'::jsonb NOT NULL,
    selected_blocks jsonb DEFAULT '["add:10"]'::jsonb,
    mixed_ops jsonb DEFAULT '[]'::jsonb,
    include_inverse boolean DEFAULT false NOT NULL,
    vertical_for_big_numbers boolean DEFAULT true NOT NULL,
    count_mode text DEFAULT 'auto'::text NOT NULL,
    timed_answer_enabled boolean DEFAULT false NOT NULL,
    immersive_mode boolean DEFAULT false NOT NULL,
    timing_mode text DEFAULT 'relaxed'::text NOT NULL,
    bonus_sec integer DEFAULT 3 NOT NULL,
    auto_submit_on_match boolean DEFAULT true NOT NULL,
    adaptive_expansion_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT calc_settings_current_level_check CHECK (((current_level >= 1) AND (current_level <= 18)))
);


--
-- Name: calc_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    coins_spent smallint DEFAULT 50 NOT NULL,
    free boolean DEFAULT false NOT NULL
);


--
-- Name: chinese_char_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_char_entries (
    char_key text NOT NULL,
    "char" text NOT NULL,
    grade smallint NOT NULL,
    semester text NOT NULL,
    pinyin text NOT NULL,
    pinyin_alt text[] DEFAULT '{}'::text[] NOT NULL,
    radical text NOT NULL,
    radical_name text NOT NULL,
    stroke_count smallint NOT NULL,
    stroke_order jsonb NOT NULL,
    phrases text[] DEFAULT '{}'::text[] NOT NULL,
    tiers text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    structure text,
    CONSTRAINT chinese_char_entries_char_check CHECK (("char" ~ '^.$'::text)),
    CONSTRAINT chinese_char_entries_semester_check CHECK ((semester = ANY (ARRAY['上'::text, '下'::text]))),
    CONSTRAINT chinese_char_entries_stroke_count_check CHECK ((stroke_count > 0)),
    CONSTRAINT chinese_char_entries_structure_check CHECK (((structure IS NULL) OR (structure = ANY (ARRAY['上下'::text, '左右'::text, '独体'::text, '半包围'::text, '全包围'::text, '上中下'::text])))),
    CONSTRAINT chinese_char_entries_tiers_check CHECK ((tiers <@ ARRAY['recognize'::text, 'write'::text]))
);


--
-- Name: chinese_char_mastery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_char_mastery (
    user_id uuid NOT NULL,
    char_key text NOT NULL,
    track text NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    incorrect integer DEFAULT 0 NOT NULL,
    last_seen date,
    stage integer,
    next_review_date date,
    is_hard boolean DEFAULT false NOT NULL,
    review_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chinese_char_mastery_track_check CHECK ((track = ANY (ARRAY['recognize'::text, 'write'::text])))
);


--
-- Name: chinese_lesson_chars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_lesson_chars (
    lesson_key text NOT NULL,
    char_key text NOT NULL,
    track text NOT NULL,
    sort_order smallint NOT NULL,
    pinyin_in_lesson text NOT NULL,
    CONSTRAINT chinese_lesson_chars_track_check CHECK ((track = ANY (ARRAY['recognize'::text, 'write'::text])))
);


--
-- Name: chinese_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_lessons (
    lesson_key text NOT NULL,
    grade smallint NOT NULL,
    semester text NOT NULL,
    unit smallint NOT NULL,
    lesson smallint NOT NULL,
    lesson_title text NOT NULL,
    lesson_kind text DEFAULT 'lesson'::text NOT NULL,
    unit_type text,
    sort_order smallint DEFAULT 0 NOT NULL,
    recall_phrases text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chinese_lessons_lesson_kind_check CHECK ((lesson_kind = ANY (ARRAY['lesson'::text, 'garden'::text, 'happy_reading'::text]))),
    CONSTRAINT chinese_lessons_semester_check CHECK ((semester = ANY (ARRAY['上'::text, '下'::text]))),
    CONSTRAINT chinese_lessons_unit_type_check CHECK ((unit_type = ANY (ARRAY['literacy'::text, 'reading'::text])))
);


--
-- Name: chinese_reading_recordings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_reading_recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    book_slug text NOT NULL,
    lesson_key text NOT NULL,
    lesson_title text DEFAULT ''::text NOT NULL,
    storage_path text NOT NULL,
    mime_type text DEFAULT 'audio/webm'::text NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chinese_reading_recordings_book_chk CHECK ((book_slug = ANY (ARRAY['g1b'::text, 'g2a'::text, 'g2b'::text]))),
    CONSTRAINT chinese_reading_recordings_duration_chk CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)))
);


--
-- Name: chinese_roadmap_plan_lesson_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_roadmap_plan_lesson_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    lesson_key character varying(64) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone DEFAULT now() NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    accuracy numeric(5,2),
    by_type jsonb DEFAULT '{}'::jsonb NOT NULL,
    quiz_types text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chinese_roadmap_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_roadmap_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    book_slug character varying(16) NOT NULL,
    start_lesson_key character varying(64) NOT NULL,
    current_lesson_key character varying(64) NOT NULL,
    lessons_per_batch integer DEFAULT 1 NOT NULL,
    quiz_types text[] DEFAULT ARRAY['recognize'::text, 'stroke'::text, 'phrase'::text, 'blank'::text, 'passage'::text, 'pinyin-write'::text] NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    completed_lesson_keys text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT chinese_roadmap_plans_batch_chk CHECK (((lessons_per_batch >= 1) AND (lessons_per_batch <= 10))),
    CONSTRAINT chinese_roadmap_plans_book_chk CHECK (((book_slug)::text = ANY ((ARRAY['g1b'::character varying, 'g2a'::character varying, 'g2b'::character varying])::text[]))),
    CONSTRAINT chinese_roadmap_plans_status_chk CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: chinese_weekly_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_weekly_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    lesson_key text NOT NULL,
    week_start_day integer DEFAULT 4 NOT NULL,
    new_recognize_per_day integer DEFAULT 4 NOT NULL,
    new_write_per_day integer DEFAULT 3 NOT NULL,
    days jsonb DEFAULT '[]'::jsonb NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chinese_wrong_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chinese_wrong_items (
    user_id uuid NOT NULL,
    item_key text NOT NULL,
    item_type text NOT NULL,
    wrong_kind text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT chinese_wrong_items_item_type_check CHECK ((item_type = ANY (ARRAY['char'::text, 'phrase'::text, 'accumulation'::text, 'poem'::text]))),
    CONSTRAINT chinese_wrong_items_wrong_kind_check CHECK ((wrong_kind = ANY (ARRAY['pinyin'::text, 'stroke'::text, 'phrase'::text, 'recite'::text, 'accumulation'::text])))
);


--
-- Name: daily_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    day_number integer NOT NULL,
    quiz_done boolean DEFAULT false,
    last_score integer,
    last_date text
);


--
-- Name: english_wrong; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.english_wrong (
    user_id uuid NOT NULL,
    word_key text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: flipbook_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flipbook_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    page_count integer,
    pdf_path text NOT NULL,
    audio_path text,
    sync_manifest jsonb,
    status text DEFAULT 'ready'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text NOT NULL,
    CONSTRAINT flipbook_books_status_check CHECK ((status = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'error'::text])))
);


--
-- Name: flipbook_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flipbook_progress (
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    last_page integer DEFAULT 1 NOT NULL,
    audio_position_sec numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid,
    subject text NOT NULL,
    chunk_index smallint NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    content_tsv tsvector,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_chunks_subject_check CHECK ((subject = ANY (ARRAY['english'::text, 'math'::text, 'chinese'::text])))
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text NOT NULL,
    source_type text NOT NULL,
    source_ref text,
    owner_id uuid,
    title text NOT NULL,
    content text NOT NULL,
    content_hash text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_documents_source_type_check CHECK ((source_type = ANY (ARRAY['db_sync'::text, 'catalog_sync'::text, 'import'::text]))),
    CONSTRAINT knowledge_documents_subject_check CHECK ((subject = ANY (ARRAY['english'::text, 'math'::text, 'chinese'::text])))
);


--
-- Name: knowledge_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    file_name text,
    file_path text,
    file_type text,
    content text DEFAULT ''::text NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_msg text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_imports_subject_check CHECK ((subject = ANY (ARRAY['english'::text, 'math'::text, 'chinese'::text])))
);


--
-- Name: knowledge_sync_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sync_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_key text NOT NULL,
    last_synced_at timestamp with time zone,
    records_synced integer DEFAULT 0 NOT NULL,
    chunks_created integer DEFAULT 0 NOT NULL,
    chunks_deleted integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    error_msg text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cursor_position integer DEFAULT 0 NOT NULL,
    total_records integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: math_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_favorites (
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_practice_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_practice_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    lesson_id text NOT NULL,
    section text DEFAULT ''::text NOT NULL,
    paper_id uuid,
    correct boolean,
    draft_id uuid,
    answer_snapshot jsonb,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    objects jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT math_practice_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))
);


--
-- Name: math_problem_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_problem_images (
    lesson_id text NOT NULL,
    problem_id text NOT NULL,
    image_kind text DEFAULT 'analysis'::text NOT NULL,
    storage_path text NOT NULL,
    user_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_problem_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_problem_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id text NOT NULL,
    problem_id text NOT NULL,
    title text,
    body_html text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_quiz_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_quiz_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title_base text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    volume_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_quiz_papers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_quiz_papers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    problems jsonb DEFAULT '[]'::jsonb NOT NULL,
    score integer,
    total_score integer DEFAULT 100 NOT NULL,
    answers jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    batch_id uuid,
    batch_index integer
);


--
-- Name: math_quiz_scratch_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_quiz_scratch_links (
    paper_id uuid NOT NULL,
    problem_id text NOT NULL,
    draft_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_rotating_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_rotating_review (
    user_id text NOT NULL,
    state_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: math_scratch_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_scratch_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    lesson_id text NOT NULL,
    section text DEFAULT ''::text NOT NULL,
    objects jsonb NOT NULL,
    object_count integer DEFAULT 0 NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_scratch_working; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_scratch_working (
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    paper_scope text DEFAULT ''::text NOT NULL,
    objects jsonb DEFAULT '[]'::jsonb NOT NULL,
    answer_draft jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_skipped; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_skipped (
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    reason text DEFAULT 'later'::text NOT NULL,
    note text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_solved; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_solved (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    solved_at timestamp with time zone DEFAULT now(),
    solve_count integer DEFAULT 1 NOT NULL
);


--
-- Name: math_weekly_lesson_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_weekly_lesson_review (
    user_id uuid NOT NULL,
    state_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: math_weekly_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_weekly_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    lesson_id text NOT NULL,
    plan_data jsonb NOT NULL,
    progress_data jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT now(),
    week_start_day integer DEFAULT 4,
    problems_per_day integer DEFAULT 3
);


--
-- Name: math_wrong; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_wrong (
    user_id uuid NOT NULL,
    problem_id text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    last_wrong_attempt_id uuid
);


--
-- Name: practice_pending_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_pending_sessions (
    user_id uuid NOT NULL,
    kind text NOT NULL,
    scope_key text NOT NULL,
    stash jsonb NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT practice_pending_sessions_kind_chk CHECK ((kind = ANY (ARRAY['calc'::text, 'chinese'::text, 'math'::text, 'english_adaptive'::text, 'english_weekly'::text])))
);


--
-- Name: problem_mastery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problem_mastery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem_key text NOT NULL,
    correct integer DEFAULT 0,
    incorrect integer DEFAULT 0,
    last_seen text,
    stage integer,
    next_review_date date,
    is_hard boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: reading_passage_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_passage_media (
    passage_key text NOT NULL,
    audio_path text NOT NULL,
    user_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: star_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.star_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date text NOT NULL,
    source text NOT NULL,
    coins_earned integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ref_id uuid,
    CONSTRAINT star_sessions_coins_earned_check CHECK ((coins_earned <> 0)),
    CONSTRAINT star_sessions_source_check CHECK ((source = ANY (ARRAY['english'::text, 'math'::text, 'calc'::text])))
);


--
-- Name: voucher_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_templates (
    category text NOT NULL,
    label text NOT NULL,
    emoji text DEFAULT '🎁'::text NOT NULL,
    gradient text NOT NULL,
    price_yellow integer DEFAULT 0 NOT NULL,
    price_red integer DEFAULT 0 NOT NULL,
    price_blue integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT voucher_templates_price_blue_check CHECK ((price_blue >= 0)),
    CONSTRAINT voucher_templates_price_red_check CHECK ((price_red >= 0)),
    CONSTRAINT voucher_templates_price_yellow_check CHECK ((price_yellow >= 0))
);


--
-- Name: weekly_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    unit text NOT NULL,
    lesson text NOT NULL,
    plan_data jsonb NOT NULL,
    progress_data jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT now(),
    week_start_day integer DEFAULT 4,
    new_words_per_day integer DEFAULT 3
);


--
-- Name: word_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.word_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator uuid NOT NULL,
    unit text NOT NULL,
    lesson text NOT NULL,
    word text NOT NULL,
    explanation text NOT NULL,
    ipa text,
    example text,
    phonics text,
    stage text,
    syllables jsonb,
    keywords jsonb,
    chinese_def text,
    vocab_type text,
    image_path text,
    image_match_score integer,
    image_match_query text,
    image_source text,
    image_pexels_id text
);


--
-- Name: COLUMN word_entries.vocab_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.word_entries.vocab_type IS 'Oxford flashcard band: Target | Context | Extension';


--
-- Name: COLUMN word_entries.image_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.word_entries.image_path IS 'Path in word-images bucket';


--
-- Name: COLUMN word_entries.image_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.word_entries.image_source IS 'pexels | upload';


--
-- Name: word_mastery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.word_mastery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    word_key text NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    incorrect integer DEFAULT 0 NOT NULL,
    last_seen date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stage integer,
    next_review_date date,
    is_hard boolean DEFAULT false,
    review_history jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: adaptive_plan_word_progress adaptive_plan_word_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_plan_word_progress
    ADD CONSTRAINT adaptive_plan_word_progress_pkey PRIMARY KEY (id);


--
-- Name: adaptive_word_plans adaptive_word_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_word_plans
    ADD CONSTRAINT adaptive_word_plans_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_teaching_sessions ai_teaching_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_teaching_sessions
    ADD CONSTRAINT ai_teaching_sessions_pkey PRIMARY KEY (id);


--
-- Name: api_rate_limits api_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key_hash, route, window_start);


--
-- Name: audio_assets audio_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_assets
    ADD CONSTRAINT audio_assets_pkey PRIMARY KEY (id);


--
-- Name: audio_playlist_items audio_playlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlist_items
    ADD CONSTRAINT audio_playlist_items_pkey PRIMARY KEY (id);


--
-- Name: audio_playlists audio_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlists
    ADD CONSTRAINT audio_playlists_pkey PRIMARY KEY (id);


--
-- Name: calc_problem_state calc_problem_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_problem_state
    ADD CONSTRAINT calc_problem_state_pkey PRIMARY KEY (user_id, signature);


--
-- Name: calc_sessions calc_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_sessions
    ADD CONSTRAINT calc_sessions_pkey PRIMARY KEY (id);


--
-- Name: calc_settings calc_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_settings
    ADD CONSTRAINT calc_settings_pkey PRIMARY KEY (user_id);


--
-- Name: calc_vouchers calc_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_vouchers
    ADD CONSTRAINT calc_vouchers_pkey PRIMARY KEY (id);


--
-- Name: chinese_char_entries chinese_char_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_char_entries
    ADD CONSTRAINT chinese_char_entries_pkey PRIMARY KEY (char_key);


--
-- Name: chinese_char_mastery chinese_char_mastery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_char_mastery
    ADD CONSTRAINT chinese_char_mastery_pkey PRIMARY KEY (user_id, char_key, track);


--
-- Name: chinese_lesson_chars chinese_lesson_chars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_lesson_chars
    ADD CONSTRAINT chinese_lesson_chars_pkey PRIMARY KEY (lesson_key, char_key, track);


--
-- Name: chinese_lessons chinese_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_lessons
    ADD CONSTRAINT chinese_lessons_pkey PRIMARY KEY (lesson_key);


--
-- Name: chinese_reading_recordings chinese_reading_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_reading_recordings
    ADD CONSTRAINT chinese_reading_recordings_pkey PRIMARY KEY (id);


--
-- Name: chinese_roadmap_plan_lesson_runs chinese_roadmap_plan_lesson_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_roadmap_plan_lesson_runs
    ADD CONSTRAINT chinese_roadmap_plan_lesson_runs_pkey PRIMARY KEY (id);


--
-- Name: chinese_roadmap_plans chinese_roadmap_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_roadmap_plans
    ADD CONSTRAINT chinese_roadmap_plans_pkey PRIMARY KEY (id);


--
-- Name: chinese_weekly_plans chinese_weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_weekly_plans
    ADD CONSTRAINT chinese_weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: chinese_weekly_plans chinese_weekly_plans_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_weekly_plans
    ADD CONSTRAINT chinese_weekly_plans_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: chinese_wrong_items chinese_wrong_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_wrong_items
    ADD CONSTRAINT chinese_wrong_items_pkey PRIMARY KEY (user_id, item_key, wrong_kind);


--
-- Name: daily_progress daily_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_progress
    ADD CONSTRAINT daily_progress_pkey PRIMARY KEY (id);


--
-- Name: daily_progress daily_progress_user_id_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_progress
    ADD CONSTRAINT daily_progress_user_id_day_number_key UNIQUE (user_id, day_number);


--
-- Name: english_wrong english_wrong_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.english_wrong
    ADD CONSTRAINT english_wrong_pkey PRIMARY KEY (user_id, word_key);


--
-- Name: flipbook_books flipbook_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flipbook_books
    ADD CONSTRAINT flipbook_books_pkey PRIMARY KEY (id);


--
-- Name: flipbook_progress flipbook_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flipbook_progress
    ADD CONSTRAINT flipbook_progress_pkey PRIMARY KEY (user_id, book_id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_source_ref_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_source_ref_unique UNIQUE (source_ref);


--
-- Name: knowledge_imports knowledge_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_imports
    ADD CONSTRAINT knowledge_imports_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sync_state knowledge_sync_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sync_state
    ADD CONSTRAINT knowledge_sync_state_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sync_state knowledge_sync_state_source_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sync_state
    ADD CONSTRAINT knowledge_sync_state_source_key_key UNIQUE (source_key);


--
-- Name: math_favorites math_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_favorites
    ADD CONSTRAINT math_favorites_pkey PRIMARY KEY (user_id, problem_id);


--
-- Name: math_practice_attempts math_practice_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_practice_attempts
    ADD CONSTRAINT math_practice_attempts_pkey PRIMARY KEY (id);


--
-- Name: math_problem_images math_problem_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_problem_images
    ADD CONSTRAINT math_problem_images_pkey PRIMARY KEY (lesson_id, problem_id, image_kind);


--
-- Name: math_problem_notes math_problem_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_problem_notes
    ADD CONSTRAINT math_problem_notes_pkey PRIMARY KEY (id);


--
-- Name: math_quiz_batches math_quiz_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_batches
    ADD CONSTRAINT math_quiz_batches_pkey PRIMARY KEY (id);


--
-- Name: math_quiz_papers math_quiz_papers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_papers
    ADD CONSTRAINT math_quiz_papers_pkey PRIMARY KEY (id);


--
-- Name: math_quiz_scratch_links math_quiz_scratch_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_scratch_links
    ADD CONSTRAINT math_quiz_scratch_links_pkey PRIMARY KEY (paper_id, problem_id);


--
-- Name: math_rotating_review math_rotating_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_rotating_review
    ADD CONSTRAINT math_rotating_review_pkey PRIMARY KEY (user_id);


--
-- Name: math_scratch_drafts math_scratch_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_scratch_drafts
    ADD CONSTRAINT math_scratch_drafts_pkey PRIMARY KEY (id);


--
-- Name: math_scratch_working math_scratch_working_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_scratch_working
    ADD CONSTRAINT math_scratch_working_pkey PRIMARY KEY (user_id, problem_id, paper_scope);


--
-- Name: math_skipped math_skipped_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_skipped
    ADD CONSTRAINT math_skipped_pkey PRIMARY KEY (user_id, problem_id);


--
-- Name: math_solved math_solved_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_solved
    ADD CONSTRAINT math_solved_pkey PRIMARY KEY (id);


--
-- Name: math_solved math_solved_user_id_problem_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_solved
    ADD CONSTRAINT math_solved_user_id_problem_id_key UNIQUE (user_id, problem_id);


--
-- Name: math_weekly_lesson_review math_weekly_lesson_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_weekly_lesson_review
    ADD CONSTRAINT math_weekly_lesson_review_pkey PRIMARY KEY (user_id);


--
-- Name: math_weekly_plans math_weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_weekly_plans
    ADD CONSTRAINT math_weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: math_weekly_plans math_weekly_plans_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_weekly_plans
    ADD CONSTRAINT math_weekly_plans_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: math_wrong math_wrong_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_wrong
    ADD CONSTRAINT math_wrong_pkey PRIMARY KEY (user_id, problem_id);


--
-- Name: practice_pending_sessions practice_pending_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_pending_sessions
    ADD CONSTRAINT practice_pending_sessions_pkey PRIMARY KEY (user_id, kind, scope_key);


--
-- Name: problem_mastery problem_mastery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_mastery
    ADD CONSTRAINT problem_mastery_pkey PRIMARY KEY (id);


--
-- Name: problem_mastery problem_mastery_user_id_problem_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_mastery
    ADD CONSTRAINT problem_mastery_user_id_problem_key_key UNIQUE (user_id, problem_key);


--
-- Name: reading_passage_media reading_passage_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_passage_media
    ADD CONSTRAINT reading_passage_media_pkey PRIMARY KEY (passage_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: star_sessions star_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.star_sessions
    ADD CONSTRAINT star_sessions_pkey PRIMARY KEY (id);


--
-- Name: adaptive_plan_word_progress uq_adaptive_plan_word; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_plan_word_progress
    ADD CONSTRAINT uq_adaptive_plan_word UNIQUE (plan_id, word_key);


--
-- Name: voucher_templates voucher_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_templates
    ADD CONSTRAINT voucher_templates_pkey PRIMARY KEY (category);


--
-- Name: weekly_plans weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: weekly_plans weekly_plans_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: word_entries word_entries_business_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_entries
    ADD CONSTRAINT word_entries_business_key UNIQUE (unit, lesson, word, stage);


--
-- Name: word_entries word_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_entries
    ADD CONSTRAINT word_entries_pkey PRIMARY KEY (id);


--
-- Name: word_mastery word_mastery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_mastery
    ADD CONSTRAINT word_mastery_pkey PRIMARY KEY (id);


--
-- Name: word_mastery word_mastery_user_id_word_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_mastery
    ADD CONSTRAINT word_mastery_user_id_word_key_key UNIQUE (user_id, word_key);


--
-- Name: ai_conversations_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_conversations_session_idx ON public.ai_conversations USING btree (session_id, created_at);


--
-- Name: ai_conversations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_conversations_user_idx ON public.ai_conversations USING btree (user_id);


--
-- Name: ai_teaching_sessions_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_teaching_sessions_conversation_idx ON public.ai_teaching_sessions USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: ai_teaching_sessions_one_active_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_teaching_sessions_one_active_conversation_idx ON public.ai_teaching_sessions USING btree (user_id, conversation_id, subject) WHERE ((status = 'active'::text) AND (conversation_id IS NOT NULL));


--
-- Name: ai_teaching_sessions_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_teaching_sessions_user_status_idx ON public.ai_teaching_sessions USING btree (user_id, status, updated_at DESC);


--
-- Name: audio_assets_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_assets_user_id_idx ON public.audio_assets USING btree (user_id);


--
-- Name: audio_playlist_items_playlist_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_playlist_items_playlist_id_idx ON public.audio_playlist_items USING btree (playlist_id);


--
-- Name: audio_playlists_one_favorite_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX audio_playlists_one_favorite_per_user ON public.audio_playlists USING btree (user_id) WHERE is_favorite;


--
-- Name: audio_playlists_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_playlists_user_id_idx ON public.audio_playlists USING btree (user_id);


--
-- Name: calc_problem_state_user_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_problem_state_user_level_idx ON public.calc_problem_state USING btree (user_id, level);


--
-- Name: calc_problem_state_user_mastered_block_upd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_problem_state_user_mastered_block_upd ON public.calc_problem_state USING btree (user_id, status, block_id, updated_at DESC) WHERE (status = 'mastered'::text);


--
-- Name: calc_problem_state_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_problem_state_user_status_idx ON public.calc_problem_state USING btree (user_id, status);


--
-- Name: calc_sessions_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_sessions_user_date_idx ON public.calc_sessions USING btree (user_id, date DESC);


--
-- Name: calc_vouchers_user_redeemed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_vouchers_user_redeemed_idx ON public.calc_vouchers USING btree (user_id, redeemed_at DESC);


--
-- Name: chinese_char_entries_char_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_char_entries_char_idx ON public.chinese_char_entries USING btree ("char");


--
-- Name: chinese_char_entries_grade_sem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_char_entries_grade_sem_idx ON public.chinese_char_entries USING btree (grade, semester);


--
-- Name: chinese_char_mastery_user_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_char_mastery_user_review_idx ON public.chinese_char_mastery USING btree (user_id, track, next_review_date);


--
-- Name: chinese_lesson_chars_lesson_track_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_lesson_chars_lesson_track_idx ON public.chinese_lesson_chars USING btree (lesson_key, track, sort_order);


--
-- Name: chinese_lessons_grade_sem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_lessons_grade_sem_idx ON public.chinese_lessons USING btree (grade, semester, sort_order);


--
-- Name: chinese_weekly_plans_user_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_weekly_plans_user_week_idx ON public.chinese_weekly_plans USING btree (user_id, week_start DESC);


--
-- Name: chinese_wrong_user_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chinese_wrong_user_unresolved_idx ON public.chinese_wrong_items USING btree (user_id, resolved, added_at DESC);


--
-- Name: english_wrong_user_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX english_wrong_user_unresolved_idx ON public.english_wrong USING btree (user_id, resolved, added_at DESC);


--
-- Name: flipbook_books_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flipbook_books_slug_uidx ON public.flipbook_books USING btree (slug);


--
-- Name: flipbook_books_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flipbook_books_user_id_idx ON public.flipbook_books USING btree (user_id);


--
-- Name: idx_adaptive_plans_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptive_plans_user ON public.adaptive_word_plans USING btree (user_id, status);


--
-- Name: idx_adaptive_progress_scheduler; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptive_progress_scheduler ON public.adaptive_plan_word_progress USING btree (plan_id, status, next_review_date);


--
-- Name: idx_adaptive_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptive_progress_user ON public.adaptive_plan_word_progress USING btree (user_id, plan_id);


--
-- Name: idx_chinese_reading_recordings_user_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chinese_reading_recordings_user_book ON public.chinese_reading_recordings USING btree (user_id, book_slug, created_at DESC);


--
-- Name: idx_chinese_reading_recordings_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chinese_reading_recordings_user_created ON public.chinese_reading_recordings USING btree (user_id, created_at DESC);


--
-- Name: idx_chinese_roadmap_plan_runs_plan_lesson; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chinese_roadmap_plan_runs_plan_lesson ON public.chinese_roadmap_plan_lesson_runs USING btree (plan_id, lesson_key, finished_at DESC);


--
-- Name: idx_chinese_roadmap_plan_runs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chinese_roadmap_plan_runs_user ON public.chinese_roadmap_plan_lesson_runs USING btree (user_id, plan_id);


--
-- Name: idx_chinese_roadmap_plans_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chinese_roadmap_plans_user_status ON public.chinese_roadmap_plans USING btree (user_id, status);


--
-- Name: idx_math_scratch_drafts_user_problem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_math_scratch_drafts_user_problem ON public.math_scratch_drafts USING btree (user_id, problem_id);


--
-- Name: idx_practice_attempts_user_problem_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practice_attempts_user_problem_time ON public.math_practice_attempts USING btree (user_id, problem_id, attempted_at DESC);


--
-- Name: idx_practice_pending_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practice_pending_user ON public.practice_pending_sessions USING btree (user_id);


--
-- Name: idx_scratch_drafts_user_problem_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scratch_drafts_user_problem_time ON public.math_scratch_drafts USING btree (user_id, problem_id, submitted_at DESC);


--
-- Name: idx_scratch_working_user_paper; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scratch_working_user_paper ON public.math_scratch_working USING btree (user_id, paper_scope) WHERE (paper_scope <> ''::text);


--
-- Name: knowledge_chunks_content_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_content_trgm_idx ON public.knowledge_chunks USING gin (content public.gin_trgm_ops);


--
-- Name: knowledge_chunks_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_document_idx ON public.knowledge_chunks USING btree (document_id);


--
-- Name: knowledge_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: knowledge_chunks_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_subject_idx ON public.knowledge_chunks USING btree (subject);


--
-- Name: knowledge_chunks_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_tsv_idx ON public.knowledge_chunks USING gin (content_tsv);


--
-- Name: knowledge_chunks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_user_idx ON public.knowledge_chunks USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: knowledge_documents_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_documents_owner_idx ON public.knowledge_documents USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: knowledge_documents_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_documents_subject_idx ON public.knowledge_documents USING btree (subject);


--
-- Name: knowledge_imports_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_imports_user_idx ON public.knowledge_imports USING btree (user_id);


--
-- Name: math_practice_attempts_one_in_progress_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX math_practice_attempts_one_in_progress_practice ON public.math_practice_attempts USING btree (user_id, problem_id) WHERE ((status = 'in_progress'::text) AND (paper_id IS NULL));


--
-- Name: math_practice_attempts_one_in_progress_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX math_practice_attempts_one_in_progress_quiz ON public.math_practice_attempts USING btree (user_id, problem_id, paper_id) WHERE ((status = 'in_progress'::text) AND (paper_id IS NOT NULL));


--
-- Name: math_problem_images_lesson_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_problem_images_lesson_id_idx ON public.math_problem_images USING btree (lesson_id);


--
-- Name: math_problem_notes_lesson_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_problem_notes_lesson_id_idx ON public.math_problem_notes USING btree (lesson_id);


--
-- Name: math_problem_notes_lesson_problem_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_problem_notes_lesson_problem_sort_idx ON public.math_problem_notes USING btree (lesson_id, problem_id, sort_order);


--
-- Name: math_problem_notes_problem_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_problem_notes_problem_id_idx ON public.math_problem_notes USING btree (problem_id);


--
-- Name: math_quiz_batches_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_quiz_batches_user_id_idx ON public.math_quiz_batches USING btree (user_id);


--
-- Name: math_quiz_papers_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_quiz_papers_batch_id_idx ON public.math_quiz_papers USING btree (batch_id);


--
-- Name: math_skipped_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX math_skipped_user_id_idx ON public.math_skipped USING btree (user_id);


--
-- Name: reading_passage_media_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reading_passage_media_user_id_idx ON public.reading_passage_media USING btree (user_id);


--
-- Name: star_sessions_ref_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX star_sessions_ref_id_idx ON public.star_sessions USING btree (ref_id);


--
-- Name: star_sessions_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX star_sessions_user_date_idx ON public.star_sessions USING btree (user_id, date);


--
-- Name: uq_chinese_roadmap_plans_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_chinese_roadmap_plans_one_active ON public.chinese_roadmap_plans USING btree (user_id) WHERE (((status)::text = 'active'::text) AND (archived_at IS NULL));


--
-- Name: voucher_templates_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voucher_templates_archived_idx ON public.voucher_templates USING btree (archived, sort_order);


--
-- Name: word_entries_unit_lesson_word_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX word_entries_unit_lesson_word_stage_idx ON public.word_entries USING btree (unit, lesson, word, COALESCE(stage, ''::text));


--
-- Name: math_wrong math_wrong_reset_resolved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER math_wrong_reset_resolved BEFORE INSERT ON public.math_wrong FOR EACH ROW EXECUTE FUNCTION public.math_wrong_clear_resolved_on_insert();


--
-- Name: knowledge_chunks trg_knowledge_chunks_update_content_tsv; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_knowledge_chunks_update_content_tsv BEFORE INSERT OR UPDATE OF content, subject ON public.knowledge_chunks FOR EACH ROW EXECUTE FUNCTION public.knowledge_chunks_update_content_tsv();


--
-- Name: adaptive_plan_word_progress adaptive_plan_word_progress_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_plan_word_progress
    ADD CONSTRAINT adaptive_plan_word_progress_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.adaptive_word_plans(id) ON DELETE CASCADE;


--
-- Name: adaptive_plan_word_progress adaptive_plan_word_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_plan_word_progress
    ADD CONSTRAINT adaptive_plan_word_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: adaptive_word_plans adaptive_word_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adaptive_word_plans
    ADD CONSTRAINT adaptive_word_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_teaching_sessions ai_teaching_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_teaching_sessions
    ADD CONSTRAINT ai_teaching_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audio_assets audio_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_assets
    ADD CONSTRAINT audio_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audio_playlist_items audio_playlist_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlist_items
    ADD CONSTRAINT audio_playlist_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.audio_assets(id) ON DELETE CASCADE;


--
-- Name: audio_playlist_items audio_playlist_items_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlist_items
    ADD CONSTRAINT audio_playlist_items_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.audio_playlists(id) ON DELETE CASCADE;


--
-- Name: audio_playlist_items audio_playlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlist_items
    ADD CONSTRAINT audio_playlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audio_playlists audio_playlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_playlists
    ADD CONSTRAINT audio_playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_problem_state calc_problem_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_problem_state
    ADD CONSTRAINT calc_problem_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_sessions calc_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_sessions
    ADD CONSTRAINT calc_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_settings calc_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_settings
    ADD CONSTRAINT calc_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_vouchers calc_vouchers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_vouchers
    ADD CONSTRAINT calc_vouchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_char_mastery chinese_char_mastery_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_char_mastery
    ADD CONSTRAINT chinese_char_mastery_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_lesson_chars chinese_lesson_chars_char_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_lesson_chars
    ADD CONSTRAINT chinese_lesson_chars_char_key_fkey FOREIGN KEY (char_key) REFERENCES public.chinese_char_entries(char_key) ON DELETE CASCADE;


--
-- Name: chinese_lesson_chars chinese_lesson_chars_lesson_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_lesson_chars
    ADD CONSTRAINT chinese_lesson_chars_lesson_key_fkey FOREIGN KEY (lesson_key) REFERENCES public.chinese_lessons(lesson_key) ON DELETE CASCADE;


--
-- Name: chinese_reading_recordings chinese_reading_recordings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_reading_recordings
    ADD CONSTRAINT chinese_reading_recordings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_roadmap_plan_lesson_runs chinese_roadmap_plan_lesson_runs_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_roadmap_plan_lesson_runs
    ADD CONSTRAINT chinese_roadmap_plan_lesson_runs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.chinese_roadmap_plans(id) ON DELETE CASCADE;


--
-- Name: chinese_roadmap_plan_lesson_runs chinese_roadmap_plan_lesson_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_roadmap_plan_lesson_runs
    ADD CONSTRAINT chinese_roadmap_plan_lesson_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_roadmap_plans chinese_roadmap_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_roadmap_plans
    ADD CONSTRAINT chinese_roadmap_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_weekly_plans chinese_weekly_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_weekly_plans
    ADD CONSTRAINT chinese_weekly_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chinese_wrong_items chinese_wrong_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chinese_wrong_items
    ADD CONSTRAINT chinese_wrong_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: daily_progress daily_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_progress
    ADD CONSTRAINT daily_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: english_wrong english_wrong_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.english_wrong
    ADD CONSTRAINT english_wrong_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: flipbook_books flipbook_books_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flipbook_books
    ADD CONSTRAINT flipbook_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: flipbook_progress flipbook_progress_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flipbook_progress
    ADD CONSTRAINT flipbook_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.flipbook_books(id) ON DELETE CASCADE;


--
-- Name: flipbook_progress flipbook_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flipbook_progress
    ADD CONSTRAINT flipbook_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_imports knowledge_imports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_imports
    ADD CONSTRAINT knowledge_imports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_favorites math_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_favorites
    ADD CONSTRAINT math_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_practice_attempts math_practice_attempts_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_practice_attempts
    ADD CONSTRAINT math_practice_attempts_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.math_scratch_drafts(id) ON DELETE SET NULL;


--
-- Name: math_practice_attempts math_practice_attempts_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_practice_attempts
    ADD CONSTRAINT math_practice_attempts_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.math_quiz_papers(id) ON DELETE SET NULL;


--
-- Name: math_practice_attempts math_practice_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_practice_attempts
    ADD CONSTRAINT math_practice_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_problem_images math_problem_images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_problem_images
    ADD CONSTRAINT math_problem_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_problem_notes math_problem_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_problem_notes
    ADD CONSTRAINT math_problem_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: math_quiz_batches math_quiz_batches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_batches
    ADD CONSTRAINT math_quiz_batches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_quiz_papers math_quiz_papers_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_papers
    ADD CONSTRAINT math_quiz_papers_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.math_quiz_batches(id) ON DELETE SET NULL;


--
-- Name: math_quiz_scratch_links math_quiz_scratch_links_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_scratch_links
    ADD CONSTRAINT math_quiz_scratch_links_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.math_scratch_drafts(id) ON DELETE CASCADE;


--
-- Name: math_quiz_scratch_links math_quiz_scratch_links_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_scratch_links
    ADD CONSTRAINT math_quiz_scratch_links_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.math_quiz_papers(id) ON DELETE CASCADE;


--
-- Name: math_quiz_scratch_links math_quiz_scratch_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_quiz_scratch_links
    ADD CONSTRAINT math_quiz_scratch_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_scratch_drafts math_scratch_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_scratch_drafts
    ADD CONSTRAINT math_scratch_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_scratch_working math_scratch_working_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_scratch_working
    ADD CONSTRAINT math_scratch_working_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_skipped math_skipped_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_skipped
    ADD CONSTRAINT math_skipped_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_solved math_solved_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_solved
    ADD CONSTRAINT math_solved_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_weekly_lesson_review math_weekly_lesson_review_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_weekly_lesson_review
    ADD CONSTRAINT math_weekly_lesson_review_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: math_weekly_plans math_weekly_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_weekly_plans
    ADD CONSTRAINT math_weekly_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: math_wrong math_wrong_last_wrong_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_wrong
    ADD CONSTRAINT math_wrong_last_wrong_attempt_id_fkey FOREIGN KEY (last_wrong_attempt_id) REFERENCES public.math_practice_attempts(id) ON DELETE SET NULL;


--
-- Name: math_wrong math_wrong_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_wrong
    ADD CONSTRAINT math_wrong_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: practice_pending_sessions practice_pending_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_pending_sessions
    ADD CONSTRAINT practice_pending_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: problem_mastery problem_mastery_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_mastery
    ADD CONSTRAINT problem_mastery_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: reading_passage_media reading_passage_media_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_passage_media
    ADD CONSTRAINT reading_passage_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: star_sessions star_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.star_sessions
    ADD CONSTRAINT star_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: word_entries word_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_entries
    ADD CONSTRAINT word_entries_user_id_fkey FOREIGN KEY (creator) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: word_mastery word_mastery_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_mastery
    ADD CONSTRAINT word_mastery_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: flipbook_books Authenticated insert flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert flipbook_books" ON public.flipbook_books FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: math_problem_images Authenticated insert math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert math_problem_images" ON public.math_problem_images FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (user_id = ( SELECT auth.uid() AS uid)) AND (image_kind = ANY (ARRAY['analysis'::text, 'figure'::text, 'summary'::text])) AND (((image_kind = ANY (ARRAY['analysis'::text, 'figure'::text])) AND (problem_id ~~ (lesson_id || '-%'::text)) AND (((image_kind = 'analysis'::text) AND (storage_path ~~ (('analysis/'::text || lesson_id) || '/%'::text))) OR ((image_kind = 'figure'::text) AND (storage_path ~~ (('figures/'::text || lesson_id) || '/%'::text))))) OR ((image_kind = 'summary'::text) AND (problem_id = (lesson_id || '__SUMMARY'::text)) AND (storage_path ~~ (('summaries/'::text || lesson_id) || '/summary.%'::text))))));


--
-- Name: reading_passage_media Authenticated insert reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert reading_passage_media" ON public.reading_passage_media FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: flipbook_books Authenticated read all flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read all flipbook_books" ON public.flipbook_books FOR SELECT TO authenticated USING (true);


--
-- Name: reading_passage_media Authenticated read reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read reading_passage_media" ON public.reading_passage_media FOR SELECT TO authenticated USING (true);


--
-- Name: flipbook_books Owners or admins delete flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins delete flipbook_books" ON public.flipbook_books FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: math_problem_images Owners or admins delete math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins delete math_problem_images" ON public.math_problem_images FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: reading_passage_media Owners or admins delete reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins delete reading_passage_media" ON public.reading_passage_media FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: flipbook_books Owners or admins update flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins update flipbook_books" ON public.flipbook_books FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: math_problem_images Owners or admins update math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins update math_problem_images" ON public.math_problem_images FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK ((((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)) AND (image_kind = ANY (ARRAY['analysis'::text, 'figure'::text, 'summary'::text])) AND (((image_kind = ANY (ARRAY['analysis'::text, 'figure'::text])) AND (problem_id ~~ (lesson_id || '-%'::text)) AND (((image_kind = 'analysis'::text) AND (storage_path ~~ (('analysis/'::text || lesson_id) || '/%'::text))) OR ((image_kind = 'figure'::text) AND (storage_path ~~ (('figures/'::text || lesson_id) || '/%'::text))))) OR ((image_kind = 'summary'::text) AND (problem_id = (lesson_id || '__SUMMARY'::text)) AND (storage_path ~~ (('summaries/'::text || lesson_id) || '/summary.%'::text))))));


--
-- Name: reading_passage_media Owners or admins update reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners or admins update reading_passage_media" ON public.reading_passage_media FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: math_problem_images Public read math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read math_problem_images" ON public.math_problem_images FOR SELECT USING (true);


--
-- Name: math_weekly_plans Users can delete own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own math_weekly_plans" ON public.math_weekly_plans FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can delete own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own weekly_plans" ON public.weekly_plans FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_weekly_plans Users can insert own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own math_weekly_plans" ON public.math_weekly_plans FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can insert own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own weekly_plans" ON public.weekly_plans FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_rotating_review Users can manage their own rotating review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own rotating review" ON public.math_rotating_review USING (((( SELECT auth.uid() AS uid))::text = user_id)) WITH CHECK (((( SELECT auth.uid() AS uid))::text = user_id));


--
-- Name: math_weekly_plans Users can read own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own math_weekly_plans" ON public.math_weekly_plans FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can read own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own weekly_plans" ON public.weekly_plans FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_weekly_plans Users can update own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own math_weekly_plans" ON public.math_weekly_plans FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can update own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own weekly_plans" ON public.weekly_plans FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: flipbook_progress Users insert own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own flipbook_progress" ON public.flipbook_progress FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: flipbook_progress Users read own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own flipbook_progress" ON public.flipbook_progress FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: flipbook_progress Users update own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own flipbook_progress" ON public.flipbook_progress FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: adaptive_plan_word_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adaptive_plan_word_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: adaptive_plan_word_progress adaptive_plan_word_progress_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adaptive_plan_word_progress_own ON public.adaptive_plan_word_progress USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: adaptive_word_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adaptive_word_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: adaptive_word_plans adaptive_word_plans_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adaptive_word_plans_own ON public.adaptive_word_plans USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_conversations ai_conversations_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conversations_own ON public.ai_conversations TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: ai_teaching_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_teaching_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_teaching_sessions ai_teaching_sessions_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_teaching_sessions_delete_own ON public.ai_teaching_sessions FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: ai_teaching_sessions ai_teaching_sessions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_teaching_sessions_insert_own ON public.ai_teaching_sessions FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: ai_teaching_sessions ai_teaching_sessions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_teaching_sessions_select_own ON public.ai_teaching_sessions FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: ai_teaching_sessions ai_teaching_sessions_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_teaching_sessions_update_own ON public.ai_teaching_sessions FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id))) WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: api_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_playlist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audio_playlist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_playlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audio_playlists ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_assets authenticated can read audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audio_assets" ON public.audio_assets FOR SELECT TO authenticated USING (true);


--
-- Name: audio_playlist_items authenticated can read audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audio_playlist_items" ON public.audio_playlist_items FOR SELECT TO authenticated USING (true);


--
-- Name: audio_playlists authenticated can read audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audio_playlists" ON public.audio_playlists FOR SELECT TO authenticated USING (true);


--
-- Name: calc_problem_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_problem_state ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_problem_state calc_problem_state_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_problem_state_modify_own ON public.calc_problem_state TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: calc_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_sessions calc_sessions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_sessions_insert_own ON public.calc_sessions FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: calc_sessions calc_sessions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_sessions_select_own ON public.calc_sessions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: calc_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_settings calc_settings_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_settings_modify_own ON public.calc_settings TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: calc_vouchers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_vouchers calc_vouchers_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_vouchers_modify_own ON public.calc_vouchers TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_char_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_char_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_char_entries chinese_char_entries_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_delete_admin ON public.chinese_char_entries FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_char_entries chinese_char_entries_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_insert_admin ON public.chinese_char_entries FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_char_entries chinese_char_entries_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_select_auth ON public.chinese_char_entries FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_char_entries chinese_char_entries_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_update_admin ON public.chinese_char_entries FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_char_mastery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_char_mastery ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_char_mastery chinese_char_mastery_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_delete_own ON public.chinese_char_mastery FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_insert_own ON public.chinese_char_mastery FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_select_own ON public.chinese_char_mastery FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_update_own ON public.chinese_char_mastery FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_lesson_chars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_lesson_chars ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_lesson_chars chinese_lesson_chars_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_delete_admin ON public.chinese_lesson_chars FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_lesson_chars chinese_lesson_chars_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_insert_admin ON public.chinese_lesson_chars FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_lesson_chars chinese_lesson_chars_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_select_auth ON public.chinese_lesson_chars FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_lesson_chars chinese_lesson_chars_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_update_admin ON public.chinese_lesson_chars FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_lessons chinese_lessons_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_delete_admin ON public.chinese_lessons FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_lessons chinese_lessons_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_insert_admin ON public.chinese_lessons FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_lessons chinese_lessons_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_select_auth ON public.chinese_lessons FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_lessons chinese_lessons_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_update_admin ON public.chinese_lessons FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: chinese_reading_recordings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_reading_recordings ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_reading_recordings chinese_reading_recordings_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_delete_own ON public.chinese_reading_recordings FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_reading_recordings chinese_reading_recordings_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_insert_own ON public.chinese_reading_recordings FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_reading_recordings chinese_reading_recordings_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_select_own ON public.chinese_reading_recordings FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_roadmap_plan_lesson_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_roadmap_plan_lesson_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_roadmap_plan_lesson_runs chinese_roadmap_plan_lesson_runs_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_roadmap_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_roadmap_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_roadmap_plans chinese_roadmap_plans_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_roadmap_plans_own ON public.chinese_roadmap_plans USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_weekly_plans chinese_weekly_plans_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_delete_own ON public.chinese_weekly_plans FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_insert_own ON public.chinese_weekly_plans FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_select_own ON public.chinese_weekly_plans FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_update_own ON public.chinese_weekly_plans FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_delete_own ON public.chinese_wrong_items FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_insert_own ON public.chinese_wrong_items FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_wrong_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_wrong_items ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_wrong_items chinese_wrong_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_select_own ON public.chinese_wrong_items FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_update_own ON public.chinese_wrong_items FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: daily_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: english_wrong; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.english_wrong ENABLE ROW LEVEL SECURITY;

--
-- Name: english_wrong english_wrong_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_delete_own ON public.english_wrong FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: english_wrong english_wrong_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_insert_own ON public.english_wrong FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: english_wrong english_wrong_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_select_own ON public.english_wrong FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: english_wrong english_wrong_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_update_own ON public.english_wrong FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: flipbook_books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flipbook_books ENABLE ROW LEVEL SECURITY;

--
-- Name: flipbook_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flipbook_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_chunks knowledge_chunks_insert_import; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_insert_import ON public.knowledge_chunks FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: knowledge_chunks knowledge_chunks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks FOR SELECT TO authenticated USING (((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: knowledge_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_documents knowledge_documents_insert_import; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_documents_insert_import ON public.knowledge_documents FOR INSERT TO authenticated WITH CHECK (((source_type = 'import'::text) AND (owner_id = ( SELECT auth.uid() AS uid))));


--
-- Name: knowledge_documents knowledge_documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_documents_select ON public.knowledge_documents FOR SELECT TO authenticated USING (((owner_id IS NULL) OR (owner_id = ( SELECT auth.uid() AS uid))));


--
-- Name: knowledge_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_imports knowledge_imports_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_imports_own ON public.knowledge_imports TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: knowledge_sync_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_sync_state ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_sync_state knowledge_sync_state_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sync_state_select ON public.knowledge_sync_state FOR SELECT TO authenticated USING (true);


--
-- Name: math_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: math_favorites math_favorites_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_delete_own ON public.math_favorites FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_favorites math_favorites_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_insert_own ON public.math_favorites FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_favorites math_favorites_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_select_own ON public.math_favorites FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_practice_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_practice_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: math_practice_attempts math_practice_attempts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_delete ON public.math_practice_attempts FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_insert ON public.math_practice_attempts FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_select ON public.math_practice_attempts FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_update ON public.math_practice_attempts FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_problem_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_problem_images ENABLE ROW LEVEL SECURITY;

--
-- Name: math_problem_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_problem_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: math_problem_notes math_problem_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_delete ON public.math_problem_notes FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: math_problem_notes math_problem_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_insert ON public.math_problem_notes FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_problem_notes math_problem_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_select ON public.math_problem_notes FOR SELECT TO authenticated USING (true);


--
-- Name: math_problem_notes math_problem_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_update ON public.math_problem_notes FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT public.is_admin() AS is_admin)));


--
-- Name: math_quiz_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_quiz_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: math_quiz_batches math_quiz_batches_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_quiz_batches_user ON public.math_quiz_batches USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_quiz_papers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_quiz_papers ENABLE ROW LEVEL SECURITY;

--
-- Name: math_quiz_papers math_quiz_papers_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_quiz_papers_user ON public.math_quiz_papers USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_quiz_scratch_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_quiz_scratch_links ENABLE ROW LEVEL SECURITY;

--
-- Name: math_rotating_review; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_rotating_review ENABLE ROW LEVEL SECURITY;

--
-- Name: math_scratch_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_scratch_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: math_scratch_drafts math_scratch_drafts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_delete ON public.math_scratch_drafts FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_insert ON public.math_scratch_drafts FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_select ON public.math_scratch_drafts FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_update ON public.math_scratch_drafts FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_scratch_working; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_scratch_working ENABLE ROW LEVEL SECURITY;

--
-- Name: math_scratch_working math_scratch_working_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_delete ON public.math_scratch_working FOR DELETE USING (((( SELECT auth.uid() AS uid))::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_insert ON public.math_scratch_working FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid))::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_select ON public.math_scratch_working FOR SELECT USING (((( SELECT auth.uid() AS uid))::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_update ON public.math_scratch_working FOR UPDATE USING (((( SELECT auth.uid() AS uid))::text = (user_id)::text)) WITH CHECK (((( SELECT auth.uid() AS uid))::text = (user_id)::text));


--
-- Name: math_skipped; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_skipped ENABLE ROW LEVEL SECURITY;

--
-- Name: math_skipped math_skipped_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_skipped_own ON public.math_skipped USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_solved; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_solved ENABLE ROW LEVEL SECURITY;

--
-- Name: math_weekly_lesson_review; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_weekly_lesson_review ENABLE ROW LEVEL SECURITY;

--
-- Name: math_weekly_lesson_review math_weekly_lesson_review_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_weekly_lesson_review_own ON public.math_weekly_lesson_review TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: math_wrong; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_wrong ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_pending_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practice_pending_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_pending_sessions practice_pending_sessions_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY practice_pending_sessions_own ON public.practice_pending_sessions USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: problem_mastery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.problem_mastery ENABLE ROW LEVEL SECURITY;

--
-- Name: word_entries public read word_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read word_entries" ON public.word_entries FOR SELECT USING (true);


--
-- Name: math_quiz_scratch_links quiz_scratch_links_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quiz_scratch_links_own ON public.math_quiz_scratch_links USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: reading_passage_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reading_passage_media ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: star_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.star_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: star_sessions star_sessions_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY star_sessions_own ON public.star_sessions USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_assets users delete own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_assets" ON public.audio_assets FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_playlist_items users delete own audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_playlist_items" ON public.audio_playlist_items FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_playlists users delete own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_playlists" ON public.audio_playlists FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_assets users insert own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_assets" ON public.audio_assets FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_playlist_items users insert own audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_playlist_items" ON public.audio_playlist_items FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_playlists users insert own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_playlists" ON public.audio_playlists FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: daily_progress users manage own daily_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own daily_progress" ON public.daily_progress TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_solved users manage own math_solved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own math_solved" ON public.math_solved TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: math_wrong users manage own math_wrong; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own math_wrong" ON public.math_wrong TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: problem_mastery users manage own problem_mastery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own problem_mastery" ON public.problem_mastery TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: word_mastery users manage own word_mastery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own word_mastery" ON public.word_mastery TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_assets users update own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own audio_assets" ON public.audio_assets FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audio_playlists users update own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own audio_playlists" ON public.audio_playlists FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: voucher_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voucher_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: voucher_templates voucher_templates_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_templates_delete_admin ON public.voucher_templates FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: voucher_templates voucher_templates_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_templates_insert_admin ON public.voucher_templates FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: voucher_templates voucher_templates_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_templates_select_authenticated ON public.voucher_templates FOR SELECT TO authenticated USING (true);


--
-- Name: voucher_templates voucher_templates_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_templates_update_admin ON public.voucher_templates FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: word_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.word_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: word_entries word_entries_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY word_entries_delete_own ON public.word_entries FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = creator));


--
-- Name: word_entries word_entries_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY word_entries_insert_own ON public.word_entries FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = creator));


--
-- Name: word_entries word_entries_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY word_entries_update_own ON public.word_entries FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = creator)) WITH CHECK ((( SELECT auth.uid() AS uid) = creator));


--
-- Name: word_mastery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.word_mastery ENABLE ROW LEVEL SECURITY;

-- Compact, rebuildable finite-curriculum progress (20260831001515).
CREATE TABLE public.calc_curriculum_snapshots (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    block_id text NOT NULL,
    curriculum_version text NOT NULL,
    universe_size integer NOT NULL CHECK (universe_size > 0),
    covered_bits bytea NOT NULL,
    within_target_bits bytea NOT NULL,
    fluent_bits bytea NOT NULL,
    mastered_bits bytea NOT NULL,
    covered_count integer DEFAULT 0 NOT NULL CHECK (covered_count >= 0),
    within_target_count integer DEFAULT 0 NOT NULL CHECK (within_target_count >= 0),
    fluent_count integer DEFAULT 0 NOT NULL CHECK (fluent_count >= 0),
    mastered_count integer DEFAULT 0 NOT NULL CHECK (mastered_count >= 0),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, block_id),
    CONSTRAINT calc_curriculum_snapshot_counts_fit CHECK (
      covered_count <= universe_size AND within_target_count <= universe_size
      AND fluent_count <= universe_size AND mastered_count <= universe_size
    ),
    CONSTRAINT calc_curriculum_snapshot_bytes_fit CHECK (
      octet_length(covered_bits) = (universe_size + 7) / 8
      AND octet_length(within_target_bits) = (universe_size + 7) / 8
      AND octet_length(fluent_bits) = (universe_size + 7) / 8
      AND octet_length(mastered_bits) = (universe_size + 7) / 8
    )
);

ALTER TABLE public.calc_curriculum_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY calc_curriculum_snapshots_select_own ON public.calc_curriculum_snapshots
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY calc_curriculum_snapshots_insert_own ON public.calc_curriculum_snapshots
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY calc_curriculum_snapshots_update_own ON public.calc_curriculum_snapshots
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
GRANT SELECT, INSERT, UPDATE ON public.calc_curriculum_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_calc_curriculum_snapshot(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  owner_id uuid := auth.uid();
  target_block text;
  target_version text;
  target_size integer;
  target_index integer;
  zero_bits bytea;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'p_items must be an array of at most 500 items' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    target_block := item->>'block_id';
    target_version := item->>'curriculum_version';
    target_size := (item->>'universe_size')::integer;
    target_index := (item->>'curriculum_index')::integer;
    IF target_block IS NULL OR target_block = '' OR target_version IS NULL OR target_version = ''
       OR target_size IS NULL OR target_size <= 0
       OR target_index IS NULL OR target_index < 0 OR target_index >= target_size THEN
      RAISE EXCEPTION 'invalid curriculum snapshot item: %', item USING ERRCODE = '22023';
    END IF;
    zero_bits := decode(repeat('00', (target_size + 7) / 8), 'hex');
    INSERT INTO public.calc_curriculum_snapshots (
      user_id, block_id, curriculum_version, universe_size,
      covered_bits, within_target_bits, fluent_bits, mastered_bits
    ) VALUES (
      owner_id, target_block, target_version, target_size,
      zero_bits, zero_bits, zero_bits, zero_bits
    )
    ON CONFLICT (user_id, block_id) DO UPDATE SET
      curriculum_version = EXCLUDED.curriculum_version,
      universe_size = EXCLUDED.universe_size,
      covered_bits = CASE WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
        AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.covered_bits ELSE EXCLUDED.covered_bits END,
      within_target_bits = CASE WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
        AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.within_target_bits ELSE EXCLUDED.within_target_bits END,
      fluent_bits = CASE WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
        AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.fluent_bits ELSE EXCLUDED.fluent_bits END,
      mastered_bits = CASE WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
        AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.mastered_bits ELSE EXCLUDED.mastered_bits END,
      updated_at = now();
    UPDATE public.calc_curriculum_snapshots
    SET
      covered_bits = CASE WHEN COALESCE((item->>'covered')::boolean, false)
        THEN set_bit(covered_bits, target_index, 1) ELSE covered_bits END,
      within_target_bits = CASE WHEN COALESCE((item->>'within_target')::boolean, false)
        THEN set_bit(within_target_bits, target_index, 1) ELSE within_target_bits END,
      fluent_bits = set_bit(fluent_bits, target_index,
        CASE WHEN COALESCE((item->>'fluent')::boolean, false) THEN 1 ELSE 0 END),
      mastered_bits = set_bit(mastered_bits, target_index,
        CASE WHEN COALESCE((item->>'mastered')::boolean, false) THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE user_id = owner_id AND block_id = target_block;
  END LOOP;
  UPDATE public.calc_curriculum_snapshots AS snapshot
  SET covered_count = bit_count(snapshot.covered_bits)::integer,
      within_target_count = bit_count(snapshot.within_target_bits)::integer,
      fluent_count = bit_count(snapshot.fluent_bits)::integer,
      mastered_count = bit_count(snapshot.mastered_bits)::integer,
      updated_at = now()
  WHERE snapshot.user_id = owner_id
    AND snapshot.block_id IN (
      SELECT DISTINCT value->>'block_id' FROM jsonb_array_elements(p_items)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) TO authenticated;

-- Additive unified calc state foundation (20260831004809).
CREATE TABLE public.calc_curriculum_registry (
    block_id text NOT NULL,
    curriculum_version text NOT NULL,
    universe_size integer NOT NULL CHECK (universe_size BETWEEN 1 AND 200000),
    curriculum_hash text NOT NULL CHECK (curriculum_hash ~ '^[0-9a-f]{64}$'),
    coverage_kind text NOT NULL CHECK (coverage_kind IN ('formula', 'structure')),
    status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
    activated_at timestamptz,
    retired_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (block_id, curriculum_version),
    UNIQUE (block_id, curriculum_hash),
    CONSTRAINT calc_curriculum_registry_lifecycle_check CHECK (
      (status = 'draft' AND activated_at IS NULL AND retired_at IS NULL)
      OR (status = 'active' AND activated_at IS NOT NULL AND retired_at IS NULL)
      OR (status = 'retired' AND activated_at IS NOT NULL AND retired_at IS NOT NULL)
    )
);
CREATE UNIQUE INDEX calc_curriculum_registry_one_active_per_block_idx
  ON public.calc_curriculum_registry (block_id) WHERE status = 'active';
ALTER TABLE public.calc_curriculum_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY calc_curriculum_registry_authenticated_read
  ON public.calc_curriculum_registry FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.calc_curriculum_registry TO authenticated;

CREATE TABLE public.calc_user_runtime (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    state_revision bigint NOT NULL DEFAULT 0 CHECK (state_revision >= 0),
    last_session_no bigint NOT NULL DEFAULT 0 CHECK (last_session_no >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calc_user_runtime ENABLE ROW LEVEL SECURITY;
CREATE POLICY calc_user_runtime_select_own ON public.calc_user_runtime
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.calc_user_runtime TO authenticated;

ALTER TABLE public.calc_problem_state
  ADD COLUMN needs_remediation boolean NOT NULL DEFAULT false,
  ADD COLUMN last_wrong_at timestamptz,
  ADD COLUMN last_wrong_session_no bigint,
  ADD COLUMN last_error_tag text,
  ADD COLUMN last_user_answer text,
  ADD COLUMN last_answer_json jsonb,
  ADD COLUMN remediation_correct_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN applied_revision bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT calc_problem_state_remediation_correct_count_check
    CHECK (remediation_correct_count BETWEEN 0 AND 3),
  ADD CONSTRAINT calc_problem_state_applied_revision_check CHECK (applied_revision >= 0),
  ADD CONSTRAINT calc_problem_state_wrong_session_check
    CHECK (last_wrong_session_no IS NULL OR last_wrong_session_no >= 0);
CREATE INDEX calc_problem_state_user_remediation_idx
  ON public.calc_problem_state (user_id, last_wrong_at DESC, signature)
  WHERE needs_remediation;

ALTER TABLE public.calc_sessions
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN session_no bigint,
  ADD COLUMN state_revision bigint,
  ADD COLUMN client_schema_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT calc_sessions_session_no_check CHECK (session_no IS NULL OR session_no > 0),
  ADD CONSTRAINT calc_sessions_state_revision_check CHECK (state_revision IS NULL OR state_revision > 0),
  ADD CONSTRAINT calc_sessions_client_schema_version_check CHECK (client_schema_version BETWEEN 1 AND 1000);
CREATE UNIQUE INDEX calc_sessions_user_idempotency_key_idx
  ON public.calc_sessions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX calc_sessions_user_session_no_idx
  ON public.calc_sessions (user_id, session_no) WHERE session_no IS NOT NULL;

CREATE TABLE public.calc_block_progress (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    block_id text NOT NULL,
    curriculum_version text NOT NULL,
    universe_size integer NOT NULL CHECK (universe_size BETWEEN 1 AND 200000),
    coverage_kind text NOT NULL CHECK (coverage_kind IN ('formula', 'structure')),
    formula_covered_bits bytea,
    formula_within_target_bits bytea,
    formula_fluent_bits bytea,
    formula_mastered_bits bytea,
    structure_covered_bits bytea,
    structure_fluent_bits bytea,
    structure_mastered_bits bytea,
    covered_count integer NOT NULL DEFAULT 0,
    within_target_count integer NOT NULL DEFAULT 0,
    fluent_count integer NOT NULL DEFAULT 0,
    mastered_count integer NOT NULL DEFAULT 0,
    review_due_count integer NOT NULL DEFAULT 0,
    recent_independent_correct integer NOT NULL DEFAULT 0,
    recent_independent_total integer NOT NULL DEFAULT 0,
    stable_count integer NOT NULL DEFAULT 0,
    tier text NOT NULL DEFAULT 'initial' CHECK (tier IN ('initial', 'stabilized', 'graduated')),
    ready boolean NOT NULL DEFAULT false,
    recovery boolean NOT NULL DEFAULT false,
    applied_revision bigint NOT NULL DEFAULT 0 CHECK (applied_revision >= 0),
    health_status text NOT NULL DEFAULT 'rebuild_required'
      CHECK (health_status IN ('healthy', 'stale', 'rebuild_required', 'version_conflict')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, block_id, curriculum_version),
    FOREIGN KEY (block_id, curriculum_version)
      REFERENCES public.calc_curriculum_registry (block_id, curriculum_version),
    CONSTRAINT calc_block_progress_counts_fit CHECK (
      covered_count BETWEEN 0 AND universe_size
      AND within_target_count BETWEEN 0 AND universe_size
      AND fluent_count BETWEEN 0 AND universe_size
      AND mastered_count BETWEEN 0 AND universe_size
      AND review_due_count BETWEEN 0 AND universe_size
      AND recent_independent_correct >= 0
      AND recent_independent_total >= recent_independent_correct
      AND stable_count BETWEEN 0 AND universe_size
    ),
    CONSTRAINT calc_block_progress_bitmap_shape_check CHECK (
      (coverage_kind = 'formula'
       AND formula_covered_bits IS NOT NULL AND formula_within_target_bits IS NOT NULL
       AND formula_fluent_bits IS NOT NULL AND formula_mastered_bits IS NOT NULL
       AND structure_covered_bits IS NULL AND structure_fluent_bits IS NULL
       AND structure_mastered_bits IS NULL
       AND octet_length(formula_covered_bits) = (universe_size + 7) / 8
       AND octet_length(formula_within_target_bits) = (universe_size + 7) / 8
       AND octet_length(formula_fluent_bits) = (universe_size + 7) / 8
       AND octet_length(formula_mastered_bits) = (universe_size + 7) / 8)
      OR
      (coverage_kind = 'structure'
       AND formula_covered_bits IS NULL AND formula_within_target_bits IS NULL
       AND formula_fluent_bits IS NULL AND formula_mastered_bits IS NULL
       AND structure_covered_bits IS NOT NULL AND structure_fluent_bits IS NOT NULL
       AND structure_mastered_bits IS NOT NULL
       AND octet_length(structure_covered_bits) = (universe_size + 7) / 8
       AND octet_length(structure_fluent_bits) = (universe_size + 7) / 8
       AND octet_length(structure_mastered_bits) = (universe_size + 7) / 8)
    ),
    CONSTRAINT calc_block_progress_bit_counts_fit CHECK (
      covered_count = bit_count(CASE WHEN coverage_kind = 'formula' THEN formula_covered_bits ELSE structure_covered_bits END)
      AND fluent_count = bit_count(CASE WHEN coverage_kind = 'formula' THEN formula_fluent_bits ELSE structure_fluent_bits END)
      AND mastered_count = bit_count(CASE WHEN coverage_kind = 'formula' THEN formula_mastered_bits ELSE structure_mastered_bits END)
      AND (coverage_kind = 'structure' OR within_target_count = bit_count(formula_within_target_bits))
    )
);
CREATE INDEX calc_block_progress_user_health_idx
  ON public.calc_block_progress (user_id, health_status, updated_at DESC);
CREATE INDEX calc_block_progress_registry_fk_idx
  ON public.calc_block_progress (block_id, curriculum_version);
ALTER TABLE public.calc_block_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY calc_block_progress_select_own ON public.calc_block_progress
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.calc_block_progress TO authenticated;

--
-- PostgreSQL database dump complete
--

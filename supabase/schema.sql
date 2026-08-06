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
-- Name: increment_math_solved(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_math_solved(p_user_id uuid, p_prob_id text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
  DECLARE new_count integer;
  BEGIN
    INSERT INTO math_solved (user_id, problem_id, solve_count, solved_at)
    VALUES (p_user_id, p_prob_id, 1, now())
    ON CONFLICT (user_id, problem_id)
    DO UPDATE SET
      solve_count = math_solved.solve_count + 1,
      solved_at   = now()
    RETURNING solve_count INTO new_count;
    RETURN new_count;
  END;
  $$;


--
-- Name: math_wrong_clear_resolved_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.math_wrong_clear_resolved_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.resolved := false;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;


--
-- Name: upsert_math_scratch_working(text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_math_scratch_working(p_problem_id text, p_paper_scope text, p_objects jsonb, p_answer_draft jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: calc_mistakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_mistakes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    signature text NOT NULL,
    display text NOT NULL,
    answer integer NOT NULL,
    level text NOT NULL,
    category text NOT NULL,
    last_wrong_at timestamp with time zone DEFAULT now() NOT NULL,
    consecutive_correct smallint DEFAULT 0 NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    session_no integer,
    answer_json jsonb,
    user_answer text,
    error_tag text,
    CONSTRAINT calc_mistakes_category_check CHECK ((category = ANY (ARRAY['addsub'::text, 'muldiv'::text, 'mixed'::text])))
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
-- Name: calc_mistakes calc_mistakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_mistakes
    ADD CONSTRAINT calc_mistakes_pkey PRIMARY KEY (id);


--
-- Name: calc_mistakes calc_mistakes_user_id_signature_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_mistakes
    ADD CONSTRAINT calc_mistakes_user_id_signature_key UNIQUE (user_id, signature);


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
-- Name: calc_mistakes_user_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_mistakes_user_resolved_idx ON public.calc_mistakes USING btree (user_id, resolved, last_wrong_at DESC);


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
-- Name: idx_math_practice_attempts_user_problem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_math_practice_attempts_user_problem ON public.math_practice_attempts USING btree (user_id, problem_id, attempted_at DESC);


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
-- Name: calc_mistakes calc_mistakes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_mistakes
    ADD CONSTRAINT calc_mistakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: flipbook_books Authenticated delete flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated delete flipbook_books" ON public.flipbook_books FOR DELETE TO authenticated USING (true);


--
-- Name: math_problem_images Authenticated delete math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated delete math_problem_images" ON public.math_problem_images FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: reading_passage_media Authenticated delete reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated delete reading_passage_media" ON public.reading_passage_media FOR DELETE TO authenticated USING (true);


--
-- Name: flipbook_books Authenticated insert flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert flipbook_books" ON public.flipbook_books FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: math_problem_images Authenticated insert math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert math_problem_images" ON public.math_problem_images FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND (image_kind = ANY (ARRAY['analysis'::text, 'figure'::text, 'summary'::text])) AND (((image_kind = ANY (ARRAY['analysis'::text, 'figure'::text])) AND (problem_id ~~ (lesson_id || '-%'::text)) AND (((image_kind = 'analysis'::text) AND (storage_path ~~ (('analysis/'::text || lesson_id) || '/%'::text))) OR ((image_kind = 'figure'::text) AND (storage_path ~~ (('figures/'::text || lesson_id) || '/%'::text))))) OR ((image_kind = 'summary'::text) AND (problem_id = (lesson_id || '__SUMMARY'::text)) AND (storage_path ~~ (('summaries/'::text || lesson_id) || '/summary.%'::text))))));


--
-- Name: reading_passage_media Authenticated insert reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert reading_passage_media" ON public.reading_passage_media FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: flipbook_books Authenticated read all flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read all flipbook_books" ON public.flipbook_books FOR SELECT TO authenticated USING (true);


--
-- Name: reading_passage_media Authenticated read reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read reading_passage_media" ON public.reading_passage_media FOR SELECT TO authenticated USING (true);


--
-- Name: flipbook_books Authenticated update flipbook_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated update flipbook_books" ON public.flipbook_books FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: math_problem_images Authenticated update math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated update math_problem_images" ON public.math_problem_images FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND (image_kind = ANY (ARRAY['analysis'::text, 'figure'::text, 'summary'::text])) AND (((image_kind = ANY (ARRAY['analysis'::text, 'figure'::text])) AND (problem_id ~~ (lesson_id || '-%'::text)) AND (((image_kind = 'analysis'::text) AND (storage_path ~~ (('analysis/'::text || lesson_id) || '/%'::text))) OR ((image_kind = 'figure'::text) AND (storage_path ~~ (('figures/'::text || lesson_id) || '/%'::text))))) OR ((image_kind = 'summary'::text) AND (problem_id = (lesson_id || '__SUMMARY'::text)) AND (storage_path ~~ (('summaries/'::text || lesson_id) || '/summary.%'::text))))));


--
-- Name: reading_passage_media Authenticated update reading_passage_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated update reading_passage_media" ON public.reading_passage_media FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: math_problem_images Public read math_problem_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read math_problem_images" ON public.math_problem_images FOR SELECT USING (true);


--
-- Name: math_weekly_plans Users can delete own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own math_weekly_plans" ON public.math_weekly_plans FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: weekly_plans Users can delete own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own weekly_plans" ON public.weekly_plans FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: math_weekly_plans Users can insert own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own math_weekly_plans" ON public.math_weekly_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: weekly_plans Users can insert own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own weekly_plans" ON public.weekly_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_weekly_plans Users can read own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own math_weekly_plans" ON public.math_weekly_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: weekly_plans Users can read own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own weekly_plans" ON public.weekly_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: math_weekly_plans Users can update own math_weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own math_weekly_plans" ON public.math_weekly_plans FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: weekly_plans Users can update own weekly_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own weekly_plans" ON public.weekly_plans FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_rotating_review Users can manage their own rotating review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own rotating review" ON public.math_rotating_review USING (((auth.uid())::text = user_id)) WITH CHECK (((auth.uid())::text = user_id));


--
-- Name: flipbook_progress Users insert own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own flipbook_progress" ON public.flipbook_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: flipbook_progress Users read own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own flipbook_progress" ON public.flipbook_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: flipbook_progress Users update own flipbook_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own flipbook_progress" ON public.flipbook_progress FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: adaptive_plan_word_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adaptive_plan_word_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: adaptive_plan_word_progress adaptive_plan_word_progress_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adaptive_plan_word_progress_own ON public.adaptive_plan_word_progress USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: adaptive_word_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adaptive_word_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: adaptive_word_plans adaptive_word_plans_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adaptive_word_plans_own ON public.adaptive_word_plans USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY "authenticated can read audio_assets" ON public.audio_assets FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: audio_playlist_items authenticated can read audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audio_playlist_items" ON public.audio_playlist_items FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: audio_playlists authenticated can read audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audio_playlists" ON public.audio_playlists FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: calc_mistakes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_mistakes ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_mistakes calc_mistakes_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_mistakes_modify_own ON public.calc_mistakes USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_mistakes calc_mistakes_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_mistakes_select_own ON public.calc_mistakes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: calc_problem_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_problem_state ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_problem_state calc_problem_state_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_problem_state_modify_own ON public.calc_problem_state USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_problem_state calc_problem_state_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_problem_state_select_own ON public.calc_problem_state FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: calc_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_sessions calc_sessions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_sessions_insert_own ON public.calc_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_sessions calc_sessions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_sessions_select_own ON public.calc_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: calc_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_settings calc_settings_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_settings_modify_own ON public.calc_settings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_settings calc_settings_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_settings_select_own ON public.calc_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: calc_vouchers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_vouchers calc_vouchers_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_vouchers_modify_own ON public.calc_vouchers USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_vouchers calc_vouchers_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_vouchers_select_own ON public.calc_vouchers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chinese_char_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_char_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_char_entries chinese_char_entries_mutate_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_mutate_auth ON public.chinese_char_entries TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chinese_char_entries chinese_char_entries_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_entries_select_auth ON public.chinese_char_entries FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_char_mastery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_char_mastery ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_char_mastery chinese_char_mastery_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_delete_own ON public.chinese_char_mastery FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_insert_own ON public.chinese_char_mastery FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_select_own ON public.chinese_char_mastery FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chinese_char_mastery chinese_char_mastery_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_char_mastery_update_own ON public.chinese_char_mastery FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chinese_lesson_chars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_lesson_chars ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_lesson_chars chinese_lesson_chars_mutate_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_mutate_auth ON public.chinese_lesson_chars TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chinese_lesson_chars chinese_lesson_chars_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lesson_chars_select_auth ON public.chinese_lesson_chars FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_lessons chinese_lessons_mutate_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_mutate_auth ON public.chinese_lessons TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chinese_lessons chinese_lessons_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_lessons_select_auth ON public.chinese_lessons FOR SELECT TO authenticated USING (true);


--
-- Name: chinese_reading_recordings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_reading_recordings ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_reading_recordings chinese_reading_recordings_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_delete_own ON public.chinese_reading_recordings FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chinese_reading_recordings chinese_reading_recordings_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_insert_own ON public.chinese_reading_recordings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_reading_recordings chinese_reading_recordings_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_reading_recordings_select_own ON public.chinese_reading_recordings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chinese_roadmap_plan_lesson_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_roadmap_plan_lesson_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_roadmap_plan_lesson_runs chinese_roadmap_plan_lesson_runs_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_roadmap_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_roadmap_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_roadmap_plans chinese_roadmap_plans_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_roadmap_plans_own ON public.chinese_roadmap_plans USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_weekly_plans chinese_weekly_plans_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_delete_own ON public.chinese_weekly_plans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_insert_own ON public.chinese_weekly_plans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_select_own ON public.chinese_weekly_plans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chinese_weekly_plans chinese_weekly_plans_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_weekly_plans_update_own ON public.chinese_weekly_plans FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_delete_own ON public.chinese_wrong_items FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_insert_own ON public.chinese_wrong_items FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chinese_wrong_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chinese_wrong_items ENABLE ROW LEVEL SECURITY;

--
-- Name: chinese_wrong_items chinese_wrong_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_select_own ON public.chinese_wrong_items FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chinese_wrong_items chinese_wrong_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chinese_wrong_update_own ON public.chinese_wrong_items FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY english_wrong_delete_own ON public.english_wrong FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: english_wrong english_wrong_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_insert_own ON public.english_wrong FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: english_wrong english_wrong_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_select_own ON public.english_wrong FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: english_wrong english_wrong_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY english_wrong_update_own ON public.english_wrong FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: flipbook_books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flipbook_books ENABLE ROW LEVEL SECURITY;

--
-- Name: flipbook_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flipbook_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: math_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: math_favorites math_favorites_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_delete_own ON public.math_favorites FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: math_favorites math_favorites_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_insert_own ON public.math_favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_favorites math_favorites_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_favorites_select_own ON public.math_favorites FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: math_practice_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_practice_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: math_practice_attempts math_practice_attempts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_delete ON public.math_practice_attempts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_insert ON public.math_practice_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_select ON public.math_practice_attempts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: math_practice_attempts math_practice_attempts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_practice_attempts_update ON public.math_practice_attempts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY math_problem_notes_delete ON public.math_problem_notes FOR DELETE TO authenticated USING (true);


--
-- Name: math_problem_notes math_problem_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_insert ON public.math_problem_notes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_problem_notes math_problem_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_select ON public.math_problem_notes FOR SELECT TO authenticated USING (true);


--
-- Name: math_problem_notes math_problem_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_problem_notes_update ON public.math_problem_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: math_quiz_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_quiz_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: math_quiz_batches math_quiz_batches_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_quiz_batches_user ON public.math_quiz_batches USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_quiz_papers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_quiz_papers ENABLE ROW LEVEL SECURITY;

--
-- Name: math_quiz_papers math_quiz_papers_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_quiz_papers_user ON public.math_quiz_papers USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY math_scratch_drafts_delete ON public.math_scratch_drafts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_insert ON public.math_scratch_drafts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_select ON public.math_scratch_drafts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: math_scratch_drafts math_scratch_drafts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_drafts_update ON public.math_scratch_drafts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_scratch_working; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_scratch_working ENABLE ROW LEVEL SECURITY;

--
-- Name: math_scratch_working math_scratch_working_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_delete ON public.math_scratch_working FOR DELETE USING (((auth.uid())::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_insert ON public.math_scratch_working FOR INSERT WITH CHECK (((auth.uid())::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_select ON public.math_scratch_working FOR SELECT USING (((auth.uid())::text = (user_id)::text));


--
-- Name: math_scratch_working math_scratch_working_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_scratch_working_update ON public.math_scratch_working FOR UPDATE USING (((auth.uid())::text = (user_id)::text)) WITH CHECK (((auth.uid())::text = (user_id)::text));


--
-- Name: math_skipped; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_skipped ENABLE ROW LEVEL SECURITY;

--
-- Name: math_skipped math_skipped_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY math_skipped_own ON public.math_skipped USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY math_weekly_lesson_review_own ON public.math_weekly_lesson_review TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY practice_pending_sessions_own ON public.practice_pending_sessions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


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

CREATE POLICY quiz_scratch_links_own ON public.math_quiz_scratch_links USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: reading_passage_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reading_passage_media ENABLE ROW LEVEL SECURITY;

--
-- Name: star_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.star_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: star_sessions star_sessions_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY star_sessions_own ON public.star_sessions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: word_mastery user_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_own ON public.word_mastery USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: problem_mastery users can manage own problem mastery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can manage own problem mastery" ON public.problem_mastery USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: audio_assets users delete own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_assets" ON public.audio_assets FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: audio_playlist_items users delete own audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_playlist_items" ON public.audio_playlist_items FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: audio_playlists users delete own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own audio_playlists" ON public.audio_playlists FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: audio_assets users insert own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_assets" ON public.audio_assets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: audio_playlist_items users insert own audio_playlist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_playlist_items" ON public.audio_playlist_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: audio_playlists users insert own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audio_playlists" ON public.audio_playlists FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: daily_progress users manage own daily_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own daily_progress" ON public.daily_progress USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_solved users manage own math_solved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own math_solved" ON public.math_solved USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_wrong users manage own math_wrong; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own math_wrong" ON public.math_wrong USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: problem_mastery users manage own problem_mastery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own problem_mastery" ON public.problem_mastery USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: word_mastery users manage own word_mastery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own word_mastery" ON public.word_mastery USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: math_wrong users manage own wrong; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own wrong" ON public.math_wrong USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: audio_assets users update own audio_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own audio_assets" ON public.audio_assets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: audio_playlists users update own audio_playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own audio_playlists" ON public.audio_playlists FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: daily_progress users_own_daily; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_daily ON public.daily_progress USING ((auth.uid() = user_id));


--
-- Name: math_solved users_own_math; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_math ON public.math_solved USING ((auth.uid() = user_id));


--
-- Name: word_entries users_own_words; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_words ON public.word_entries USING ((auth.uid() = creator));


--
-- Name: voucher_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voucher_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: voucher_templates voucher_templates_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voucher_templates_all_authenticated ON public.voucher_templates USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: word_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.word_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: word_mastery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.word_mastery ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



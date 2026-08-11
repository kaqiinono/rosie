# Supabase Database Advisor audit — 2026-08-11

This is the durable ledger for every `WARN` or `ERROR` reported by
`supabase db advisors --type all --level warn` against project
`yvukypevtqblhjdhkatb`. Raw advisor output contained 8 security findings and
254 performance rows. Performance rows repeat inherited roles; after grouping
by finding type and database object they represent 61 unique object groups.

Status meanings:

- **Fixed in 0008** — included in `0008_harden_database_advisor_findings.sql`.
- **Deferred** — intentionally not changed yet; the reason and next action are recorded.
- **Accepted** — intentionally retained with documented rationale.

## Security findings (8/8 recorded)

| ID | Advisor finding | Object | Status | Decision / next action |
|---|---|---|---|---|
| SEC-001 | `rls_disabled_in_public` (ERROR) | `public.schema_migrations` | Fixed in 0008 | Enable RLS and revoke Data API roles; the direct migration runner remains able to use it. |
| SEC-002 | `rls_policy_always_true` | `math_problem_notes.math_problem_notes_update` | Fixed in 0008 | Restrict update to owner or admin and add the same `WITH CHECK`. |
| SEC-003 | `rls_policy_always_true` | `math_problem_notes.math_problem_notes_delete` | Fixed in 0008 | Restrict delete to owner or admin. |
| SEC-004 | `function_search_path_mutable` | `public.increment_math_solved(uuid,text)` | Fixed in 0008 | Empty search path, qualified objects, and authenticated-only RPC execution. |
| SEC-005 | `function_search_path_mutable` | `public.knowledge_chunks_update_content_tsv()` | Fixed in 0008 | Empty search path, qualified built-ins, and direct execution revoked. |
| SEC-006 | `function_search_path_mutable` | `public.math_wrong_clear_resolved_on_insert()` | Fixed in 0008 | Empty search path and direct execution revoked. |
| SEC-007 | `extension_in_public` | `vector` | Deferred | Moving an installed extension can rewrite dependencies used by RAG indexes/functions. Plan and test this on a restored database before production. |
| SEC-008 | `extension_in_public` | `pg_trgm` | Deferred | Same dependency risk; move together with the RAG extension migration after restore testing. |

## Performance findings (61/61 object groups recorded)

### PERF-001 — RLS auth initialization plans (47 object groups)

Advisor finding: `auth_rls_initplan`. Policies call `auth.uid()`, `auth.jwt()`,
or another auth function directly, which can be evaluated once per row. Replace
with scalar subqueries such as `(SELECT auth.uid())`.

`math_problem_notes` is fixed in 0008 for INSERT/UPDATE/DELETE. The remaining
tables are deferred to small, lock-bounded migration batches because replacing
many policies at once acquires DDL locks and previously caused a production
deadlock. Each batch must preserve policy command, roles, `USING`, and
`WITH CHECK` exactly.

Affected objects (all 47):

1. `math_solved`
2. `word_entries`
3. `daily_progress`
4. `math_wrong`
5. `word_mastery`
6. `problem_mastery`
7. `chinese_wrong_items`
8. `math_rotating_review`
9. `calc_settings`
10. `calc_sessions`
11. `calc_mistakes`
12. `calc_vouchers`
13. `flipbook_progress`
14. `calc_problem_state`
15. `audio_assets`
16. `english_wrong`
17. `star_sessions`
18. `voucher_templates`
19. `flipbook_books`
20. `chinese_char_mastery`
21. `math_weekly_plans`
22. `reading_passage_media`
23. `chinese_weekly_plans`
24. `chinese_reading_recordings`
25. `math_problem_images`
26. `audio_playlists`
27. `audio_playlist_items`
28. `math_favorites`
29. `knowledge_documents`
30. `math_problem_notes` (mutating policies fixed in 0008; recheck SELECT after advisor rerun)
31. `math_quiz_scratch_links`
32. `knowledge_chunks`
33. `math_quiz_batches`
34. `math_quiz_papers`
35. `knowledge_imports`
36. `ai_conversations`
37. `chinese_roadmap_plans`
38. `adaptive_word_plans`
39. `adaptive_plan_word_progress`
40. `math_skipped`
41. `practice_pending_sessions`
42. `math_practice_attempts`
43. `chinese_roadmap_plan_lesson_runs`
44. `math_weekly_lesson_review`
45. `math_scratch_drafts`
46. `math_scratch_working`
47. `weekly_plans`

### PERF-002 — Multiple permissive policies (13 object groups)

Advisor finding: `multiple_permissive_policies`. **Fixed in 0009.** Equivalent
legacy policies were consolidated. Calc and user-data policies retained the
same ownership predicates; Chinese admin `ALL` policies and the word-entry
owner `ALL` policy were split into INSERT/UPDATE/DELETE policies so their
existing SELECT policies remain the sole read rules.

Affected objects (all 13):

1. `calc_mistakes`
2. `calc_problem_state`
3. `calc_settings`
4. `calc_vouchers`
5. `chinese_char_entries`
6. `chinese_lesson_chars`
7. `chinese_lessons`
8. `daily_progress`
9. `math_solved`
10. `math_wrong`
11. `problem_mastery`
12. `word_entries`
13. `word_mastery`

### PERF-003 — Duplicate index (1 object group)

| Object | Indexes | Status | Decision / next action |
|---|---|---|---|
| `math_practice_attempts` | `idx_math_practice_attempts_user_problem`, `idx_practice_attempts_user_problem_time` | Fixed in 0010 | Definitions were identical and neither backed a constraint. Retained `idx_practice_attempts_user_problem_time` (450 observed scans) and removed `idx_math_practice_attempts_user_problem` (5 scans, 16 kB). |

## Migration history reconciliation

The repository uses its own `NNNN_*.sql` migration runner rather than Supabase
CLI timestamp migrations. Production originally recorded only `0001` and
`0002`, although the objects and policies from `0003` through `0006` were
already present. On 2026-08-11 all declared policies/key objects were verified,
then versions `0003`–`0006` were inserted into `public.schema_migrations` with
`ON CONFLICT DO NOTHING`. No historical DDL was replayed.

The RAG hardening migration initially had a timestamp filename that the custom
runner ignores. Before running pending migrations it was renamed, without SQL
content loss, to `0007_harden_rag_sync_and_search.sql`; the advisor remediation
therefore uses version `0008` so its stricter function settings run last.

## Verification checklist for 0008

- `schema_migrations`: RLS enabled; no privileges for `anon`, `authenticated`, or `service_role`.
- `math_problem_notes`: authenticated SELECT remains shared; INSERT is owner-only; UPDATE/DELETE are owner-or-admin.
- All three functions have `search_path=''`.
- Trigger functions cannot be invoked by API roles.
- `increment_math_solved` remains executable by `authenticated` and `service_role`, not `anon`.
- Re-run security and performance advisors and update statuses/counts above.

## Post-migration verification result

Verified against production after `0007` and `0008` were committed by the
custom runner:

- Migration history contains every version from `0001` through `0008`.
- Security advisor findings decreased from **8 to 2**. The only remaining
  findings are SEC-007 (`vector`) and SEC-008 (`pg_trgm`), both explicitly
  deferred above. No new security finding was introduced.
- Performance advisor output decreased from **254 raw rows / 61 unique object
  groups** to **253 raw rows / 60 unique object groups**:
  - `auth_rls_initplan`: 46 remaining (down from 47)
  - `multiple_permissive_policies`: 13 remaining
  - `duplicate_index`: 1 remaining
- `schema_migrations` has RLS enabled and its ACL contains only `postgres`.
- All three remediated functions have `search_path=''`; trigger functions are
  not executable by API roles; `increment_math_solved` is executable only by
  `authenticated` and `service_role` among API roles.
- `math_problem_notes` keeps authenticated shared read access. INSERT is owner-
  only; UPDATE and DELETE are owner-or-admin; all seven existing rows have a
  non-null owner.

## Post-0009 verification result

`0009_consolidate_duplicate_rls_policies.sql` was applied as a single
transaction with a five-second lock timeout. All 13 PERF-002 object groups were
verified in `pg_policies`, then Database Advisors were rerun:

- Security findings remain **2**, both intentionally deferred extensions.
- Performance output decreased from **253 raw rows / 60 unique groups** to
  **81 raw rows / 37 unique groups**.
- `multiple_permissive_policies`: **13 → 0**.
- `auth_rls_initplan`: **46 → 36**. Besides the earlier `math_problem_notes`
  fix, 0009 removed this finding from `calc_mistakes`, `calc_problem_state`,
  `calc_settings`, `calc_vouchers`, `daily_progress`, `math_solved`,
  `math_wrong`, `problem_mastery`, `word_entries`, and `word_mastery`.
- `duplicate_index`: **1** remains and is still tracked as PERF-003.

The exact 36 remaining `auth_rls_initplan` objects are:

1. `adaptive_plan_word_progress`
2. `adaptive_word_plans`
3. `ai_conversations`
4. `audio_assets`
5. `audio_playlist_items`
6. `audio_playlists`
7. `calc_sessions`
8. `chinese_char_mastery`
9. `chinese_reading_recordings`
10. `chinese_roadmap_plan_lesson_runs`
11. `chinese_roadmap_plans`
12. `chinese_weekly_plans`
13. `chinese_wrong_items`
14. `english_wrong`
15. `flipbook_books`
16. `flipbook_progress`
17. `knowledge_chunks`
18. `knowledge_documents`
19. `knowledge_imports`
20. `math_favorites`
21. `math_practice_attempts`
22. `math_problem_images`
23. `math_quiz_batches`
24. `math_quiz_papers`
25. `math_quiz_scratch_links`
26. `math_rotating_review`
27. `math_scratch_drafts`
28. `math_scratch_working`
29. `math_skipped`
30. `math_weekly_lesson_review`
31. `math_weekly_plans`
32. `practice_pending_sessions`
33. `reading_passage_media`
34. `star_sessions`
35. `voucher_templates`
36. `weekly_plans`

## Post-0010 verification result

The duplicate-index definitions, constraint dependencies, usage counters, and
sizes were inspected before `0010_drop_duplicate_practice_attempt_index.sql`
ran. The migration completed successfully and advisors were rerun:

- Security: **2** findings (`vector`, `pg_trgm`), both deferred above.
- Performance: **80 raw rows / 36 unique groups**.
- `duplicate_index`: **1 → 0**.
- `multiple_permissive_policies`: remains **0**.
- The only remaining performance category is `auth_rls_initplan`, covering the
  exact 36-object list above.

## RLS init-plan batches 0011–0014

The remaining 36 `auth_rls_initplan` object groups were processed in three
independent, lock-bounded batches of 12 tables. `ALTER POLICY` preserved policy
commands and unspecified clauses while replacing direct auth calls with scalar
subqueries. Deprecated `auth.role()` read checks were replaced with explicit
`TO authenticated` policies.

Making `voucher_templates` authentication explicit revealed that its legacy
`ALL` policy allowed every authenticated user to mutate the shared catalog.
Application usage showed learner pages only require SELECT, while catalog
mutations belong to `/admin/awards`; `0014` therefore retains authenticated
read access and restricts INSERT/UPDATE/DELETE to `public.is_admin()`.

Final advisor verification after `0014`:

- Performance advisor at `WARN` or higher: **0 issues**.
- Security advisor at `WARN` or higher: **2 issues**, exactly SEC-007 (`vector`)
  and SEC-008 (`pg_trgm`), both intentionally deferred and documented above.
- No `auth_rls_initplan`, `multiple_permissive_policies`, `duplicate_index`, or
  permissive voucher-template mutation finding remains.

## Migration-file reconciliation (resolved by 0015)

Final Git inspection detected a separately created, untracked file:
`supabase/migrations/20260811030611_add_ai_teaching_sessions.sql`. The Rosie
migration runner only recognizes `NNNN_*.sql`, so this file is currently
ignored. It was not renamed, executed, or marked applied during this work
because its provenance and remote deployment state have not yet been audited.
Before the next database deployment, inspect its SQL and remote objects, then
either normalize it to the next `NNNN` version or document/remove it as an
obsolete artifact without replaying already-applied DDL.

Resolution: all 15 columns, six checks/keys, two indexes, four own-user RLS
policies, table grants, and zero-row state were verified against production.
The file was normalized to `0015_add_ai_teaching_sessions.sql`, made
lock-bounded and explicitly revoked from `anon`, then scheduled through the
standard runner for idempotent application and migration-history registration.

Post-0015 verification confirmed RLS enabled, four authenticated-only policies,
no anon SELECT/INSERT privilege, authenticated CRUD grants, zero performance
advisor findings, and no new security finding.

## 0016–0018 teaching-session and RPC reconciliation

The AI teaching UI introduced idempotent session creation. Migration
`0016_enforce_unique_active_ai_teaching_session.sql` adds a partial unique index on
`(user_id, conversation_id, subject)` for active sessions, closing the remaining retry/concurrency
race. The application store first reuses an existing row and also recovers from PostgreSQL `23505`.

The linked CLI direct database connection remained unavailable, but the authenticated Supabase MCP
channel succeeded. It revealed a migration-history entry named
`enforce_unique_active_ai_teaching_session` while the intended canonical index did not exist. A
different, out-of-band index named `uq_ai_teaching_sessions_active_conversation_subject` already
had the same unique columns and predicate. There were zero duplicate active-session groups.

The canonical `ai_teaching_sessions_one_active_conversation_idx` was applied and verified unique.
Migration `0017_reconcile_ai_index_and_scratch_rpc_grants.sql` then removed the identically defined
legacy index and revoked anonymous execution of `upsert_math_scratch_working` while preserving the
authenticated and service-role grants.

The security advisor then showed that authenticated execution of the function remained flagged
because it was `SECURITY DEFINER`. The target table has RLS enabled, authenticated SELECT/INSERT/
UPDATE privileges, and own-user policies for all writes, so elevated execution was unnecessary.
Migration `0018_make_scratch_working_rpc_security_invoker.sql` changed it to `SECURITY INVOKER`.

Final verification:

- Canonical teaching-session unique index exists; legacy duplicate index does not.
- `upsert_math_scratch_working`: `security_definer = false`, anon EXECUTE = false,
  authenticated/service-role EXECUTE = true.
- A transaction-scoped authenticated RPC call wrote one own-user row successfully under RLS;
  rollback was confirmed separately with a zero-row check, so no test data remains.
- Performance advisor at `WARN` or higher: **0 issues**.
- Security advisor at `WARN` or higher: **3 issues**: the two intentionally deferred extension
  findings (`vector`, `pg_trgm`) and disabled Auth leaked-password protection.
- Leaked-password protection requires enabling in Supabase Dashboard → Authentication → Security;
  no Auth configuration mutation tool was available in this session, so it remains explicitly
  deferred rather than silently omitted.
- The owner manually enabled CAPTCHA protection under Attack Protection. A subsequent Security
  advisor run still reported `auth_leaked_password_protection`, confirming CAPTCHA and leaked-
  password checks are independent controls. The leaked-password setting remains disabled.
- Attempting to enable `Prevent use of leaked passwords` returned Supabase's plan-gate error:
  the HaveIBeenPwned integration is available only on Pro and above. The project will not be
  upgraded implicitly; this WARN is therefore accepted under the current plan and should be
  revisited only if the project moves to Pro.

Final INFO-level findings were also retained rather than treated as failures:

- `rls_enabled_no_policy`: `api_rate_limits`, `schema_migrations`. Both are internal/no-client-
  policy tables; RLS intentionally denies Data API access by default.
- `unindexed_foreign_keys` (12): `audio_playlist_items.asset_id`,
  `audio_playlist_items.user_id`, `chinese_lesson_chars.char_key`,
  `flipbook_progress.book_id`, `math_practice_attempts.draft_id`,
  `math_practice_attempts.paper_id`, `math_problem_images.user_id`,
  `math_problem_notes.user_id`, `math_quiz_scratch_links.draft_id`,
  `math_quiz_scratch_links.user_id`, `math_wrong.last_wrong_attempt_id`,
  `word_entries.creator`. Review found the largest relevant tables were `word_entries` (~2,219 rows,
  1.39 MB) and `chinese_lesson_chars` (~2,064 rows, 0.59 MB); `math_problem_images` had ~280 rows,
  attempts ~88, wrong items ~26, and the rest were tiny or not yet analyzed. Existing primary/
  compound indexes cover the dominant application reads, while these findings primarily concern
  parent-delete maintenance. Adding all 12 now would trade small sequential scans for write
  amplification and immediately create low-signal unused indexes, so they remain measured INFO
  items pending growth or slow-query evidence.
- `unused_index` (16): `knowledge_documents_owner_idx`, `knowledge_chunks_user_idx`,
  `knowledge_imports_user_idx`, `ai_conversations_user_idx`,
  `math_problem_notes_lesson_id_idx`, `idx_practice_pending_user`,
  `voucher_templates_archived_idx`, `idx_chinese_reading_recordings_user_created`,
  `idx_chinese_roadmap_plan_runs_plan_lesson`, `knowledge_chunks_embedding_idx`,
  `knowledge_chunks_content_trgm_idx`, `reading_passage_media_user_id_idx`,
  `audio_playlists_user_id_idx`, `idx_math_scratch_drafts_user_problem`,
  `ai_conversations_session_idx`, `ai_teaching_sessions_conversation_idx`.
  No index was removed solely because fresh/low-traffic statistics report it unused.

The CLI's first `migration new` invocation also created an empty file outside this repository at
`/Users/meinuo/supabase/migrations/20260811034439_enforce_unique_active_ai_teaching_session.sql`
because no explicit `--workdir` was supplied. After explicit authorization, its zero-byte size was
verified and the file was deleted; a follow-up existence check passed. The valid repository
migration was created with `--workdir` and normalized to the Rosie `NNNN_*.sql` convention.

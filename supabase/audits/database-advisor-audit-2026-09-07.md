# Supabase Database Advisor audit — 2026-09-07

Run after applying `20260907052259_add_calc_report_projection.sql`,
`20260907055523_extend_calc_report_sources.sql`, and
`20260907060123_fix_calc_ability_stable_rollup.sql` to project
`yvukypevtqblhjdhkatb`. The advisor returned six warnings and no errors. The
report migration introduced no new unplanned finding.

| Finding                                              | Object                           | Status   | Rationale / next action                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extension_in_public`                                | `vector`                         | Deferred | Existing finding. Moving it can rewrite RAG dependencies; test against a restored database first.                                                                                                                                                                                                      |
| `extension_in_public`                                | `pg_trgm`                        | Deferred | Existing finding; move with the RAG extension migration after restore testing.                                                                                                                                                                                                                         |
| `anon_security_definer_function_executable`          | `compact_star_sessions(integer)` | Deferred | Existing unrelated function; harden in its owning rewards migration.                                                                                                                                                                                                                                   |
| `authenticated_security_definer_function_executable` | `compact_star_sessions(integer)` | Deferred | Existing unrelated function; harden in its owning rewards migration.                                                                                                                                                                                                                                   |
| `authenticated_security_definer_function_executable` | `settle_calc_session(jsonb)`     | Accepted | This is the authenticated transaction boundary for state, progress, report facets, session and reward writes. It checks `auth.uid()`, validates bounded payloads, locks the caller's runtime row, enforces revision/idempotency, uses an empty search path, and has `PUBLIC`/`anon` execution revoked. |
| `auth_leaked_password_protection`                    | Auth configuration               | Deferred | Existing project-level setting; enable after account-owner review because it changes sign-up/password-reset policy.                                                                                                                                                                                    |

Post-migration verification:

- `calc_problem_state`: 1,101/1,101 historical rows have report facets v1 across five users.
- `calc_block_progress`: every one of the five users has 16/16 healthy finite curricula.
- Authenticated-context RPC smoke: projection `complete=true`, 16 blocks, five concept groups,
  108 structure-cell rows, two observed rule groups and 311 recent audit questions for the
  largest history.
- Formula detail RPC returned 10 items at limit 10, a next cursor, and the same revision.
- Auxiliary RPC returned 35 ability curricula and 22 observed detail sources. Deduplicated
  structure stability returned 79 stable cells; every ability block remained within its denominator
  (`invalid_blocks=0`, maximum ratio `1.0`).

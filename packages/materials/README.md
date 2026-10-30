# Shared materials

`/materials` lists authenticated shared assets. Text/link creation is available now. Creator/admin may
edit metadata or archive; modifying content requires a new asset so tasks retain their original content.
`/tasks/materials` remains the private legacy recording/lesson-material screen.

The package only depends on core. App `TaskMaterialsBridge` injects concrete picker, course list and task
asset preview into the existing task/course UI. Subject is a default picker filter, not access control.
`CourseMaterialList` accepts a structural catalog projection and immutable current-event content.

## Database contracts (local migration pending)

- `material_assets`: shared authenticated SELECT, no browser DML. Server Tasks8/9 can insert Baidu/builtin
  assets with service role; `account_id,fs_id,version` uniquely identify provider versions. Never store tokens.
- `course_material_links`: owner-only SELECT; composite `(user_id,course_id)` FK, independent asset creator FK.
- `material_save_asset(p_input jsonb)` returns asset. New input kind=text/link, subject/title/text_content/href.
  Existing ID allows title/subject/status only; content replacement is rejected. Admin role uses app_metadata.
- `material_link_course(p_course uuid,p_links jsonb)` atomically upserts <=200 links and returns saved rows.
  Each contains asset_id,scope,role,sort_order. Scope keys validate against the user's immutable course catalog;
  math question keys must occur in real teaching-segment problem lists, never visible question numbers.
- `material_unlink_course(p_link uuid)` removes owned association only. Archived references stay readable.
- `material_refresh_pending(p_course uuid)` re-resolves pending active tasks under advisory lock seed228.
  Link writes call this atomically. Revision increments, append-only old task snapshot history and planning
  revision triggers remain authoritative. Selected/completed/cancelled histories are never cleared on unlink/archive.
- `task_instances.material_selector_snapshot` freezes the effective binding/pool selector at insertion or
  template revision. Pending refresh uses this snapshot, never a later mutable binding.
- `private.task_resolve_materials(user,course,scope,selector,content)` retains Task4's canonical signature.
  None returns not_required, explicit ready IDs or auto links matching immutable target content return selected,
  otherwise pending. No signed URL output. Scope is already resolved by the event matcher; content is the
  effective current/next target. Forecast Task11 uses injected `materials.resolve` with the same policy.

`MaterialScope` is all/unit(book+unit)/lessons(lesson_keys)/segments(segment_keys)/problems(problem_keys).
`MaterialContent` is lesson(key/book/unit), cursor(segment_key), problem_keys. SQL and TS resolution sort/dedupe
ready asset UUIDs. General links always apply; more specific links match the target content. Material roles
are descriptive and do not suppress activity generation. Pending materials retain full task demand.

Tasks8/9 must populate canonical assets only after server verification, use account_mismatch/pending for
unavailable transport, create new asset versions for replacements, and call owner refresh where appropriate.
They own provider preview/download/upload/scan. No Baidu transport is claimed by this package.

## Local verification

`pnpm --filter web exec vitest run tests/materials/material-access.test.ts`
`node scripts/tmp/task7-material-validation.mjs` uses disposable native PostgreSQL with the full task migration
chain plus the materials migration; dependencies are installed at `/private/tmp/task4-postgres` (see Tasks guide).
No env or remote database is used. SQL tests roll back. The temporary harness is diagnostics, not a public CLI.

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
  intentional generator revision, including binding-only explicit event revisions. Pending refresh uses
  this snapshot, never a later mutable binding or unrelated progress/metadata update. The insertion
  trigger only supplies a fallback for legacy/manual callers; it does not rebase updates.
- `private.task_resolve_materials(user,course,scope,selector,content)` retains Task4's canonical signature.
  None returns not_required, explicit ready IDs or auto links matching immutable target content return selected,
  otherwise pending. Independent once/weekly emission uses the same resolver; a null course supports
  explicit shared assets or none, while auto remains pending without a course. No signed URL output. Scope is already resolved by the event matcher; content is the
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


Review repair migration `20261030031333_tasks_material_resolution_repairs.sql` is forward-only.
The existing independent and event emitters write the exact effective selector with their material
result, preserving source identities, revision/history behavior and user lock228. `readyData()` awaits
the latest actual fetch promise shared by all hooks for the user (including automatic initial/retry
reads), then rejects recorded errors even while the session store retains ready display data.
Local focused regressions: `tests/materials/material-readiness.test.tsx`,
`supabase/tests/material-independent-generation.sql`, `supabase/tests/material-selector-revision.sql`.

## Directory import (Task8, local migration pending)

The shared library and course detail expose DirectoryImport with allowlisted root, relative path,
subject, target course, recursive option, folder inventory, partial/completed status, and scan-number
recovery. Candidates never write links automatically. Ambiguous and unmatched files remain selectable
for a deliberate course/unit/lesson/segment/real-question association. Confirmation reuses the <=200
atomic material_link_course RPC; unlink still only removes the owner's association.

Server allowlist: English/Chinese/math subject trees under `/airosie`, owned by
apps/web/src/lib/baidu-material-catalog.ts. No arbitrary drive-root input is accepted. POST
`/api/materials/baidu/scan` creates a durable user checkpoint first (cursor0); repeat unchanged
rootId/relativePath/recursive/subject plus sessionId/cursor to list one200-entry provider page.
GET `/api/materials/baidu/scan/{id}` restores the owner's current-account checkpoint. Session data
and credentials have no browser table privileges. Bounds are20000 entries,2000 queued folders and
100000 offset per directory. Failure retains the previous checkpoint and all prior links/assets.
A retry after a lost response can restore the latest revision with GET. Offset enumeration is not
a provider snapshot; even completed scans never infer missing-file archival.

Identity foundation for Task9: OAuth callback verifies exact provider uinfo.uk before storing tokens.
Service-only baidu_store_verified_credentials preserves generation for same-account reauthorization,
rotates generation for a switch, and marks old assets account_mismatch while keeping links. Ordinary
refresh retains account/generation. Existing credential rows without verified identity require admin
reauthorization for account-aware material access. Unknown identity fails closed.
getBaiduAccountContext returns server-only {accountId,generation,accessToken}. Task9 must capture this
before provider work and atomically compare BOTH identity and generation at publication, as
material_publish_scan does under the credential-row lock. SQL/session/JSON IDs remain exact strings;
parseBaiduJson quotes unsafe integer tokens before JSON.parse. Never stringify an already rounded ID.
Account-aware caches include generation. No provider token or dlink is returned by scan routes.

File delivery/upload remains Task9. Read permissions do not establish upload-root rights. Real uk
stability, root existence/permissions, offset consistency under concurrent changes, and provider
transport remain unverified without live authorization. No real provider or hosted DB call was used.

Local fixture verification: `pnpm --filter web exec vitest run tests/materials` and
`node scripts/tmp/task8-material-validation.mjs`. The latter installs the full predecessor task
migration chain plus OAuth/lease and Task8 into disposable native PostgreSQL, checks real RLS and
atomic batch-link rollback, and uses two actual connections for a switch racing scan publication.

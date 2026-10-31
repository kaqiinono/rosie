# Shared materials

`/materials` lists authenticated shared assets. Text/link creation is available now. Creator/admin may
edit metadata or archive; modifying content requires a new asset so tasks retain their original content.
`/tasks/materials` remains the private legacy recording/lesson-material screen.

The package only depends on core. App `TaskMaterialsBridge` injects concrete picker, course list and task
asset preview into the existing task/course UI. Subject is a default picker filter, not access control.
`CourseMaterialList` accepts a structural catalog projection and immutable current-event content.

## Database contracts (migrations applied 2026-10-31)

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
They own provider preview/download/upload/scan. Application-owned Baidu scan/upload/stream transport is implemented; live provider authorization and rollout remain unverified.

## Local verification

`pnpm --filter web exec vitest run tests/materials/material-access.test.ts`
`node scripts/tmp/task7-material-validation.mjs` uses disposable native PostgreSQL with the full task migration
chain plus the materials migration; dependencies are installed at `/private/tmp/task4-postgres` (see Tasks guide).
No env or remote database is used. SQL tests roll back. The temporary harness is diagnostics, not a public CLI.


Review repair migration `20261031020244_tasks_material_resolution_repairs.sql` is forward-only.
The existing independent and event emitters write the exact effective selector with their material
result, preserving source identities, revision/history behavior and user lock228. `readyData()` awaits
the latest actual fetch promise shared by all hooks for the user (including automatic initial/retry
reads), then rejects recorded errors even while the session store retains ready display data.
Local focused regressions: `tests/materials/material-readiness.test.tsx`,
`supabase/tests/material-independent-generation.sql`, `supabase/tests/material-selector-revision.sql`.

## Directory import (Task8, migration applied 2026-10-31)

The shared library and course detail expose DirectoryImport with allowlisted root, relative path,
subject, target course, recursive option, folder inventory, partial/completed status, and scan-number
recovery. Candidates never write links automatically. Ambiguous and unmatched files remain selectable
for a deliberate course/unit/lesson/segment/real-question association. Confirmation reuses the <=200
atomic material_link_course RPC; unlink still only removes the owner's association.

Server allowlist: English/Chinese/math subject trees under `/airosie`, owned by
apps/web/src/lib/baidu-material-catalog.ts. No arbitrary drive-root input is accepted. POST
`/api/materials/baidu/scan` creates a durable user checkpoint first (cursor0); repeat unchanged
rootId/relativePath/recursive/subject plus sessionId/cursor to list one200-entry provider page.
GET `/api/materials/baidu/scan/{id}` restores current-account metadata and a bounded review page, never the durable queue/inventory. Session data
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


### Task8 review repair: bounded result transport and complete math stems

Provider enumeration and result browsing have independent cursors. POST start creates revision0;
DirectoryImport immediately performs the first continuation, keeping the checkpoint if listing fails.
Subsequent POSTs use `cursor` (the current enumeration revision). Each POST response returns only the
first result page. GET returns `sessionId`, revision/cursor/complete, fileCount/folderCount,
resultOffset/nextResultOffset, files/folders, rootId/relativePath/recursive/subject. No `state` or directory
queue is exposed. `GET ?offset=N&revision=R` reads further result pages without advancing enumeration;
nonzero offsets require the current matching revision. A stale revision returns409. GET without a
revision restores latest progress, and the UI's always-visible recovery action preserves reviewed
choices for that session. Cross-page choices retain exact account/fs identity and can be confirmed
atomically even while enumeration is partial. Browser rendering still uses20-row chunks.

Each response page contains at most100 total entries and120KiB UTF-8 serialized page data, leaving8KiB
for bounded recovery metadata. The complete GET JSON envelope has an explicit128KiB ceiling. Provider
paths longer than4096 characters are rejected before checkpoint publication; a byte budget also covers
long Unicode names/paths, so entry count alone is never used as the transport guarantee. Full durable
inventory and SQL account/generation/revision publication guards are unchanged. No database migration
was required for this transport repair; server-to-database checkpoint state remains accumulated.

Math problem aliases now match the complete NFC/case-normalized filename stem (final extension
removed), including full subquestion suffixes. No arbitrary trailing annotation is silently stripped.
Real lesson12 `1-12-L2` and `1-12-L2-1` aliases remain different. Identical complete aliases projected
from different question groups remain multiple candidates, never an automatic link.

### Task9 upload and private delivery

`BAIDU_MATERIAL_UPLOAD_ROOT` is required on the server. Configure the app's actual permitted write
root (ordinary app roots may be `/apps/<app>`); existing `/airosie` read access proves no write access.
`BAIDU_MATERIAL_MAX_BYTES` optionally lowers the default 2147483648-byte limit; zero-byte files are
explicitly unsupported. No root/write permission, account quota or deployment throughput is verified
by local fixtures. Provider permission failures remain errors; no optimistic ready asset is created.

Worker hashes one 4194304-byte slice at a time before any init request. Browser sends raw parts with
two lanes and three bounded attempts (500/1000ms backoff). Server validates exact length and MD5,
wraps the validated bytes in multipart `file` upstream, and keeps all credentials server-only.
Both precreate/create use the entire ordered manifest, even when provider requests only missing parts.
Unique server UUID paths and `rtype=0` prohibit deliberate overwrite. Returned renamed paths fail.

POST `/api/materials/uploads` reserves owner/account/generation session and returns its ID without
provider mutation. POST `/{id}/prepare` claims precreate exactly once. GET/DELETE `/{id}` query/cancel;
PUT `/{id}/parts/{index}` records a verified part; POST `/{id}/complete` returns session plus `asset`
when ready. The split reservation ensures UI receives a recoverable ID before precreate can mutate.
A response lost before reservation returns may leave only an empty orphan session, not a remote file.
Close/reload requires keeping the displayed session ID and selecting the original file/subject; full
manifest, size and name must match. Server sessions are not directly browser-readable tables.

Precreate/create unknown outcomes never automatically repeat their mutation. Repeated completion
checks exact unique path/ID/size and streams all bytes through ordered block MD5 verification. A
crash after claim but before create can leave no file: verification stays unconfirmed and the user
must cancel and start a new session. There is no guessed success, overwrite, provider deletion or
hidden retry. Cancelled sessions cannot publish; remote orphan files may remain. Ready publication
and account switching serialize on the same Task8 credential row before the session row. Refresh
keeps that identity/generation; actual account switches invalidate publication. No second identity
layer or OAuth change is needed. Native validation CLI: `node scripts/tmp/task9-material-validation.mjs`
(disposable local PostgreSQL; full21-migration prerequisite chain; no hosted writes).

`POST /api/materials/session` exchanges an authenticated bearer session for a strict HttpOnly cookie
scoped to `/api/materials`, enabling native img/audio/video/iframe/download requests. Every content
request validates the Supabase user again, reads the shared asset through RLS and checks the current
verified Baidu account. `/api/materials/{id}/content` streams with backpressure/cancellation, exact
Range/length validation, no-store, nosniff and sandbox CSP. Safe passive MIME allowlist supports
JPEG/PNG/GIF/WebP/AVIF, common audio/video and PDF; unknown/HTML/SVG are octet-stream attachments.
No dlink/token/redirect is sent to the browser. A first-match SW NetworkOnly rule covers ALL material
API destinations, including image and PDF navigation. Full-file downloads are real streams, never
one silently truncated range. Upstream ignoring Range fails. Late truncation errors the stream.

Local >6MiB reconstruction proves application streaming rather than deployed capacity. Content is
bounded by a280s upstream lifetime and300s function declaration; maximum-size downloads require
actual sustained throughput verification on the deployed plan. Expired sessions require refreshing
login and reopening preview. Cookie lifetime is at most1hour; expiry never grants public access.

Task13/15: readiness remains canonical `resolveMaterials` / `private.task_resolve_materials`: uploads
create NO asset until verification; pending/cancelled/uncertain uploads cannot clear a task's pending
material state. Completion refreshes the existing per-user session store before offering Task7 links.
Course linking supports all/unit/lesson/segment/full problem keys and preserves explicit selector
snapshots; never rebase task selectors after an unrelated link edit. No `/today` or subject progress
writes. Remaining deployment checks: real app capability/root/collision behavior, uk/refresh/switch,
upload-ID lifetime, quota, Range and redirects, native media codecs, sustained transfer and disconnects.

## Rollout

See `docs/baidu-materials.md` for actual routes/protocol/recovery and `docs/task-module-rollout.md` for mapping and operational switches. Existing private recordings/materials remain private. No migration publishes them. Local protocol/SQL/browser fixtures cannot establish live account permission, hosted scheduler delivery or deployment throughput.

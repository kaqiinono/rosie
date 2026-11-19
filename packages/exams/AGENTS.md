# @rosie/exams

> 最新状态（2026-11-13）：用户追加授权环境配置与迁移，七份考试迁移现已应用，私有录音桶已创建，本地版本已同步。见[环境与迁移记录](../../docs/exams-environment-status.md)。两套完整卷和两个 Trainer 训练包现已导入为草稿，私有解答已保存；早期单题样本未导入。图片可通过任务页裁切后自动绑定；音频仍手动绑定。审核、发布及应用运行验收仍未执行。

考一考 owns exam content contracts, versioned templates and its page bodies. Routes live in
`apps/web`. Workspace dependencies are only `@rosie/core`, `@rosie/ui` and `@rosie/player`;
never import English, Audio or AI. Internal imports are relative. The public barrel exports
pages, template metadata and **types only** for content/solutions. Pure runtime validators
have a separate `@rosie/exams/validation` entry point so server code does not load UI exports.

## Current scope

`/admin/exams/images` is the real image-task workspace: a draft/slot list, authenticated
original page with candidate crop, and electronic question-group preview. It reuses
`@rosie/ui` ImageCropper; grammar imports that shared primitive independently. Four current
bundles have 37 image slots (29 required), with 14 originals prepared in the private temporary
`/airosie/project/exam-image-sources`. Source access is admin-only/no-store; finished images upload to
Baidu and commit through the existing immutable media-binding RPC plus a crop receipt.
Actual crop coordinates, upload identity and leases live in service-only authoring tables.

Deleting a task retires only the authoring task and cleans its original page when no other
active draft task needs it. **Keep electronic questions, finished images and their bindings.**
Cleanup can remove unreferenced failed/replaced crop files created by this workspace, but
never files referenced by current revisions or historical attempts, or external manual files.
Database tombstones prevent new bindings while remote deletion is in progress. Cleanup
failures remain retryable. Retired tasks require an available original before restoration.
These operations do not approve or publish a paper. See `docs/exams-image-workbench.md`.

Image preparation now defaults to the user's approved reference-region workflow:
`scripts/prepare-exam-image-crops.mjs --apply --revision <id>` (or `--all-drafts`) crops
and saves unbound image slots through the existing source/version/lease/media RPC gates.
The CLI uses an actual administrator actor, skips bound/retired/unlocated tasks, and retains
private resumable request receipts. It is a write operation, not a test/check command.
Existing images open in review mode; only explicit recropping opens ImageCropper. Automatic
preparation adopts the authorized crop regions but does not approve content or publication.
`exam_image_task_reviews` stores independent human visual-review marks (pending/approved/flagged)
against the exact saved image snapshot. `/api/admin/exams/images/review` uses an administrator
and optimistic review version; replacement files revert to pending in the task projection.
The left task cards default to unresolved reviews. These marks neither re-upload images nor
replace formal content/publication reviews. Migration `20261113111944` is applied.

The current source implements the student catalog and complete-group practice at
`/exams/ket` and `/exams/ket/practice`, owner-bound attempts at `/exams/attempts/[id]`,
submitted-scope review at `/exams/attempts/[id]/review`, vocabulary review at
`/exams/review-words/[batchId]`, and 14/28-day reports at `/exams/reports`.
`/admin/exams` and `/admin/exams/[id]` manage content, review and publication;
`/admin/exams/attempts` requires an explicit user selection for manual assessment.
The root AuthGuard and existing AdminGuard protect pages; every server route independently
verifies the authenticated user and required role. Private data uses server projections,
not direct browser table access. Per-user session stores coordinate client reads.

These are implemented source paths, not a deployment or acceptance record. All new exam
migrations, content imports, media bindings/reviews, publication and runtime acceptance
remain unexecuted by this task. No reward, mastery, Boss or adaptive-plan writes are added.

`src/templates/ket-schools-2020-v1.ts` describes the agreed 7/5/2 Part structure,
30 reading and 25 listening objective questions, 2 writing tasks and 2 speaking Parts.
Mock reading/writing has a server-derived one-hour deadline. Listening uses the frozen,
reviewed finite audio program, including segments, repeats and waits; speaking records
elapsed time. The database clock controls cutoff, and expired work is settled using saved
answers. Technical interruption is an explicit state transition, not a new time allowance.
Template numeric rubric ranges are authored; publication still requires the relevant
source/rubric review. No official scaled score or pass prediction is defined.

`src/templates/pet-schools-2020-v1.ts` registers the B1 Preliminary for Schools draft
format with independent Reading, Writing, Listening and Speaking sections. Admin paper
preview uses one shared, non-reusable sentence pool for Reading Part 4, one writing
response editor for the selected Part 2 prompt, and separate Candidate A/B photographs
for Speaking Part 2. Speaking Part 3 has its own shared card. Test 1 is an unpublished
draft. Student PET attempts, timers and official scoring are outside this draft support.
See [PET Test 1 coverage](source-data/pet-schools-1/test-1-full/README.md).

## Content ownership

Generic, classification and handwriting question fields omit plain prompt text already rendered as the current activity's
instruction (exact whitespace-normalized text, optionally prefixed by its own `Exercise N.`).
Only instructions actually passed by the group renderer participate. Audio, images, answer
slots and annotated passages remain intact. Draft data and editor fields are not rewritten;
different wording remains visible, and standalone question views keep their complete prompts.
Example answer text already present in its prompt is not printed again; classification examples
still show their complete option set. Matching examples render in either the board or the
editable/review question fields, never both. Editor callbacks and review information remain intact.

Authored image `displayWidth` is a maximum CSS width; images use available container width
and retain their aspect ratio. Image choices opt into `AnswerChoiceGroup layout="images"`,
which wraps complete option cards using a 224–320px minimum based on the authored image
width, capped at 100% on smaller containers. Readability takes priority over a single row.
In student views and admin read-only preview, image actions open the containing activity in
`AppDialog presentation="fullscreen"`. This view removes authored image caps, retains the
same controlled answers and focuses the clicked image. Its transport controls use the existing
audio context: the sole PlayerDock/media element stays mounted outside the dialog. Mock
listening restrictions remain in effect. Admin edit mode does not offer the zoom action.
`ExamActivityFrame` consolidates repeated identical audio-slot references within each activity.
That icon, and any audio whose question text is already the instruction, sits at the right of
the instruction. The control shows only the headphone icon; the track label and binding status
stay in the accessible name. Different slots are never merged by
track label or file name, since they may have distinct segments or playback contracts.

Classification activities (judgment and letter choices, including audio P/F questions) use
borderless accent `StickerCard variant="soft"` surfaces in an auto-fit grid. Each scored
question shows a solid number badge; examples are content-width `variant="quote"` strips
(gray fill, left bar only). Minimum column
width accounts for the longest measured full prompt (including sentence prompts), 32px
choices, spacing and the authoring rail only in edit mode. There is no fixed long-prompt
minimum: reduce the column count before wrapping an otherwise fitting prompt/choice row.
The hidden measurement area is clipped so long sentences cannot widen the page. Text-only
scored groups with prompts of at most three
words/24 characters use shared measured regular 16px prompt widths and adjacent choices.
All letter/judgment prompts use row-first wrapping Flex, including sentences and examples;
choices move below only when the available width cannot fit them beside the prompt.
Quiet choices use gray resting fills and deep-blue selected fills with bold white lettering.
Examples appear first as content-width quote strips with the complete, non-interactive
option set. Only an explicit `exampleText` match marks a choice selected; otherwise all choices
remain neutral and the existing example text is retained. No answer is inferred. Handwriting uses the same soft
surfaces in an auto-fit grid with a 20rem minimum capped by container width. `ExamAlignedQuestion`
uses the same solid number badge as classification questions, top-aligned with the prompt, with
the amber Example badge for examples, and retains full-width word answers below it.
Paper type size follows the heading level: part, topic, then exercise instruction. Question
prompts, word-bank words and choice labels stay regular body text, smaller than the exercise
instruction. Generic admin/default questions use soft surfaces as well. Admin question/option regions reserve a separate 32px edit-control
column inside their card so authoring icons cannot cover answers. Student routes retain no edit rail.

Each exercise instruction shows an 编辑 tag beside its other tags. Choosing it replaces that
exercise with the existing per-question editor and the same save and cancel actions.
The full admin paper preview defaults to read-only mode. Its top mode selector reveals
pencil edit buttons only in edit mode; switching modes is disabled until the active block
is saved or cancelled. Only edit mode wraps each question in an independently editable block.
Selection outlines are dashed and inset: blue for text/options, green for images, purple for
question blocks, with a visible legend and no added padding, margin or preview heading.
`RegionEditButton` is a square inside the right edge of the outline. A ResizeObserver
sets both dimensions to the smaller of the region border-box height and 32px,
matching the region color without consuming layout space; image outlines follow
the authored image width. The admin preview uses the optional `renderMaterial` outlet to omit
decorative material panels in both modes; default student material rendering is unchanged.
Edit replaces that block's preview with `DraftFields questionOnly`; its Save action validates
and persists the current revision through the versioned server API, then returns to preview
only after acknowledgement. Validation/network failures retain the edited values. Cancel
discards the staged edit. Shared choice labels show inline nonempty/length errors, and
validation reports identify the activity and option instead of only the enclosing Part.
Save/cancel use the fixed 64×32px `RegionEditActions` icon toolbar.
Stacked word-handwriting questions stretch their answer area to the question width through
`ExamGapAnswer fullWidth` and `InlineHandwritingPad fullWidth`; horizontal letter answers
retain their compact size. Ink viewBox coordinates and aspect ratio are preserved.
The admin-only `ExamAuthoringContext` supplies in-place editing for shared heading/instruction
blocks (including category labels), annotated passages, email/table text, activity/material
titles, word banks and option regions. `ExamRegionFields` preserves IDs and references and
reuses management fields. Paragraph annotation groups remain intact; option editing wraps
the option region instead of inserting interactive controls inside answer buttons. No provider
is supplied by student routes.
There is no simultaneous preview below the editor. The full preview has no shared-content
editing accordion. Shared titles, instruction blocks, material blocks/images, activity metadata
and option pools remain independently editable through `ExamSharedFields` in the management
tab. In full-preview edit mode, material and activity images also expose a right-edge pencil
that replaces the image region with the shared `ImageSizeControl`. Save persists the width and
returns to the image after acknowledgement; Cancel discards it. `resizeDraftImage` updates references to the same
slot consistently, including standalone activity illustrations. Option images remain editable
inside their question form to avoid nesting an edit button inside an answer-choice button.
Shared changes affect all referencing questions.
`ExamManagementFields` shows the same granular fields continuously for the whole paper;
selecting a question scrolls to and focuses its highlighted editor. Both tabs share the same
draft. Full-preview region saves persist directly; management and vocabulary forms use
Save Changes, and the raw content editor validates and saves directly with its own button.
There is no second Save Draft step. Storage still uses an unpublished draft revision;
saving neither approves nor publishes content. While a block editor is open, tab switches,
reload, export, top-level save and review/publication are
disabled, and leaving warns about unsaved work. Only the full admin editor passes editing
callbacks to `ExamPaperView`; student renderers receive no authoring controls.
After a successful server save, the full preview closes the acknowledged edit without
remounting its mode selector. The management preview remounts. Related current-user
admin catalog, image workspace/catalog and media metadata
caches are cleared and fetched again. Failed saves retain local edits; a cache reload failure
after an acknowledged save is reported separately. Exam requests already use no-store;
this flow does not clear unrelated browser storage or account/session credentials.

`examRequest` also distinguishes server auth timeouts, transport failures, upstream
rate limits/service errors and missing server configuration. `api-auth.ts` emits bounded
`[auth-lookup]` diagnostics with a per-lookup ID, attempt, elapsed time, upstream status,
allowlisted error name and transport codes (including nested causes). It never adds raw
errors, tokens, request headers, URLs or user identifiers to these diagnostics. Existing
2.5-second/three-attempt verification and authorization gates remain; diagnostic changes
do not bypass verification or assert that server connectivity has been repaired.

The editor renders validation issues through `components/admin/ExamIssueList.tsx` and
`examIssueTasks.ts`: Chinese action text, source question/resource locations, collapsed long
lists and optional technical details. Duplicate diagnostics for the same location are merged
for display only; publication gates and original issues remain unchanged. Blocked items and
truncated-report notices remain prominent. External media/image navigation is disabled while
edits or requests are pending. A zero-item display does not grant publication approval.

- `types/content.ts`: sources, page/region references, material families, complete groups,
  classification, media slots, vocabulary links, sets/revisions and template contracts.
- `types/questions.ts`: discriminated `Question` union for `single_choice`, `gap_fill`,
  `matching`, `writing`, `speaking`, `self_check`. Book examples and open self-check tasks
  carry zero points. Writing/speaking use manual rubrics, not unique correct answers.
- `types/solutions.ts`: private solution/teacher-note contracts. Publisher answers,
  original explanations, translations and supplements retain distinct provenance/reviews.
  Missing publisher sample scores stay null. Examiner scripts remain distinguishable
  from teaching/scoring guidance for current session/Part-scoped parent access.
- `types/publication.ts`, `types/media.ts`, `types/attempts.ts`, `types/assessment.ts`:
  reviewed revision state, frozen media grants, student projections, private-recording
  receipts and append-only manual assessment history. Types do not grant access.

Question IDs use `<source>:test-<N>:<exam|training>:<section>:part-<N>:<original-number>`.
Keep source books distinct, original numbers intact and example identifiers explicit.
Use one objective question per printed scored number so skill aggregates remain per-question;
matching questions refer to a pool in their containing group. Group selection always includes
the whole material, dialogue or option pool. Classification is domain → question type →
one primary skill; knowledge points/topics and linked vocabulary are cross-filters, not extra
questions. Candidate classifications are not approved merely because they have an ID.

PDF page references are one-based and printed pages are stored separately for each source.
Mixed-role pages need reviewed crops when displayed; a source-page scan is admin-only.
`MaterialBlock` contains ordered structured content and media-slot IDs, never raw HTML,
local PDF paths or Baidu credentials. Media binding versions are resolved by server code.
Segment boundaries, repetitions and waits require actual audio review. Null playback means
unconfigured, not a playable listening examination.

`ExamContentRevision` is an **authoring/storage contract**, not a student API response.
Its guidance and training content must be filtered for the requested mode and authorized scope.
Private solution values, teacher notes, source pages and reserved material must not enter
browser bundles. The type-only solution exports do not authorize reading solution data.
Readonly TypeScript declarations are neither runtime validation nor access control.
`validation/` checks draft structure and references before saves; the database foundation
isolates solutions. A saved draft can be published without a completed review, media check
or material-family list. Publishing does not freeze the revision: it can return to draft
and be edited again. Withdrawal still stops new attempts and keeps existing learning records.
Live media checks and attempt authorization remain separate. A structural draft success is
permission to publish only through the explicit administrator action.

Gap-fill variants are complete `acceptedAnswerSets`; preserve their correlations instead of
mixing individual alternatives. Gap IDs/order follow the question's `gaps` and `answerOrder`.
Only trimming and case folding are universal; spelling, contractions, dates and numbers need
explicit reviewed variants. Gap-fill `value` is the actual answer text (including when a word
pool exists); matching uses option IDs. The objective grader evaluates complete authored
alternatives rather than combining unrelated valid fragments. Manual writing/speaking
results remain pending until an authorized person records rubric dimensions.

Vocabulary links require the existing canonical `word_entries.id` and a full
`(stage, unit, lesson, word)` snapshot. Never invent UUIDs, use legacy mastery keys as IDs,
or resolve deleted entries by spelling. Core already has optional `WordEntry.id` and English
already reads it. The server resolves exam links against that identity and snapshot; the
separate exam word-review flow records its own evidence and must not directly alter mastery,
Boss, adaptive plans or rewards.

## Samples and UI

`examples/ket-reading-part1.ts` and its separate `.solution.ts` are source-referenced,
unpublished contract fixtures copied from the first-batch preview. Both remain pending review;
they are not a full paper or a new source verification. The real source question has one point,
although the file is a contract example; original book example questions use `kind: 'example'`.
No sample is exported by `src/index.ts` or imported into production page bodies.
The existing `/dev-preview/exams` remains separate and unchanged.

Use `PageShell`, `StickerCard`, `AnswerChoiceGroup` and `@rosie/ui/themes` as documented in
`packages/ui/AGENTS.md` and `docs/visual-guidelines.md`. Do not copy controls or override
their appearance. Requests have real pending/error/empty states and
`LoadingOverlay placement="content"` for page-level waits. Do not show a successful empty
catalog or invented progress while the backend is unavailable. Unknown mutation outcomes
retain the exact request for retry; a version conflict does not discard local answers/edits.

## Manual verification only

Do not automatically install, start servers, run build/test/lint/typecheck, audits, migrations,
imports or publication. The lockfile importer was edited as text using existing resolutions;
workspace links must be installed by the user. No automated checks have been run for these batches.

The user must manually prepare dependencies/services, apply migrations, validate and import
source bundles, bind and review actual media, review/publish content, then exercise the flows.
`docs/exams-manual-acceptance.md` is the unchecked acceptance checklist covering permissions,
CAS/idempotency, timing, uploads, media scope, PIN sessions, word review, reports and PWA.
Package typecheck includes examples when manually invoked. No build/test/lint/typecheck,
check script, database migration, network acceptance or browser verification has run in this
implementation task; do not describe source delivery as verified runtime behavior.

Design/spec references: `docs/superpowers/plans/2026-11-13-ket-exams-learning-plan.md` and
`docs/superpowers/specs/2026-11-13-exams-visual-interaction-design.md` (local docs may be ignored
by Git). Student access to answers/materials must remain bound to an authorized attempt
and the appropriate started/submitted scope. The remaining delivery boundary is user-run
migration, source/media review, import/publication and full runtime acceptance.

## Content storage and API foundation

Local migration: `supabase/migrations/20261113092029_exams_content_foundation.sql`.
`exam_content_sets` stores stable source/test/template identity. `exam_content_revisions`
stores each version's complete set snapshot (including title and purpose) and question content.
`exams_private.exam_solutions` stores its corresponding answer/teacher-note payload.
All three tables enable RLS and deny direct browser access, including browser administrator
sessions. The private schema is not exposed in the Data API. Service-only, security-invoker
RPCs use an empty search path and explicit grants; no service credential enters the package.

Application adapters are `apps/web/src/lib/exams/{http,repository,contracts}.ts` and use
`server-only` for runtime modules. Routes verify the Bearer token through existing
`getUserFromRequest`, then require `isAdminRequestUser` for management. This preserves the
existing app_metadata/initial-rollout allowlist rule. Parent PIN is not administrator access.
The service-role client is created inside the request after authorization and input validation.

| Endpoint | Contract |
| --- | --- |
| `GET /api/exams/catalog` | Signed-in users; published revision metadata only, including reserved-paper titles but never their material/answers. |
| `GET /api/admin/exams` | Administrators; draft metadata only. |
| `POST /api/admin/exams` | Administrators; JSON `{ draft: { contentSet, content, solutions }, requestId }`, creates a draft with a new revision ID. |
| `GET /api/admin/exams/[id]` | Administrators; reads one draft and its private solutions atomically, plus its edit version. `id` is the content revision ID. |
| `PATCH /api/admin/exams/[id]` | Administrators; JSON `{ draft, requestId, expectedVersion }`, replaces that draft and solutions atomically. |

Lists accept `page` (default 1) and `pageSize` (default 25, maximum 100), returning `items`,
`page`, `pageSize`, `hasMore`. No progress, sample counts or student content are fabricated.
Management requests require JSON, a UUID `requestId`, and at most 2 MiB. Revision and set IDs
use ASCII letters/digits plus `:._-`, up to 256 characters, beginning with a letter/digit.
PATCH requires the UUID edit `version` from the previous read/save. This token is distinct
from the content's integer publication `revision`. Published/withdrawn versions are immutable;
new versions use new IDs and retain their own set snapshots. At most one published revision
exists per set. Separate publish/withdraw operations are described below; there is no
browser API for deleting immutable history.

All review fields submitted through draft saves must be pending/blocked; approval actor/time
cannot be supplied by a client. Separate review operations derive them on the server.
Missing answers or explanations can remain a structurally valid draft; returned `readiness`
lists content gaps and does not grant publication. Existing vocabulary IDs and full source
snapshots are checked against `word_entries` before save. Links remain subject to later review
and revalidation because entries may subsequently change or disappear.
Shared material references are checked within complete groups, but matching family IDs cannot
prove that the original source was not split incorrectly. Alternative answers across questions
sharing a non-reusable option pool report a review gap when joint feasibility is unresolved;
the validator does not invent cross-question answer combinations.

`save_exam_draft` receives the verified actor separately, performs CAS and commits both JSON
documents in one transaction. The most recent identical request (same actor, payload and
expected version) returns the original receipt. Reusing a request ID with different input,
a stale version, or replaying an older request after later saves produces a conflict. This
is not an unlimited idempotency history. Retry a failed request unchanged; after a conflict,
reload before intentionally preparing a new request ID/version.

Errors distinguish 401 unauthenticated, 403 forbidden, 400 invalid input, 404 missing draft,
409 conflict/not editable, 413 oversized input, 415 non-JSON, 422 invalid vocabulary reference,
and 503 unavailable storage/configuration. Raw database errors are never returned. Missing
migration/storage is not treated as a successful empty catalog. Responses use
`Cache-Control: private, no-store` and `Vary: Authorization`; the Service Worker matches
`/api/exams` and `/api/admin/exams` before document/image/audio caches using `NetworkOnly`.

For manual verification, follow `supabase/README.md` for migration dry-run/push and inspect
the pending list before applying anything. `supabase/tests/exams-content-permissions.sql`
contains manual-only transactional privilege assertions and writes no application data.
Vitest files `apps/web/tests/exams-{content-validation,api-access,repository}.test.ts` are
written but not executed; their mocks do not prove database transaction/concurrency behavior.
Manually verify anonymous/non-admin denial, metadata-only catalog output, missing-storage errors,
sample draft creation/read, identical-request replay, stale-version conflicts, atomic answer
replacement and refusal to edit published content in a suitable test environment. For cache
behavior use the project's production preview mode and hard-reload to activate the new worker.

## Local bundle and import CLI

`scripts/import-exam-content.mjs` has narrow helpers under
`scripts/lib/exams/`. It uses the existing `jiti` dependency to load the same TypeScript
draft validator without the UI barrel. The `extract` command renders explicitly mapped PDF pages into a private local workspace. It does not run the old grammar importer, upload PDFs, call an OCR/model provider, or publish content. Mapping coverage is partial; see source-data/README.md for the authored paper scopes.

A bundle directory contains five regular files; symbolic links are rejected:

| File | Content |
| --- | --- |
| `manifest.json` | Version 1 manifest shown below. |
| `content-set.json` | One `ExamContentSet`, including `source.fileHash`. |
| `content.json` | One draft `ExamContentRevision`. |
| `solutions.private.json` | Its private `ExamSolutionRevision`. |
| `source-pages.json` | An array of explicit `SourceReference` entries. |

The exact manifest fields are `schemaVersion: 1`, `sourceId`, `sourceSha256`,
`extractionVersion`, `contentSetId`, `contentRevisionId`, and integer `revision`.
`sourceSha256` is the source PDF's actual lowercase 64-character SHA-256 and must match
`contentSet.source.fileHash`. The remaining identities must match the draft. The importer
checks consistency; it does not read the PDF or certify that the provided hash, mapping,
transcription or answers are correct. `extractionVersion` is an explicit ASCII identifier
for the authoring/extraction procedure, not a timestamp silently generated on every run.

Source pages preserve one-based PDF pages, separate printed-page strings/null, roles and
optional normalized crops. Every source reference in content and solutions must exactly
occur in this mapping. Duplicate entries, contradictory printed pages and other source IDs
are rejected. Extra pages from the same source are permitted. If the mapping identifies a
page containing private solutions/teacher notes, references in student content require crops.
The crop coordinates themselves still require human review against the source page.

Each JSON file is bounded to 2 MiB. The complete UTF-8 save request, including its UUIDs,
must also fit 2 MiB; local validation reserves the larger PATCH envelope. Stable hashes
sort object keys but preserve array and complete answer-tuple order. No text normalization,
answer completion or approval promotion occurs during loading.

Manual commands, from the repository root:

```bash
pnpm exams:content validate --bundle output/exams/<source>/<set>
pnpm exams:content import-draft --bundle output/exams/<source>/<set>
# Only after the user prepares the authenticated environment and applies the migration:
pnpm exams:content import-draft --bundle output/exams/<source>/<set> --apply --base-url https://<app-origin>
pnpm exams:content import-draft --bundle output/exams/<source>/<set> --apply --base-url https://<app-origin> --resume
pnpm exams:content import-draft --bundle output/exams/<source>/<set> --apply --base-url https://<app-origin> --update-existing
```

The first two commands only read local files and print a summary. No token is required for
them; Jiti's disk cache is disabled. Pending-review gaps do not make a structurally valid
draft fail. Readiness counts describe reported issues (each category is capped at 100), not
an exhaustive content audit or permission to publish. Structural errors include safe issue
paths/codes for correction. Exit codes: 0 success, 2 invalid input/operation, 3 remote failure
or conflict, 1 local I/O/unexpected failure.

For `--apply`, provide a current administrator session access token through the
`EXAMS_ADMIN_ACCESS_TOKEN` environment variable using the user's secure environment setup.
Do not paste a token into the command, a report, a recovery file or Git. The CLI does not
load `.env.local`, use service-role credentials or infer administrator rights from JWT claims.
The existing API verifies the token and administrator status. Base URLs must be HTTPS origins
or loopback HTTP origins; credentials, paths, query strings and fragments are rejected.
Redirects are never followed with the token. `--resume` and `--update-existing` are exclusive.

Before each write, the CLI saves a recovery journal under the already ignored
`output/exams/import-state/`. Its filename is a hash of API origin and content revision ID.
The journal contains private draft/answer bytes, request ID, version precondition and receipt;
it has mode 0600 in a mode-0700 directory and contains no token. Do not copy it to public
storage. An exclusive `.lock` prevents simultaneous imports. After a crashed process, the
user must confirm that process has stopped before removing its stale lock; do not delete the
JSON journal to bypass a conflict or to force a new write.

Initial imports only create stable IDs from the bundle. Repeated successful imports read
the remote draft and skip only when the acknowledged version and stored content still match.
Pending operations require `--resume` with unchanged input; the original request bytes,
request ID and expectedVersion are replayed. `--update-existing` only updates a draft with
a prior local receipt and uses that receipt's version. It never adopts a new remote version.
An existing draft without a local receipt is not claimed automatically. A changed version,
409, or 404 for a previously imported draft stops the operation: 404 may mean published or
withdrawn, and must not trigger recreation. A different administrator's retry can conflict
because the server also binds request identity to the authenticated actor.

Network failures, 429 and 5xx use at most three attempts per request, with 1/2-second backoff
and bounded Retry-After (up to 30 seconds). Each attempt has a 30-second timeout. Responses
are bounded to 4 MiB to allow a valid draft plus server readiness metadata. Other failures
stop and retain pending state. A malformed success response also retains state because a
write may already have succeeded. Resume is still subject to current vocabulary validation
and the server's most-recent-request limit described above. Do not force a fresh request ID
after an uncertain result; resolve the existing pending operation first.

`apps/web/tests/exams-import-bundle.test.ts` and `exams-import-draft.test.ts` define local
file and mocked HTTP cases. Their source fixtures are synthetic, not newly verified exam
content. This task does not execute them, the CLI, network requests or imports. Real source
review and database/concurrency verification remain manual work.


## Source pages and authored bundles

`scripts/exams-source-map.json` pins independent PDF page/printed-page references, exact
source SHA-256, page counts, crops and complete groups. `source_checked` records source
reading only; it never approves a content revision. No fixed page-offset formula is used.

Manual source-material command (does not generate a finished five-file bundle):

```bash
pnpm exams:content extract --input /path/to/source.pdf --source ket-official-four-tests --test 1 --role exam
# Same source/mapping/output only; unknown or modified artifacts are not overwritten:
pnpm exams:content extract --input /path/to/source.pdf --source ket-official-four-tests --test 1 --role exam --resume
```

Uses local pdfinfo/pdftoppm/pdftotext with argument arrays, page-specific time limits and
200 DPI. It streams the PDF hash, compares actual page count, records empty text layers,
checks source changes, writes each PNG/text/reference triplet and an atomic private
manifest, and retains a lock until done. Default output is ignored
`output/exams/<source>/test-<n>-<role>/extraction/`; directories/files use 0700/0600.
Never put full source/answer pages in public assets. Recovery refuses changed source, map,
settings or artifact bytes; after a crash, confirm the process stopped before removing a
stale lock. Test definitions for source-map and extraction are written, never executed
by this task. Four release-candidate bundles subsequently passed the import preview and
were saved as drafts; the two extraction samples remain unimported. Nothing is published.

## Management and review

`/admin/exams` lists real draft/published/withdrawn versions via the administrator catalog;
`/admin/exams/[id]` edits imported drafts, solutions, classifications and vocabulary links.
The complete JSON editor covers fields beyond the structured form. Exported edits include
private solutions and must remain private. Save errors preserve inputs and unknown outcomes
retain the exact request for retry. Lists use per-user session stores.

Review approvals remain a separate server-authored audit bound to the draft UUID version;
editing invalidates prior approvals. They are optional reminders. Publishing a saved draft
does not require exam/explanations review, rubric approval, material families, vocabulary
snapshots or live media verification. Client JSON still cannot submit an approved review.
Publish, withdraw and reopen are explicit admin operations with CAS and persistent
idempotency. Reopen returns a published or withdrawn revision to an editable draft on the
same version. One content set still has at most one published revision. Withdrawal prevents
new attempts while retaining the revision and its learning records.

Review routes under `/api/admin/exams/[id]` use GET/POST `reviews`, POST `publish` and
POST `withdraw`. Review input is `{expectedVersion,requestId,scope,decision,reason?}`;
transition input is `{expectedVersion,requestId}`. Scope is exam/explanations/rubric.
Draft JSON cannot promote reviews. A current approved server review does not erase explicit
blocked fields or missing authored content. Publication checks every review-bearing path;
a capped readiness report cannot silently hide blockers. Formal exam groups must reference
material families. Rubric approval does not invent a missing numeric range. Withdrawal
prevents new attempts while retaining immutable revisions and authorized historical review.

## Frozen media and authorization

The on-demand `/admin/sync` exam panel uses GET/PUT `/api/baidu/sync/exams`. Server code
under `apps/web/src/lib/exams/{media,mediaAdmin}.ts` reuses the shared Baidu OAuth account,
directory bookmarks and Range proxy. `exam_media_binding_revisions` freezes account identity
and generation, directory, file ID/path/size/fingerprint, exact slot snapshot, reviewed state
and actual duration. Bindings are immutable; saving a replacement rotates the draft edit
version and invalidates earlier content reviews. Runtime checks reject moved/replaced files
and changed shared-account generation. No file paths, Baidu tokens or dlinks enter student
responses. New picks must be previewed and explicitly reviewed by the administrator.

The same file may serve multiple slots/segments, but a Range response exposes the complete
file. Client segment boundaries are never authorization boundaries. All same-file slots and
actual material/group/note references must fit the authorized scope; cross-audience sharing
is denied. Administrators must pre-crop student assets away from answers, parent scripts or
private source pages. Full source-page PDF/image comparison is administrator-only.

GET `/api/exams/media` accepts either an admin `revisionId + slotId`, or an owner
`attemptId + slotId + audience`. `authorize_exam_media` checks the attempt's frozen binding
and full-file scope; parent additionally requires the verified JWT session_id and current
speaking Part grant. POST `/api/exams/media/session` creates the HttpOnly media cookie;
DELETE clears it. Its lifetime is capped by token expiry and one hour, and each stream still
verifies authentication. Root-level cleanup clears the cookie on logout; parent-session
revocation does not accept a client-supplied owner or session ID. These endpoints are
private/no-store and excluded from SW caches.

`verifyExamMediaForPublication` and `verifyExamMediaForAttempt` check required files live;
they do not write an approval. The latter accepts an optional fifth AbortSignal for bounded
recommendation probes and returns the reviewed section listening duration. Frozen duration
is segment length or actual full-track duration, multiplied by explicit repeats, plus the
step wait once. A source file containing its own repeats requires repeatCount=1 and no
additional wait. The service-only SQL duration helper independently derives mock deadlines.

## Attempts, timing and submitted review

The practice directory now uses actual server facets: paper revision → section / Part →
ability → question type → knowledge point → linked canonical word. GET
`/api/exams/practice` accepts `revisionId`, `sectionId`, `partNumber`, `domain`,
`questionType`, `knowledgePoint`, `wordEntryId`, `unseen`, `page` and `wordReviewBatchId`;
duplicate parameters, empty identifiers, malformed UUIDs and out-of-range page/Part values
are rejected. Only published revisions with purpose=training contribute metadata. The
response includes `options` for revisions/sections/parts/domains/questionTypes/knowledgePoints/
words; no question text, answers or reserved-paper material is returned. Each selector uses
FormSelect and available upstream options. Template Part labels supply Chinese question-type
names; other authored tags remain unchanged, and words show their snapshot word plus stage.

Changing an upstream selector clears lower-level selections and resets pagination. Available
facets are generated before pagination; each field retains its own alternatives. Multiple
question filters must match the same question, but starting still creates one whole-group
attempt with all shared material and questions. The per-paper link
`/exams/ket/practice?revisionId=...` means unlimited-time, group-by-group practice and submission,
not a cross-group attempt. Reserved-paper cards have no practice link. The bounded directory
contains the first 100 published training revisions and can additionally resolve the exact
selected published training revision; option lists are capped at 500 with an explicit hint.
Completed word-review batch filters remain owner-bound, snapshot-matched and unseen-only;
they do not relax the later transfer-attempt authorization checks. Client filter choices are
temporary local view state; only the selected paper/batch entry context is in the route URL.

Server modules `attemptEngine.ts`, `attempts.ts` and `attemptRoutes.ts` implement transitions;
the browser receives explicit `ExamAttemptView` / `ExamAttemptReview` projections. Student
pages never import source-data or private solution values. The application root still owns
authentication, and API handlers derive owner IDs from validated sessions.

| Endpoint under `/api/exams` | Scope |
| --- | --- |
| `GET/POST attempts` | List own attempts / create practice complete-group or mock attempt |
| `GET/PATCH attempts/[id]` | Read own authorized projection / CAS-save active answers |
| `POST attempts/[id]/start-section` | Explicitly start a mock section after media checks |
| `POST attempts/[id]/submit` | Atomically settle and lock the active section |
| `POST attempts/[id]/help` | Record practice help and disclose only its allowed question |
| `POST attempts/[id]/interrupt`, `resume` | Record technical interruption and authorized recovery |
| `GET attempts/[id]/program` | Frozen finite mock-listening steps and persisted position |
| `GET attempts/[id]/review` | Solutions/results only for submitted authorized scope |
| `GET/POST attempts/[id]/reflections` | Optional owner-only self-reported reasons, separate CAS/idempotent storage |

Mutations use UUID requestId/expectedVersion. Durable request receipts bind owner, actor and
original command; SQL serializes owner operations before locking the attempt. Start and
first exposure commit material family history before body disclosure. Reopening the same
attempt does not count as prior exposure; another attempt on the same family does.
Server clocks derive deadlines. Late saves cannot overwrite cutoff answers; expiry settles
stored answers. Objective scoring does not accept client results. Submitted answers and
timing remain unchanged during manual grading. Help, technical interruption and prior
exposure stay separate from independent first-attempt evidence.

Optional reflections are a separate owner-bound record, not a new answer or a correction
to grading. Their CAS/idempotent API must not change first-attempt scores, recommendation
algorithms or mastery. The separately authored `20261113092155_exams_reflections.sql`
migration is also pending manual application; specific reflection fields belong to that API.

Mock listening uses `@rosie/player`'s finite program lease. Ordinary queues are paused and
cannot start while the lease is held; no program pause/seek/rate/skip control is exposed.
Client playback limits supplement server time/scope checks and do not secure media by
themselves. A media failure triggers the explicit interruption path, not a fresh timer.

## Parent scripts, recordings and manual assessment

POST `/api/exams/attempts/[id]/speaking-script` takes `{requestId,expectedVersion,pin}`.
PIN verification reuses the current owner's server-side PIN, rate-limited across grading
and scripts. The token's already-verified session_id is server-derived. Only the current
speaking Part's `examiner_script` notes and parent slots are returned, for a DB-clock ten-minute
grant. Other Parts, teaching/scoring guidance and examples remain private. Old retries do
not renew an expired grant. POST `/api/exams/parent-session/revoke` has no body and clears
matching grants for the verified current owner/session, rotating affected attempt versions.

Recordings use Baidu `/airosie/project/record/exam-recordings` and service-only metadata. POST
`attempts/[id]/recordings` prepares `{requestId,expectedVersion,questionId,mimeType,sizeBytes,
sha256}`; GET lists own recovery metadata. PUT `.../recordings/[recordingId]` accepts bounded
binary bytes up to 4 MiB. Larger recordings upload through the owner-scoped multipart route, then POST the same exam recording URL to finalize. Both routes verify Baidu bytes against the declared length, SHA-256 and container before recording completion.
The limit is 20 MiB per file; accepted base MIME types are audio/webm, audio/ogg, audio/mp4,
audio/mpeg and audio/wav. GET the same URL returns authorized private bytes, never a public
Baidu URL. POST `.../[recordingId]/abandon` with `{requestId}` explicitly abandons an
unfinished upload. Complete objects are immutable. Normal submission and completion share
the attempt lock: uploading blocks submission unless explicitly abandoned; only matching
owner/attempt/question complete recordings can be attached. Automatic deadline settlement
cannot be indefinitely blocked by a failed upload. Finalization cannot complete after its
section was submitted.

GET/POST `attempts/[id]/grades` reads manual history / records rubric dimensions. POST uses
`{requestId,expectedVersion,questionId,dimensions:[{dimensionId,score,comment?}],comment?,pin?,
ownerId?}`. The current owner needs PIN; an administrator must supply explicit ownerId to
grade that account without PIN. GET and recording playback also support explicit admin
ownerId; ordinary callers cannot choose another owner. `/api/admin/exams/attempts` and its
`/[id]` route require explicit userId and expose only submitted scope for assessment.

Server code checks exact rubric dimensions/ranges and derives totals. Manual results begin
as pending and become graded, never an automatic objective incorrect result. Audit rows in
`exams_private.exam_manual_reviews` are append-only and commit with the attempt result;
latest reviewedAt/id per question is current, while old dimensions/comments remain readable
within owner/submitted scope. PINs never enter audit hashes or stored request payloads.

## Vocabulary evidence and reports

`/api/exams/word-review/links?attemptId=...` resolves owner-authorized submitted vocabulary
against current canonical dictionary identity and source snapshots. `/word-review` GET/POST
lists batches/adds sources; `/word-review/[batchId]` GET/POST reads or advances a batch.
Up to ten deduplicated words preserve multiple approved sources. Starting freezes membership;
meaning and spelling track first answers, help, retry and completion independently. Dictionary
deletion/change does not silently relink by spelling. Evidence and transfer-practice links
live in exam tables, never in English mastery, rewards or plans. Complete eligible training
groups can be offered for transfer; reserved papers, previously exposed families and unsafe
or unavailable media are excluded rather than fabricated into recommendations.

GET `/api/exams/reports?days=14|28` returns owner-only report projections. Objective evidence,
manual rubric history, help/interruption/prior exposure and word-review evidence remain
distinct. Pending manual work is not zero, examples/unscored tasks do not inflate objective
denominators, and prior assessments are not accumulated as new attempts. Empty data and
backend failure have separate UI states. Recommendations may be absent when no safe complete
group is available or the bounded live-media check cannot finish. Report math and exposure
semantics still require the user's manual acceptance with known examples.

## Pending migration order

The user subsequently authorized migration application; these versions are already applied.
Follow `supabase/README.md` for future migrations and do not reapply these files:

1. `20261113092029_exams_content_foundation.sql`
2. `20261113092043_exams_review_publication.sql`
3. `20261113092118_exams_media_bindings.sql`
4. `20261113092133_exams_attempts.sql`
5. `20261113092143_exams_recordings_grades.sql`
6. `20261113092149_exams_word_review.sql`

7. `20261113092155_exams_reflections.sql`

All seven are applied. Official Test 1, Trainer Test 3 and both Trainer Part 1 training
bundles passed the import preview and are stored as drafts, with private solutions.
Media bindings, content approval and publication remain pending.
Use `docs/exams-manual-acceptance.md` and `docs/baidu-oauth.md` for user-run source review,
pre-cropped media binding, publication, owner/session isolation, concurrency and PWA checks.

## Final integration details

- `LoadingOverlay appearance="quiet" placement="content"` and `PlayerDock appearance="quiet" placement="inline"` are public shared props used by exam pages. Background attempt reads retain mounted answer/recording components; an unknown command remains retryable with its original bytes.
- Private `TeacherNote.kind = listening_transcript` distinguishes reviewable audio transcripts from examiner/teaching/scoring notes. `projectAttemptReview` returns transcripts only after every associated group has been submitted; it also returns separately scoped guidance and review-slot metadata. Full source bundles retain pending provenance.
- `/api/exams/attempts/[id]/reflections` GET returns `{items:[{questionId,reason,version}]}`. POST accepts exactly `{requestId,questionId,expectedVersion,reason}`; `reason` is null or one of unknown_word/unclear_audio/spelling/misunderstood_question/unsure. Only owner-submitted non-example questions are eligible. The independent CAS/receipt tables in `20261113092155_exams_reflections.sql` never alter attempts, scores or insights. Shared per-user reads dedupe across question widgets. Pure reflection types/constants are available through `@rosie/exams/reflection`.
- Draft management automatically matches the public paper text before saving. It uses the
  shared vocabulary catalog's headwords, spelling variants, and the English module's word
  forms. Links record actual UTF-16 ranges and the question scope of their text. The editor
  freezes the result before the versioned save so retries reuse the same payload.
  Source bundles can also carry authored links. Automatic matches are background vocabulary
  for submitted review. Existing authored key links can also support transfer evidence.
- `GET /api/admin/exams/words?q=...&limit=...` remains an administrator-only lookup for
  canonical KET records used by authoring tools.

## Confirmed question rendering rollout (2026-11-14)

`ExamGroupRenderer` composes activity instructions, materials, inline slots and
questions for attempts, review, administrative paper/image previews and assessment.
`ExamActivity` preserves one complete material family while presenting Trainer
Exercises separately. MatchingBoard joins all questions using the same pool;
examples display public printed answers and reserve a non-reusable word. Single
choices can contain bound images with normalized `imageRegion` viewports. Plain
open gaps use the confirmed anchored handwriting input when the handwriting capability is available; explicit option pools remain click-to-select.
`multiple_choice` uses a distinct option-ID set with authored `selectionCount`;
its solutions are complete `acceptedOptionSets`, not ordered matching positions.

`MaterialBlock.answerSlots` contains authored UTF-16 ranges and exact `questionId`
plus `gapId` for gaps, with row/column for email/table cells. `sourceText` detects
stale anchors after text edits. `sentences` similarly preserves authored ranges for
sentence markers. Validate these references in `validation/presentation.ts`; never
infer a blank, choice or sentence in the student browser. Preserve original
question IDs, complete accepted answer combinations and source provenance.

The four `*-rendering-v2` source bundles were saved as new **draft** revisions;
r1 drafts and historical references remain intact. The new revisions inherit 36
existing media bindings (10/20/1/5), without uploads or publication. Media/source/
solution reviews remain pending/blocked, including Trainer listening Exercise 7.
A newer draft is not approval to publish and does not supersede frozen attempts.

Optional annotations live outside answers/results in attempt state. The additive
migration `20261113163105_exams_sentence_annotations.sql` extends the existing CAS
transaction and preserves SQL deadlines, scope checks and receipts. Hosted application
is confirmed: the existing migration script applied only this migration from an isolated
directory, and remote history plus the service-only capability RPC were read back successfully.
`exam_sentence_annotations_ready` capability lookup keeps existing answer saving
compatible until migration availability is confirmed. Before then, markers remain
page-local with a visible refresh notice; after migration they save with answers.
Do not replace this gate with optimistic claims of persistent annotations.

`/dev-preview/exams` is retained: 14 confirmed question examples, a separate
handwriting assessment workflow demo, an illustrated-reading material preview,
and a title/activity/item-number hierarchy preview (items 15–17).
The material preview includes three source layouts and stable missing-image spaces;
the user subsequently authorized formal layout/data integration. See
`docs/exams-illustrated-reading-coverage.md` for the 37-slot inventory and scope limits.
The handwriting demo allows submission, pending
status, human judgement (correct/incorrect/unclear) and comment review using original
ink. The retained demo has no OCR, authorization claims, API calls or real grade writes.
The user has now approved this workflow for formal integration; see the migration boundary below.

No build, test, lint, typecheck, server start or browser acceptance was run. Import
schema/source-reference validation ran only as the mandatory guard for authorized
draft writes. Temporary preparation/apply CLIs and private receipts are documented
in `docs/exams-question-rendering.md`; never import source bundles into browser code.

## Approved formal handwriting integration (2026-11-14)

Open `gap_fill` questions without an option pool accept `values` (typed text) plus
optional `ink: Record<gapId,{strokes}>`. A gap cannot contain both nonempty text and
ink. Strokes contain finite x/y coordinates only (600×440 bounds, at most 250 strokes
and 10,000 points per gap); the existing 2 MiB request/state bound remains. No OCR,
SVG markup, public uploads, transcription or fabricated choices are introduced.
Writing essays, speaking and original choice tasks retain their existing contracts.

`ExamGapAnswer` reuses the approved `HandwritingField` anchored interaction. Material
blocks provide an outlet after the complete material; ordinary gaps use a local outlet.
“写好了” updates the answer and existing autosave/CAS pipeline; unconfirmed editors
block submit/next-group and trigger the existing unload warning. Submitted original
ink is read-only in student/admin review. Old typed answers remain valid.

Any objective question containing ink submits as `pending` with null points/maximum.
The whole question (including any typed sibling gaps) is assessed together to preserve
correlated accepted answer sets. `unclear` stays pending, never zero. Reports include
pending handwriting in the pending count; finalized decisions use authored maxPoints.

`GET/POST /api/exams/attempts/[id]/handwriting-grades` uses verified owner access;
explicit cross-owner access requires admin. Writes require the existing rate-limited
parent PIN unless an authorized administrator explicitly supplies ownerId. GET returns
only submitted handwritten question references and their append-only reviews. POST
accepts correct/incorrect/unclear plus an optional empty comment, never caller scores.
The service-only RPC derives points from frozen content, retains answers and timing,
checks CAS, and records an atomic permanent receipt plus actor/time/history. Unknown
outcomes retry the original request; history uses an owner-scoped session store.

Applied migration `20261113170244_exams_handwriting_assessment.sql` adds the private
history table, bounded-ink guard and service-only read/grade/readiness functions.
**Applied after explicit user authorization using the existing migration script.** Remote
history and `exam_handwriting_ready() = true` were confirmed by read-only calls.
Only this migration was pushed from an isolated directory; unrelated 20261018040000
remains pending. `exam_handwriting_ready()` gates both formal
input and server writes: absent migration means the existing keyboard input remains.
Do not enable the capability without the full migration. Demo remains accessible.
No build/test/lint/typecheck, server or browser verification ran.

## Structured illustrated materials and headings (2026-11-14)

Material.layout partitions existing blocks into ordered rows with optional heading,
image and side. Every block must occur once, and image rows require an explicit
aspectRatio. ExamReadingMaterial serves the shared student/review/admin renderer.
Legacy revisions without layout retain ordered-block rendering. Sentence IDs and
original question numbers remain stable; moved body ranges are re-anchored.

Text presentation is explicitly authored as heading (optional prefix) or instruction
(number); no browser prefix regex. ExamTextHeading uses Themes Heading/Badge.
DraftFields exposes semantic fields. `displayLabel` is navigation text for the editor
and stays off the paper; the paper shows the authored instruction number. ExamMaterialImage reserves authored
image dimensions for missing/loading/error states; unconfigured legacy images use
a placeholder then their intrinsic ratio.

Four current r2 drafts were read and saved with CAS through the existing repository.
Only presentation changed; current private solutions/media references were retained.
Receipts: output/exams/material-layouts/. One-time resumable CLI:
scripts/tmp/apply-exam-material-layouts.mjs --apply. Old rendering-upgrade receipts
are stale and must not be used to overwrite current drafts. No publication, migration,
build/test/lint/typecheck or browser verification ran.

## Author-controlled image width

Image MaterialBlocks and ExamOptions accept optional integer displayWidth (80–1200
CSS pixels). Missing values retain default responsive sizing. Admin paper/inline
previews expose ImageSizeControl (Themes Slider/TextField, reset), editing the current
draft via the existing dirty/CAS save flow. No image upload, crop or binding mutation
is involved. Saving is explicit; no database migration is needed for this JSON field.
Image rows adapt their columns to the configured cap; student/review images and
MatchingBoard illustration coordinates scale with the same setting. Frozen attempts
retain their snapshot rather than retroactively adopting later author edits.
/dev-preview/exams is retained. No build/test/lint/typecheck or browser checks run.

## Inline audio and Part resource binding

Automatically created crop directories are identified from the account's initial
crop-job destinations and marked `managedBy: exam_images` in the directory list API.
The sync page hides them only in its path-management list; bookmarks, directory
selection, bindings and media access remain intact. Adding a paper does not require
manually registering its generated upload path: `saveExamImageCrop` owns that step.

Authored audio blocks render headphone controls with source track labels through
`ExamAudioScope` and the shared PlayerDock. Admin previews read binding state from an
owner-scoped session store; unbound/loading/error states remain explicit. Practice
and submitted review pass authorized media metadata; active mock attempts disable
manual audio controls and retain the reviewed playback program. No audio positions
or track numbers are inferred from printed text.

Paper preview links carry revision, section, Part and optional slot into `/admin/sync`.
The media editor lists authored listening and training audio grouped by listening Part.
「使用此目录」 immediately saves an existing authorized Baidu listening directory per draft.
The directory has its own edit version. The editor reads
that directory and its descendants. Batch matching stages
unique authored track numbers or explicit filenames for single-track Parts, leaves ambiguous
tracks for manual selection, and preserves existing bindings. The listening-only save validates
every changed slot against current draft membership and commits across Parts using the existing
CAS and immutable binding revisions. Each new listening file retains the authorized bookmark
it was matched under. Existing files can still resolve through the legacy binding directory.
After saving a match, 「试听」 reads the track duration from media metadata. 「确认音轨」 stages
the review and duration for the next binding save. No audio upload directory is created.
Question images use the image workspace. The hosted database has
`20261119121511_exam_listening_directory.sql` applied.

The admin catalog displays the stored content type (真题, 模拟题 or 专项训练).
Paper and training names remain editable in 管理试卷 through the draft save flow.

For additional authored papers, pass `--bundle <source-data path>` once per bundle
and `--pages-dir <render directory>` to `scripts/prepare-exam-image-pages.mjs`.
The selected directory supplies `page-NNN.png` originals and stores the batch's
private source-assets manifest. Existing invocations still use their configured paths.

## Approved compact interactions applied (2026-11-14)

Formal attempts, submitted review and author previews now use content-sized left/right
MatchingBoard boxes. Inline cloze choices remain in the passage without a second
answer list. `/dev-preview/exams` is retained and shares InlineHandwritingPad through
@rosie/ui. Open gaps use permanent small handwriting pads with keyboard fallback;
completed strokes enter the existing autosave/CAS pipeline. Legacy tall-canvas ink
uses the same permanent pad with its original coordinate space; it never opens the old anchored editor. The handwriting capability
gate, pending objective assessment and original unscored training rules are preserved.

ExamActivity supports `layout: handwriting`, `handwritingSize: letter | word` and
optional source `wordBank`. Handwriting activities require open gap_fill questions;
a word bank is displayed material, not a forced choice input. Trainer listening
Exercises 1/3/4/5/8 were revised using current-draft CAS through
`scripts/tmp/apply-exam-approved-interactions.mjs --apply`. Explicit T/A/N, ticks,
P/F and A/D keys were converted to gap answers without inventing distractors or
changing source evidence, question IDs, points or media bindings. The rooms bank
is preserved. Exercises 2/6/9 remain picture choice and 7 retains multiple choice
and its existing review blockers.

Saved draft version: `0db94c85-5039-42b7-902e-ed4ec5d848e7`. Private resumable save
receipts are in `output/exams/approved-interactions/`. Old attempts retain their
frozen question contracts. No publication, migration, build, test, lint, typecheck
or browser acceptance was performed; only the mandatory contract guard on the
authorized draft save ran.

Admin paper previews support page-local trial answers (never saved to draft/attempts). Focused review renders the selected activity rather than the entire Part. Handwriting question cards contain the actual compact pad and source/edit tools together; no duplicate control-less cards are appended. Clearing trial answers is disabled while a stroke is active.

## Classification choices with optional handwriting

`ExamActivity.choicePresentation` explicitly identifies `judgment` (✓/✗) or
`letters` and their source answer values/labels. It requires a handwriting-layout
activity with one open gap per question. These values use the existing gap answer
contract, allowing both category selection and ink without weakening choice-answer
validation or adding OCR. `ExamClassificationActivity` is shared by attempts,
review and admin preview. The header has one 手写模式 toggle; default is point
selection, and saved ink reopens as ink. Drawing locks the toggle. Switching keeps
inactive answers in page-local memory; only the current mode is sent through the
existing answer save flow. Submitted review shows actual stored ink or category;
unmatched typed answers remain visible. Unscored training remains unscored.

The retained demo and formal rendering share JudgmentIconButton/LetterChoiceButton:
no outline at rest, orange hover with a hard bottom edge, centered icons/letters
without state-dependent movement. Trainer listening Exercises 1/4/5/8 and reading
Exercise 1 are the explicit conversion scope. Rooms word labels and all other
questions are unchanged. Temporary save CLI:
`scripts/tmp/apply-exam-classification-modes.mjs --apply`; resumable private receipts:
`output/exams/classification-modes/`. It reads current drafts, verifies source answer
values, validates the save contract and uses CAS; never publishes or alters old attempts.
No build, test, lint, typecheck or browser acceptance is run.

# PET implementation record

Approved scope: six supplied PDFs plus the August 2025 Cambridge list; independent
PET progress; reuse reviewed existing content; daily learning and exam practice.

## Execution constraints

- Work only on PET-related files; existing math edits belong to the user.
- Do not run builds, tests, linters, type checks, installs or dev servers. Remote writes require
  explicit authorization and must stay within the approved migration/import scope.
- Database migration and content import require explicit authorization. The PET migration was
  subsequently authorized and applied on 2026-11-13; the 30-word sample and subsequent 37 reviewed
  words were imported after authorization. The user has also authorized reviewing all remaining
  candidates and importing accepted content in batches; extracted candidates require content review.
- Raw source rows and unreviewed candidates must remain distinguishable from published content.

## Work ownership

- Data: full source manifests, 500 paired questions, safe repeatable import CLI, reviewed sample.
- Storage: stable word IDs, published content, owner-scoped sessions and cross-day review.
- Exercises: opt-in strict grading and callbacks; six original exam sets and contextual forms.
- Integration: PET daily/specialist page, existing practice entry, source and performance views.

## Decisions

- Keep the existing A/B/C mainline and Boss unchanged; additional scores do not alter old mastery.
- Retention is word-level; skill results are reported separately without multiplying due queues.
- First independent performance controls retention. Retries/help cannot replace the first result.
- Initial review is +1 day; subsequent successful intervals are 3, 7, 14 and 30 days.
- Unit/topic assignments and content IDs remain stable across reimport.
- Existing visual guidance is authoritative; no new design system or appearance overrides.

## Status

Implementation files are written: the import CLI, source inventories and frozen allocations,
published-content/session/review migration, controlled exercise engine, PET pages and entry point.
The completed local vocabulary inventory contains 3,424 candidates and 3,423 reviewed entries.
Only `guest guide` remains unapproved because its source headword and Chinese gloss cannot be
reliably reconciled. The original 20-word pilot, first 10 paired sentence items, six original
six-gap passage sets and eight contextual word-form items remain part of the reviewed content.
The remaining 49 sentence sets (490 items) have now received separate question/answer review.
The three range-specific decision files preserve raw source cells, corrections, contextual
explanations and canonical references; sentence-review-audit.json records the merged decisions.

Builds, type checking, linting, tests and browser runtime verification have not been run, as
requested. The user verified the initial sample manually, then authorized all remaining vocabulary
review and incremental import. The acceptance sequence remains in `README.md`.

On 2026-11-13, explicit user authorization applied `pet_learning` to the linked Supabase project
`yvukypevtqblhjdhkatb`. The migration API recorded version `20261113054603`; the local SQL filename
matches that history. Read-only catalog queries confirmed all four PET tables with RLS, owner-scoped
personal reads, no direct personal writes, and authenticated-only RPC access.

The user subsequently authorized word import. The sample CLI imported 30 reviewed PET words,
30 content records, and the first 10-question sentence set. A read-only comparison reported all
word/content/set payloads unchanged after the import, with no location conflicts. Database receipt
confirmed all 10 item UUID references resolve to PET words, existing non-PET stage counts remain
unchanged, and no practice sessions or review progress were created. Reports are in
`output/pet/sample-import-{preview,applied,after}.json`. After the user verified that sample, the
remaining 37 reviewed words and seven exercise groups were imported. That initial publication total was
67 words and eight groups containing 54 items; its receipts are
`output/pet/reviewed-import-{preview,applied}.json`.

The first normalization expanded 3,394 extracted candidates to 3,460. Final lexical review then
resolved 44 ordinary inflection/spelling merges, range expansions and corrected unpublished
headwords, producing 3,424 candidates and 3,423 reviewed entries. All 13,200 structured source
rows are accounted for: 13,198 map to canonical entries and two ambiguous source labels retain
explicit pending reasons. The active source queue has three issues: `08:0019`, `08:0088`, and
`08:1297` (`guest guide`). Missing pronunciations and the regional gas senses were completed.

`IT`/`it`, `May`/`may`, and `Miss`/`miss` use separate canonical keys. IT and May retain the
locations of their original displayed words; the lowercase pronoun and modal use separate basics
locations. Surviving published locations and sense IDs remain unchanged. `miss` no longer contains
the two title-only `Miss` source references. `notice board` redirects to `noticeboard`; the
placeholder `leave sb. alone` becomes `leave alone` with its separable pattern retained. Later
corrections include `ask for leave`, `surprising` and `tablecloth`; `while` and `whilst` remain
separate words with distinct pronunciations. Original question answers and raw source text were
not rewritten during lexical identity reconciliation.

The local-first pass reviewed 1,329 candidates with existing-library matches and all 2,064
source-only candidates. The user explicitly requested no further Bailian calls; provider attempts
on 16 unmatched words were not published. The final content comes from local source comparison
and assistant authoring/review, not a claim of human dictionary-editor sign-off. Decision files
retain source evidence and corrections. `final-identity-reconciliation.json` records operations
and coverage; `canonical-key-redirects.json` retains retired allocations, and
`output/pet/final-identity-backup/` preserves the integration baseline. Explicit reviewed irregular
forms also disable the corresponding additive generated category; contextual answers remain
sense-specific through `acceptedAnswerSets`.

Authorized batches are recorded in `output/pet/local-batch-*-{preview,applied}.json`. The final
database receipt after identity reconciliation, safe duplicate cleanup and word-form protection is
complete: 3,423 PET words and 3,423 published content records. The final read-only comparison shows
all 3,423 word/content payloads and eight exercise sets unchanged, with zero location conflicts or
missing item references. Core/reading/irregular tags cover 661/499/95 words. See
`docs/pet/data/import-completion.json` and `output/pet/final-import-{applied,after}.json`.
The unused chips/holidays duplicate rows created during this import were backed up and removed
only after transactional guards confirmed zero learning, plan, session or exercise references;
canonical chip/holiday IDs remain. No other stage was modified. Project builds/tests remain unrun.


The subsequently authorized sentence review/import is complete (2026-11-13): 49 newly published
groups contain 490 reviewed items. The database now has 50 sentence groups / 500 source items,
plus the preserved six passage groups / 36 items and one forms group / eight items: 57 groups /
544 items overall. Read-back confirms 544 unique item IDs and zero invalid PET word references.
All 3,423 word/content records and 57 set payloads compare unchanged after import, with zero
location conflicts and no deferred sets. See data/sentence-import-completion.json and
output/pet/sentence-final-{preview,applied,after}.json. No personal progress was written, no
external AI provider was called, and project builds/checks/tests remain for manual execution.

# Independent exam vocabulary review

Application injection: `apps/web/src/components/exams/ExamVocabularyReviewBridge.tsx` receives only `{ attemptId, links: readonly VocabularyLink[] }` from submitted review. `ExamVocabularyLinks` defines the narrow callback surface; the app imports both subject packages. English owns the reusable `ExamWordReviewCard` and controlled `ExamWordReviewSession`. Exams never imports English.

`WordPopup` accepts optional generic `sourceContext: { title, sentence, matchedForm }`, without synthesizing a textbook passage. Existing passage callers retain their behavior. Dictionary mastery, when supplied, explicitly uses the existing shared `unit::lesson::word` history; absent mastery in a batch card is not displayed as a zero record.

Server APIs:

- `GET /api/exams/word-review/links?attemptId=...`: authenticate owner first, then resolve links whose entire question scope is submitted; original authoring review remains pending, while the frozen published/withdrawn version requires approved exam/explanations records. Live `word_entries.id` and all four source fields must match. Invalid links cannot open a replacement card.
- `GET /api/exams/word-review`: up to 50 most recently updated owner batch summaries.
- `POST /api/exams/word-review`: `{ requestId, attemptId, linkId }`, deduplicates exact word IDs into the collecting batch (maximum 10) and retains unique attempt/question/link source snapshots.
- `GET /api/exams/word-review/:batchId`: owner-only projection, including saved answer/help/retry progress. Internal correct-option IDs are omitted.
- `POST /api/exams/word-review/:batchId`: `{ requestId, expectedVersion, operation }`, with `answer` only for `answer`, `wordEntryId` only for `remove`. Operations: start, answer, help, retry, next, remove. Removal only applies to the collecting batch, including stale entries; it cannot rewrite a running batch.

The English `buildQuizOptions` and `isAcceptedSpelling` helpers produce/grade B/C practice on the server; `SpellTiles` and `AnswerChoiceGroup` provide controlled UI. Choices come from real dictionary definitions and are frozen at batch start. A pool with fewer than two distinct choices fails explicitly. No Type D, generated vocabulary, automatic answer correction or client-supplied correctness is accepted. Each word completes meaning then spelling. Help is saved before opening the card; wrong answers need an explicit retry. Only a successful final save shows completion.

Local migration `20261113092149_exams_word_review.sql` follows the content/publication/attempt migrations. Owner advisory locking, UUID version CAS and owner/request command hashes make progress and final independent evidence atomic. RLS is enabled and browser grants revoked on every new table/RPC; only service_role can call persistence routines. Source snapshots and submitted owner question scope are rechecked in the transaction. No routine writes word mastery, Boss queues, active plans, rewards or ordinary vocabulary settlement.

Completed evidence lives in `exam_word_review_evidence`, once per batch/word. Meaning and spelling each retain first correctness, whether that first answer was independent, all attempt counts, help counts and final answer/verdict. This is memory practice evidence, separate from contextual transfer evidence.

`exam_word_review_transfers(batch_id,user_id,attempt_id,created_at)` associates an explicit new-material attempt with a completed owner batch. `create_exam_transfer_attempt` holds the same owner lock as exposure/attempt creation, requires training purpose, an approved published version, a matching key word with exact snapshot, and wholly unseen material families, then creates and associates the attempt in one transaction. Repeated requests do not duplicate either record. The completion link is `/exams/ket/practice?wordReviewBatchId=...`; an empty filtered catalog is “等待新题验证”. Existing active KET plans are read only to provide a continuation link; no plan is created or switched. Failure to load this optional link does not hide a successful completion.

Client data uses per-user session stores and patches successful writes. Stable failed commands retain their request ID for “重试保存”; explicit reread reconciles version conflicts. No token, source passage or answer is placed in persistent browser storage. Changing accounts remounts local card/command state. Reload restores server-saved progress; unsaved input is not claimed as saved.

## Manual acceptance (not run)

1. Apply the dependency migrations manually; verify anonymous/direct browser table/RPC calls are denied and another user's attempt/batch IDs return 404 without passages.
2. Submit a real reviewed linked question. Open its exact card; add the same word from two questions/attempts and confirm one batch item preserves both sources. Add 10 words; the eleventh is refused until the batch starts. Remove a pending word, including a renamed/deleted source.
3. With and without an active KET plan, start the batch. Complete meaning then spelling; test wrong → retry, help → answer, and reload after each saved step. Verify first independent result survives later retries.
4. Simulate lost responses and retry the same request; verify one mutation/evidence row. Submit competing versions in two tabs; one conflicts, and reread restores authoritative progress.
5. Rename/delete a linked dictionary entry after collection/start; verify no same-name replacement or new evidence is silently accepted. Frozen completed history remains readable.
6. On final save failure, keep input and a retry action; show completion only after success. Inspect new evidence alongside unchanged mastery/Boss/plan records.
7. Follow the new-material filter. Unseen matching key groups are available; reserved, already-exposed or unrelated groups cannot start through the transfer RPC. Retry creation with the same request and verify one association.
8. Open the source word card in narrow layout, use keyboard choices/spelling, and inspect loading, empty, failure, saved-answer and account-change states. Existing reading WordPopup callers should retain textbook/story context.

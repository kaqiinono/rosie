/** Group by logical phase and instants, independent of database ISO offset/precision.
 * The deadline is the ORIGINAL deadline, never an effective recovery target. Null stays null;
 * invalid timestamps remain distinct for the execution-window diagnostics to report. */
export function buildTaskBatchKey(
  courseId: string | null,
  phase: string,
  releaseAt: string,
  originalDueAt: string | null,
): string {
  const instant = (value: string | null) =>
    value !== null && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : value
  return JSON.stringify([
    courseId,
    phase === 'confirmed' ? 'after_class' : phase,
    instant(releaseAt),
    instant(originalDueAt),
  ])
}

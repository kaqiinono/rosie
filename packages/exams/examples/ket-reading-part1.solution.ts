import type { ExamSolutionRevision } from '../src/types/solutions'

// Private contract fixture. Never import into src/, a client page, or the public barrel.
// Answer reference inherited from the first-batch preview: printed p.93 / PDF p.94.
const answerSource = {
  sourceId: 'ket-official-four-tests', pdfPage: 94, printedPage: '93', role: 'solution',
} as const

export const KET_READING_EXAMPLE_SOLUTION = {
  schemaVersion: 1,
  contentRevisionId: 'ket-official-four-tests:test-1:contract-example-v1',
  solutions: [
    {
      id: 'ket-official-four-tests:test-1:solution:reading_writing:part-1:1',
      role: 'solution',
      questionId: 'ket-official-four-tests:test-1:exam:reading_writing:part-1:1',
      answerType: 'single_choice',
      correctOptionId: 'B',
      provenance: { origin: 'source', sources: [answerSource], review: { status: 'pending' } },
      explanations: [
        {
          text: '这是一则失物招领启事。失主带学生证到学校办公室领包。',
          // Existing preview wording is a summary, not a verbatim publisher explanation.
          provenance: { origin: 'supplement', sources: [answerSource], review: { status: 'pending' } },
        },
      ],
      evidence: [
        {
          source: { sourceId: 'ket-official-four-tests', pdfPage: 9, printedPage: '8', role: 'exam' },
          quote: 'Collect from school office',
          materialId: 'ket-official-four-tests:test-1:exam:reading_writing:part-1:material-1',
          blockId: 'body',
        },
      ],
      distractors: [],
    },
  ],
  teacherNotes: [],
  mediaSlots: [],
} as const satisfies ExamSolutionRevision

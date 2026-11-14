import type { ExamContentRevision, ExamContentSet } from '../src/types/content'

// Contract example only. Transcribed from the existing dev preview, not re-extracted or
// published. Source: official Test 1, printed p.8 / PDF p.9. No answers in this file.
export const KET_READING_EXAMPLE_SET = {
  id: 'ket-official-four-tests:test-1',
  source: { id: 'ket-official-four-tests', title: '01 KET青少版官方真题 全4套' },
  testNumber: 1,
  title: 'KET 真题 Test 1 · 内容契约样本',
  kind: 'official_paper',
  template: { id: 'ket-schools-2020-v1', version: 1 },
  purpose: 'training',
} as const satisfies ExamContentSet

const questionSource = {
  sourceId: 'ket-official-four-tests', pdfPage: 9, printedPage: '8', role: 'exam',
} as const

export const KET_READING_EXAMPLE = {
  schemaVersion: 1,
  id: 'ket-official-four-tests:test-1:contract-example-v1',
  contentSetId: KET_READING_EXAMPLE_SET.id,
  revision: 1,
  status: 'draft',
  materials: [
    {
      id: 'ket-official-four-tests:test-1:exam:reading_writing:part-1:material-1',
      familyId: 'ket-official-four-tests:blue-sports-bag',
      role: 'exam',
      title: '失物招领告示',
      blocks: [
        { id: 'title', kind: 'text', text: 'Found: blue sports bag' },
        { id: 'body', kind: 'text', text: 'Collect from school office' },
        { id: 'detail', kind: 'text', text: '(with student ID card)' },
      ],
      provenance: { origin: 'source', sources: [questionSource], review: { status: 'pending' } },
    },
  ],
  groups: [
    {
      id: 'ket-official-four-tests:test-1:exam:reading_writing:part-1:group-1',
      role: 'exam',
      sectionId: 'reading_writing',
      partNumber: 1,
      instructions: [{ id: 'instruction', kind: 'text', text: 'For each question, choose the correct answer.' }],
      materialIds: ['ket-official-four-tests:test-1:exam:reading_writing:part-1:material-1'],
      optionPools: [],
      questions: [
        {
          id: 'ket-official-four-tests:test-1:exam:reading_writing:part-1:1',
          location: {
            sourceId: 'ket-official-four-tests', testNumber: 1, role: 'exam',
            sectionId: 'reading_writing', partNumber: 1, questionNumber: '1',
          },
          answerType: 'single_choice',
          prompt: [],
          options: [
            { id: 'A', label: 'A student has found the wrong ID card in his sports bag.' },
            { id: 'B', label: 'The person who lost his bag can get it from the school office.' },
            { id: 'C', label: 'If you find a lost sports bag, please take it to the school office.' },
          ],
          // A real scored source question; "contract example" does not make it a book example.
          scoring: { kind: 'objective', maxPoints: 1 },
          classification: {
            domain: 'reading', questionTypeId: 'short_messages', primarySkillId: 'reading_intent',
            knowledgePointIds: [], topicIds: ['lost_property'], review: { status: 'pending' },
          },
          provenance: { origin: 'source', sources: [questionSource], review: { status: 'pending' } },
        },
      ],
      provenance: { origin: 'source', sources: [questionSource], review: { status: 'pending' } },
    },
  ],
  guidance: [],
  vocabularyLinks: [],
  mediaSlots: [],
  mediaBindingRevisionId: null,
  readiness: { exam: { status: 'pending' }, explanations: { status: 'pending' } },
} as const satisfies ExamContentRevision

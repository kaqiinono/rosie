import { issue, type ValidationIssue } from './contracts'

type Validator = (value: unknown, path: string, issues: ValidationIssue[]) => void
type Field = Validator | { optional: Validator }
type Fields = Readonly<Record<string, Field>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text: Validator = (value, path, issues) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 50_000) {
    issue(issues, path, 'invalid_string', 'Expected a nonempty string of at most 50000 characters.')
  }
}
const cellText: Validator = (value, path, issues) => {
  if (typeof value !== 'string' || value.length > 50_000) issue(issues, path, 'invalid_string', 'Expected a string of at most 50000 characters.')
}
const id: Validator = (value, path, issues) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/.test(value)) {
    issue(issues, path, 'invalid_id', 'Expected an identifier using letters, digits, colon, dot, underscore or hyphen.')
  }
}
const uuid: Validator = (value, path, issues) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    issue(issues, path, 'invalid_uuid', 'Expected a canonical word entry UUID.')
  }
}
const bool: Validator = (value, path, issues) => {
  if (typeof value !== 'boolean') issue(issues, path, 'invalid_boolean', 'Expected a boolean.')
}
const number = (min = 0, max = 1_000_000_000, integer = true): Validator => (value, path, issues) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    issue(issues, path, 'invalid_number', 'Expected a finite number within the allowed bounds.')
  }
}
const oneOf = (...values: readonly (string | number | boolean)[]): Validator => (value, path, issues) => {
  if (!values.some(candidate => candidate === value)) issue(issues, path, 'invalid_enum', 'Value is not an allowed choice.')
}
const nullable = (validate: Validator): Validator => (value, path, issues) => {
  if (value !== null) validate(value, path, issues)
}
const optional = (validate: Validator): Field => ({ optional: validate })
const array = (validate: Validator, min = 0): Validator => (value, path, issues) => {
  if (!Array.isArray(value) || value.length < min || value.length > 2_000) {
    issue(issues, path, 'invalid_array', 'Expected an array within the allowed size bounds.')
    return
  }
  value.forEach((item: unknown, index: number) => validate(item, `${path}[${index}]`, issues))
}
const object = (fields: Fields): Validator => (value, path, issues) => {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid_object', 'Expected an object.')
    return
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key)) issue(issues, path, 'unknown_field', 'Object contains a field not allowed by this contract.')
  }
  for (const [key, field] of Object.entries(fields)) {
    const exists = Object.hasOwn(value, key)
    if (typeof field === 'function') {
      if (!exists) issue(issues, `${path}.${key}`, 'required_field', 'Required field is missing.')
      else field(value[key], `${path}.${key}`, issues)
    } else if (exists) field.optional(value[key], `${path}.${key}`, issues)
  }
}
const tagged = (key: string, variants: Readonly<Record<string, Validator>>): Validator => (value, path, issues) => {
  if (!isRecord(value) || typeof value[key] !== 'string' || !Object.hasOwn(variants, value[key])) {
    issue(issues, `${path}.${key}`, 'invalid_variant', 'Unknown object variant.')
    return
  }
  variants[value[key]](value, path, issues)
}

const review: Validator = (value, path, issues) => {
  if (isRecord(value) && value.status === 'approved') {
    issue(issues, path, 'review_not_authorized', 'Draft writes cannot approve content; approval requires a separate review operation.')
    return
  }
  tagged('status', {
    pending: object({ status: oneOf('pending') }),
    blocked: object({ status: oneOf('blocked'), reason: text }),
  })(value, path, issues)
}
const role = oneOf('exam', 'training', 'guidance', 'teacher_notes', 'solution')
const questionRole = oneOf('exam', 'training')
const sourceReference = object({
  sourceId: id, pdfPage: number(1), printedPage: nullable(text), role,
  region: optional(object({ x: number(0, 1, false), y: number(0, 1, false), width: number(Number.MIN_VALUE, 1, false), height: number(Number.MIN_VALUE, 1, false) })),
})
const provenance = object({
  origin: oneOf('source', 'translation', 'supplement'), sources: array(sourceReference),
  authorship: optional(oneOf('human', 'ai_assisted')), review,
})
const blockBase = {
  id,
  answerSlots: optional(array(object({ sourceText: optional(text), start: number(0), end: number(1), questionId: id, gapId: optional(id), row: optional(number(0)), column: optional(number(0)) }))),
  sentences: optional(array(object({ id, sourceText: optional(text), start: number(0), end: number(1) }))),
}
const imageRegion = object({ x: number(0, 1, false), y: number(0, 1, false), width: number(Number.MIN_VALUE, 1, false), height: number(Number.MIN_VALUE, 1, false) })
const block = tagged('kind', {
  text: object({ ...blockBase, kind: oneOf('text'), text, presentation: optional(tagged('role', {
    heading: object({ role: oneOf('heading'), prefix: optional(text), originalText: optional(text) }),
    instruction: object({ role: oneOf('instruction'), number: text, originalText: optional(text) }),
  })) }),
  email: object({ ...blockBase, kind: oneOf('email'), from: text, to: text, subject: cellText, body: array(text) }),
  table: object({ ...blockBase, kind: oneOf('table'), headers: array(cellText), rows: array(array(cellText)) }),
  image: object({ ...blockBase, kind: oneOf('image'), mediaSlotId: id, alt: text, caption: optional(text), aspectRatio: optional(number(0.05, 20, false)), displayWidth: optional(number(80, 1200)) }),
  audio: object({ ...blockBase, kind: oneOf('audio'), mediaSlotId: id }),
})
const blocks = array(block)
const option = object({ id, label: text, imageSlotId: optional(id), imageRegion: optional(imageRegion), displayWidth: optional(number(80, 1200)) })
const unscored = {
  example: object({ kind: oneOf('example'), points: oneOf(0) }),
  unscored: object({ kind: oneOf('unscored'), points: oneOf(0) }),
}
const objectiveScoring = tagged('kind', { ...unscored, objective: object({ kind: oneOf('objective'), maxPoints: number(Number.MIN_VALUE, 1_000, false) }) })
const manualScoring = tagged('kind', { ...unscored, manual: object({ kind: oneOf('manual'), rubricId: id }) })
const questionBase: Fields = {
  id, exampleText: optional(text), displayLabel: optional(text),
  location: object({ sourceId: id, testNumber: number(1), role: questionRole, sectionId: id, partNumber: number(1), questionNumber: id }),
  prompt: blocks,
  classification: object({
    domain: oneOf('reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary'),
    questionTypeId: id, primarySkillId: id, knowledgePointIds: array(id), topicIds: array(id), review,
  }),
  provenance,
}
const question = tagged('answerType', {
  multiple_choice: object({ ...questionBase, answerType: oneOf('multiple_choice'), options: array(option, 2), selectionCount: number(1), scoring: objectiveScoring }),
  single_choice: object({ ...questionBase, answerType: oneOf('single_choice'), options: array(option, 2), scoring: objectiveScoring }),
  gap_fill: object({ ...questionBase, answerType: oneOf('gap_fill'), gaps: array(object({ id, label: text, maxWords: nullable(number(1)) }), 1), answerOrder: oneOf('fixed', 'any'), optionPoolId: optional(id), scoring: objectiveScoring }),
  matching: object({ ...questionBase, answerType: oneOf('matching'), items: array(object({ id, prompt: blocks }), 1), optionPoolId: id, scoring: objectiveScoring }),
  writing: object({ ...questionBase, answerType: oneOf('writing'), minimumWords: nullable(number(0)), scoring: manualScoring }),
  speaking: object({ ...questionBase, answerType: oneOf('speaking'), scoring: manualScoring }),
  self_check: object({ ...questionBase, answerType: oneOf('self_check'), checklist: array(object({ id, label: text })), scoring: tagged('kind', unscored) }),
})
const mediaBase: Fields = {
  id, target: object({ kind: oneOf('content_set', 'group', 'guidance', 'teacher_notes'), id }),
  sourceTrackLabel: nullable(text), required: bool,
  segment: nullable(object({ startMs: number(0), endMs: number(1) })),
  playback: nullable(object({ repeatCount: number(1, 100), waitAfterMs: number(0), includesSourceRepetitions: bool })),
  provenance,
}
const studentMedia = object({ ...mediaBase, audience: oneOf('student'), purpose: oneOf('exam_listening', 'training_audio', 'question_image') })
const privateMedia = tagged('audience', {
  review: object({ ...mediaBase, audience: oneOf('review'), purpose: oneOf('speaking_example', 'solution_image') }),
  parent: object({ ...mediaBase, audience: oneOf('parent'), purpose: oneOf('examiner_audio', 'examiner_image') }),
  admin: object({ ...mediaBase, audience: oneOf('admin'), purpose: oneOf('source_page') }),
})
const explanation = object({ text, provenance })
const solutionBase: Fields = {
  id, role: oneOf('solution'), questionId: id, provenance, explanations: array(explanation),
  evidence: array(object({ source: sourceReference, quote: text, materialId: optional(id), blockId: optional(id) })),
  distractors: array(object({ optionId: id, explanation })),
}
const solution = tagged('answerType', {
  multiple_choice: object({ ...solutionBase, answerType: oneOf('multiple_choice'), acceptedOptionSets: array(array(id, 1), 1) }),
  single_choice: object({ ...solutionBase, answerType: oneOf('single_choice'), correctOptionId: id }),
  gap_fill: object({ ...solutionBase, answerType: oneOf('gap_fill'), acceptedAnswerSets: array(array(object({ gapId: id, value: text }), 1)), normalization: object({ trim: oneOf(true), ignoreCase: oneOf(true) }) }),
  matching: object({ ...solutionBase, answerType: oneOf('matching'), acceptedMatches: array(array(object({ itemId: id, optionId: id }), 1)) }),
  writing: object({
    ...solutionBase, answerType: oneOf('writing'), taskGuidance: array(explanation),
    samples: array(object({ id, text, provenance, originalScore: nullable(object({ score: number(0, 1_000, false), maximum: number(Number.MIN_VALUE, 1_000, false), source: sourceReference })), originalComments: array(explanation), supplementaryComments: array(explanation) })),
  }),
  speaking: object({ ...solutionBase, answerType: oneOf('speaking'), reviewGuidance: array(explanation) }),
  self_check: object({ ...solutionBase, answerType: oneOf('self_check'), guidance: array(explanation) }),
})

export const validateDraftShape: Validator = object({
  contentSet: object({
    id, source: object({ id, title: text, edition: optional(text), fileHash: optional(text) }),
    testNumber: number(1), title: text, kind: oneOf('official_paper', 'mock_paper', 'training_unit'),
    template: object({ id, version: number(1) }), purpose: oneOf('training', 'reserved'),
  }),
  content: object({
    schemaVersion: oneOf(1), id, contentSetId: id, revision: number(1), status: oneOf('draft'),
    materials: array(object({ id, familyId: id, role: questionRole, title: text, blocks, provenance,
      layout: optional(array(object({ id, headingBlockId: optional(id), bodyBlockIds: array(id), imageBlockId: optional(id), imageSide: optional(oneOf('left', 'right')) }), 1)),
    })),
    groups: array(object({
      id, role: questionRole, sectionId: id, partNumber: number(1), instructions: blocks, materialIds: array(id),
      activities: optional(array(object({ id, title: cellText, instructionIds: array(id), materialIds: array(id), questionIds: array(id), layout: oneOf('questions', 'matching', 'image_labels', 'cloze', 'handwriting'), handwritingSize: optional(oneOf('letter', 'word')), choicePresentation: optional(object({ kind: oneOf('judgment', 'letters'), options: array(object({ value: text, label: text }), 2) })), wordBank: optional(array(text)), imageDisplayWidth: optional(number(80, 1200)), imageSlotId: optional(id), positions: optional(array(object({ questionId: id, x: number(0, 100, false), y: number(0, 100, false) }))) }))),
      optionPools: array(object({ id, options: array(option, 1), allowReuse: bool })), questions: array(question), provenance,
    })),
    guidance: array(object({ id, role: oneOf('guidance'), groupIds: array(id), blocks, provenance })),
    vocabularyLinks: array(object({
      id, wordEntryId: uuid, sourceSnapshot: object({ stage: text, unit: text, lesson: text, word: text }),
      questionIds: array(id), materialId: id, blockId: id, matchedForm: text, contextMeaning: text, sentence: text,
      textRange: object({ start: number(0), end: number(1) }), role: oneOf('key', 'background'), review,
    })),
    mediaSlots: array(studentMedia), mediaBindingRevisionId: nullable(id),
    readiness: object({ exam: review, explanations: review }),
  }),
  solutions: object({
    schemaVersion: oneOf(1), contentRevisionId: id, solutions: array(solution),
    teacherNotes: array(object({ id, role: oneOf('teacher_notes'), sectionId: id, partNumber: number(1), groupIds: array(id), kind: oneOf('examiner_script', 'teaching_guidance', 'scoring_guidance', 'listening_transcript'), blocks, provenance })),
    mediaSlots: array(privateMedia),
  }),
})

/** Reject non-JSON values, cycles, huge strings/arrays and excessive nesting before recursive schemas. */
export function validateJsonBounds(input: unknown, issues: ValidationIssue[]): void {
  const seen = new WeakSet<object>()
  let nodes = 0
  let characters = 0
  const visit = (value: unknown, path: string, depth: number): void => {
    if (issues.length) return
    nodes += 1
    if (depth > 24 || nodes > 50_000) {
      issue(issues, path, 'input_limit', 'Input exceeds the nesting or node limit.')
      return
    }
    if (value === null || typeof value === 'boolean') return
    if (typeof value === 'string') {
      characters += value.length
      if (value.length > 50_000 || characters > 2_000_000) issue(issues, path, 'input_limit', 'Input exceeds the text size limit.')
      return
    }
    if (typeof value === 'number' && Number.isFinite(value)) return
    if (typeof value !== 'object' || seen.has(value)) {
      issue(issues, path, 'invalid_json', 'Expected finite, acyclic JSON data.')
      return
    }
    seen.add(value)
    if (Array.isArray(value)) {
      if (value.length > 2_000) issue(issues, path, 'input_limit', 'Array exceeds the size limit.')
      else for (let index = 0; index < value.length; index += 1) visit(value[index], `${path}[${index}]`, depth + 1)
    } else {
      const prototype: unknown = Object.getPrototypeOf(value)
      if (prototype !== Object.prototype && prototype !== null) {
        issue(issues, path, 'invalid_json', 'Expected a plain JSON object.')
        return
      }
      const descriptors = Object.getOwnPropertyDescriptors(value)
      if (Reflect.ownKeys(value).length > 100) issue(issues, path, 'input_limit', 'Object exceeds the field limit.')
      else for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || key.length > 256 || !Object.hasOwn(descriptors[key], 'value')) {
          issue(issues, path, 'invalid_json', 'Expected ordinary JSON properties.')
          break
        }
        const child: unknown = descriptors[key].value
        visit(child, path, depth + 1)
      }
    }
    seen.delete(value)
  }
  visit(input, '$', 0)
}

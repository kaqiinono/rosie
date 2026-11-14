import 'server-only'

import type { ExamDraftInput } from '@rosie/exams/validation'
import { isExamInk } from '@rosie/exams/validation'
import type { ExamAnswer, ExamAttemptState, ExamQuestionResult } from '@rosie/exams'
import type { Question, QuestionGroup, Solution } from '@rosie/exams'
import { ExamApiError } from './http'

export type AttemptOperation = 'start' | 'save' | 'submit' | 'expire' | 'help' | 'interrupt' | 'resume' | 'script' | 'grade'
export interface AttemptCommand {
  answers?: unknown
  annotations?: unknown
  groupId?: string
  sectionId?: string
  questionId?: string
  playbackPositionMs?: number
}

function fail(code = 'exam_invalid_answer', status = 400): never { throw new ExamApiError(code, status) }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
function exact(value: Record<string, unknown>, names: string[]) {
  if (Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail()
}
function text(value: unknown, max = 20000): string {
  if (typeof value !== 'string' || value.length > max) return fail()
  return value
}
function textMap(value: unknown, ids: readonly string[]): Record<string, string> {
  const record = object(value)
  if (Object.keys(record).some(id => !ids.includes(id))) fail()
  return Object.fromEntries(Object.entries(record).map(([id, entry]) => [id, text(entry, 1000)]))
}

export function parseExamAnswer(value: unknown, question: Question, group: QuestionGroup): ExamAnswer {
  const answer = object(value)
  if (answer.type !== question.answerType) return fail()
  switch (question.answerType) {
    case 'single_choice': {
      exact(answer, ['type', 'optionId'])
      const optionId = text(answer.optionId, 256)
      if (optionId && !question.options.some(option => option.id === optionId)) fail()
      return { type: 'single_choice', optionId }
    }
    case 'multiple_choice': {
      exact(answer, ['type', 'optionIds'])
      if (!Array.isArray(answer.optionIds) || answer.optionIds.length > question.selectionCount) return fail()
      const optionIds = answer.optionIds.map(id => text(id, 256))
      if (new Set(optionIds).size !== optionIds.length || optionIds.some(id => !question.options.some(option => option.id === id))) return fail()
      return { type: 'multiple_choice', optionIds }
    }
    case 'gap_fill': {
      exact(answer, answer.ink === undefined ? ['type', 'values'] : ['type', 'values', 'ink'])
      const values = textMap(answer.values, question.gaps.map(gap => gap.id))
      if (answer.ink === undefined) return { type: 'gap_fill', values }
      const ink = object(answer.ink)
      if (question.optionPoolId || Object.entries(ink).some(([id, entry]) => !question.gaps.some(gap => gap.id === id)
        || !!values[id]?.trim() || !isExamInk(entry))) fail()
      return { type: 'gap_fill', values, ink: ink as NonNullable<Extract<ExamAnswer, { type: 'gap_fill' }>['ink']> }
    }
    case 'matching': {
      exact(answer, ['type', 'matches'])
      const matches = textMap(answer.matches, question.items.map(item => item.id))
      const pool = group.optionPools.find(item => item.id === question.optionPoolId)
      if (!pool || Object.values(matches).some(id => id && !pool.options.some(option => option.id === id))) fail()
      return { type: 'matching', matches }
    }
    case 'writing': exact(answer, ['type', 'text']); return { type: 'writing', text: text(answer.text) }
    case 'speaking': {
      exact(answer, ['type', 'recordingIds', 'abandoned'])
      if (!Array.isArray(answer.recordingIds) || answer.recordingIds.length > 4 || typeof answer.abandoned !== 'boolean') return fail()
      const recordingIds = answer.recordingIds.map(id => text(id, 36))
      if (recordingIds.some(id => !/^[0-9a-f-]{36}$/i.test(id)) || new Set(recordingIds).size !== recordingIds.length || (answer.abandoned && recordingIds.length)) fail()
      return { type: 'speaking', recordingIds, abandoned: answer.abandoned }
    }
    case 'self_check': {
      exact(answer, ['type', 'checkedIds'])
      if (!Array.isArray(answer.checkedIds)) return fail()
      const checkedIds = answer.checkedIds.map(id => text(id, 256))
      if (checkedIds.some(id => !question.checklist.some(item => item.id === id)) || new Set(checkedIds).size !== checkedIds.length) fail()
      return { type: 'self_check', checkedIds }
    }
  }
}

function normalized(value: string): string { return value.trim().toLowerCase() }
function empty(answer: ExamAnswer | undefined): boolean {
  if (!answer) return true
  switch (answer.type) {
    case 'single_choice': return !answer.optionId
    case 'multiple_choice': return !answer.optionIds.length
    case 'gap_fill': return !Object.keys(answer.ink ?? {}).length && Object.values(answer.values).every(value => !value.trim())
    case 'matching': return Object.values(answer.matches).every(value => !value)
    case 'writing': return !answer.text.trim()
    case 'speaking': return !answer.recordingIds.length
    case 'self_check': return !answer.checkedIds.length
  }
}

export function scoreExamQuestion(question: Question, answer: ExamAnswer | undefined, solution: Solution | undefined): ExamQuestionResult {
  if (question.scoring.kind === 'example' || question.scoring.kind === 'unscored') return { questionId: question.id, outcome: 'unscored', points: null, maxPoints: null }
  if (question.scoring.kind === 'manual') return { questionId: question.id, outcome: 'pending', points: null, maxPoints: null }
  if (answer?.type === 'gap_fill' && Object.keys(answer.ink ?? {}).length) return { questionId: question.id, outcome: 'pending', points: null, maxPoints: null }
  const maxPoints = question.scoring.maxPoints
  if (empty(answer)) return { questionId: question.id, outcome: 'unanswered', points: 0, maxPoints }
  if (!solution || solution.answerType !== question.answerType || !answer) return fail('exam_content_unavailable', 503)
  let correct = false
  if (answer.type === 'single_choice' && solution.answerType === 'single_choice') correct = answer.optionId === solution.correctOptionId
  if (answer.type === 'multiple_choice' && solution.answerType === 'multiple_choice') correct = solution.acceptedOptionSets.some(set => set.length === answer.optionIds.length && set.every(id => answer.optionIds.includes(id)))
  if (answer.type === 'gap_fill' && solution.answerType === 'gap_fill' && question.answerType === 'gap_fill') {
    const actual = question.gaps.map(gap => normalized(answer.values[gap.id] ?? ''))
    // Any-order answers compare complete multisets, retaining duplicate counts.
    correct = solution.acceptedAnswerSets.some(set => {
      const expected = question.gaps.map(gap => normalized(set.find(value => value.gapId === gap.id)?.value ?? ''))
      if (question.answerOrder === 'any') { actual.sort(); expected.sort() }
      return actual.length === expected.length && actual.every((value, i) => value !== '' && value === expected[i])
    })
  }
  if (answer.type === 'matching' && solution.answerType === 'matching' && question.answerType === 'matching') {
    correct = solution.acceptedMatches.some(set => question.items.every(item => {
      const actual = answer.matches[item.id]
      return !!actual && set.some(value => value.itemId === item.id && value.optionId === actual)
    }))
  }
  return { questionId: question.id, outcome: correct ? 'correct' : 'incorrect', points: correct ? maxPoints : 0, maxPoints }
}

export function selectedGroups(draft: ExamDraftInput, state: ExamAttemptState): readonly QuestionGroup[] {
  return draft.content.groups.filter(group => state.groupIds.includes(group.id))
}

export function newExamAttempt(draft: ExamDraftInput, mode: 'practice' | 'mock', groupId: string | undefined, now: string): ExamAttemptState {
  const groups = mode === 'practice' ? draft.content.groups.filter(group => group.id === groupId) : draft.content.groups.filter(group => group.role === 'exam')
  if (!groups.length || (mode === 'practice' && draft.contentSet.purpose !== 'training')) fail('exam_content_unavailable', 409)
  if (mode === 'mock' && draft.contentSet.kind === 'training_unit') fail('exam_invalid_mode')
  const sections = [...new Set(groups.map(group => group.sectionId))]
  const currentSectionId = mode === 'practice' ? groups[0].sectionId : null
  return {
    schemaVersion: 1, mode, groupIds: groups.map(group => group.id), currentSectionId,
    currentGroupId: mode === 'practice' ? groups[0].id : null,
    sections: Object.fromEntries(sections.map(sectionId => [sectionId, {
      status: sectionId === currentSectionId ? 'active' : 'not_started', startedAt: sectionId === currentSectionId ? now : null,
      deadlineAt: null, submittedAt: null, interruptedAt: null, technicalInterruption: false, timedOut: false,
    }])),
    answers: {}, results: {}, helpQuestionIds: [], priorExposureFamilies: [], groupActiveMs: {},
    lastActivityAt: currentSectionId ? now : null, playbackPositionMs: 0, scriptGrant: null,
  }
}

export function applyExamOperation(draft: ExamDraftInput, original: ExamAttemptState, operation: AttemptOperation,
  command: AttemptCommand, now: string, listeningDurationMs: number | null = null): { state: ExamAttemptState; exposureGroupIds: string[] } {
  const state = structuredClone(original)
  const time = Date.parse(now)
  const groups = selectedGroups(draft, state)
  const current = state.currentSectionId ? state.sections[state.currentSectionId] : null
  if (operation === 'start') {
    const sectionId = command.sectionId
    if (state.mode !== 'mock' || current || !sectionId || state.sections[sectionId]?.status !== 'not_started') fail('exam_invalid_transition', 409)
    const scope = groups.filter(group => group.sectionId === sectionId)
    if (!scope.length) fail('exam_invalid_transition', 409)
    let duration: number | null = sectionId === 'reading_writing' ? 3_600_000 : null
    if (sectionId === 'listening') {
      if (!listeningDurationMs || !Number.isFinite(listeningDurationMs) || listeningDurationMs <= 0) fail('exam_playback_unavailable', 409)
      duration = listeningDurationMs
    }
    state.sections[sectionId] = { status: 'active', startedAt: now, deadlineAt: duration ? new Date(time + duration).toISOString() : null,
      submittedAt: null, interruptedAt: null, technicalInterruption: false, timedOut: false }
    state.currentSectionId = sectionId
    state.currentGroupId = scope[0].id
    state.lastActivityAt = now
    state.playbackPositionMs = 0
    state.scriptGrant = null
    return { state, exposureGroupIds: scope.map(group => group.id) }
  }
  if (!current || !state.currentSectionId) fail('exam_invalid_transition', 409)
  const scope = groups.filter(group => group.sectionId === state.currentSectionId)
  const expired = current.deadlineAt !== null && time >= Date.parse(current.deadlineAt) && current.status !== 'interrupted'
  if (expired && operation !== 'expire') fail('exam_expired', 409)
  if (operation === 'expire' && !expired) fail('exam_invalid_transition', 409)
  if (current.status === 'interrupted' && operation !== 'resume') fail('exam_interrupted', 409)
  if (current.status !== 'active' && operation !== 'resume') fail('exam_invalid_transition', 409)
  if (operation === 'resume') {
    if (current.status !== 'interrupted' || !current.interruptedAt) fail('exam_invalid_transition', 409)
    if (current.deadlineAt) current.deadlineAt = new Date(Date.parse(current.deadlineAt) + Math.max(0, time - Date.parse(current.interruptedAt))).toISOString()
    current.interruptedAt = null
    current.status = 'active'
    state.lastActivityAt = now
    return { state, exposureGroupIds: [] }
  }
  if (operation === 'interrupt') {
    if (state.mode !== 'mock' || state.currentSectionId !== 'listening') fail('exam_invalid_transition', 409)
    current.status = 'interrupted'
    current.technicalInterruption = true
    current.interruptedAt = now
    state.scriptGrant = null
    return { state, exposureGroupIds: [] }
  }
  if (operation === 'help') {
    if (state.mode !== 'practice' || !scope.some(group => group.questions.some(question => question.id === command.questionId))) fail('exam_help_unavailable', 403)
    if (command.questionId && !state.helpQuestionIds.includes(command.questionId)) state.helpQuestionIds.push(command.questionId)
    return { state, exposureGroupIds: [] }
  }
  if (operation !== 'save' && operation !== 'submit' && operation !== 'expire') fail('exam_invalid_transition', 409)
  if (operation !== 'expire' && command.annotations !== undefined) {
    const marks = object(command.annotations)
    const groups = draft.content.groups.filter(group => state.groupIds.includes(group.id) && group.sectionId === state.currentSectionId)
    const blockEntries = groups.flatMap(group => [...group.instructions, ...group.questions.flatMap(q => [...q.prompt]), ...draft.content.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => [...material.blocks])].map(block => [`${group.id}/${block.id}`, block] as const))
    const blocks = new Map<string, (typeof blockEntries)[number][1]>(blockEntries)
    const next = { ...state.annotations }
    for (const [id, selected] of Object.entries(marks)) {
      const block = blocks.get(id)
      if (!block || !Array.isArray(selected) || selected.length > (block.sentences?.length ?? 0) || new Set(selected).size !== selected.length || selected.some(value => typeof value !== 'string' || !block.sentences?.some(sentence => sentence.id === value))) return fail()
      next[id] = selected as string[]
    }
    state.annotations = next
  }
  if (operation !== 'expire' && command.answers !== undefined) {
    const answers = object(command.answers)
    for (const [id, value] of Object.entries(answers)) {
      const group = scope.find(item => item.questions.some(question => question.id === id))
      const question = group?.questions.find(item => item.id === id)
      if (!group || !question || question.scoring.kind === 'example') fail()
      state.answers[id] = parseExamAnswer(value, question, group)
    }
  }
  if (state.currentGroupId && state.lastActivityAt && operation !== 'expire') {
    state.groupActiveMs[state.currentGroupId] = (state.groupActiveMs[state.currentGroupId] ?? 0) + Math.min(30_000, Math.max(0, time - Date.parse(state.lastActivityAt)))
  }
  state.lastActivityAt = now
  if (command.groupId) {
    const group = scope.find(item => item.id === command.groupId)
    if (!group) fail()
    if (state.scriptGrant && state.scriptGrant.partNumber !== group.partNumber) state.scriptGrant = null
    state.currentGroupId = group.id
  }
  if (command.playbackPositionMs !== undefined) {
    if (state.currentSectionId !== 'listening' || !Number.isFinite(command.playbackPositionMs) || command.playbackPositionMs < 0 || command.playbackPositionMs > 86_400_000) fail()
    state.playbackPositionMs = command.playbackPositionMs
  }
  if (operation === 'submit' || operation === 'expire') {
    for (const question of scope.flatMap(group => group.questions)) {
      state.results[question.id] = scoreExamQuestion(question, state.answers[question.id], draft.solutions.solutions.find(solution => solution.questionId === question.id))
    }
    current.status = 'submitted'
    current.submittedAt = now
    current.timedOut = operation === 'expire'
    state.currentSectionId = null
    state.currentGroupId = null
    state.lastActivityAt = null
    state.scriptGrant = null
  }
  return { state, exposureGroupIds: [] }
}

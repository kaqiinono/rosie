import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, ExamApiError, examFailure, examJson } from '@/lib/exams/http'
import { attemptUuid, projectExamAttempt, readAttemptEnvelope } from '@/lib/exams/attempts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await authorizeExamRequest(request, true)
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => key !== 'userId') || params.getAll('userId').length !== 1) throw new ExamApiError('exam_invalid_request', 400)
    const userId = attemptUuid(params.get('userId'))
    const id = attemptUuid((await context.params).id)
    const current = await readAttemptEnvelope(createAdminSupabase(), userId, id)
    const view = projectExamAttempt(current)
    // Explicit owner selection does not unlock unfinished scopes for grading.
    const groups = view.groups.filter(group => view.state.sections[group.sectionId]?.status === 'submitted')
    const groupIds = new Set(groups.map(group => group.id))
    const questionIds = new Set<string>(groups.flatMap(group => group.questions.map(question => question.id)))
    const materialIds = new Set(groups.flatMap(group => [...group.materialIds]))
    const sectionIds = new Set(groups.map(group => group.sectionId))
    return examJson({ ...view, adminRevisionId: current.attempt.contentRevisionId, groups, materials: view.materials.filter(material => materialIds.has(material.id)),
      mediaSlots: view.mediaSlots.filter(slot => (slot.target.kind === 'group' && groupIds.has(slot.target.id))
        || (slot.target.kind === 'content_set' && slot.purpose === 'exam_listening' && sectionIds.has('listening'))),
      vocabularyLinks: [],
      state: { ...view.state, groupIds: [...groupIds], currentGroupId: null, currentSectionId: null, scriptGrant: null, lastActivityAt: null,
        sections: Object.fromEntries(Object.entries(view.state.sections).filter(([section]) => sectionIds.has(section))),
        answers: Object.fromEntries(Object.entries(view.state.answers).filter(([question]) => questionIds.has(question))),
        results: Object.fromEntries(Object.entries(view.state.results).filter(([question]) => questionIds.has(question))),
        helpQuestionIds: view.state.helpQuestionIds.filter(question => questionIds.has(question)),
        groupActiveMs: Object.fromEntries(Object.entries(view.state.groupActiveMs).filter(([group]) => groupIds.has(group))),
      } })
  } catch (error) { return examFailure(error) }
}

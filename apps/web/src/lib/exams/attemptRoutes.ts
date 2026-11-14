import 'server-only'

import { createAdminSupabase } from '@/lib/api-auth'
import { authorizeExamRequest, examFailure, examJson } from './http'
import { attemptUuid, mutateExamAttempt, projectAttemptReview, projectExamAttempt, readAttemptCommand } from './attempts'
import type { AttemptOperation } from './attemptEngine'

type Context = { params: Promise<{ id: string }> }

export function examAttemptMutation(operation: AttemptOperation) {
  return async (request: Request, context: Context) => {
    try {
      const user = await authorizeExamRequest(request)
      const id = attemptUuid((await context.params).id)
      const command = await readAttemptCommand(request, operation)
      const result = await mutateExamAttempt(createAdminSupabase(), user.id, id, operation, command)
      return examJson(operation === 'help'
        ? { attempt: projectExamAttempt(result), review: projectAttemptReview(result, command.questionId) }
        : projectExamAttempt(result))
    } catch (error) { return examFailure(error) }
  }
}

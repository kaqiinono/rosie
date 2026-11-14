import type { ReactNode } from 'react'
import { Badge, Flex } from '@rosie/ui/themes'
import type { Question } from '../types/questions'
import type { MaterialBlock } from '../types/content'

/** Keep the number and answer controls independent of wrapped prompt text. */
export function ExamAlignedQuestion({ number, prompt, response, stacked = false }: {
  number: string; prompt: ReactNode; response: ReactNode; stacked?: boolean
}) {
  const example = number === 'Example'
  return <Flex direction={stacked ? 'column' : 'row'} wrap={stacked ? undefined : 'wrap'}
    align={stacked ? 'stretch' : 'center'} gap="3" flexGrow="1" minWidth="0">
    <Flex align="start" gap="3" minWidth="0" maxWidth="100%">
      <Badge size="2" radius="full" variant={example ? 'soft' : 'solid'} color={example ? 'amber' : undefined}>{number}</Badge>
      <div className="min-w-0 break-words">{prompt}</div>
    </Flex>
    {response && <div className={stacked ? 'mt-auto w-full min-w-0' : 'max-w-full shrink-0'}>{response}</div>}
  </Flex>
}

/** Avoid repeating an authored example answer already visible in the prompt. */
export function exampleAnswerIsVisible(question: Question, prompt: readonly MaterialBlock[] = question.prompt): boolean {
  const answer = question.exampleText?.trim()
  if (!answer) return false
  return prompt.some(block => block.answerSlots?.some(slot => slot.questionId === question.id))
    || prompt.some(block => block.kind === 'text' && (
      block.text.trim().replace(/[.!。]+$/, '') === answer
      || block.text.trim().replace(/[.!。]+$/, '').endsWith(` ${answer}`)
    ))
}

'use client'

import { AnswerChoiceGroup, SentenceHighlightText, StickerCard } from '@rosie/ui'
import { Flex, Heading, Text } from '@rosie/ui/themes'
import { CHEESE_SENTENCE_PARAGRAPHS } from './reading-type-sample'

type QuestionId = '14' | '15'
export type ReadingAnnotationState = {
  selected: string[]
  history: string[][]
}
export function createReadingAnnotations(): ReadingAnnotationState {
  return { selected: [], history: [] }
}
const questions = {
  '14': { prompt: 'Pat learned to make good cheese', options: [
    { id: 'A', label: 'by listening to the advice she got.' },
    { id: 'B', label: 'by seeing how her mother did it.' },
    { id: 'C', label: 'by practising at home on her own.' },
  ] },
  '15': { prompt: 'Where does Pat get the milk for her cheese?', options: [
    { id: 'A', label: 'from her neighbour’s farm' },
    { id: 'B', label: 'her father helps her to buy it' },
    { id: 'C', label: 'her parents give it to her' },
  ] },
}

type Props = {
  annotations: ReadingAnnotationState
  onAnnotationsChange: (next: ReadingAnnotationState) => void
  answers: Readonly<Record<string, string>>
  onAnswer: (questionId: QuestionId, optionId: string) => void
  readOnly: boolean
}

export default function ReadingHighlightPreview({ annotations, onAnnotationsChange, answers, onAnswer, readOnly }: Props) {
  let text = ''
  const sentences: { id: string; start: number; end: number }[] = []
  CHEESE_SENTENCE_PARAGRAPHS.forEach((paragraph, p) => {
    if (p) text += '\n\n'
    paragraph.forEach((sentence, index) => {
      if (index) text += ' '
      const start = text.length
      text += sentence.text
      sentences.push({ id: sentence.id, start, end: text.length })
    })
  })
  return <Flex direction="column" gap="4">
    <StickerCard tone="paper" elevation="flat" size="md">
      <Heading as="h3" size="5">Pat Tulloch</Heading>
      <SentenceHighlightText text={text} sentences={sentences} selected={annotations.selected}
        onValueChange={selected => onAnnotationsChange({ selected, history: [] })} readOnly={readOnly} />
    </StickerCard>
    {(['14', '15'] as const).map(questionId => <Flex key={questionId} direction="column" gap="3">
      <Text size="4" weight="bold" lang="en">{questionId}. {questions[questionId].prompt}</Text>
      <AnswerChoiceGroup label={`第 ${questionId} 题选项`} optionLang="en" options={questions[questionId].options} value={answers[questionId] ?? ''}
        onValueChange={next => onAnswer(questionId, next)} readOnly={readOnly} reserveFeedbackSpace={false} />
    </Flex>)}
  </Flex>
}

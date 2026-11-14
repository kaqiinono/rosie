'use client'

import { ExamAttemptReviewPage, ExamGradingPanel } from '@rosie/exams'
import { ExamVocabularyReviewBridge } from './ExamVocabularyReviewBridge'

export function ExamAttemptReviewScreen({ id }: { id: string }) {
  return <ExamAttemptReviewPage id={id}
    renderVocabulary={props => <ExamVocabularyReviewBridge {...props} />}
    renderGrading={props => <ExamGradingPanel {...props} />} />
}

'use client'

import { useState } from 'react'
import { DarkScope, FormSelect, PageShell, StickerCard } from '@rosie/ui'
import { Button, Text } from '@rosie/ui/themes'
import CalcQuestionStage from '../components/CalcQuestionStage'
import type { FeedbackKind } from '../components/FeedbackOverlay'
import { checkAnswer, formatAnswer } from '../utils/calc-answer'
import { CALC_DEMO_SAMPLES, type CalcDemoSample } from '../utils/calc-demo-samples'

const sampleOptions = CALC_DEMO_SAMPLES.map(({ id, label }) => ({ value: id, label }))

function QuestionPreview({ sample }: { sample: CalcDemoSample }) {
  const [answerMode, setAnswerMode] = useState(sample.question.answerMode ?? 'pad')
  const [input, setInput] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)
  const question = { ...sample.question, answerMode }
  const finished = feedback === 'correct' || feedback === 'wrong'

  function submitResult(correct: boolean) {
    if (finished) return
    if (correct) {
      setFeedback('correct')
    } else if (attempts === 0) {
      setInput('')
      setFeedback('retry')
    } else {
      setFeedback('wrong')
    }
    setAttempts(attempts + 1)
  }

  function submitAnswer(raw: string) {
    if (raw.trim()) submitResult(checkAnswer(raw, question.answer))
  }

  function switchAnswerMode(next: 'pad' | 'vertical') {
    setInput('')
    setAnswerMode(next)
  }

  return (
    <>
      <DarkScope>
        <div className="flex h-[clamp(34rem,75svh,45rem)] min-w-0 flex-col rounded-3xl bg-violet-950 px-3 pt-3 sm:px-4">
          <CalcQuestionStage
            question={question}
            disabled={finished}
            padKey={answerMode}
            className="pb-5"
            input={input}
            onInputChange={setInput}
            onNumberSubmit={() => submitAnswer(input)}
            onFractionSubmit={submitAnswer}
            onRemainderSubmit={submitAnswer}
            onVerticalSubmit={submitResult}
            feedback={feedback}
            revealAnswer={feedback === 'wrong' ? formatAnswer(question.answer) : null}
            attempt={attempts}
            onSwitchToVertical={sample.canSwitchAnswerMode ? () => switchAnswerMode('vertical') : undefined}
            onSwitchToPad={sample.canSwitchAnswerMode ? () => switchAnswerMode('pad') : undefined}
          />
        </div>
      </DarkScope>
      <Text as="p" role="status" size="2" className="min-h-5">
        {feedback === 'correct' && '答对啦！'}
        {feedback === 'retry' && '还可以再试一次。'}
        {feedback === 'wrong' && '本题已结束，可重置后再试。'}
      </Text>
    </>
  )
}

export default function CalcDemoPage() {
  const [sampleId, setSampleId] = useState(CALC_DEMO_SAMPLES[0].id)
  const [resetCount, setResetCount] = useState(0)
  const sample = CALC_DEMO_SAMPLES.find(({ id }) => id === sampleId) ?? CALC_DEMO_SAMPLES[0]

  return (
    <PageShell title="口算题型预览" width="narrow" backHref="/demos" backLabel="返回 Demo 总入口">
      <div className="mx-auto grid max-w-[640px] grid-cols-1 gap-3">
        <StickerCard size="sm" elevation="flat" className="flex flex-wrap items-center justify-between gap-2">
          <FormSelect
            ariaLabel="口算题型"
            value={sample.id}
            onValueChange={setSampleId}
            options={sampleOptions}
            size="3"
          />
          <Button type="button" variant="soft" onClick={() => setResetCount(count => count + 1)}>
            重置作答
          </Button>
        </StickerCard>
        <QuestionPreview key={`${sample.id}:${resetCount}`} sample={sample} />
      </div>
    </PageShell>
  )
}

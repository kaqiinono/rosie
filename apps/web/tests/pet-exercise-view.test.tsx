import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ExerciseView,
  isExerciseAnswerCorrect,
  type ExerciseItemState,
  type ExercisePracticeOptions,
} from '../../../packages/english/src/grammar/components/ExerciseView'
import type { GrammarExerciseItem } from '../../../packages/english/src/grammar/types'

const legacy: GrammarExerciseItem = {
  number: 1,
  type: 'fill_blank',
  prompt: 'I ______ ready and they ______ early.',
  answer: 'am, are',
}

const strict: GrammarExerciseItem = {
  ...legacy,
  acceptedAnswerSets: [['am', 'are'], ['was', 'were']],
}

describe('ExerciseView answer sets', () => {
  it('grades each valid ordered combination without mixing alternatives', () => {
    expect(isExerciseAnswerCorrect(strict, ['am', 'are'])).toBe(true)
    expect(isExerciseAnswerCorrect(strict, ['was', 'were'])).toBe(true)
    expect(isExerciseAnswerCorrect(strict, ['are', 'am'])).toBe(false)
    expect(isExerciseAnswerCorrect(strict, ['am', 'were'])).toBe(false)
  })

  it('rejects missing, empty, or extra blank values', () => {
    expect(isExerciseAnswerCorrect(strict, [])).toBe(false)
    expect(isExerciseAnswerCorrect(strict, ['am'])).toBe(false)
    expect(isExerciseAnswerCorrect(strict, ['am', '   '])).toBe(false)
    expect(isExerciseAnswerCorrect(strict, ['am', 'are', 'am'])).toBe(false)
  })

  it('normalizes apostrophes, case, and whitespace while retaining punctuation', () => {
    const item: GrammarExerciseItem = {
      ...strict,
      prompt: 'I ______.',
      acceptedAnswerSets: [["don't know"]],
    }
    expect(isExerciseAnswerCorrect(item, ['  DON’T   know  '])).toBe(true)
    expect(isExerciseAnswerCorrect(item, ["don't know."])).toBe(false)
  })

  it('keeps existing answer-only matching behavior', () => {
    expect(isExerciseAnswerCorrect(legacy, ['are', 'am'])).toBe(true)
    expect(isExerciseAnswerCorrect(legacy, ['am.', 'are'])).toBe(true)
    expect(isExerciseAnswerCorrect(
      { ...legacy, prompt: 'I ______.', answer: 'sleep\nrest' },
      ['rest'],
    )).toBe(true)
    expect(isExerciseAnswerCorrect(
      { ...legacy, type: 'multiple_choice', answer: 'A, B' },
      ['B. rest'],
    )).toBe(true)
  })
})

const item: GrammarExerciseItem = {
  number: 1,
  type: 'fill_blank',
  prompt: 'I have ______ to school.',
  answer: 'gone',
  acceptedAnswerSets: [['gone']],
  explanation: 'Use the past participle.',
}

function ExerciseHarness({ mode }: { mode: ExercisePracticeOptions['mode'] }) {
  const [state, setState] = useState<ExerciseItemState>()
  const [submitted, setSubmitted] = useState(false)
  return (
    <>
      <ExerciseView
        groups={[{ section: 'PET', instruction: 'Fill in the blank.', items: [item] }]}
        isAdmin={false}
        pageImages={[]}
        onGroupResult={() => {}}
        onPreviewFigure={() => {}}
        practice={{
          mode,
          submitted,
          states: { 1: state },
          onItemChange: (_, next) => setState(next),
        }}
      />
      {mode === 'assessment' && (
        <button
          type="button"
          onClick={() => {
            if (!state) return
            const status = isExerciseAnswerCorrect(item, state.values) ? 'correct' : 'wrong'
            setState({ ...state, status })
            setSubmitted(true)
          }}
        >
          Submit
        </button>
      )}
      <output aria-label="Item state">{JSON.stringify(state)}</output>
    </>
  )
}

function enter(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '第 1 题第 1 个空' }), { target: { value } })
}

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function itemState(): ExerciseItemState {
  return JSON.parse(screen.getByLabelText('Item state').textContent ?? '')
}

describe('ExerciseView controlled PET practice', () => {
  it('keeps the first wrong answer after a correct retry', () => {
    render(<ExerciseHarness mode="practice" />)
    enter('went')
    click('检查')
    click('再试一次')
    enter('gone')
    click('检查')
    expect(itemState()).toMatchObject({
      first: { values: ['went'], correct: false, helped: false },
      values: ['gone'],
      retries: 1,
      status: 'correct',
    })
  })

  it('records revealed help separately and keeps it on the first answer', () => {
    render(<ExerciseHarness mode="practice" />)
    click('查看答案')
    expect(itemState()).toMatchObject({ helped: true, revealed: true })
    expect(itemState().first).toBeUndefined()
    click('再试一次')
    enter('gone')
    click('检查')
    expect(itemState()).toMatchObject({
      first: { values: ['gone'], correct: true, helped: true },
      retries: 1,
    })
  })

  it('saves assessment drafts and renders feedback after group submission', () => {
    render(<ExerciseHarness mode="assessment" />)
    enter('went')
    expect(itemState()).toEqual({ values: ['went'] })
    expect(screen.queryByRole('button', { name: '查看答案' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Use the past participle/)).not.toBeInTheDocument()
    click('Submit')
    expect(screen.getByText('gone')).toBeInTheDocument()
    expect(screen.getByText(/Use the past participle/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

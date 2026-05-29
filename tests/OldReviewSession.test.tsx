import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WordEntry } from '@/utils/type'

// ── Context mocks ────────────────────────────────────────────────────────────
const mockRecordBatch = vi.fn()
vi.mock('@/contexts/WordsContext', () => ({
  useWordsContext: () => ({ masteryMap: {}, recordBatch: mockRecordBatch }),
}))

const mockSetIsImmersive = vi.fn()
vi.mock('@/contexts/ImmersiveContext', () => ({
  useImmersive: () => ({ isImmersive: false, setIsImmersive: mockSetIsImmersive }),
}))

// ── Child-component mocks (expose key props as test surface) ────────────────
type AnyProps = Record<string, unknown>

vi.mock('@/components/english/words/StudyPhase', () => ({
  default: (props: AnyProps) => {
    const entry = props.entry as WordEntry
    return (
      <div data-testid="study-phase">
        <div data-testid="study-word">{entry?.word ?? ''}</div>
        <div data-testid="study-idx">{String(props.currentIdx)}</div>
        <div data-testid="study-total">{String(props.totalCount)}</div>
        <button data-testid="study-back" onClick={props.onBack as () => void}>
          back
        </button>
        <button data-testid="study-complete" onClick={props.onComplete as () => void}>
          {String(props.completeButtonText)}
        </button>
      </div>
    )
  },
}))

vi.mock('@/components/english/words/QuizCard', () => ({
  default: (props: AnyProps) => {
    const question = props.question as { word: WordEntry; type: string }
    return (
      <div data-testid="quiz-card">
        <div data-testid="quiz-word">{question.word.word}</div>
        <div data-testid="quiz-type">{question.type}</div>
        <div data-testid="quiz-idx">{String(props.currentIndex)}</div>
        <div data-testid="quiz-total">{String(props.totalCount)}</div>
        <button
          data-testid="quiz-answer-correct"
          onClick={() => (props.onAnswer as (c: boolean) => void)(true)}
        >
          mark correct
        </button>
        <button data-testid="quiz-next" onClick={props.onNext as () => void}>
          next
        </button>
      </div>
    )
  },
}))

vi.mock('@/components/english/words/DoneSummary', () => ({
  default: (props: AnyProps) => (
    <div data-testid="done-summary">
      <div data-testid="done-score">{String(props.score)}</div>
      <div data-testid="done-total">{String(props.total)}</div>
    </div>
  ),
}))

vi.mock('@/components/english/words/MasteryStatusPanel', () => ({
  default: () => <div data-testid="mastery-panel" />,
}))

// Import after mocks so the module graph picks them up
import OldReviewSession from '@/components/english/words/OldReviewSession'
import { wordKey } from '@/utils/english-helpers'

const STORAGE_KEY = 'old_review_session'

function makeWord(word: string): WordEntry {
  return { unit: 'U1', lesson: 'L1', word, explanation: `def of ${word}` }
}

const words: WordEntry[] = [makeWord('alpha'), makeWord('beta'), makeWord('gamma')]
const extraVocab: WordEntry[] = [makeWord('delta'), makeWord('epsilon'), makeWord('zeta'), makeWord('eta')]
const vocab: WordEntry[] = [...words, ...extraVocab]

const onBack = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  mockRecordBatch.mockClear()
  mockSetIsImmersive.mockClear()
  onBack.mockClear()
})

function makeQuizSnapshot(curQ: number, quizLen = 3) {
  const quizQs = Array.from({ length: quizLen }, (_, i) => ({
    key: wordKey(words[i % words.length]),
    type: 'A' as const,
  }))
  const quizResults = Array.from({ length: curQ }, (_, i) => ({
    key: wordKey(words[i % words.length]),
    correct: i % 2 === 0,
  }))
  return {
    version: 1,
    phase: 'quiz' as const,
    studyIdx: 0,
    wordKeys: words.map(wordKey),
    quizQs,
    curQ,
    quizResults,
  }
}

describe('OldReviewSession — session restore on accidental exit', () => {
  it('restores to the exact quiz question that was in progress', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(1)))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    expect(screen.queryByTestId('study-phase')).toBeNull()
    expect(screen.getByTestId('quiz-idx')).toHaveTextContent('1')
    expect(screen.getByTestId('quiz-total')).toHaveTextContent('3')
    // curQ=1 → the 2nd question, which we built from words[1] ('beta')
    expect(screen.getByTestId('quiz-word')).toHaveTextContent('beta')
  })

  it('uses the snapshot wordKeys even if the parent passes a different `words` prop', () => {
    // User was reviewing the original 3 due words; by the time they come back,
    // the parent's due-words list has shifted. The session must continue with
    // the original list (data protection).
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(0)))

    const shiftedWords = [makeWord('delta'), makeWord('epsilon')]

    render(<OldReviewSession words={shiftedWords} vocab={vocab} onBack={onBack} />)

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-total')).toHaveTextContent('3')
    expect(screen.getByTestId('quiz-word')).toHaveTextContent('alpha')
  })

  it('starts a fresh study session when no snapshot exists', () => {
    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)

    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
    expect(screen.getByTestId('study-word')).toHaveTextContent('alpha')
  })

  it('discards snapshots with a mismatched version', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...makeQuizSnapshot(2), version: 999 }),
    )

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
  })

  it('discards snapshots whose phase is neither study nor quiz', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...makeQuizSnapshot(0), phase: 'done' }),
    )

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
  })

  it('persists the active quiz to sessionStorage so reload picks up where you left off', async () => {
    const user = userEvent.setup()
    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)

    await user.click(screen.getByTestId('study-complete')) // → start quiz

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.version).toBe(1)
    expect(persisted.phase).toBe('quiz')
    expect(persisted.wordKeys).toEqual(words.map(wordKey))
    expect(persisted.quizQs.length).toBeGreaterThan(0)
    expect(persisted.curQ).toBe(0)
  })
})

describe('OldReviewSession — 回到记忆 restarts the quiz', () => {
  it('clears quizQs/curQ/score and returns to study word 0', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
    expect(screen.getByTestId('study-word')).toHaveTextContent('alpha')

    // The persisted snapshot must reflect cleared progress, not the previous quiz
    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('study')
    expect(persisted.studyIdx).toBe(0)
    expect(persisted.quizQs).toEqual([])
    expect(persisted.curQ).toBe(0)
    expect(persisted.quizResults).toEqual([])
  })

  it('after 回到记忆, a fresh mount (simulated reload) does NOT resume the prior quiz', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    const { unmount } = render(
      <OldReviewSession words={words} vocab={vocab} onBack={onBack} />,
    )
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))
    unmount()

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
  })

  it('生成全新题目 — starting the quiz after 回到记忆 builds a brand-new question list', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    // Now in study with cleared progress; start a fresh quiz
    await user.click(screen.getByTestId('study-complete'))

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-idx')).toHaveTextContent('0')

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('quiz')
    expect(persisted.curQ).toBe(0)
    expect(persisted.quizResults).toEqual([])
    // Each session word gets one question per enabled type (A,B,C) → 9 total
    expect(persisted.quizQs.length).toBe(words.length * 3)
  })
})

describe('OldReviewSession — done phase clears the snapshot', () => {
  it('removes sessionStorage entry once the quiz reaches done', async () => {
    const user = userEvent.setup()
    // Snapshot points at the LAST question of a 1-question quiz
    const oneQuestionSnapshot = {
      ...makeQuizSnapshot(0, 1),
      quizQs: [{ key: wordKey(words[0]), type: 'A' as const }],
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(oneQuestionSnapshot))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)

    // Advance through the only question
    await user.click(screen.getByTestId('quiz-answer-correct'))
    await user.click(screen.getByTestId('quiz-next'))

    expect(screen.getByTestId('done-summary')).toBeInTheDocument()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

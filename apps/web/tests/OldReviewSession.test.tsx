import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WordEntry } from '@rosie/core'

// ── Context mocks ────────────────────────────────────────────────────────────
const mockRecordBatch = vi.fn()
// Mock the WordsContext module itself: OldReviewSession imports useWordsContext
// from '../../WordsContext' internally, so mocking the '@rosie/english' barrel
// export would not intercept that call.
vi.mock('@rosie/english/WordsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rosie/english/WordsContext')>()
  return {
    ...actual,
    useWordsContext: () => ({ masteryMap: {}, recordBatch: mockRecordBatch }),
  }
})

const mockSetIsImmersive = vi.fn()
// useImmersive/useStarHud are imported from the package roots inside the
// english components, so override them on the real modules (spread actual to
// keep every other export intact).
vi.mock('@rosie/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rosie/core')>()
  return {
    ...actual,
    useImmersive: () => ({ isImmersive: false, setIsImmersive: mockSetIsImmersive }),
  }
})

const mockAwardStars = vi.fn(() => Promise.resolve())
vi.mock('@rosie/rewards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rosie/rewards')>()
  return {
    ...actual,
    useStarHud: () => ({ awardStars: mockAwardStars }),
  }
})

// ── Child-component mocks (expose key props as test surface) ────────────────
// These components are relative-imported inside @rosie/english, so the mocks
// must target the same files via the package's subpath exports.
type AnyProps = Record<string, unknown>

vi.mock('@rosie/english/components/words/StudyPhase', () => ({
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

// QuizCard was replaced by QuizQuestionBody + useQuizRunner; keep the old test
// surface by driving the runner directly.
vi.mock('@rosie/english/components/words/QuizQuestionBody', () => ({
  default: (props: AnyProps) => {
    const question = props.question as { word: WordEntry; type: string }
    const runner = props.runner as {
      handleMCAnswer: (word: string) => void
      requestAdvance: () => void
    }
    return (
      <div data-testid="quiz-card">
        <div data-testid="quiz-word">{question.word.word}</div>
        <div data-testid="quiz-type">{question.type}</div>
        <div data-testid="quiz-idx">{String(props.questionKey)}</div>
        <div data-testid="quiz-total">{String(props.total)}</div>
        <button
          data-testid="quiz-answer-correct"
          onClick={() => runner.handleMCAnswer(question.word.word)}
        >
          mark correct
        </button>
        <button data-testid="quiz-next" onClick={() => runner.requestAdvance()}>
          next
        </button>
      </div>
    )
  },
}))

vi.mock('@rosie/english/components/words/DoneSummary', () => ({
  default: (props: AnyProps) => (
    <div data-testid="done-summary">
      <div data-testid="done-score">{String(props.score)}</div>
      <div data-testid="done-total">{String(props.total)}</div>
    </div>
  ),
}))

vi.mock('@rosie/english/components/words/MasteryStatusPanel', () => ({
  default: () => <div data-testid="mastery-panel" />,
}))

// Import after mocks so the module graph picks them up
import { OldReviewSession } from '@rosie/english'
import { wordKey } from '@rosie/english'

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

describe('OldReviewSession — 回到记忆 keeps quiz progress for 继续测试', () => {
  it('returns to study word 0 but keeps quiz progress for resume', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
    expect(screen.getByTestId('study-word')).toHaveTextContent('alpha')
    // Existing quiz progress survives so the complete button resumes it
    expect(screen.getByTestId('study-complete')).toHaveTextContent('继续测试 →')

    // The persisted snapshot keeps the quiz queue; only the phase rewinds
    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('study')
    expect(persisted.studyIdx).toBe(0)
    expect(persisted.quizQs.length).toBe(3)
    expect(persisted.curQ).toBe(2)
  })

  it('after 回到记忆, a fresh mount (simulated reload) does NOT jump back into the quiz', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    const { unmount } = render(
      <OldReviewSession words={words} vocab={vocab} onBack={onBack} />,
    )
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))
    unmount()

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    // Snapshot phase is 'study' now, so mount lands in study — not the quiz
    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
  })

  it('继续测试 — completing study after 回到记忆 resumes the retained quiz', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<OldReviewSession words={words} vocab={vocab} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    // Resume the retained quiz instead of building a new one
    await user.click(screen.getByTestId('study-complete'))

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    // curQ survived the detour through study
    expect(screen.getByTestId('quiz-idx')).toHaveTextContent('2')

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('quiz')
    expect(persisted.curQ).toBe(2)
    expect(persisted.quizQs.length).toBe(3)
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

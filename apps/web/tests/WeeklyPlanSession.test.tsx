import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WordEntry, WeeklyPlan } from '@rosie/core'

// ── External-system mocks ────────────────────────────────────────────────────
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    }),
  },
}))

// ── Context mocks ────────────────────────────────────────────────────────────
const mockUser = { id: 'user-1', email: 'test@example.com' }
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const mockRecordBatch = vi.fn()
vi.mock('@/contexts/WordsContext', () => ({
  useWordsContext: () => ({ masteryMap: {}, recordBatch: mockRecordBatch }),
}))

const mockSetIsImmersive = vi.fn()
vi.mock('@/contexts/ImmersiveContext', () => ({
  useImmersive: () => ({ isImmersive: false, setIsImmersive: mockSetIsImmersive }),
}))

const mockAwardStars = vi.fn(() => Promise.resolve())
vi.mock('@/components/stars/StarHudProvider', () => ({
  useStarHud: () => ({
    yellowBalance: 0,
    redBalance: 0,
    blueBalance: 0,
    session: { yellow: 0, red: 0, blue: 0 },
    bursts: [],
    awardStars: mockAwardStars,
    consumeBurst: vi.fn(),
    refresh: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('@/components/stars/StarProgressBar', () => ({
  default: () => <div data-testid="star-progress" />,
}))

// ── Child-component mocks ────────────────────────────────────────────────────
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

// Import after mocks
import WeeklyPlanSession from '@/components/english/words/WeeklyPlanSession'
import { wordKey } from '@/utils/english-helpers'

function makeWord(word: string): WordEntry {
  return { unit: 'U1', lesson: 'L1', word, explanation: `def of ${word}` }
}

const words: WordEntry[] = [makeWord('alpha'), makeWord('beta'), makeWord('gamma')]
const vocab: WordEntry[] = [
  ...words,
  makeWord('delta'),
  makeWord('epsilon'),
  makeWord('zeta'),
  makeWord('eta'),
]

const SELECTED_DATE = '2026-05-28' // a Thursday — week start

function makePlan(): WeeklyPlan {
  return {
    id: 'plan-1',
    weekStart: SELECTED_DATE,
    unit: 'U1',
    lesson: 'L1',
    weekStartDay: 4,
    newWordsPerDay: 3,
    days: Array.from({ length: 7 }, (_, i) => {
      const day = 28 + i
      return {
        date: `2026-05-${String(day).padStart(2, '0')}`,
        newWordKeys: i === 0 ? words.map(wordKey) : [],
      }
    }),
    progress: {},
  }
}

const STORAGE_KEY = `weekly_session_plan-1`
const onBack = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  mockRecordBatch.mockClear()
  mockSetIsImmersive.mockClear()
  mockAwardStars.mockClear()
  onBack.mockClear()
})

function makeQuizSnapshot(curQ: number) {
  const quizQs = [
    { key: wordKey(words[0]), type: 'A' as const, kind: 'consolidate' as const },
    { key: wordKey(words[1]), type: 'A' as const, kind: 'consolidate' as const },
    { key: wordKey(words[2]), type: 'A' as const, kind: 'consolidate' as const },
  ]
  const quizResults = Array.from({ length: curQ }, (_, i) => ({
    key: wordKey(words[i % words.length]),
    correct: i % 2 === 0,
  }))
  return {
    version: 3,
    phase: 'quiz' as const,
    selectedDate: SELECTED_DATE,
    subTask: 'all' as const,
    studyIdx: 0,
    words: words.map((w) => ({
      key: wordKey(w),
      kind: 'consolidate' as const,
    })),
    quizQs,
    curQ,
    quizResults,
  }
}

describe('WeeklyPlanSession — session restore on accidental exit', () => {
  it('restores to the exact quiz question that was in progress', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(1)))

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    expect(screen.queryByTestId('study-phase')).toBeNull()
    expect(screen.getByTestId('quiz-idx')).toHaveTextContent('1')
    expect(screen.getByTestId('quiz-total')).toHaveTextContent('3')
    expect(screen.getByTestId('quiz-word')).toHaveTextContent('beta')
  })

  it('discards snapshots with a mismatched version', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...makeQuizSnapshot(2), version: 999 }),
    )

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)
    // Falls back to week-view (no quiz, no study, no done — that's the default)
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.queryByTestId('study-phase')).toBeNull()
  })

  it('persists the active quiz to sessionStorage so reload picks up where you left off', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(1)))

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)

    // After mount, the persistence effect re-writes the snapshot. Validate shape.
    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.version).toBe(3)
    expect(persisted.phase).toBe('quiz')
    expect(persisted.selectedDate).toBe(SELECTED_DATE)
    expect(persisted.curQ).toBe(1)
    expect(persisted.quizQs.length).toBe(3)
  })
})

describe('WeeklyPlanSession — 回到记忆 restarts the quiz', () => {
  it('clears quizQs/curQ/score and returns to study word 0', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
    expect(screen.getByTestId('study-word')).toHaveTextContent('alpha')

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('study')
    expect(persisted.studyIdx).toBe(0)
    expect(persisted.quizQs).toEqual([])
    expect(persisted.curQ).toBe(0)
    expect(persisted.quizResults).toEqual([])
    // The session's word list survives — only quiz progress is cleared
    expect(persisted.words.length).toBe(3)
  })

  it('after 回到记忆, a fresh mount (simulated reload) does NOT resume the prior quiz', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    const { unmount } = render(
      <WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />,
    )
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))
    unmount()

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)
    expect(screen.getByTestId('study-phase')).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-card')).toBeNull()
    expect(screen.getByTestId('study-idx')).toHaveTextContent('0')
  })

  it('生成全新题目 — starting the quiz after 回到记忆 builds a brand-new question list', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(makeQuizSnapshot(2)))

    render(<WeeklyPlanSession initialPlan={makePlan()} vocab={vocab} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /回到记忆/ }))

    await user.click(screen.getByTestId('study-complete'))

    expect(screen.getByTestId('quiz-card')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-idx')).toHaveTextContent('0')

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.phase).toBe('quiz')
    expect(persisted.curQ).toBe(0)
    expect(persisted.quizResults).toEqual([])
    expect(persisted.quizQs.length).toBeGreaterThan(0)
  })
})

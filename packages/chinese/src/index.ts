// @rosie/chinese — 生字认读/会写 + 古诗背诵
import './chinese.css'

// Context
export { ChineseProvider, useChineseContext } from './context/ChineseContext'

// Hooks
export { useCharMastery } from './hooks/useCharMastery'
export type { CharMasteryMap, CharMasteryResult } from './hooks/useCharMastery'
export { useChineseCharData, buildLessonGroups } from './hooks/useChineseCharData'
export { useChineseCharAdmin } from './hooks/useChineseCharAdmin'
export type { CharEntryPatch, LessonPatch } from './hooks/useChineseCharAdmin'
export { useChineseWeeklyPlan } from './hooks/useChineseWeeklyPlan'
export { useChineseWrong } from './hooks/useChineseWrong'
export type { ChineseWrongRow, ChineseWrongKind, ChineseWrongItemType } from './hooks/useChineseWrong'

// Types
export type {
  ChineseCharProfile,
  ChineseLessonRow,
  ChineseLessonCharRow,
  StrokeOrderData,
} from './types/chineseCharData'

// Utils
export * from './utils/chinese-helpers'
export * from './utils/chinese-phrase-helpers'
export * from './utils/chinese-accumulation-helpers'
export * from './utils/chinese-garden-helpers'
export * from './utils/chinese-lesson-passage-helpers'
export * from './utils/chinese-lesson-display'
export * from './utils/chinese-mastery-stats'
/** TS backup only — runtime reads Supabase via useChineseCharData */
export * from './utils/grade1-down'

// Components
export { default as CharFlashCard } from './components/chars/CharFlashCard'
export { default as CharWriter } from './components/chars/CharWriter'
export type { CharWriterProps } from './components/chars/CharWriter'
export { default as CharQuizRunner } from './components/chars/CharQuizRunner'
export type { CharQuizItem } from './components/chars/CharQuizRunner'
export { default as PoemList } from './components/poems/PoemList'
export { default as PoemRecite } from './components/poems/PoemRecite'
export { default as PhraseQuizRunner } from './components/phrases/PhraseQuizRunner'
export { default as ChinesePhraseQuizPage } from './components/ChinesePhraseQuizPage'
export { default as AccumulationQuizRunner } from './components/accumulation/AccumulationQuizRunner'
export { default as ChineseAccumulationPage } from './components/ChineseAccumulationPage'
export { default as ChineseGardenQuizPage } from './components/ChineseGardenQuizPage'
export { default as ChineseUnitPage } from './components/ChineseUnitPage'
export { default as LessonPassageView } from './components/units/LessonPassageView'
export { default as ChineseWrongPage } from './components/ChineseWrongPage'
export { default as ChineseHomePage } from './components/ChineseHomePage'
export { default as ChineseMasteryStatsBar } from './components/ChineseMasteryStatsBar'
export { default as ChineseDailyPage } from './components/ChineseDailyPage'
export { default as ChineseCharQuizPage } from './components/ChineseCharQuizPage'
export { default as ChineseCharWritingPage } from './components/ChineseCharWritingPage'
export { default as ChineseCharsPage } from './components/ChineseCharsPage'
export { default as ChineseCharCardsPage } from './components/ChineseCharCardsPage'
export { default as ChineseCharsPracticeSession } from './components/chars/ChineseCharsPracticeSession'
export { default as ChineseWeeklyPage } from './components/ChineseWeeklyPage'
export * from './utils/chinese-chars-session-helpers'

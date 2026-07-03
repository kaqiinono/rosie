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
} from './types/chineseCharData'

// Utils
export * from './utils/chinese-helpers'
export * from './utils/chinese-phrase-helpers'
export * from './utils/chinese-accumulation-helpers'
export * from './utils/chinese-garden-helpers'
export * from './utils/chinese-lesson-passage-helpers'
export * from './utils/chinese-lesson-display'
export * from './utils/chinese-mastery-stats'
export * from './utils/chinese-roadmap'
/** TS backup only — runtime reads Supabase via useChineseCharData */
export * from './utils/g1b'
export { CHINESE_BOOKS, getChineseBook, isChineseBookSlug, type ChineseBookSlug } from './utils/chinese-books'
export { chineseRoute, parseBookSlugFromPath } from './utils/chinese-routes'
export {
  getBookAccumulation,
  getBookLessonPassages,
  getBookPoems,
  getLessonPassageForBook,
  getBookPinyinWriteWords,
} from './utils/chinese-book-content'
export { default as ChinesePoemsPage } from './components/ChinesePoemsPage'

// Components
export { default as CharFlashCard } from './components/chars/CharFlashCard'
export { default as CharWriter } from './components/chars/CharWriter'
export type { CharWriterProps } from './components/chars/CharWriter'
export { default as CharQuizRunner } from './components/chars/CharQuizRunner'
export type { CharQuizItem } from './components/chars/CharQuizRunner'
export { default as PoemList } from './components/poems/PoemList'
export { default as PoemRecite } from './components/poems/PoemRecite'
export { default as PhraseQuizRunner } from './components/phrases/PhraseQuizRunner'
export { default as AccumulationQuizRunner } from './components/accumulation/AccumulationQuizRunner'
export { default as ChineseAccumulationPage } from './components/ChineseAccumulationPage'
export { default as ChineseGardenQuizPage } from './components/ChineseGardenQuizPage'
export { default as ChineseUnitPage } from './components/ChineseUnitPage'
export { default as LessonPassageView } from './components/units/LessonPassageView'
export { default as ChineseReadingIndexPage } from './components/reading/ChineseReadingIndexPage'
export { default as ChineseReadingPassagePage } from './components/reading/ChineseReadingPassagePage'
export { default as ChineseWrongPage } from './components/ChineseWrongPage'
export { default as ChineseHomePage } from './components/ChineseHomePage'
export { default as ChineseDailyCard } from './components/ChineseDailyCard'
export { default as ChineseMasteryStatsBar } from './components/ChineseMasteryStatsBar'
export { default as ChineseDailyPage } from './components/ChineseDailyPage'
export { default as ChineseCharQuizPage } from './components/ChineseCharQuizPage'
export { default as ChineseCharWritingPage } from './components/ChineseCharWritingPage'
export { default as ChineseCharsPage } from './components/ChineseCharsPage'
export { default as ChineseCharCardsPage } from './components/ChineseCharCardsPage'
export { default as ChineseCharsPracticeSession } from './components/chars/ChineseCharsPracticeSession'
export { default as ChinesePinyinWritePrintPage } from './components/chars/ChinesePinyinWritePrintPage'
export { default as ChineseWeeklyPage } from './components/ChineseWeeklyPage'
export * from './utils/chinese-chars-session-helpers'
export * from './utils/chinese-pinyin-write-helpers'
export * from './utils/chinese-pinyin-write-print-helpers'

// @rosie/english — vocabulary (cards/quiz/spelling/daily/weekly-plan/mastery) + reading
// (passages with their own audio). Public API for apps/web routes & external consumers.

// Package-private styles (phonics / keyword / word-monster + rescue vars, reading-recall
// decorations). Bundled here so any route importing @rosie/english gets them — keeps the
// app's globals.css free of module-specific CSS.
import './english.css'

// Context
export { WordsProvider, useWordsContext } from './WordsContext'

// Module landing
export { default as EnglishQuickLinkGrid } from './components/EnglishQuickLinkGrid'
export { default as EnglishQuickLinkCard } from './components/EnglishQuickLinkCard'

// Hooks
export { useWordData } from './hooks/useWordData'
export { useWordMastery } from './hooks/useWordMastery'
export { useEnglishWrong } from './hooks/useEnglishWrong'
export { useWeeklyPlan } from './hooks/useWeeklyPlan'
export { useAdaptiveWordPlan } from './hooks/useAdaptiveWordPlan'
export { useRescueQueue } from './hooks/useRescueQueue'
export { useReadingPassageMedia } from './hooks/useReadingPassageMedia'
export { useReadingPassageAudio } from './hooks/useReadingPassageAudio'

// Utils (named modules)
export * from './utils/english-helpers'
export * from './utils/english-data'
export * from './utils/english-data-4b'
export * from './utils/phonics'
export * from './utils/reading-data'
export * from './utils/reading-audio-types'
export * from './utils/weeklyPlanPayload'
export * from './utils/weeklyPlanProgress'
export * from './utils/weeklyReportWordRows'
export * from './utils/buildEnglishWeeklyReport'
export * from './utils/adaptivePlanTypes'
export * from './utils/adaptivePlanMappers'
export * from './utils/adaptivePlanQuizTypes'
export { buildDailyTask } from './utils/adaptivePlanScheduler'
export type { AdaptiveDailyTask } from './utils/adaptivePlanScheduler'
export * from './utils/word-enrich'
export * from './utils/speak'

// Words components (default exports → named barrel exports)
export { default as AppHeader } from './components/words/AppHeader'
export { default as CardsGrid } from './components/words/CardsGrid'
export { default as DoneSummary } from './components/words/DoneSummary'
export { default as EnglishWeeklyReportView } from './components/words/EnglishWeeklyReportView'
export { default as EnglishWeeklyReportWordTable } from './components/words/EnglishWeeklyReportWordTable'
export { default as FilterBar } from './components/words/FilterBar'
export { default as FlashCard } from './components/words/FlashCard'
export { default as ImmersiveMode } from './components/words/ImmersiveMode'
export { default as ImportModal } from './components/words/ImportModal'
export { default as MasteryStatusPanel } from './components/words/MasteryStatusPanel'
export { default as OldReviewSession } from './components/words/OldReviewSession'
export { default as PassageHintModal } from './components/words/PassageHintModal'
export { default as PhonicsLegend } from './components/words/PhonicsLegend'
export { default as PhonicsWord } from './components/words/PhonicsWord'
export { default as PracticeSetup } from './components/words/PracticeSetup'
export { default as QuizResults } from './components/words/QuizResults'
export { default as RescueCompletionView } from './components/words/RescueCompletionView'
export { default as RescueListBadge } from './components/words/RescueListBadge'
export { default as RescueReviewCarousel } from './components/words/RescueReviewCarousel'
export { default as SpeakButton } from './components/words/SpeakButton'
export { default as SpellTiles } from './components/words/SpellTiles'
export type { SpellButtonStyle } from './components/words/SpellTiles'
export { default as StudyPhase } from './components/words/StudyPhase'
export { default as AdaptivePlanEditor } from './components/words/AdaptivePlanEditor'
export { default as AdaptivePlanManage } from './components/words/AdaptivePlanManage'
export { default as AdaptivePlanPractice } from './components/words/AdaptivePlanPractice'
export { default as AdaptivePlanProgressBar } from './components/words/AdaptivePlanProgressBar'
export { default as AdaptivePlanSession } from './components/words/AdaptivePlanSession'
export { default as AdaptivePlanStageBoard } from './components/words/AdaptivePlanStageBoard'
export * from './utils/adaptivePlanStages'
export { default as EnglishHardWordsPage } from './components/words/EnglishHardWordsPage'
export { default as EnglishWeeklyPlanEditor } from './components/words/EnglishWeeklyPlanEditor'
export { default as EnglishWeeklyPlanManage } from './components/words/EnglishWeeklyPlanManage'
export { default as EnglishWeeklyPlanSession } from './components/words/EnglishWeeklyPlanSession'
export { default as WeeklyPlanSession } from './components/words/WeeklyPlanSession'
export { default as WeeklyPractice } from './components/words/WeeklyPractice'
export { default as WordHelpModal } from './components/words/WordHelpModal'

// Reading components (default exports → named barrel exports)
export { default as GlossaryPanel } from './components/reading/GlossaryPanel'
export { default as GlossaryPopup } from './components/reading/GlossaryPopup'
export { default as ParagraphRecallQuiz } from './components/reading/ParagraphRecallQuiz'
export { default as PassageView } from './components/reading/PassageView'
export { default as PreReadingRecall } from './components/reading/PreReadingRecall'
export { default as ReadingAudioButton } from './components/reading/ReadingAudioButton'
export { default as ReadingAudioUploadButton } from './components/reading/ReadingAudioUploadButton'
export { default as RecallQuizStack } from './components/reading/RecallQuizStack'
export { default as UncoveredWordsReview } from './components/reading/UncoveredWordsReview'
export { default as WordPopup } from './components/reading/WordPopup'

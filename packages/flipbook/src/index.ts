// @rosie/flipbook — PDF flipbook reader (books with audio in FLIPBOOK_BUCKET).
// Public API for apps/web routes & external consumers (audio module).

// Hooks
export * from './hooks/useFlipbookBooks'
export * from './hooks/useFlipbookDuplicatePrompt'
export * from './hooks/useFlipbookProgress'
export * from './hooks/useFlipbookReaderImmersive'

// Utils (named modules)
export * from './utils/flipbook-batch-match'
export * from './utils/flipbook-duplicate'
export * from './utils/flipbook-flip-props'
export * from './utils/flipbook-naming'
export * from './utils/flipbook-page-images'
export * from './utils/flipbook-page-load'
export * from './utils/flipbook-pdf'
export * from './utils/flipbook-sync'
export * from './utils/flipbook-types'
export * from './utils/flipbook-viewport'
export * from './utils/flipbook-word-match'

// Reader shell
export * from './components/flipbook-reader-shell'

// Components (default exports → named barrel exports)
export { default as FlipbookAudioBar } from './components/FlipbookAudioBar'
export { default as FlipbookBatchUploader } from './components/FlipbookBatchUploader'
export { default as FlipbookDuplicateDialog } from './components/FlipbookDuplicateDialog'
export { default as FlipbookLayoutEffects } from './components/FlipbookLayoutEffects'
export { default as FlipbookPage } from './components/FlipbookPage'
export { default as FlipbookPageWordsOverlay } from './components/FlipbookPageWordsOverlay'
export { default as FlipbookReader } from './components/FlipbookReader'
export { default as FlipbookUploadGuide } from './components/FlipbookUploadGuide'
export { default as FlipbookUploadProgress } from './components/FlipbookUploadProgress'
export { flipbookOverallUploadPercent } from './components/FlipbookUploadProgress'
export type { FlipbookProgressStep, FlipbookUploadProgressProps, FlipbookOverallProgressInput } from './components/FlipbookUploadProgress'
export { default as FlipbookUploader } from './components/FlipbookUploader'
export type { FlipbookCreateBookInput } from './components/FlipbookUploader'
export { default as FlipbookWordCarouselModal } from './components/FlipbookWordCarouselModal'
export { flipbookPreviewWords } from './components/FlipbookWordCarouselModal'

// @rosie/audio — unified audio playback module: kid-facing listening page,
// admin media manager, and the audio-collection hooks (favorites / playlists /
// virtual reading collection). Public API for apps/web routes.

// Hooks
export * from './hooks/useAudioCollections'
export * from './hooks/useAudioPlaylists'

// Components (default exports → named barrel exports)
export { default as AudioPageView } from './components/AudioPageView'
export { default as CollectionPills } from './components/CollectionPills'

// Admin
export { default as AudioManagerPage } from './admin/AudioManagerPage'

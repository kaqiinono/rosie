import '@testing-library/jest-dom/vitest'

// jsdom logs a noisy "not implemented" error for canvas even when callers
// correctly handle a null context. Unit tests do not render pixels, so model
// the browser's allowed null return without installing the native canvas package.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => null,
})

// jsdom does not implement matchMedia; components (e.g. MonsterEatScene) query
// it for prefers-reduced-motion. Provide a minimal stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

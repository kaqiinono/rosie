importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js')

const { precacheAndRoute } = workbox.precaching
const { registerRoute } = workbox.routing
const { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } = workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { CacheableResponsePlugin } = workbox.cacheableResponse
const { RangeRequestsPlugin } = workbox.rangeRequests
const isDevelopment = new URLSearchParams(self.location.search).get('dev') === '1'
const offlineShell = 'rosie-offline-shell-v1'
const offlinePath = '/offline'
let downloadingOfflineShell

async function downloadOfflineShell() {
  const response = await fetch(offlinePath, { cache: 'reload' })
  if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('offline shell unavailable')
  }
  const html = await response.clone().text()
  const assets = [...new Set(Array.from(
    html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g),
    (match) => match[1].replaceAll('&amp;', '&'),
  ))]
  if (!assets.some((asset) => /\.js(?:\?|$)/.test(asset))) throw new Error('offline scripts missing')
  const cache = await caches.open(offlineShell)
  await cache.addAll(assets)
  await cache.put(offlinePath, response)
  const retained = new Set([offlinePath, ...assets].map((asset) => new URL(asset, self.location.origin).href))
  for (const cached of await cache.keys()) {
    if (!retained.has(cached.url)) await cache.delete(cached)
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ROSIE_PREPARE_OFFLINE' || !event.ports[0]) return
  downloadingOfflineShell ??= downloadOfflineShell().finally(() => { downloadingOfflineShell = undefined })
  event.waitUntil(downloadingOfflineShell.then(
    () => event.ports[0].postMessage({ ok: true }),
    () => event.ports[0].postMessage({ ok: false }),
  ))
})

precacheAndRoute([
  { url: '/manifest.json', revision: null },
  { url: '/icons/favicon-32.png', revision: 'rosie-icon-split-v4' },
  { url: '/icons/icon-192.png', revision: 'rosie-icon-split-v4' },
  { url: '/icons/icon-512.png', revision: 'rosie-icon-split-v4' },
])

// Private content must bypass every destination cache, including image/PDF navigations.
registerRoute(
  ({ url }) =>
    url.pathname === '/api/draw-wheel' || url.pathname.startsWith('/api/draw-wheel/') ||
    url.pathname === '/api/time-tree' ||
    url.pathname === '/api/vocabulary-assessment' ||
    url.pathname === '/api/exams' || url.pathname.startsWith('/api/exams/') ||
    url.pathname === '/api/theater' || url.pathname.startsWith('/api/theater/') ||
    url.pathname === '/api/admin/exams' || url.pathname.startsWith('/api/admin/exams/') ||
    url.pathname === '/api/admin/audio-alignment' || url.pathname === '/api/baidu/audio/alignment' ||
    url.pathname.startsWith('/api/project-media/chinese-reading-recordings/') ||
    url.pathname.startsWith('/api/project-media/english-story-recordings/') ||
    url.pathname.startsWith('/api/project-media/exam-recordings/') ||
    url.pathname.startsWith('/api/project-media/reading/stories/') ||
    url.pathname.startsWith('/api/baidu/sync/') || url.pathname === '/api/baidu/video/materials',
  new NetworkOnly(),
)

registerRoute(
  ({ request }) => request.destination === 'document',
  async ({ event, request, url }) => {
    const cache = await caches.open(offlineShell)
    const saved = await cache.match(offlinePath)
    if (url.pathname === offlinePath) {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(4_000) })
        if (response.status < 500) return response
        return saved ?? response
      } catch (error) {
        if (saved) return saved
        throw error
      }
    }
    if (saved && (url.pathname === '/' || url.pathname === '/auth')) {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(4_000) })
        if (response.status < 500) return response
      } catch {
        // The explicitly downloaded entry is available for both startup routes.
      }
      return Response.redirect(new URL(offlinePath + '?auto=1', self.location.origin).href, 302)
    }
    try {
      const response = await pages.handle({ event, request })
      if (response.status < 500 || !saved) return response
    } catch (error) {
      if (!saved) throw error
    }
    return Response.redirect(new URL(offlinePath + '?auto=1', self.location.origin).href, 302)
  },
)

const pages = new NetworkFirst({
  cacheName: 'pages',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
  ],
})

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'),
  // Turbopack can reuse development chunk URLs after their exports change.
  isDevelopment
    ? new NetworkOnly({ fetchOptions: { cache: 'no-store' } })
    : async ({ event, request }) => {
        const saved = await (await caches.open(offlineShell)).match(request)
        return saved ?? staticResources.handle({ event, request })
      },
)

const staticResources = new StaleWhileRevalidate({
  cacheName: 'static-resources',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
})

registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  staticResources,
)

registerRoute(
  ({ url, request }) => request.destination === 'image' && /^thumbnail\d+\.baidupcs\.com$/.test(url.hostname)
    && url.pathname.startsWith('/thumbnail/'),
  new NetworkOnly({ fetchOptions: { cache: 'no-store' } }),
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// Audio (mp3/m4a/wav/ogg): cache the full file on first listen. RangeRequestsPlugin
// is required so the browser's range requests (HTML5 <audio> seek/metadata)
// can be served from a cached 200 response. Query strings (?v=updatedAt) are
// part of the cache key, so a new upload (new timestamp) naturally bypasses
// the stale cache.
registerRoute(
  ({ url, request }) =>
    !url.pathname.startsWith('/api/baidu/audio/') &&
    !url.pathname.includes('/storage/v1/object/sign/chinese-reading-recordings/') &&
    (request.destination === 'audio' ||
      /\.(mp3|m4a|wav|aac|ogg|webm)(\?|$)/i.test(url.pathname + url.search)),
  new CacheFirst({
    cacheName: 'audio-v2',
    plugins: [
      // RangeRequestsPlugin slices a cached complete response. Caching a 206
      // response would preserve only one fragment and can stall later ranges.
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new RangeRequestsPlugin(),
    ],
  })
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
)


self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete('audio'),
      self.clients.claim(),
    ])
  )
})

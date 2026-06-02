importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js')

const { precacheAndRoute } = workbox.precaching
const { registerRoute, NavigationRoute } = workbox.routing
const { StaleWhileRevalidate, CacheFirst, NetworkFirst } = workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { CacheableResponsePlugin } = workbox.cacheableResponse
const { RangeRequestsPlugin } = workbox.rangeRequests

precacheAndRoute([
  { url: '/manifest.json', revision: null },
  { url: '/favicon.svg', revision: null },
  { url: '/icons/icon.svg', revision: null },
])

registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
)

registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
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
    request.destination === 'audio' ||
    /\.(mp3|m4a|wav|aac|ogg)(\?|$)/i.test(url.pathname + url.search),
  new CacheFirst({
    cacheName: 'audio',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200, 206] }),
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
  event.waitUntil(self.clients.claim())
})

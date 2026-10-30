import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
it('all private material destinations bypass image/document/audio caches', () => {
  const routes: { match: (p: unknown) => boolean; strategy: { name: string } }[] = []
  const strategy = (name: string) =>
    class {
      name = name
    }
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    importScripts: () => {},
    workbox: {
      precaching: { precacheAndRoute: () => {} },
      routing: {
        registerRoute: (match: (p: unknown) => boolean, strategy: { name: string }) =>
          routes.push({ match, strategy }),
      },
      strategies: {
        NetworkOnly: strategy('NetworkOnly'),
        NetworkFirst: strategy('NetworkFirst'),
        CacheFirst: strategy('CacheFirst'),
        StaleWhileRevalidate: strategy('StaleWhileRevalidate'),
      },
      expiration: { ExpirationPlugin: class {} },
      cacheableResponse: { CacheableResponsePlugin: class {} },
      rangeRequests: { RangeRequestsPlugin: class {} },
    },
    self: { addEventListener: () => {} },
  })
  for (const destination of ['image', 'document', 'audio', 'video', '']) {
    const p = {
      url: new URL('https://rosie.test/api/materials/a/content'),
      request: { destination },
    }
    expect(routes.find((r) => r.match(p))?.strategy.name).toBe('NetworkOnly')
  }
})

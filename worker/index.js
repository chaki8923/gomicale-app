import { privateCacheUrls } from '../shared/private-cache-urls'

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).map(async (name) => {
      const cache = await caches.open(name)
      const privateRequests = (await cache.keys()).filter((request) => privateCacheUrls.test(request.url))
      await Promise.all(privateRequests.map((request) => cache.delete(request)))
    }))
  })())
})

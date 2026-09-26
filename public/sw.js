const CACHE_PREFIX = 'debut-offline-'
const CACHE = `${CACHE_PREFIX}v21`
const CORE = [
  './', './index.html', './privacy.html', './manifest.webmanifest?v=20',
  './icon-192-v4.png', './icon-512-v4.png', './apple-touch-icon-v4.png',
  './stockfish/stockfish-19-lite-single.js',
  './stockfish/stockfish-19-lite-single.wasm',
  './stockfish/Copying.txt', './stockfish/SOURCE.txt',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(CORE)
    const html = await fetch('./index.html', { cache: 'no-store' }).then((response) => response.text())
    const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((match) => match[1])
    await cache.addAll(assets)
  }))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
          return response
        })
        .catch(async () => (await caches.match(event.request)) || caches.match('./index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
      return response
    })),
  )
})

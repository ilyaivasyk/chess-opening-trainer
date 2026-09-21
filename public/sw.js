const CACHE = 'debut-offline-v13'
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './assets/app.js', './assets/app.css',
  './icon-192.png', './icon-512.png',
  './stockfish/stockfish-19-lite-single.js',
  './stockfish/stockfish-19-lite-single.wasm',
  './stockfish/Copying.txt', './stockfish/SOURCE.txt',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          caches.open(CACHE).then((cache) => cache.put('./index.html', response.clone()))
          return response
        })
        .catch(() => caches.match('./index.html')),
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

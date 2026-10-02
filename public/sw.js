const CACHE_PREFIX = 'debut-offline-'
const RELEASE = 'v32'
const CACHE = `${CACHE_PREFIX}${RELEASE}`
const CORE = [
  './privacy.html', './manifest.webmanifest?v=29',
  './icon-192-v4.png', './icon-512-v4.png', './apple-touch-icon-v4.png',
  './stockfish/stockfish-19-lite-single.js',
  './stockfish/stockfish-19-lite-single.wasm',
  './stockfish/Copying.txt', './stockfish/SOURCE.txt',
]
const STATIC_PATHS = new Set(CORE.map((path) => new URL(path, self.location.href).pathname))

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch('./index.html', { cache: 'no-store' })
    if (!response.ok) throw new Error('Could not load the app shell')
    const html = await response.clone().text()
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((match) => match[1]))]
    if (!assets.length) throw new Error('The app shell has no built assets')
    const cache = await caches.open(CACHE)
    await cache.addAll([...CORE, ...assets])
    await cache.put('./index.html', response.clone())
    await cache.put('./', response)
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
  if (event.data === 'GET_RELEASE') event.ports[0]?.postMessage({ release: RELEASE })
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  const appRoot = new URL('./', self.location.href).pathname

  if (event.request.mode === 'navigate') {
    // Keep the shell and its hashed assets on the same release until an update is accepted.
    const isAppShell = url.pathname === appRoot || url.pathname === `${appRoot}index.html`
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(isAppShell ? './index.html' : event.request)) || fetch(event.request)))
    return
  }

  // Public static files do not vary by Origin. Module/CSS requests can send an
  // Origin header that their precache request lacked (Vite preview adds Vary: Origin).
  const isStaticAsset = url.pathname.startsWith(`${appRoot}assets/`) || STATIC_PATHS.has(url.pathname)
  event.respondWith(
    caches.open(CACHE).then(async (cache) => (await cache.match(event.request, { ignoreVary: isStaticAsset })) || fetch(event.request).then((response) => {
      if (response.ok) event.waitUntil(cache.put(event.request, response.clone()))
      return response
    })),
  )
})

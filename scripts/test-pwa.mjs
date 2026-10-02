import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

class Events {
  listeners = new Map()
  addEventListener(name, listener) {
    const list = this.listeners.get(name) || []
    list.push(listener)
    this.listeners.set(name, list)
  }
  emit(name) { for (const listener of this.listeners.get(name) || []) listener() }
}
class Worker extends Events {
  state = 'installing'
  release = 'v23'
  messages = []
  postMessage(message, ports = []) {
    this.messages.push(message)
    if (message === 'GET_RELEASE' && this.release) ports[0]?.postMessage({ release: this.release })
  }
}
class Channel {
  port1 = { onmessage: null, close() {} }
  port2 = { postMessage: (data) => queueMicrotask(() => this.port1.onmessage?.({ data })), close() {} }
}

const lifecycleSource = (await readFile(new URL('../src/pwa.ts', import.meta.url), 'utf8'))
  .replace(/^import .*@capacitor\/core.*\n/m, '')
  .replaceAll('import.meta.env', 'env')
const lifecycleCode = ts.transpileModule(lifecycleSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function lifecycle({ native = false, production = true, controlled = false, oldController = false, failRegister = false, failUpdate = false } = {}) {
  const initialWorker = new Worker()
  if (oldController) initialWorker.release = null
  const registration = Object.assign(new Events(), {
    active: controlled ? initialWorker : null,
    installing: controlled ? null : initialWorker,
    waiting: null,
    updateCalls: 0,
    update: async () => { registration.updateCalls += 1; if (failUpdate) throw new Error('offline') },
  })
  const serviceWorker = Object.assign(new Events(), {
    controller: controlled ? initialWorker : null,
    registerCalls: 0,
    registeredUrls: [],
    register: async (url) => { serviceWorker.registerCalls += 1; serviceWorker.registeredUrls.push(url); if (failRegister) throw new Error('offline'); return registration },
  })
  const window = Object.assign(new Events(), { reloads: 0, setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 30)), clearTimeout,
    location: { href: 'https://example.test/chess-opening-trainer/', reload: () => { window.reloads += 1 } } })
  const document = Object.assign(new Events(), { visibilityState: 'visible' })
  const exports = {}
  vm.runInNewContext(lifecycleCode, { exports, MessageChannel: Channel, navigator: { serviceWorker }, window, document,
    Capacitor: { isNativePlatform: () => native }, env: { PROD: production, BASE_URL: '/chess-opening-trainer/' } })
  return { api: exports, serviceWorker, registration, window, document, initialWorker }
}

const initial = lifecycle()
const preparing = initial.api.preparePwa()
assert.equal(initial.api.preparePwa(), preparing, 'preparation must not register duplicate listeners/workers')
await preparing
assert.equal(initial.api.getPwaStatus(), 'pending', 'downloading assets is not offline-ready')
initial.registration.active = initial.initialWorker
initial.initialWorker.state = 'activated'
initial.initialWorker.emit('statechange')
assert.equal(initial.api.getPwaStatus(), 'pending', 'an active worker must also control this page')
initial.serviceWorker.controller = initial.initialWorker
initial.serviceWorker.emit('controllerchange')
await new Promise((resolve) => setImmediate(resolve))
assert.equal(initial.api.getPwaStatus(), 'ready')
assert.deepEqual(initial.serviceWorker.registeredUrls, ['/chess-opening-trainer/sw.js'], 'use a stable worker URL across releases')
assert.equal(initial.window.reloads, 0, 'initial installation must not reload the app')

const nextWorker = new Worker()
initial.registration.installing = nextWorker
initial.registration.emit('updatefound')
initial.registration.waiting = nextWorker
nextWorker.state = 'installed'
nextWorker.emit('statechange')
assert.equal(initial.api.getPwaStatus(), 'update')
assert.equal(nextWorker.messages.length, 0, 'do not activate while a game may be in progress')
initial.api.applyPwaUpdate()
assert.deepEqual(nextWorker.messages, ['SKIP_WAITING'])
assert.equal(initial.window.reloads, 0, 'reload only after the new worker controls the page')
initial.registration.waiting = null
initial.registration.active = nextWorker
initial.serviceWorker.controller = nextWorker
initial.serviceWorker.emit('controllerchange')
assert.equal(initial.window.reloads, 1)

const offline = lifecycle({ controlled: true, failUpdate: true })
await offline.api.preparePwa()
assert.equal(offline.api.getPwaStatus(), 'ready', 'failed update must preserve cached offline readiness')
const upgrading = lifecycle({ controlled: true, oldController: true })
await upgrading.api.preparePwa()
assert.equal(upgrading.api.getPwaStatus(), 'pending', 'old cached release must not certify newly loaded assets')
const failedUpgrade = lifecycle({ controlled: true, oldController: true, failUpdate: true })
await failedUpgrade.api.preparePwa()
assert.equal(failedUpgrade.api.getPwaStatus(), 'error')
const failed = lifecycle({ failRegister: true })
await failed.api.preparePwa()
assert.equal(failed.api.getPwaStatus(), 'error', 'first installation failure must be visible')
failed.api.applyPwaUpdate()
assert.equal(failed.window.reloads, 1, 'Home retry must reset a failed preparation')
failed.window.emit('online')
await new Promise((resolve) => setImmediate(resolve))
assert.equal(failed.serviceWorker.registerCalls, 2, 'retry first installation when connectivity returns')
for (const options of [{ native: true }, { production: false }]) {
  const disabled = lifecycle(options)
  await disabled.api.preparePwa()
  assert.equal(disabled.serviceWorker.registerCalls, 0)
}

const foreground = lifecycle({ controlled: true })
await foreground.api.preparePwa()
let finishCheck
foreground.registration.update = () => {
  foreground.registration.updateCalls += 1
  return new Promise((resolve) => { finishCheck = resolve })
}
foreground.window.emit('online')
foreground.window.emit('online')
foreground.document.emit('visibilitychange')
assert.equal(foreground.registration.updateCalls, 2, 'online/foreground checks must share a pending request')
finishCheck()
await new Promise((resolve) => setImmediate(resolve))
foreground.document.visibilityState = 'hidden'
foreground.document.emit('visibilitychange')
assert.equal(foreground.registration.updateCalls, 2)
foreground.serviceWorker.controller = new Worker()
foreground.serviceWorker.emit('controllerchange')
assert.equal(foreground.api.getPwaStatus(), 'update', 'another tab must not silently reload this game')
assert.equal(foreground.window.reloads, 0)
foreground.api.applyPwaUpdate()
assert.equal(foreground.window.reloads, 1)

const workerCode = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const shell = '<link href="./assets/app.css"><script src="./assets/app.js"></script>'
function workerRuntime({ failAssets = false } = {}) {
  const events = new Map()
  const stores = new Map([['debut-offline-v20', new Map()], ['another-app', new Map()]])
  const fetches = []
  const resolveKey = (key) => new URL(typeof key === 'string' ? key : key.url, 'https://example.test/chess-opening-trainer/sw.js').href
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (key) => stores.delete(key),
    open: async (key) => {
      if (!stores.has(key)) stores.set(key, new Map())
      const store = stores.get(key)
      return {
        addAll: async (urls) => {
          if (failAssets) throw new Error('download failed')
          for (const url of urls) store.set(resolveKey(url), { requestHeaders: new Headers(), response: new Response(url, { headers: { Vary: 'Origin' } }) })
        },
        put: async (key, response) => { store.set(resolveKey(key), { requestHeaders: new Headers(typeof key === 'string' ? undefined : key.headers), response }) },
        match: async (key, options = {}) => {
          const entry = store.get(resolveKey(key))
          if (!entry) return undefined
          const requestHeaders = new Headers(typeof key === 'string' ? undefined : key.headers)
          if (!options.ignoreVary && entry.response.headers.get('Vary') === 'Origin'
            && entry.requestHeaders.get('Origin') !== requestHeaders.get('Origin')) return undefined
          return entry.response.clone()
        },
      }
    },
  }
  const self = {
    location: new URL('https://example.test/chess-opening-trainer/sw.js'),
    skipCalls: 0, claimCalls: 0,
    skipWaiting: async () => { self.skipCalls += 1 },
    clients: { claim: async () => { self.claimCalls += 1 } },
    addEventListener: (name, listener) => events.set(name, listener),
  }
  vm.runInNewContext(workerCode, { self, caches, URL, fetch: async (url) => { fetches.push(url); return new Response(shell) } })
  async function dispatch(name, fields = {}) {
    const promises = []
    let response
    events.get(name)({ ...fields, waitUntil: (promise) => promises.push(promise), respondWith: (promise) => { response = promise } })
    const result = response ? await response : undefined
    await Promise.all(promises)
    return result
  }
  return { dispatch, stores, self, fetches, resolveKey }
}

const installed = workerRuntime()
await installed.dispatch('install')
assert.equal(installed.fetches.length, 1, 'shell and asset manifest must come from the same fetch')
const cache = installed.stores.get('debut-offline-v23')
assert.equal(await cache.get(installed.resolveKey('./index.html')).response.clone().text(), shell)
assert.equal(await cache.get(installed.resolveKey('./')).response.clone().text(), shell)
assert.ok(cache.has(installed.resolveKey('./assets/app.js')))
assert.ok(cache.has(installed.resolveKey('./stockfish/stockfish-19-lite-single.wasm')))
assert.equal(installed.self.skipCalls, 0)
let acknowledgedRelease
await installed.dispatch('message', { data: 'GET_RELEASE', ports: [{ postMessage: ({ release }) => { acknowledgedRelease = release } }] })
assert.equal(acknowledgedRelease, 'v23')
await installed.dispatch('message', { data: 'SKIP_WAITING' })
assert.equal(installed.self.skipCalls, 1)
await installed.dispatch('activate')
assert.equal(installed.self.claimCalls, 1)
assert.ok(!installed.stores.has('debut-offline-v20'))
assert.ok(installed.stores.has('another-app'), 'do not delete another app\'s caches')
const navigation = await installed.dispatch('fetch', { request: { url: 'https://example.test/chess-opening-trainer/?v=23', method: 'GET', mode: 'navigate' } })
assert.equal(await navigation.text(), shell)
const privacy = await installed.dispatch('fetch', { request: { url: 'https://example.test/chess-opening-trainer/privacy.html', method: 'GET', mode: 'navigate' } })
assert.equal(await privacy.text(), './privacy.html', 'privacy iframe must not receive the app shell')
for (const path of ['./assets/app.js', './assets/app.css', './stockfish/stockfish-19-lite-single.wasm']) {
  const response = await installed.dispatch('fetch', { request: {
    url: installed.resolveKey(path), method: 'GET', mode: 'cors', headers: { Origin: 'https://example.test' },
  } })
  assert.equal(await response.text(), path, 'public static cache must tolerate Vary: Origin differences on module requests')
}
assert.equal(installed.fetches.length, 1, 'cached navigation must work without another network request')
const rejected = workerRuntime({ failAssets: true })
await assert.rejects(rejected.dispatch('install'), /download failed/)
assert.equal(rejected.self.skipCalls, 0)
assert.equal(rejected.self.claimCalls, 0)
assert.ok(rejected.stores.has('debut-offline-v20'), 'failed installation must keep the old cache')

console.log('✓ PWA readiness, manual updates, offline failure recovery, scoped cache and matching shell/assets')

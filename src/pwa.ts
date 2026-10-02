import { Capacitor } from '@capacitor/core'

export type PwaStatus = 'pending' | 'ready' | 'update' | 'error'

let status: PwaStatus = 'pending'
let registration: ServiceWorkerRegistration | undefined
let preparation: Promise<void> | undefined
let updateCheck: Promise<void> | undefined
let reloadAfterUpdate = false
let loadedReleaseOutdated = false
let watchingLifecycle = false
let preparedController: ServiceWorker | null = null
let preparationFailed = false
const RELEASE = 'v23'
const listeners = new Set<(status: PwaStatus) => void>()

export const getPwaStatus = () => status

export function onPwaStatusChange(listener: (status: PwaStatus) => void) {
  listeners.add(listener)
  listener(status)
  return () => { listeners.delete(listener) }
}

function setStatus(next: PwaStatus) {
  if (status === next) return
  status = next
  listeners.forEach((listener) => listener(next))
}

function refreshStatus() {
  if (loadedReleaseOutdated || registration?.waiting) setStatus('update')
  else if (registration?.active && hasPreparedController()) setStatus('ready')
  else if (preparationFailed) setStatus('error')
  else setStatus('pending')
}

function hasPreparedController() {
  return Boolean(navigator.serviceWorker.controller && navigator.serviceWorker.controller === preparedController)
}

async function verifyController() {
  const controller = navigator.serviceWorker.controller
  if (!controller || hasPreparedController()) { refreshStatus(); return }
  const channel = new MessageChannel()
  const matches = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 1500)
    channel.port1.onmessage = ({ data }) => {
      window.clearTimeout(timer)
      resolve(data?.release === RELEASE)
    }
    try { controller.postMessage('GET_RELEASE', [channel.port2]) }
    catch { window.clearTimeout(timer); resolve(false) }
  })
  channel.port1.close()
  channel.port2.close()
  if (navigator.serviceWorker.controller === controller) {
    preparedController = matches ? controller : null
    refreshStatus()
  }
}

function watchInstallingWorker(worker: ServiceWorker | null) {
  if (!worker) return
  worker.addEventListener('statechange', () => {
    if (worker.state === 'redundant') { preparationFailed = true; refreshStatus() }
    else if (worker.state === 'installed' && navigator.serviceWorker.controller) setStatus('update')
    else refreshStatus()
  })
}

async function checkForUpdate() {
  if (!registration || updateCheck) return updateCheck
  preparationFailed = false
  updateCheck = (async () => {
    try {
      await registration!.update()
    } catch {
      // A failed update must not disable an already cached release.
      preparationFailed = true
      refreshStatus()
    }
  })()
  try { await updateCheck } finally { updateCheck = undefined }
}

export function preparePwa(): Promise<void> {
  if (Capacitor.isNativePlatform() || !import.meta.env.PROD) {
    return Promise.resolve()
  }
  if (!('serviceWorker' in navigator)) { setStatus('error'); return Promise.resolve() }
  if (preparation) return preparation
  if (!watchingLifecycle) {
    watchingLifecycle = true
    let hadController = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadAfterUpdate) { window.location.reload(); return }
      // Another open tab can activate an update; let this tab finish its game.
      if (hadController) loadedReleaseOutdated = true
      hadController = Boolean(navigator.serviceWorker.controller)
      refreshStatus()
      if (!loadedReleaseOutdated) void verifyController()
    })
    const check = () => { void (registration ? checkForUpdate() : preparePwa()) }
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }
  preparationFailed = false
  setStatus('pending')
  preparation = (async () => {
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      registration.addEventListener('updatefound', () => watchInstallingWorker(registration!.installing))
      watchInstallingWorker(registration.installing)
      refreshStatus()
      await Promise.all([verifyController(), checkForUpdate()])
    } catch {
      preparationFailed = true
      setStatus(hasPreparedController() ? 'ready' : 'error')
      preparation = undefined
    }
  })()
  return preparation
}

export function applyPwaUpdate() {
  if (status === 'error') {
    window.location.reload()
  } else if (registration?.waiting) {
    reloadAfterUpdate = true
    registration.waiting.postMessage('SKIP_WAITING')
  } else if (loadedReleaseOutdated) {
    window.location.reload()
  }
}

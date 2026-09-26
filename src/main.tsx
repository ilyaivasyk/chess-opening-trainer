import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './styles.css'

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        updateViaCache: 'none',
      })
      await registration.update()
    } catch {
      // Offline launch still works from the current cache.
    }
  })
}

function DismissBootSplash() {
  useEffect(() => { document.getElementById('boot-splash')?.remove() }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DismissBootSplash />
  </StrictMode>,
)

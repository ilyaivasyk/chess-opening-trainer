import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preparePwa } from './pwa'
import './styles.css'

void preparePwa()

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

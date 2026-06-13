import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'
import { AppProviders } from './app/providers/AppProviders'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error("Failed to find the root element")
}

createRoot(rootElement).render(
  <AppProviders>
    <App />
  </AppProviders>,
)

const cleanupLegacyServiceWorker = async (): Promise<void> => {
  const reloadKey = 'njupt-search:sw-clean'
  let removed = false

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async registration => {
      removed = true
      await registration.unregister()
    }))
  }

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(async key => {
      if (!key.startsWith('njupt-search') && !key.startsWith('workbox-')) return
      removed = true
      await caches.delete(key)
    }))
  }

  if (removed && sessionStorage.getItem(reloadKey) !== '1') {
    sessionStorage.setItem(reloadKey, '1')
    window.location.reload()
  }
}

void cleanupLegacyServiceWorker().catch(() => undefined)

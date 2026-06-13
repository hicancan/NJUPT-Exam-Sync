import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App'
import { AppProviders } from './app/providers/AppProviders'
import { APP_CONFIG } from './app/config/constants'



const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error("Failed to find the root element")
}

createRoot(rootElement).render(
  <AppProviders>
    <App />
  </AppProviders>,
)

let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {}

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateServiceWorker(true)
  },
  onRegisterError(error) {
    console.error('Service worker registration failed:', error)
  }
})

window.addEventListener(APP_CONFIG.UPDATE_APPLY_EVENT, () => {
  void updateServiceWorker(true)
})

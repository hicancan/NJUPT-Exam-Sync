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

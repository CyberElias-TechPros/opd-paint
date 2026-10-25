import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Two voices, both drawn from the product itself:
//   Instrument Serif — the catalogue voice. A tight, high-contrast display
//     serif with a real italic, set large and close. It reads like a printed
//     colour card, not a dashboard.
//   Archivo — the tin voice. A signage grotesque whose heavy caps match the
//     lettering on the pail; it carries labels, tables, forms and numbers.
// Subsets are declared per file, so only latin and latin-ext are ever fetched.
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/archivo/wght.css'
import './styles/theme.css'
import { App } from './App'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Offline support, production only.
 *
 * The worker caches the shell and the photography and leaves every API request
 * alone. It is registered after load so it can never compete with the first
 * paint of the hero, and a browser without service workers simply skips it.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration must never surface to a visitor: the site works
      // exactly as before, it just will not work offline.
    })
  })
}

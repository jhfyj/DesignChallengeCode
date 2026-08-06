import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// self-hosted (via @fontsource) instead of the Google Fonts CDN link that
// used to sit in index.html -- that request could stall or get blocked
// (slow network, ad blocker, corporate proxy), and since it's fetched from
// index.html itself, the text that needs it most (the very first "tap to
// begin" screen) had zero time to wait for it before rendering in a
// fallback font. Bundling the font files means they're guaranteed to be
// available as soon as the JS runs, no external request involved.
import '@fontsource/khula/400.css'
import '@fontsource/pt-mono/400.css'
import '@fontsource/petit-formal-script/400.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

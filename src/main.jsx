import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (not a Google Fonts <link>) so the terminal typeface still
// loads offline — the app is an installable PWA that precaches its assets.
// Latin + latin-ext subsets only: the full import pulls in cyrillic/greek/
// vietnamese weights too, which would bloat the offline precache for scripts
// this app never renders.
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/jetbrains-mono/latin-ext-400.css'
import '@fontsource/jetbrains-mono/latin-ext-500.css'
import '@fontsource/jetbrains-mono/latin-ext-700.css'
import './index.css'
import App from './App.jsx'
import { requestPersistentStorage } from './lib/persistentStorage.js'

// Fire and forget — nothing renders differently either way, and the answer
// needs to be settled before there is anything queued to lose.
requestPersistentStorage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

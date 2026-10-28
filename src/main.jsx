import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n.js'
import App from './App.jsx'
import PicsApp from './pics/PicsApp.jsx'
import { initErrorReporting } from './lib/errorReporting.js'

// Fire-and-forget: reads the DSN from the server's /config.json and starts
// reporting if one is set. Deliberately NOT awaited -- error reporting must
// never delay first paint. Errors in the first few hundred ms are the
// trade-off for not blocking render on a network round-trip.
initErrorReporting()

const isPics = window.location.hostname.startsWith('pics.')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPics ? <PicsApp /> : <App />}
  </StrictMode>,
)

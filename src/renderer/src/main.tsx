import '@fontsource/outfit'
import '@fontsource/geist-mono'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AudioProvider } from './context/AudioContext'
import { setupTauriBridge } from './lib/tauriBridge'

setupTauriBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>
)

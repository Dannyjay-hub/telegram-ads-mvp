// MUST run before any TonConnect SDK initialization
// Clears stale bridge sessions that cause 404 errors
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith('ton-connect'))
    .forEach(k => localStorage.removeItem(k));
} catch (_) { /* ignore in SSR */ }

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

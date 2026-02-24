import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global fetch interceptor — injects the session token for all /api/ requests.
const originalFetch = window.fetch
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {})

  // Session-based auth (preferred)
  const token = localStorage.getItem('dcc_token')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    // Legacy API-key path (dev/testing fallback)
    const apiKey = localStorage.getItem('dcc_api_key')
    const role = localStorage.getItem('dcc_role')
    const user = localStorage.getItem('dcc_user')
    if (apiKey) headers.set('X-API-Key', apiKey)
    if (role) headers.set('X-Role', role)
    if (user) headers.set('X-User', user)
  }

  return originalFetch(input, { ...init, headers })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

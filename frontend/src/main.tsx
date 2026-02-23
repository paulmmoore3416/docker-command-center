import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const originalFetch = window.fetch
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {})
  const apiKey = localStorage.getItem('dcc_api_key')
  const role = localStorage.getItem('dcc_role')
  const user = localStorage.getItem('dcc_user')

  if (apiKey) headers.set('X-API-Key', apiKey)
  if (role) headers.set('X-Role', role)
  if (user) headers.set('X-User', user)

  return originalFetch(input, { ...init, headers })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

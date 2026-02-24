import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Role = 'operator' | 'admin' | null

export interface AuthUser {
  username: string
  role: Role
  name?: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dcc_token'))

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('dcc_token')
    if (!savedToken) return

    fetch('http://localhost:9876/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('invalid session')
        return r.json()
      })
      .then((data: { username: string; role: string }) => {
        setUser({ username: data.username, role: data.role as Role })
        setToken(savedToken)
      })
      .catch(() => {
        localStorage.removeItem('dcc_token')
        setToken(null)
      })
  }, [])

  async function login(username: string, password: string) {
    const res = await fetch('http://localhost:9876/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      throw new Error('Invalid username or password')
    }
    const data = await res.json()
    localStorage.setItem('dcc_token', data.token)
    setToken(data.token)
    setUser({ username: data.username, role: data.role as Role, name: data.name })
  }

  function logout() {
    const savedToken = localStorage.getItem('dcc_token')
    if (savedToken) {
      fetch('http://localhost:9876/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${savedToken}` },
      }).catch(() => {})
    }
    localStorage.removeItem('dcc_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

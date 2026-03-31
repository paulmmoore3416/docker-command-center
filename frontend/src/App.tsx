import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  Container,
  Network,
  HardDrive,
  Activity,
  GitBranch,
  Settings,
  Bell,
  FileText,
  Shield,
  Terminal,
  Link2,
  Layers,
  Wand2,
  Boxes,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Zap,
  ShieldCheck,
  Code2,
  LogOut,
  User,
} from 'lucide-react'

import Dashboard from './pages/Dashboard'
import Containers from './pages/Containers'
import Networks from './pages/Networks'
import Volumes from './pages/Volumes'
import Environments from './pages/Environments'
import ComposeFiles from './pages/ComposeFiles'
import Proxy from './pages/Proxy'
import Stacks from './pages/Stacks'
import ComposeBuilder from './pages/ComposeBuilder'
import Templates from './pages/Templates'
import Updates from './pages/Updates'
import StackLogs from './pages/StackLogs'
import SettingsPage from './pages/Settings'
import { Security } from './pages/Security'
import { Logs } from './pages/Logs'
import { Drift } from './pages/Drift'
import Topology from './pages/Topology'
import { AdminPanel } from './pages/AdminPanel'
import { DevOptions } from './pages/DevOptions'

import { useWebSocket } from './hooks/useWebSocket'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BootScreen } from './components/BootScreen'
import { LoginScreen } from './components/LoginScreen'

// ─── Navigation item definitions ────────────────────────────────────────────

interface NavItem {
  path: string
  icon: React.ElementType
  label: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',            icon: Activity,    label: 'Dashboard' },
  { path: '/topology',   icon: Zap,         label: 'Topology Map' },
  { path: '/stacks',     icon: Layers,      label: 'Stacks' },
  { path: '/containers', icon: Container,   label: 'Containers' },
  { path: '/networks',   icon: Network,     label: 'Networks' },
  { path: '/volumes',    icon: HardDrive,   label: 'Volumes' },
  { path: '/environments', icon: GitBranch, label: 'Environments' },
  { path: '/compose',    icon: FileText,    label: 'Compose Files' },
  { path: '/builder',    icon: Wand2,       label: 'Visual Builder' },
  { path: '/templates',  icon: Boxes,       label: 'Templates' },
  { path: '/proxy',      icon: Link2,       label: 'Proxy Manager' },
  { path: '/drift',      icon: GitBranch,   label: 'Drift Detection' },
  { path: '/security',   icon: Shield,      label: 'Security' },
  { path: '/logs',       icon: Terminal,    label: 'Logs' },
  { path: '/stack-logs', icon: FileText,    label: 'Stack Logs' },
  { path: '/updates',    icon: RefreshCcw,  label: 'Updates' },
  { path: '/settings',   icon: Settings,    label: 'Settings' },
  // Admin-only
  { path: '/admin',      icon: ShieldCheck, label: 'Admin Panel',       adminOnly: true },
  { path: '/dev-options',icon: Code2,       label: 'Developer Options', adminOnly: true },
]

// ─── Navigation sidebar ──────────────────────────────────────────────────────

function Navigation() {
  const location = useLocation()
  const { user, isAdmin, logout } = useAuth()
  const [alerts, setAlerts] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('dcc_nav_collapsed') === 'true'
  })

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws`
  const { messages } = useWebSocket(wsUrl)

  useEffect(() => {
    const alertMessages = messages.filter((m: any) => m.type === 'alert')
    setAlerts(prev => [...alertMessages, ...prev].slice(0, 5))
  }, [messages])

  const triggerHaptic = () => {
    if (navigator?.vibrate) navigator.vibrate(15)
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('dcc_nav_collapsed', String(next))
    triggerHaptic()
  }

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <nav style={{
      width: collapsed ? '72px' : '240px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      transition: 'width 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: collapsed ? '0 12px' : '0 20px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Container size={24} color="#3b82f6" />
          {!collapsed && 'Docker CC'}
        </h1>
        {!collapsed && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px', marginBottom: 0 }}>
            Command Center
          </p>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className="btn-hover"
          style={{
            marginTop: '12px',
            padding: '6px 8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Alerts */}
      {!collapsed && alerts.length > 0 && (
        <div style={{
          margin: '0 15px 20px',
          padding: '10px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Bell size={14} color="#ef4444" />
            <span style={{ fontSize: '12px', fontWeight: '600' }}>
              {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Nav links */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          const adminColor = item.adminOnly ? '#a855f7' : 'var(--accent-blue)'

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '12px 16px' : '12px 20px',
                color: isActive ? adminColor : 'var(--text-secondary)',
                textDecoration: 'none',
                background: isActive
                  ? item.adminOnly ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)'
                  : 'transparent',
                borderLeft: isActive
                  ? `3px solid ${adminColor}`
                  : '3px solid transparent',
                transition: 'all 0.2s',
              }}
              className="nav-link"
              onClick={triggerHaptic}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <Icon size={20} />
              {!collapsed && (
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.label}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Footer: user info + logout */}
      <div style={{
        padding: collapsed ? '16px 12px' : '16px 20px',
        borderTop: '1px solid var(--border)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} className="pulse" />
          {!collapsed && <span>Connected</span>}
        </div>

        {/* Logged-in user */}
        {!collapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <User size={12} />
            <span style={{ fontWeight: '500' }}>{user.username}</span>
            <span style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              background: isAdmin ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.15)',
              color: isAdmin ? '#a855f7' : '#22c55e',
              fontWeight: '600',
            }}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title="Log out"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px 0',
            fontSize: '12px',
            width: '100%',
          }}
        >
          <LogOut size={14} />
          {!collapsed && 'Log out'}
        </button>

        {!collapsed && <div style={{ marginTop: '6px' }}>v2.2.0</div>}
      </div>
    </nav>
  )
}

// ─── App shell (requires auth) ───────────────────────────────────────────────

function AppShell() {
  const { isAdmin } = useAuth()

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Navigation />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/topology"   element={<Topology />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/networks"   element={<Networks />} />
          <Route path="/volumes"    element={<Volumes />} />
          <Route path="/environments" element={<Environments />} />
          <Route path="/compose"    element={<ComposeFiles />} />
          <Route path="/builder"    element={<ComposeBuilder />} />
          <Route path="/templates"  element={<Templates />} />
          <Route path="/proxy"      element={<Proxy />} />
          <Route path="/stacks"     element={<Stacks />} />
          <Route path="/drift"      element={<Drift />} />
          <Route path="/security"   element={<Security />} />
          <Route path="/logs"       element={<Logs />} />
          <Route path="/stack-logs" element={<StackLogs />} />
          <Route path="/updates"    element={<Updates />} />
          <Route path="/settings"   element={<SettingsPage />} />

          {/* Admin-only routes */}
          <Route
            path="/admin"
            element={isAdmin ? <AdminPanel /> : <Navigate to="/" replace />}
          />
          <Route
            path="/dev-options"
            element={isAdmin ? <DevOptions /> : <Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

// ─── Root flow: Boot → Login → App ──────────────────────────────────────────

function Root() {
  const { isAuthenticated, user } = useAuth()
  const [bootDone, setBootDone] = useState(() => {
    // Skip boot if user already has a saved session (page refresh).
    return localStorage.getItem('dcc_boot_shown') === 'true'
  })

  function handleBootComplete() {
    localStorage.setItem('dcc_boot_shown', 'true')
    setBootDone(true)
  }

  if (!bootDone) {
    return <BootScreen onComplete={handleBootComplete} />
  }

  if (!isAuthenticated || user === null) {
    return <LoginScreen />
  }

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}

export default App

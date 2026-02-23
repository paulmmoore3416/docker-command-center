import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
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
  Zap
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
import { useWebSocket } from './hooks/useWebSocket'

const NAV_ITEMS = [
  { path: '/', icon: Activity, label: 'Dashboard' },
  { path: '/topology', icon: Zap, label: 'Topology Map' },
  { path: '/stacks', icon: Layers, label: 'Stacks' },
  { path: '/containers', icon: Container, label: 'Containers' },
  { path: '/networks', icon: Network, label: 'Networks' },
  { path: '/volumes', icon: HardDrive, label: 'Volumes' },
  { path: '/environments', icon: GitBranch, label: 'Environments' },
  { path: '/compose', icon: FileText, label: 'Compose Files' },
  { path: '/builder', icon: Wand2, label: 'Visual Builder' },
  { path: '/templates', icon: Boxes, label: 'Templates' },
  { path: '/proxy', icon: Link2, label: 'Proxy Manager' },
  { path: '/drift', icon: GitBranch, label: 'Drift Detection' },
  { path: '/security', icon: Shield, label: 'Security' },
  { path: '/logs', icon: Terminal, label: 'Logs' },
  { path: '/stack-logs', icon: FileText, label: 'Stack Logs' },
  { path: '/updates', icon: RefreshCcw, label: 'Updates' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

function Navigation() {
  const location = useLocation()
  const [alerts, setAlerts] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('dcc_nav_collapsed') === 'true'
  })

  const { messages } = useWebSocket('ws://localhost:9876/api/ws')

  useEffect(() => {
    const alertMessages = messages.filter(m => m.type === 'alert')
    setAlerts(prev => [...alertMessages, ...prev].slice(0, 5))
  }, [messages])

  const triggerHaptic = () => {
    if (navigator?.vibrate) {
      navigator.vibrate(15)
    }
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('dcc_nav_collapsed', String(next))
    triggerHaptic()
  }

  return (
    <nav style={{
      width: collapsed ? '72px' : '240px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      transition: 'width 0.2s ease'
    }}>
      <div style={{ padding: collapsed ? '0 12px' : '0 20px', marginBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Container size={24} color="#3b82f6" />
          {!collapsed && 'Docker CC'}
        </h1>
        {!collapsed && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
            Command Center
          </p>
        )}
        <button
          onClick={toggleCollapse}
          className="btn-hover"
          style={{
            marginTop: '12px',
            padding: '6px 8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {!collapsed && alerts.length > 0 && (
        <div style={{
          margin: '0 15px 20px',
          padding: '10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Bell size={14} color="#ef4444" />
            <span style={{ fontSize: '12px', fontWeight: '600' }}>
              {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '12px 16px' : '12px 20px',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                textDecoration: 'none',
                background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
              className="nav-link"
              onClick={triggerHaptic}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
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
              {!collapsed && <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.label}</span>}
            </Link>
          )
        })}
      </div>

      <div style={{
        padding: collapsed ? '16px' : '20px',
        borderTop: '1px solid var(--border)',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent-green)'
          }} className="pulse" />
          {!collapsed && <span>Connected</span>}
        </div>
        {!collapsed && <div>v2.1.0</div>}
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh' }}>
        <Navigation />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/containers" element={<Containers />} />
            <Route path="/networks" element={<Networks />} />
            <Route path="/volumes" element={<Volumes />} />
            <Route path="/environments" element={<Environments />} />
            <Route path="/compose" element={<ComposeFiles />} />
            <Route path="/builder" element={<ComposeBuilder />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/proxy" element={<Proxy />} />
            <Route path="/stacks" element={<Stacks />} />
            <Route path="/drift" element={<Drift />} />
            <Route path="/security" element={<Security />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/stack-logs" element={<StackLogs />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

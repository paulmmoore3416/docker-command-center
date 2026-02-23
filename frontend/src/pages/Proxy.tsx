import { useEffect, useState } from 'react'
import { Link2, Plus, Trash2 } from 'lucide-react'

interface ProxyRoute {
  id: string
  name: string
  host: string
  target: string
  created_at: string
}

export default function Proxy() {
  const [routes, setRoutes] = useState<ProxyRoute[]>([])
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadRoutes()
  }, [])

  async function loadRoutes() {
    try {
      const response = await fetch('/api/proxy/routes')
      const data = await response.json()
      setRoutes(data || [])
    } catch (error) {
      console.error('Failed to load proxy routes:', error)
    }
  }

  async function addRoute() {
    if (!name || !host || !target) return
    setLoading(true)
    try {
      await fetch('/api/proxy/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, host, target })
      })
      setName('')
      setHost('')
      setTarget('')
      await loadRoutes()
    } catch (error) {
      console.error('Failed to add proxy route:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteRoute(id: string) {
    try {
      await fetch(`/api/proxy/routes/${id}`, { method: 'DELETE' })
      await loadRoutes()
    } catch (error) {
      console.error('Failed to delete proxy route:', error)
    }
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Proxy Manager
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Create and manage reverse proxy routes
        </p>
      </div>

      <div style={{
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        marginBottom: '20px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          Add Proxy Route
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Route name"
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)'
            }}
          />
          <input
            value={host}
            onChange={e => setHost(e.target.value)}
            placeholder="Host (example.local)"
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)'
            }}
          />
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="Target (http://container:3000)"
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            onClick={addRoute}
            disabled={loading}
            className="btn-hover"
            style={{
              padding: '10px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} style={{ marginRight: '6px' }} />
            Add
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {routes.map(route => (
          <div
            key={route.id}
            className="hover-lift"
            style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link2 size={18} color="#3b82f6" />
                <span style={{ fontWeight: '600' }}>{route.name}</span>
              </div>
              <button
                onClick={() => deleteRoute(route.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Host: {route.host}</div>
              <div>Target: {route.target}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

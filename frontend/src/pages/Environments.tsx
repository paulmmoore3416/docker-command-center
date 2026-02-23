import { useState, useEffect } from 'react'
import { GitBranch, Clock, Plus, Trash2 } from 'lucide-react'

export default function Environments() {
  const [environments, setEnvironments] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    branch: '',
    ttl_minutes: 240,
    compose_path: ''
  })

  useEffect(() => {
    loadEnvironments()
    const interval = setInterval(loadEnvironments, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadEnvironments() {
    try {
      const response = await fetch('/api/environments')
      const data = await response.json()
      setEnvironments(data || [])
    } catch (error) {
      console.error('Failed to load environments:', error)
    }
  }

  async function createEnvironment() {
    try {
      await fetch('/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      setShowCreate(false)
      setFormData({ name: '', branch: '', ttl_minutes: 240, compose_path: '' })
      loadEnvironments()
    } catch (error) {
      console.error('Failed to create environment:', error)
    }
  }

  async function deleteEnvironment(id: string) {
    try {
      await fetch(`/api/environments/${id}`, { method: 'DELETE' })
      loadEnvironments()
    } catch (error) {
      console.error('Failed to delete environment:', error)
    }
  }

  function getTimeRemaining(expiresAt: string) {
    const now = new Date().getTime()
    const expires = new Date(expiresAt).getTime()
    const diff = expires - now
    
    if (diff < 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h ${minutes}m remaining`
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            Ephemeral Environments
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Temporary isolated environments for testing branches
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 20px',
            background: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={18} />
          Create Environment
        </button>
      </div>

      {showCreate && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>
            New Environment
          </h3>
          
          <div style={{ display: 'grid', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="my-feature-env"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Git Branch
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={e => setFormData({ ...formData, branch: e.target.value })}
                style={inputStyle}
                placeholder="feature/new-api"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                TTL (minutes)
              </label>
              <input
                type="number"
                value={formData.ttl_minutes}
                onChange={e => setFormData({ ...formData, ttl_minutes: parseInt(e.target.value) })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Compose File Path
              </label>
              <input
                type="text"
                value={formData.compose_path}
                onChange={e => setFormData({ ...formData, compose_path: e.target.value })}
                style={inputStyle}
                placeholder="./docker-compose.yml"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={createEnvironment} style={buttonStyle}>
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{ ...buttonStyle, background: 'var(--bg-tertiary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {environments.map(env => (
          <div
            key={env.id}
            style={{
              padding: '20px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              transition: 'transform 0.2s'
            }}
            className="fade-in"
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GitBranch size={20} color="#3b82f6" />
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
                  {env.name}
                </h3>
              </div>
              <button
                onClick={() => deleteEnvironment(env.id)}
                style={{
                  padding: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-red)',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Branch:</span>
              <span style={{ fontSize: '14px', marginLeft: '8px', fontFamily: 'monospace' }}>
                {env.branch}
              </span>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="var(--accent-yellow)" />
              <span style={{ fontSize: '13px', color: 'var(--accent-yellow)' }}>
                {getTimeRemaining(env.expires_at)}
              </span>
            </div>

            <div style={{
              marginTop: '15px',
              padding: '10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div>Port offset: {env.port_offset}</div>
              <div>Containers: {env.containers?.length || 0}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>
                Created: {new Date(env.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '14px'
}

const buttonStyle = {
  padding: '10px 20px',
  background: 'var(--accent-blue)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer'
}

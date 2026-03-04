import { useState, useEffect } from 'react'
import { GitBranch, Clock, Plus, Trash2, Pencil, Check, X, Copy, ChevronDown, ChevronRight, Terminal, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Env {
  id: string
  name: string
  branch: string
  compose_path: string
  created_at: string
  expires_at: string
  port_offset: number
  containers: string[]
}

interface EditState {
  name: string
  branch: string
  compose_path: string
}

export default function Environments() {
  const { isAdmin } = useAuth()
  const [environments, setEnvironments] = useState<Env[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ name: '', branch: '', compose_path: '' })
  const [expandedDev, setExpandedDev] = useState<Set<string>>(new Set())
  const [expandedAdmin, setExpandedAdmin] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({ name: '', branch: 'main', ttl_minutes: 480, compose_path: '' })

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    try {
      const r = await fetch('/api/environments')
      const d = await r.json()
      setEnvironments(d || [])
    } catch {}
  }

  async function create() {
    await fetch('/api/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    setShowCreate(false)
    setFormData({ name: '', branch: 'main', ttl_minutes: 480, compose_path: '' })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/environments/${id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(env: Env) {
    setEditingId(env.id)
    setEditState({ name: env.name, branch: env.branch, compose_path: env.compose_path || '' })
  }

  async function saveEdit(id: string) {
    await fetch(`/api/environments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editState.name, branch: editState.branch, compose_path: editState.compose_path })
    })
    setEditingId(null)
    load()
  }

  async function extend(id: string, mins: number) {
    await fetch(`/api/environments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extend_minutes: mins })
    })
    load()
  }

  async function duplicate(id: string) {
    await fetch(`/api/environments/${id}/duplicate`, { method: 'POST' })
    load()
  }

  function toggleDev(id: string) {
    setExpandedDev(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleAdmin(id: string) {
    setExpandedAdmin(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function timeRemaining(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff < 0) return { label: 'Expired', urgent: true }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return { label: h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`, urgent: diff < 3600000 }
  }

  const isEditing = (id: string) => editingId === id

  return (
    <div style={{ padding: '30px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '6px' }}>Ephemeral Environments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Temporary isolated environments for testing branches</p>
        </div>
        <button type="button" onClick={() => setShowCreate(v => !v)} style={btnPrimary}>
          <Plus size={16} /> Create Environment
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 1fr', gap: '12px', alignItems: 'end' }}>
            <Field label="Name">
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={inp} placeholder="my-feature-env" />
            </Field>
            <Field label="Git Branch">
              <input value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })}
                style={inp} placeholder="main" />
            </Field>
            <Field label="TTL (min)">
              <input type="number" value={formData.ttl_minutes}
                onChange={e => setFormData({ ...formData, ttl_minutes: parseInt(e.target.value) })}
                style={inp} title="Time to live in minutes" placeholder="480" />
            </Field>
            <Field label="Compose Path">
              <input value={formData.compose_path} onChange={e => setFormData({ ...formData, compose_path: e.target.value })}
                style={inp} placeholder="./docker-compose.yml" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button type="button" onClick={create} style={btnPrimary}><Check size={14} /> Create</button>
            <button type="button" onClick={() => setShowCreate(false)} style={btnGhost}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Environment Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
        {environments.map(env => {
          const ttl = timeRemaining(env.expires_at)
          const editing = isEditing(env.id)
          const devOpen = expandedDev.has(env.id)
          const adminOpen = expandedAdmin.has(env.id)

          return (
            <div key={env.id} style={{
              background: 'var(--bg-secondary)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s'
            }}>

              {/* Card Header */}
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? '10px' : '0' }}>
                  {editing ? (
                    <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                      <input value={editState.name} onChange={e => setEditState({ ...editState, name: e.target.value })}
                        style={{ ...inp, flex: 1, padding: '5px 8px', fontSize: '15px', fontWeight: '600' }}
                        title="Environment name" placeholder="env-name" />
                      <button type="button" title="Save changes" onClick={() => saveEdit(env.id)} style={iconBtn('#22c55e')}><Check size={14} /></button>
                      <button type="button" title="Cancel editing" onClick={() => setEditingId(null)} style={iconBtn('#6b7280')}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GitBranch size={16} color="#3b82f6" />
                        <span style={{ fontSize: '16px', fontWeight: '600' }}>{env.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" onClick={() => startEdit(env)} title="Edit environment" style={iconBtn('#94a3b8')}><Pencil size={13} /></button>
                        <button type="button" onClick={() => remove(env.id)} title="Delete environment" style={iconBtn('#ef4444')}><Trash2 size={13} /></button>
                      </div>
                    </>
                  )}
                </div>

                {/* Branch + Compose inline edit */}
                {editing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <Field label="Branch">
                      <input value={editState.branch} onChange={e => setEditState({ ...editState, branch: e.target.value })}
                        style={{ ...inp, padding: '5px 8px' }} title="Git branch name" placeholder="main" />
                    </Field>
                    <Field label="Compose Path">
                      <input value={editState.compose_path} onChange={e => setEditState({ ...editState, compose_path: e.target.value })}
                        style={{ ...inp, padding: '5px 8px' }} title="Path to docker-compose file" placeholder="./docker-compose.yml" />
                    </Field>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>⎇ {env.branch}</span>
                    {env.compose_path && <span style={{ fontFamily: 'monospace' }}>{env.compose_path}</span>}
                  </div>
                )}
              </div>

              {/* TTL Row */}
              {!editing && (
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color={ttl.urgent ? '#f59e0b' : '#6b7280'} />
                    <span style={{ fontSize: '12px', color: ttl.urgent ? '#f59e0b' : 'var(--text-secondary)' }}>
                      {ttl.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[60, 240, 480].map(m => (
                      <button type="button" key={m} onClick={() => extend(env.id, m)} title={`Extend TTL by ${m / 60} hour${m > 60 ? 's' : ''}`}
                        style={{ padding: '2px 7px', fontSize: '11px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
                        +{m / 60}h
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Developer Details (collapsible) */}
              <div style={{ borderBottom: isAdmin ? '1px solid var(--border)' : 'none' }}>
                <button type="button" title="Toggle developer details" onClick={() => toggleDev(env.id)} style={{
                  width: '100%', padding: '8px 16px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500'
                }}>
                  <Terminal size={12} />
                  Developer Details
                  {devOpen ? <ChevronDown size={12} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={12} style={{ marginLeft: 'auto' }} />}
                </button>
                {devOpen && (
                  <div style={{ padding: '0 16px 12px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'grid', gap: '4px' }}>
                    <Row label="ID" value={env.id} copyable />
                    <Row label="Compose" value={env.compose_path || '—'} />
                    <Row label="Port offset" value={String(env.port_offset)} />
                    <Row label="Containers" value={String(env.containers?.length ?? 0)} />
                    <Row label="Created" value={new Date(env.created_at).toLocaleString()} />
                    <Row label="Expires" value={new Date(env.expires_at).toLocaleString()} />
                  </div>
                )}
              </div>

              {/* Admin Controls (admin only, collapsible) */}
              {isAdmin && (
                <div>
                  <button type="button" title="Toggle admin controls" onClick={() => toggleAdmin(env.id)} style={{
                    width: '100%', padding: '8px 16px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    color: '#a78bfa', fontSize: '12px', fontWeight: '500'
                  }}>
                    <Shield size={12} />
                    Admin Controls
                    {adminOpen ? <ChevronDown size={12} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={12} style={{ marginLeft: 'auto' }} />}
                  </button>
                  {adminOpen && (
                    <div style={{ padding: '4px 16px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => duplicate(env.id)} style={btnSmall('#7c3aed')}>
                        <Copy size={12} /> Duplicate
                      </button>
                      <button type="button" onClick={() => extend(env.id, 1440)} style={btnSmall('#0369a1')}>
                        <Clock size={12} /> +24h
                      </button>
                      <button type="button" onClick={() => remove(env.id)} style={btnSmall('#b91c1c')}>
                        <Trash2 size={12} /> Force Expire
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {environments.length === 0 && !showCreate && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          No environments yet. Click <strong>Create Environment</strong> to get started.
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={{ color: '#64748b', minWidth: '72px' }}>{label}:</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
      {copyable && (
        <button type="button" title="Copy to clipboard" onClick={() => navigator.clipboard.writeText(value)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0 2px' }}>
          <Copy size={10} />
        </button>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)', borderRadius: '5px',
  color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box'
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--accent-blue)', color: 'white',
  border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
}

const btnGhost: React.CSSProperties = {
  ...btnPrimary, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)'
}

const iconBtn = (color: string): React.CSSProperties => ({
  padding: '4px', background: 'transparent', border: 'none',
  color, cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center'
})

const btnSmall = (bg: string): React.CSSProperties => ({
  padding: '4px 10px', background: bg, color: 'white', border: 'none',
  borderRadius: '4px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px'
})

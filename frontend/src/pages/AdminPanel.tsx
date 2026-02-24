import { useState, useEffect } from 'react'
import { Shield, Users, FileText, AlertTriangle, RefreshCw } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface AuditEvent {
  timestamp: string
  user: string
  role: string
  action: string
  method: string
  path: string
  status: number
}

export function AdminPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchAudit() {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/audit?limit=100')
      if (!res.ok) throw new Error('Failed to load audit log')
      const data = await res.json()
      setEvents(data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAudit() }, [])

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Shield size={28} color="#3b82f6" />
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Admin Panel</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Administrator-only controls and audit log
          </p>
        </div>
        <button
          onClick={fetchAudit}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { icon: Users, label: 'Active Users', value: '2', color: '#3b82f6' },
          { icon: FileText, label: 'Audit Events', value: String(events.length), color: '#22c55e' },
          { icon: AlertTriangle, label: 'Errors', value: String(events.filter(e => e.status >= 400).length), color: '#ef4444' },
        ].map(card => (
          <div
            key={card.label}
            style={{
              padding: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <card.icon size={28} color={card.color} />
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: '600', fontSize: '15px' }}>
          Audit Log
        </div>

        {loading && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: '16px 20px', color: '#ef4444', fontSize: '13px' }}>{error}</div>
        )}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)' }}>
                  {['Time', 'User', 'Role', 'Action', 'Method', 'Path', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No audit events yet
                    </td>
                  </tr>
                )}
                {events.map((ev, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 14px' }}>{ev.user || '—'}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: ev.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        color: ev.role === 'admin' ? '#3b82f6' : '#22c55e',
                      }}>
                        {ev.role}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px' }}>{ev.action}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{ev.method}</span>
                    </td>
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: '12px' }}>{ev.path}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: ev.status >= 400 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                        color: ev.status >= 400 ? '#ef4444' : '#22c55e',
                      }}>
                        {ev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

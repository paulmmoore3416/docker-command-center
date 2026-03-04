import { useState, useEffect } from 'react'
import {
  Shield, Users, AlertTriangle, RefreshCw,
  Server, Trash2, Cpu, HardDrive, Activity, LogOut,
  Play, Square, RotateCcw, Database, Network, Box,
  Image as ImageIcon, ChevronDown, ChevronUp,
} from 'lucide-react'
import { apiFetch } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEvent { timestamp: string; user: string; role: string; action: string; method: string; path: string; status: number }
interface UserInfo { username: string; name: string; role: string; active_sessions: number }
interface SessionInfo { token: string; username: string; role: string; created_at: string; expires_at: string }
interface DockerContainer { Id: string; Names: string[]; Image: string; Status: string; State: string; Created: number }
interface SystemInfo { containers: number; containers_running: number; containers_paused: number; containers_stopped: number; images: number; docker_version: string; operating_system: string; ncpu: number; mem_total_mb: number }
interface PruneResult { deleted: string[]; space_reclaimed: number }
interface Thresholds { cpu_percent: number; memory_percent: number; disk_gb: number; log_size_mb: number }

// ─── Shared helpers ───────────────────────────────────────────────────────────

const TABS = ['Overview', 'Users', 'Containers', 'System', 'Audit Log'] as const
type Tab = typeof TABS[number]

const roleBadge = (role: string) => ({
  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
  background: role === 'admin' ? 'rgba(59,130,246,0.15)' : role === 'operator' ? 'rgba(168,85,247,0.15)' : 'rgba(107,114,128,0.2)',
  color: role === 'admin' ? '#3b82f6' : role === 'operator' ? '#a855f7' : '#9ca3af',
})

const statusBadge = (s: number) => ({
  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
  background: s >= 500 ? 'rgba(239,68,68,0.15)' : s >= 400 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
  color: s >= 500 ? '#ef4444' : s >= 400 ? '#f59e0b' : '#22c55e',
})

const stateBadge = (state: string) => ({
  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
  background: state === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
  color: state === 'running' ? '#22c55e' : '#9ca3af',
})

const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
  cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', ...extra,
})

const dangerBtn: React.CSSProperties = {
  ...btn(), border: '1px solid rgba(239,68,68,0.4)',
  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ events }: { events: AuditEvent[] }) {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])

  useEffect(() => {
    apiFetch('/admin/system-info').then(r => r.ok ? r.json() : null).then(d => d && setSysInfo(d)).catch(() => {})
    apiFetch('/admin/sessions').then(r => r.ok ? r.json() : []).then(d => setSessions(d ?? [])).catch(() => {})
  }, [])

  const errCount = events.filter(e => e.status >= 400).length
  const recent = [...events].reverse().slice(0, 8)

  const cards = [
    { icon: Box, label: 'Containers', value: sysInfo ? `${sysInfo.containers_running} / ${sysInfo.containers}` : '—', sub: 'running / total', color: '#3b82f6' },
    { icon: ImageIcon, label: 'Images', value: sysInfo?.images ?? '—', sub: 'available', color: '#a855f7' },
    { icon: Users, label: 'Active Sessions', value: sessions.length, sub: 'live tokens', color: '#22c55e' },
    { icon: AlertTriangle, label: 'Audit Errors', value: errCount, sub: 'status ≥ 400', color: errCount > 0 ? '#ef4444' : '#6b7280' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {cards.map(c => (
          <div key={c.label} style={{ padding: '18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <c.icon size={28} color={c.color} />
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700 }}>{c.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.7 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {sysInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Docker Daemon</div>
            {[
              ['Version', sysInfo.docker_version],
              ['OS', sysInfo.operating_system],
              ['CPUs', sysInfo.ncpu],
              ['Memory', `${sysInfo.mem_total_mb.toLocaleString()} MB`],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontFamily: 'monospace' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Container Breakdown</div>
            {[
              ['Running', sysInfo.containers_running, '#22c55e'],
              ['Paused', sysInfo.containers_paused, '#f59e0b'],
              ['Stopped', sysInfo.containers_stopped, '#6b7280'],
              ['Total', sysInfo.containers, '#3b82f6'],
            ].map(([k, v, color]) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontWeight: 600, color: String(color) }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>Recent Audit Activity</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <tbody>
            {recent.length === 0
              ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No events</td></tr>
              : recent.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '7px 12px', color: '#555', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td style={{ padding: '7px 12px', color: '#a855f7' }}>{e.user || '—'}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{e.action}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.path}</td>
                  <td style={{ padding: '7px 12px' }}><span style={statusBadge(e.status)}>{e.status}</span></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [revoking, setRevoking] = useState<string | null>(null)
  const [showSessions, setShowSessions] = useState(false)

  const fetchAll = async () => {
    const [ur, sr] = await Promise.all([apiFetch('/admin/users'), apiFetch('/admin/sessions')])
    if (ur.ok) setUsers((await ur.json()) ?? [])
    if (sr.ok) setSessions((await sr.json()) ?? [])
  }

  useEffect(() => { fetchAll() }, [])

  const revoke = async (token: string) => {
    setRevoking(token)
    await apiFetch(`/admin/sessions/${token}`, { method: 'DELETE' })
    await fetchAll()
    setRevoking(null)
  }

  const revokeAll = async () => {
    await Promise.all(sessions.map(s => apiFetch(`/admin/sessions/${s.token}`, { method: 'DELETE' })))
    await fetchAll()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Users */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>Registered Users</span>
          <button type="button" style={btn()} onClick={fetchAll}><RefreshCw size={13} />Refresh</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)' }}>
              {['Username', 'Display Name', 'Role', 'Active Sessions'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.username} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{u.username}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{u.name}</td>
                <td style={{ padding: '10px 14px' }}><span style={roleBadge(u.role)}>{u.role}</span></td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontWeight: 600, color: u.active_sessions > 0 ? '#22c55e' : 'var(--text-secondary)' }}>
                    {u.active_sessions}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sessions */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div
          style={{ padding: '12px 16px', borderBottom: showSessions ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => setShowSessions(v => !v)}
        >
          <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>Active Sessions ({sessions.length})</span>
          {sessions.length > 0 && (
            <button type="button" style={dangerBtn} onClick={e => { e.stopPropagation(); revokeAll() }}>
              <LogOut size={13} />Revoke All
            </button>
          )}
          {showSessions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {showSessions && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                {['Token', 'User', 'Role', 'Created', 'Expires', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0
                ? <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No active sessions</td></tr>
                : sessions.map(s => (
                  <tr key={s.token} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#9ca3af' }}>{s.token.slice(0, 12)}…</td>
                    <td style={{ padding: '8px 12px', color: '#a855f7', fontWeight: 600 }}>{s.username}</td>
                    <td style={{ padding: '8px 12px' }}><span style={roleBadge(s.role)}>{s.role}</span></td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(s.expires_at).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <button type="button" style={dangerBtn} disabled={revoking === s.token} onClick={() => revoke(s.token)}>
                        <LogOut size={12} />{revoking === s.token ? '…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Containers Tab ───────────────────────────────────────────────────────────

function ContainersTab() {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [pruning, setPruning] = useState(false)
  const [pruneResult, setPruneResult] = useState<PruneResult | null>(null)

  const fetchContainers = () =>
    apiFetch('/containers').then(r => r.ok ? r.json() : []).then(d => setContainers(d ?? [])).catch(() => {})

  useEffect(() => { fetchContainers() }, [])

  const act = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setActing(`${id}-${action}`)
    await apiFetch(`/containers/${id}/${action}`, { method: 'POST' })
    await fetchContainers()
    setActing(null)
  }

  const stopAll = async () => {
    setActing('bulk-stop')
    await Promise.all(containers.filter(c => c.State === 'running').map(c => apiFetch(`/containers/${c.Id}/stop`, { method: 'POST' })))
    await fetchContainers()
    setActing(null)
  }

  const pruneContainers = async () => {
    setPruning(true)
    const r = await apiFetch('/admin/prune/containers', { method: 'POST' })
    if (r.ok) setPruneResult(await r.json())
    await fetchContainers()
    setPruning(false)
  }

  const displayed = containers.filter(c =>
    filter === 'all' || (filter === 'running' ? c.State === 'running' : c.State !== 'running')
  )
  const runningCount = containers.filter(c => c.State === 'running').length
  const stoppedCount = containers.filter(c => c.State !== 'running').length

  return (
    <div>
      {/* Actions bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(['all', 'running', 'stopped'] as const).map(f => (
          <button type="button" key={f} onClick={() => setFilter(f)}
            style={{ ...btn(), background: filter === f ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)', color: filter === f ? '#3b82f6' : 'var(--text-primary)', border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'var(--border)'}` }}>
            {f === 'all' ? `All (${containers.length})` : f === 'running' ? `Running (${runningCount})` : `Stopped (${stoppedCount})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button type="button" style={btn()} onClick={fetchContainers}><RefreshCw size={13} />Refresh</button>
        <button type="button" style={dangerBtn} onClick={stopAll} disabled={acting === 'bulk-stop' || runningCount === 0}>
          <Square size={13} />{acting === 'bulk-stop' ? 'Stopping…' : `Stop All (${runningCount})`}
        </button>
        <button type="button" style={dangerBtn} onClick={pruneContainers} disabled={pruning || stoppedCount === 0}>
          <Trash2 size={13} />{pruning ? 'Pruning…' : `Prune Stopped (${stoppedCount})`}
        </button>
      </div>

      {pruneResult && (
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '7px', fontSize: '12px', color: '#22c55e', marginBottom: '12px' }}>
          Pruned {pruneResult.deleted.length} container(s) · {mb(pruneResult.space_reclaimed)} reclaimed
          <button type="button" style={{ marginLeft: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: '12px' }} onClick={() => setPruneResult(null)}>✕</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                {['Name', 'Image', 'State', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0
                ? <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No containers</td></tr>
                : displayed.map(c => (
                  <tr key={c.Id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.Names[0]?.replace(/^\//, '')}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.Image}</td>
                    <td style={{ padding: '8px 12px' }}><span style={stateBadge(c.State)}>{c.State}</span></td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>{c.Status}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {c.State !== 'running' && (
                          <button type="button" title="Start" style={btn({ padding: '4px 8px', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' })}
                            disabled={acting === `${c.Id}-start`} onClick={() => act(c.Id, 'start')}>
                            <Play size={12} />
                          </button>
                        )}
                        {c.State === 'running' && (
                          <button type="button" title="Stop" style={btn({ padding: '4px 8px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' })}
                            disabled={acting === `${c.Id}-stop`} onClick={() => act(c.Id, 'stop')}>
                            <Square size={12} />
                          </button>
                        )}
                        <button type="button" title="Restart" style={btn({ padding: '4px 8px' })}
                          disabled={acting === `${c.Id}-restart`} onClick={() => act(c.Id, 'restart')}>
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

interface PruneCard { id: string; icon: React.ElementType; label: string; description: string; color: string; endpoint: string; danger?: boolean }

const PRUNE_CARDS: PruneCard[] = [
  { id: 'containers', icon: Box, label: 'Prune Containers', description: 'Remove all stopped containers and reclaim disk space.', color: '#3b82f6', endpoint: '/admin/prune/containers' },
  { id: 'images', icon: ImageIcon, label: 'Prune Images', description: 'Delete dangling (untagged) and unused images.', color: '#a855f7', endpoint: '/admin/prune/images' },
  { id: 'volumes', icon: Database, label: 'Prune Volumes', description: 'Remove volumes not referenced by any container.', color: '#f59e0b', endpoint: '/admin/prune/volumes', danger: true },
  { id: 'networks', icon: Network, label: 'Prune Networks', description: 'Remove custom networks with no active endpoints.', color: '#22c55e', endpoint: '/admin/prune/networks' },
]

function SystemTab() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [thresholds, setThresholds] = useState<Thresholds | null>(null)
  const [saving, setSaving] = useState(false)
  const [pruning, setPruning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, PruneResult>>({})
  const [confirm, setConfirm] = useState<string | null>(null)

  const fetchAll = () => {
    apiFetch('/admin/system-info').then(r => r.ok ? r.json() : null).then(d => d && setSysInfo(d)).catch(() => {})
    apiFetch('/monitoring/thresholds').then(r => r.ok ? r.json() : null).then(d => d && setThresholds(d)).catch(() => {})
  }

  useEffect(() => { fetchAll() }, [])

  const runPrune = async (card: PruneCard) => {
    if (card.danger && confirm !== card.id) { setConfirm(card.id); return }
    setConfirm(null)
    setPruning(card.id)
    const r = await apiFetch(card.endpoint, { method: 'POST' })
    if (r.ok) {
      const data = await r.json()
      setResults(prev => ({ ...prev, [card.id]: data }))
    }
    await fetchAll()
    setPruning(null)
  }

  const saveThresholds = async () => {
    if (!thresholds) return
    setSaving(true)
    await apiFetch('/monitoring/thresholds', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(thresholds) })
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Docker Info */}
      {sysInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { icon: Server, label: 'Docker', value: sysInfo.docker_version, color: '#3b82f6' },
            { icon: Cpu, label: 'CPUs', value: sysInfo.ncpu, color: '#a855f7' },
            { icon: HardDrive, label: 'Memory', value: `${sysInfo.mem_total_mb.toLocaleString()} MB`, color: '#22c55e' },
            { icon: Activity, label: 'OS', value: sysInfo.operating_system, color: '#f59e0b' },
          ].map(c => (
            <div key={c.label} style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <c.icon size={22} color={c.color} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{c.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prune tools */}
      <div>
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Prune Tools</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {PRUNE_CARDS.map(card => {
            const result = results[card.id]
            const isConfirming = confirm === card.id
            return (
              <div key={card.id} style={{ padding: '16px', background: 'var(--bg-secondary)', border: `1px solid ${isConfirming ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`, borderRadius: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <card.icon size={18} color={card.color} />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{card.label}</span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{card.description}</p>
                {result && (
                  <div style={{ fontSize: '11px', color: '#22c55e', marginBottom: '8px' }}>
                    ✓ {result.deleted.length} removed · {mb(result.space_reclaimed)} freed
                  </div>
                )}
                {isConfirming ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" style={{ ...dangerBtn, fontSize: '12px' }} onClick={() => runPrune(card)}>Confirm</button>
                    <button type="button" style={btn({ fontSize: '12px' })} onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                ) : (
                  <button type="button"
                    disabled={pruning === card.id}
                    onClick={() => runPrune(card)}
                    style={card.danger ? dangerBtn : btn({ color: card.color, borderColor: card.color + '55', background: card.color + '18' })}>
                    <Trash2 size={12} />{pruning === card.id ? 'Pruning…' : 'Run Prune'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Alert Thresholds */}
      {thresholds && (
        <div style={{ padding: '18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Alert Thresholds</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
            {[
              { key: 'cpu_percent' as const, label: 'CPU Alert (%)', min: 1, max: 100, step: 1 },
              { key: 'memory_percent' as const, label: 'Memory Alert (%)', min: 1, max: 100, step: 1 },
              { key: 'disk_gb' as const, label: 'Disk Alert (GB)', min: 1, max: 10000, step: 1 },
              { key: 'log_size_mb' as const, label: 'Log Size Alert (MB)', min: 1, max: 10000, step: 1 },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{f.label}</label>
                <input
                  type="number"
                  aria-label={f.label}
                  min={f.min} max={f.max} step={f.step}
                  value={thresholds[f.key]}
                  onChange={e => setThresholds(prev => prev ? { ...prev, [f.key]: Number(e.target.value) } : prev)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <button type="button" style={btn({ color: '#3b82f6', borderColor: 'rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)' })} onClick={saveThresholds} disabled={saving}>
            {saving ? 'Saving…' : 'Save Thresholds'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditTab() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error'>('all')
  const [limit, setLimit] = useState(200)
  const [flushing, setFlushing] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    const r = await apiFetch(`/audit?limit=${limit}`)
    if (r.ok) setEvents((await r.json()) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [limit])

  const flush = async () => {
    setFlushing(true)
    await apiFetch('/audit', { method: 'DELETE' })
    setEvents([])
    setFlushing(false)
  }

  const filtered = [...events].reverse().filter(e => {
    if (userFilter && !e.user?.toLowerCase().includes(userFilter.toLowerCase())) return false
    if (actionFilter && !e.action?.toLowerCase().includes(actionFilter.toLowerCase())) return false
    if (statusFilter === 'ok' && e.status >= 400) return false
    if (statusFilter === 'error' && e.status < 400) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Filter user…" value={userFilter} onChange={e => setUserFilter(e.target.value)}
          style={{ padding: '5px 9px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '130px' }} />
        <input placeholder="Filter action…" value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          style={{ padding: '5px 9px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '150px' }} />
        {(['all', 'ok', 'error'] as const).map(f => (
          <button type="button" key={f} onClick={() => setStatusFilter(f)}
            style={{ ...btn(), background: statusFilter === f ? 'rgba(59,130,246,0.12)' : 'var(--bg-tertiary)', color: statusFilter === f ? '#3b82f6' : 'var(--text-secondary)', borderColor: statusFilter === f ? 'rgba(59,130,246,0.35)' : 'var(--border)' }}>
            {f === 'all' ? 'All' : f === 'ok' ? '✓ OK' : '✕ Errors'}
          </button>
        ))}
        <select aria-label="Limit" value={limit} onChange={e => setLimit(Number(e.target.value))}
          style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px' }}>
          {[100, 200, 500, 1000].map(n => <option key={n} value={n}>{n} entries</option>)}
        </select>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} shown</span>
        <button type="button" style={btn()} onClick={fetchEvents}><RefreshCw size={13} />Refresh</button>
        <button type="button" style={dangerBtn} onClick={flush} disabled={flushing}><Trash2 size={13} />{flushing ? 'Flushing…' : 'Flush Log'}</button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        {loading
          ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                <tr>
                  {['Time', 'User', 'Role', 'Action', 'Method', 'Path', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No events match</td></tr>
                  : filtered.map((e, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={{ padding: '7px 12px', color: '#555', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '7px 12px', color: '#a855f7', fontWeight: 600 }}>{e.user || '—'}</td>
                      <td style={{ padding: '7px 12px' }}><span style={roleBadge(e.role)}>{e.role}</span></td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{e.action}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#3b82f6' }}>{e.method}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{e.path}</td>
                      <td style={{ padding: '7px 12px' }}><span style={statusBadge(e.status)}>{e.status}</span></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    apiFetch('/audit?limit=200').then(r => r.ok ? r.json() : []).then(d => setEvents(d ?? [])).catch(() => {})
  }, [])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexShrink: 0 }}>
        <Shield size={28} color="#3b82f6" />
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Admin Panel</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Docker orchestration controls — administrator only</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button type="button" key={t} onClick={() => setTab(t)}
            style={{
              padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px',
              color: tab === t ? '#3b82f6' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t ? '#3b82f6' : 'transparent'}`,
              fontWeight: tab === t ? 600 : 400, transition: 'color 0.15s', marginBottom: '-1px',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'Overview' && <OverviewTab events={events} />}
        {tab === 'Users' && <UsersTab />}
        {tab === 'Containers' && <ContainersTab />}
        {tab === 'System' && <SystemTab />}
        {tab === 'Audit Log' && <AuditTab />}
      </div>
    </div>
  )
}

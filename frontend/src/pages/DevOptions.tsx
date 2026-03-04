import React, { useState, useEffect, useRef } from 'react'
import { Terminal, Code, Cpu, Database, Sliders, X, Play, RefreshCw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry { timestamp: string; level: string; message: string }
interface RuntimeMetrics {
  timestamp: string; goroutines: number; mem_alloc_mb: number
  mem_sys_mb: number; gc_runs: number; heap_objects: number; uptime: string
}
interface AuditEvent {
  timestamp: string; user: string; role: string; action: string
  method: string; path: string; status: number
}
interface FeatureFlag { name: string; description: string; enabled: boolean; category: string }
interface RouteInfo { methods: string[]; path: string }
interface LogStats { path: string; size_bytes: number; line_count: number }

// ─── Shared helpers ───────────────────────────────────────────────────────────

const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: '5px', border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
  cursor: 'pointer', fontSize: '12px', ...extra,
})

const dangerBtn: React.CSSProperties = {
  ...btn(), border: '1px solid rgba(239,68,68,0.4)',
  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
}

const activeBtn: React.CSSProperties = {
  ...btn(), border: '1px solid rgba(168,85,247,0.4)',
  background: 'rgba(168,85,247,0.15)', color: '#a855f7',
}

// ─── Debug Console ────────────────────────────────────────────────────────────

function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = () =>
    fetch('/api/dev/logs').then(r => r.ok ? r.json() : []).then(d => setLogs(d ?? [])).catch(() => {})

  const clearLogs = () =>
    fetch('/api/dev/logs', { method: 'DELETE' }).then(() => setLogs([]))

  useEffect(() => {
    fetchLogs()
    if (!autoRefresh) return
    const id = setInterval(fetchLogs, 2000)
    return () => clearInterval(id)
  }, [autoRefresh])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const levelColor = (l: string) =>
    l === 'ERROR' ? '#ef4444' : l === 'WARN' ? '#f59e0b' : '#6b7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
          {logs.length} entries
        </span>
        <button type="button" style={autoRefresh ? activeBtn : btn()} onClick={() => setAutoRefresh(v => !v)}>
          Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
        </button>
        <button type="button" style={btn()} onClick={fetchLogs}>Refresh</button>
        <button type="button" style={dangerBtn} onClick={clearLogs}>Clear</button>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', background: '#0d0d0d', borderRadius: '6px',
        border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '12px', padding: '10px',
      }}>
        {logs.length === 0
          ? <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>No log entries yet</div>
          : logs.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '2px', lineHeight: '1.6' }}>
              <span style={{ color: '#444', minWidth: '72px', flexShrink: 0 }}>
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ color: levelColor(e.level), minWidth: '42px', fontWeight: 600, flexShrink: 0 }}>
                {e.level}
              </span>
              <span style={{ color: '#d4d4d4', wordBreak: 'break-all' }}>{e.message}</span>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── API Explorer ─────────────────────────────────────────────────────────────

function APIExplorer() {
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<RouteInfo | null>(null)
  const [testMethod, setTestMethod] = useState('GET')
  const [testBody, setTestBody] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusCode, setStatusCode] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/dev/routes').then(r => r.json()).then(d => setRoutes(d ?? [])).catch(() => {})
  }, [])

  const filtered = routes.filter(rt =>
    rt.path.toLowerCase().includes(filter.toLowerCase()) ||
    rt.methods.some(m => m.toLowerCase().includes(filter.toLowerCase()))
  )

  const runRequest = async () => {
    if (!selected) return
    setLoading(true)
    setResponse(null)
    setStatusCode(null)
    try {
      const opts: RequestInit = { method: testMethod }
      if (testBody && testMethod !== 'GET') {
        opts.body = testBody
        opts.headers = { 'Content-Type': 'application/json' }
      }
      const res = await fetch(selected.path, opts)
      setStatusCode(res.status)
      const text = await res.text()
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)) }
      catch { setResponse(text) }
    } catch (e: any) {
      setResponse(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  const methodColor = (m: string) => (
    ({ GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', DELETE: '#ef4444', PATCH: '#a855f7' } as any)[m] ?? '#9ca3af'
  )

  const statusColor = (s: number) => s >= 500 ? '#ef4444' : s >= 400 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ display: 'flex', gap: '14px', height: '100%', overflow: 'hidden' }}>
      {/* Route list */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          placeholder="Filter routes…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px',
            outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map((rt, i) => (
            <div
              key={i}
              onClick={() => { setSelected(rt); setTestMethod(rt.methods[0] ?? 'GET'); setResponse(null) }}
              style={{
                padding: '7px 10px', borderRadius: '5px', cursor: 'pointer', marginBottom: '2px',
                background: selected === rt ? 'rgba(168,85,247,0.1)' : 'transparent',
                border: `1px solid ${selected === rt ? 'rgba(168,85,247,0.35)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {rt.methods.map(m => (
                <span key={m} style={{ fontSize: '10px', fontWeight: 700, color: methodColor(m), minWidth: '32px', flexShrink: 0 }}>{m}</span>
              ))}
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rt.path}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>No routes match</div>
          )}
        </div>
      </div>

      {/* Test panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
        {selected ? (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#a855f7', wordBreak: 'break-all' }}>{selected.path}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                aria-label="HTTP method"
                value={testMethod}
                onChange={e => setTestMethod(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px' }}
              >
                {selected.methods.map(m => <option key={m}>{m}</option>)}
              </select>
              <button
                type="button"
                onClick={runRequest}
                disabled={loading}
                style={{ padding: '5px 14px', borderRadius: '5px', background: '#a855f7', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', opacity: loading ? 0.7 : 1 }}
              >
                <Play size={12} /> {loading ? 'Sending…' : 'Send'}
              </button>
              {statusCode !== null && (
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: statusColor(statusCode), fontWeight: 600 }}>
                  {statusCode}
                </span>
              )}
            </div>
            {testMethod !== 'GET' && (
              <textarea
                value={testBody}
                onChange={e => setTestBody(e.target.value)}
                placeholder="Request body (JSON)…"
                rows={3}
                style={{ padding: '7px 9px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', outline: 'none' }}
              />
            )}
            {response !== null && (
              <div style={{ flex: 1, overflowY: 'auto', background: '#0d0d0d', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {response}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', paddingTop: '16px' }}>
            Select a route on the left to test it
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Performance Profiler ─────────────────────────────────────────────────────

function PerformanceProfiler() {
  const [metrics, setMetrics] = useState<RuntimeMetrics | null>(null)
  const [history, setHistory] = useState<RuntimeMetrics[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchMetrics = () =>
    fetch('/api/dev/metrics').then(r => r.ok ? r.json() : null).then(m => {
      if (!m) return
      setMetrics(m)
      setHistory(h => [...h.slice(-29), m])
    }).catch(() => {})

  useEffect(() => {
    fetchMetrics()
    if (!autoRefresh) return
    const id = setInterval(fetchMetrics, 3000)
    return () => clearInterval(id)
  }, [autoRefresh])

  const Card = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#a855f7' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )

  const sparkMax = Math.max(...history.map(m => m.goroutines), 1)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
        <button type="button" style={autoRefresh ? activeBtn : btn()} onClick={() => setAutoRefresh(v => !v)}>
          Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
        </button>
        <button type="button" style={btn()} onClick={fetchMetrics}><RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Refresh</button>
      </div>

      {metrics ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <Card label="Goroutines" value={metrics.goroutines} />
            <Card label="Heap Alloc" value={`${metrics.mem_alloc_mb.toFixed(1)} MB`} sub={`System: ${metrics.mem_sys_mb.toFixed(1)} MB`} />
            <Card label="GC Runs" value={metrics.gc_runs} sub={`${metrics.heap_objects.toLocaleString()} objects`} />
            <Card label="Uptime" value={metrics.uptime} />
            <Card label="Goroutine History" value={`${history.length} samples`} sub={`Peak: ${Math.max(...history.map(m => m.goroutines))}`} />
          </div>

          {history.length > 1 && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goroutine trend</div>
              <svg width="100%" height="48" style={{ display: 'block' }}>
                <polyline
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  points={history.map((m, i) => `${(i / (history.length - 1)) * 100}%,${(1 - m.goroutines / sparkMax) * 40 + 4}`).join(' ')}
                />
              </svg>
            </div>
          )}

          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '48px' }}>Loading metrics…</div>
      )}
    </div>
  )
}

// ─── Audit Store ──────────────────────────────────────────────────────────────

function AuditStore() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [flushing, setFlushing] = useState(false)

  const fetchData = async () => {
    const [evRes, stRes] = await Promise.all([
      fetch('/api/audit?limit=100'),
      fetch('/api/audit/stats'),
    ]).catch(() => [null, null]) as [Response | null, Response | null]
    if (evRes?.ok) setEvents((await evRes.json()) ?? [])
    if (stRes?.ok) setStats(await stRes.json())
  }

  const flush = async () => {
    setFlushing(true)
    await fetch('/api/audit', { method: 'DELETE' })
    await fetchData()
    setFlushing(false)
  }

  useEffect(() => { fetchData() }, [])

  const statusColor = (s: number) => s >= 500 ? '#ef4444' : s >= 400 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {stats && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
            {stats.path} · {(stats.size_bytes / 1024).toFixed(1)} KB · {stats.line_count} entries
          </span>
        )}
        <button type="button" style={btn()} onClick={fetchData}>Refresh</button>
        <button type="button" style={dangerBtn} onClick={flush} disabled={flushing}>
          {flushing ? 'Flushing…' : 'Flush Log'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Time', 'User', 'Action', 'Method', 'Path', 'Status'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...events].reverse().map((e, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '5px 8px', color: '#555', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                <td style={{ padding: '5px 8px', color: '#a855f7' }}>{e.user || '—'}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{e.action}</td>
                <td style={{ padding: '5px 8px', color: '#3b82f6', fontFamily: 'monospace' }}>{e.method}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.path}</td>
                <td style={{ padding: '5px 8px', color: statusColor(e.status), fontFamily: 'monospace', fontWeight: 600 }}>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px', fontSize: '13px' }}>No audit events recorded</div>
        )}
      </div>
    </div>
  )
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dev/flags').then(r => r.json()).then(d => setFlags(d ?? [])).catch(() => {})
  }, [])

  const toggle = async (name: string) => {
    setToggling(name)
    try {
      const res = await fetch(`/api/dev/flags/${name}`, { method: 'PUT' })
      if (res.ok) {
        const updated = await res.json()
        setFlags(f => f.map(fl => fl.name === name ? updated : fl))
      }
    } catch {}
    setToggling(null)
  }

  const grouped = flags.reduce((acc, f) => {
    acc[f.category] = acc[f.category] ?? []
    acc[f.category].push(f)
    return acc
  }, {} as Record<string, FeatureFlag[]>)

  return (
    <div style={{ overflowY: 'auto' }}>
      {Object.entries(grouped).map(([cat, catFlags]) => (
        <div key={cat} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{cat}</div>
          {catFlags.map(flag => (
            <div
              key={flag.name}
              style={{
                display: 'flex', alignItems: 'center', padding: '11px 14px',
                borderRadius: '7px', border: `1px solid ${flag.enabled ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                marginBottom: '5px', background: flag.enabled ? 'rgba(168,85,247,0.05)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: '2px' }}>{flag.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{flag.description}</div>
              </div>
              <button
                type="button"
                onClick={() => toggle(flag.name)}
                disabled={toggling === flag.name}
                title={flag.enabled ? 'Disable' : 'Enable'}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', flexShrink: 0,
                  background: flag.enabled ? '#a855f7' : '#374151',
                  cursor: toggling === flag.name ? 'not-allowed' : 'pointer',
                  position: 'relative', transition: 'background 0.2s', opacity: toggling === flag.name ? 0.6 : 1,
                }}
              >
                <div style={{
                  position: 'absolute', top: '3px',
                  left: flag.enabled ? '22px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          ))}
        </div>
      ))}
      {flags.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading flags…</div>
      )}
    </div>
  )
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

interface Tool {
  id: string
  icon: React.ElementType
  title: string
  badge?: string
  component: React.ComponentType
  description: string
}

const TOOLS: Tool[] = [
  { id: 'debug',    icon: Terminal, title: 'Debug Console',       badge: 'Live',         component: DebugConsole,          description: 'Access internal debug logs, trace requests, and inspect WebSocket events in real time.' },
  { id: 'api',      icon: Code,     title: 'API Explorer',                                component: APIExplorer,           description: 'Browse and test all REST API endpoints exposed by the DCC backend directly from this panel.' },
  { id: 'profiler', icon: Cpu,      title: 'Performance Profiler',                        component: PerformanceProfiler,   description: 'View backend latency metrics, goroutine counts, and memory usage for the running process.' },
  { id: 'audit',    icon: Database, title: 'Audit Store',                                 component: AuditStore,            description: 'Inspect and flush the on-disk audit log file at /tmp/dcc-audit.log.' },
  { id: 'flags',    icon: Sliders,  title: 'Feature Flags',       badge: 'Experimental', component: FeatureFlags,          description: 'Enable or disable experimental features without restarting the server.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DevOptions() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTool = TOOLS.find(t => t.id === activeId)

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Code size={28} color="#a855f7" />
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Developer Options</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Advanced tooling — restricted to administrators</p>
        </div>
      </div>

      {/* Warning banner */}
      <div style={{ padding: '13px 18px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', fontSize: '13px', color: '#c084fc', marginBottom: '28px' }}>
        Warning: changes made here directly affect the running backend process. Use with caution.
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {TOOLS.map(tool => (
          <div
            key={tool.id}
            style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#a855f7')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <tool.icon size={22} color="#a855f7" />
              <span style={{ fontWeight: 600, fontSize: '15px' }}>{tool.title}</span>
              {tool.badge && (
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 600 }}>
                  {tool.badge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {tool.description}
            </p>
            <button
              type="button"
              onClick={() => setActiveId(tool.id)}
              style={{ padding: '8px 14px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', color: '#a855f7', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-start', marginTop: 'auto', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.1)')}
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {activeTool && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setActiveId(null) }}
        >
          <div style={{ background: 'var(--bg-primary)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: '12px', width: '100%', maxWidth: '920px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <activeTool.icon size={18} color="#a855f7" />
              <span style={{ fontWeight: 600, fontSize: '15px' }}>{activeTool.title}</span>
              {activeTool.badge && (
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 600 }}>
                  {activeTool.badge}
                </span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setActiveId(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            {/* Modal body */}
            <div style={{ padding: '20px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <activeTool.component />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Layers, Play, Square, RefreshCw, FileText } from 'lucide-react'

interface StackMetrics {
  cpu_percent: number
  memory_usage: number
  containers: number
}

export default function Stacks() {
  const [stacks, setStacks] = useState<Record<string, any[]>>({})
  const [metrics, setMetrics] = useState<Record<string, StackMetrics>>({})
  const [logs, setLogs] = useState<Record<string, string>>({})

  useEffect(() => {
    loadStacks()
  }, [])

  async function loadStacks() {
    const response = await fetch('/api/stacks')
    const data = await response.json()
    setStacks(data || {})

    Object.keys(data || {}).forEach(loadMetrics)
  }

  async function loadMetrics(project: string) {
    try {
      const response = await fetch(`/api/stacks/${project}/metrics`)
      const data = await response.json()
      setMetrics(prev => ({ ...prev, [project]: data }))
    } catch (error) {
      console.error('Failed to load metrics:', error)
    }
  }

  async function loadLogs(project: string) {
    const response = await fetch(`/api/stacks/${project}/logs?tail=200`)
    const data = await response.json()
    const combined = data.map((entry: any) => `[${entry.container}]\n${entry.logs}`).join('\n')
    setLogs(prev => ({ ...prev, [project]: combined }))
  }

  async function containerAction(id: string, action: string) {
    await fetch(`/api/containers/${id}/${action}`, { method: 'POST' })
    loadStacks()
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Stacks</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Global view of all Compose stacks with per-stack metrics and logs.
        </p>
      </div>

      {Object.keys(stacks).length === 0 ? (
        <div style={{ color: 'var(--text-secondary)' }}>No compose stacks found.</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {Object.entries(stacks).map(([project, containers]) => (
            <div key={project} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={18} color="#3b82f6" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{project}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {containers.length} containers
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>CPU: {metrics[project]?.cpu_percent?.toFixed(1) || 0}%</div>
                  <div>Mem: {formatBytes(metrics[project]?.memory_usage || 0)}</div>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                {containers.map(container => (
                  <div key={container.Id} className="hover-lift" style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{container.Names?.[0]}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{container.Image}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-hover" onClick={() => containerAction(container.Id, 'start')} style={iconButton}>
                        <Play size={14} />
                      </button>
                      <button className="btn-hover" onClick={() => containerAction(container.Id, 'stop')} style={iconButton}>
                        <Square size={14} />
                      </button>
                      <button className="btn-hover" onClick={() => containerAction(container.Id, 'restart')} style={iconButton}>
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <button className="btn-hover" onClick={() => loadLogs(project)} style={secondaryButton}>
                  <FileText size={14} style={{ marginRight: '6px' }} /> View Stack Logs
                </button>
              </div>

              {logs[project] && (
                <pre style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  maxHeight: '240px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}>{logs[project]}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const iconButton: React.CSSProperties = {
  padding: '6px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  cursor: 'pointer',
  color: 'var(--text-primary)'
}

const secondaryButton: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

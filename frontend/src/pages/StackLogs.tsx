import { useEffect, useState } from 'react'
import { Terminal } from 'lucide-react'

export default function StackLogs() {
  const [project, setProject] = useState('')
  const [logs, setLogs] = useState('')

  const loadLogs = async () => {
    if (!project) return
    const response = await fetch(`/api/stacks/${project}/logs?tail=300`)
    const data = await response.json()
    const combined = data.map((entry: any) => `[${entry.container}]\n${entry.logs}`).join('\n')
    setLogs(combined)
  }

  useEffect(() => {
    const timer = setInterval(() => loadLogs(), 5000)
    return () => clearInterval(timer)
  }, [project])

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Stack Logs</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Unified logs by stack.</p>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="stack name (compose project)"
          style={{
            width: '320px',
            padding: '10px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)'
          }}
        />
        <button className="btn-hover" onClick={loadLogs} style={{
          marginLeft: '10px',
          padding: '10px 12px',
          background: 'var(--accent-blue)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          <Terminal size={14} style={{ marginRight: '6px' }} /> Load Logs
        </button>
      </div>
      <pre style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        maxHeight: '520px',
        overflow: 'auto',
        fontSize: '12px'
      }}>{logs || 'No logs loaded.'}</pre>
    </div>
  )
}

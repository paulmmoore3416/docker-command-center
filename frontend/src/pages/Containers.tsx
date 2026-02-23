import { useState, useEffect } from 'react'
import { Play, Square, RotateCw, FileText, Activity } from 'lucide-react'

export default function Containers() {
  const [containers, setContainers] = useState<any[]>([])

  useEffect(() => {
    loadContainers()
    const interval = setInterval(loadContainers, 3000)
    return () => clearInterval(interval)
  }, [])

  async function loadContainers() {
    try {
      const response = await fetch('/api/containers')
      const data = await response.json()
      setContainers(data)
    } catch (error) {
      console.error('Failed to load containers:', error)
    }
  }

  async function performAction(containerId: string, action: string) {
    try {
      await fetch(`/api/containers/${containerId}/${action}`, { method: 'POST' })
      loadContainers()
    } catch (error) {
      console.error(`Failed to ${action} container:`, error)
    }
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Containers
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Manage your Docker containers
        </p>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Name</th>
              <th style={tableHeaderStyle}>Image</th>
              <th style={tableHeaderStyle}>Ports</th>
              <th style={tableHeaderStyle}>State</th>
              <th style={tableHeaderStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.map(container => (
              <tr
                key={container.Id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={tableCellStyle}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: container.State === 'running' ? 'var(--accent-green)' : 'var(--accent-red)'
                  }} className={container.State === 'running' ? 'pulse' : ''} />
                </td>
                <td style={tableCellStyle}>
                  <span style={{ fontWeight: '500' }}>
                    {container.Names[0]?.replace('/', '')}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {container.Image}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <span style={{ fontSize: '13px' }}>
                    {container.Ports?.map((p: any) => 
                      p.PublicPort ? `${p.PublicPort}→${p.PrivatePort}` : p.PrivatePort
                    ).join(', ') || '-'}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: container.State === 'running' 
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    color: container.State === 'running' 
                      ? 'var(--accent-green)'
                      : 'var(--accent-red)'
                  }}>
                    {container.State}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {container.State === 'running' ? (
                      <>
                        <IconButton onClick={() => performAction(container.Id, 'stop')} title="Stop">
                          <Square size={16} />
                        </IconButton>
                        <IconButton onClick={() => performAction(container.Id, 'restart')} title="Restart">
                          <RotateCw size={16} />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => performAction(container.Id, 'start')} title="Start">
                        <Play size={16} />
                      </IconButton>
                    )}
                    <IconButton onClick={() => {}} title="Logs">
                      <FileText size={16} />
                    </IconButton>
                    <IconButton onClick={() => {}} title="Stats">
                      <Activity size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const tableHeaderStyle = {
  padding: '15px',
  textAlign: 'left' as const,
  fontSize: '13px',
  fontWeight: '600' as const,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
}

const tableCellStyle = {
  padding: '15px',
  fontSize: '14px'
}

function IconButton({ onClick, title, children }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--accent-blue)'
        e.currentTarget.style.color = 'white'
        e.currentTarget.style.borderColor = 'var(--accent-blue)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-tertiary)'
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {children}
    </button>
  )
}

import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'

interface UpdateSettings {
  enabled: boolean
  schedule_cron: string
  auto_rollback: boolean
  notify_on_update: boolean
}

export default function Updates() {
  const [settings, setSettings] = useState<UpdateSettings>({
    enabled: false,
    schedule_cron: '0 3 * * *',
    auto_rollback: true,
    notify_on_update: true
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const response = await fetch('/api/updates/settings')
    const data = await response.json()
    setSettings(data)
  }

  async function saveSettings() {
    await fetch('/api/updates/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    setMessage('Update settings saved')
  }

  async function runUpdate() {
    const response = await fetch('/api/updates/run', { method: 'POST' })
    const data = await response.json()
    setMessage(data.message || 'Update queued')
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Image Updates</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Schedule automatic image updates with optional rollback.
        </p>
      </div>

      {message && <div style={{ marginBottom: '12px', color: 'var(--accent-green)' }}>{message}</div>}

      <div style={{
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        maxWidth: '520px'
      }}>
        <label style={labelStyle}>Enable auto updates</label>
        <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />

        <label style={labelStyle}>Schedule (cron)</label>
        <input style={inputStyle} value={settings.schedule_cron} onChange={e => setSettings({ ...settings, schedule_cron: e.target.value })} />

        <label style={labelStyle}>Auto rollback on health failure</label>
        <input type="checkbox" checked={settings.auto_rollback} onChange={e => setSettings({ ...settings, auto_rollback: e.target.checked })} />

        <label style={labelStyle}>Notify on updates</label>
        <input type="checkbox" checked={settings.notify_on_update} onChange={e => setSettings({ ...settings, notify_on_update: e.target.checked })} />

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-hover" onClick={saveSettings} style={primaryButton}>Save</button>
          <button className="btn-hover" onClick={runUpdate} style={secondaryButton}>
            <RefreshCcw size={14} style={{ marginRight: '6px' }} /> Run now
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  marginTop: '12px',
  marginBottom: '6px'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)'
}

const primaryButton: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--accent-blue)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600
}

const secondaryButton: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600
}

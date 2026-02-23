import { useEffect, useState } from 'react'
import { Boxes, Plus } from 'lucide-react'

interface TemplateItem {
  name: string
  description: string
  category: string
}

export default function Templates() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const response = await fetch('/api/templates')
    const data = await response.json()
    setTemplates(data || [])
  }

  async function createTemplate(name: string) {
    const response = await fetch('/api/templates/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    const data = await response.json()
    localStorage.setItem('dcc_last_compose_path', data.path)
    setMessage(`Template created at ${data.path}. Open it in Compose Files.`)
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Templates</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          One-click templates for common self-hosted applications.
        </p>
      </div>

      {message && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--accent-green)' }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {templates.map(template => (
          <div key={template.name} className="hover-lift" style={{
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Boxes size={18} color="#f59e0b" />
              <div style={{ fontWeight: 600 }}>{template.name}</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {template.description}
            </div>
            <button className="btn-hover" onClick={() => createTemplate(template.name)} style={{
              padding: '8px 12px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}>
              <Plus size={14} style={{ marginRight: '6px' }} /> Create
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

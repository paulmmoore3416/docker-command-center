import { useMemo, useState } from 'react'
import { Sparkles, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface ServiceDraft {
  name: string
  image: string
  ports: string
  env: string
  volumes: string
}

export default function ComposeBuilder() {
  const [services, setServices] = useState<ServiceDraft[]>([])
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [ports, setPorts] = useState('')
  const [env, setEnv] = useState('')
  const [volumes, setVolumes] = useState('')
  const [filePath, setFilePath] = useState('./compose/visual-compose.yml')
  const [validateResult, setValidateResult] = useState<any>(null)
  const [draftResult, setDraftResult] = useState<any>(null)

  const addService = () => {
    if (!name || !image) return
    setServices(prev => [...prev, { name, image, ports, env, volumes }])
    setName('')
    setImage('')
    setPorts('')
    setEnv('')
    setVolumes('')
  }

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index))
  }

  const yaml = useMemo(() => {
    const lines: string[] = ["version: '3'", 'services:']
    services.forEach(service => {
      lines.push(`  ${service.name}:`)
      lines.push(`    image: ${service.image}`)
      if (service.ports.trim()) {
        lines.push('    ports:')
        service.ports.split(',').map(p => p.trim()).filter(Boolean).forEach(port => {
          lines.push(`      - '${port}'`)
        })
      }
      if (service.env.trim()) {
        lines.push('    environment:')
        service.env.split(',').map(e => e.trim()).filter(Boolean).forEach(envVar => {
          lines.push(`      - ${envVar}`)
        })
      }
      if (service.volumes.trim()) {
        lines.push('    volumes:')
        service.volumes.split(',').map(v => v.trim()).filter(Boolean).forEach(vol => {
          lines.push(`      - ${vol}`)
        })
      }
    })
    return lines.join('\n') + '\n'
  }, [services])

  const validateYaml = async () => {
    const response = await fetch('/api/compose/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: yaml })
    })
    setValidateResult(await response.json())
  }

  const draftYaml = async () => {
    const response = await fetch('/api/compose/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: yaml })
    })
    setDraftResult(await response.json())
  }

  const saveFile = async () => {
    await fetch('/api/compose/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: yaml })
    })
    localStorage.setItem('dcc_last_compose_path', filePath)
    alert('Draft saved. Open it from Compose Files to deploy.')
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Visual Compose Builder</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Build services visually, validate YAML, and draft safely before deployment.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Add Service</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="service name"
              style={inputStyle} />
            <input value={image} onChange={e => setImage(e.target.value)} placeholder="image (nginx:alpine)"
              style={inputStyle} />
            <input value={ports} onChange={e => setPorts(e.target.value)} placeholder="ports (8080:80, 8443:443)"
              style={inputStyle} />
            <input value={env} onChange={e => setEnv(e.target.value)} placeholder="env (KEY=VALUE, DEBUG=true)"
              style={inputStyle} />
            <input value={volumes} onChange={e => setVolumes(e.target.value)} placeholder="volumes (/data:/data)"
              style={inputStyle} />
            <button className="btn-hover" onClick={addService} style={primaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Add Service
            </button>
          </div>
        </div>

        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Services</h3>
          {services.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No services added.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {services.map((service, index) => (
                <div key={index} className="hover-lift" style={{
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{service.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{service.image}</div>
                  </div>
                  <button onClick={() => removeService(index)} style={iconButton}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Sparkles size={16} color="#8b5cf6" />
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>YAML Preview</h3>
        </div>
        <textarea value={yaml} readOnly style={{
          width: '100%',
          minHeight: '220px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontFamily: 'monospace',
          fontSize: '13px',
          padding: '12px'
        }} />

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button className="btn-hover" onClick={validateYaml} style={secondaryButton}>
            <CheckCircle size={14} style={{ marginRight: '6px' }} /> Validate
          </button>
          <button className="btn-hover" onClick={draftYaml} style={secondaryButton}>
            <AlertCircle size={14} style={{ marginRight: '6px' }} /> Draft Mode
          </button>
          <input value={filePath} onChange={e => setFilePath(e.target.value)} style={{ ...inputStyle, minWidth: '260px' }} />
          <button className="btn-hover" onClick={saveFile} style={primaryButton}>Save Draft File</button>
        </div>

        {validateResult && (
          <div style={{ marginTop: '12px', fontSize: '12px' }}>
            {validateResult.valid ? '✅ YAML is valid' : `❌ ${validateResult.error}`}
          </div>
        )}
        {draftResult && (
          <div style={{ marginTop: '12px', fontSize: '12px' }}>
            Draft status: {draftResult.status} • services: {draftResult.services} • warnings: {draftResult.warnings?.length || 0}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)'
}

const primaryButton: React.CSSProperties = {
  padding: '10px',
  background: 'var(--accent-blue)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  cursor: 'pointer'
}

const secondaryButton: React.CSSProperties = {
  padding: '10px',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontWeight: 600,
  cursor: 'pointer'
}

const iconButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-red)',
  cursor: 'pointer'
}

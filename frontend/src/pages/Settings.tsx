import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Bell, Server, Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react'

interface RemoteSystem {
  id: string
  name: string
  url: string
  apiKey: string
  isActive: boolean
  isDefault: boolean
  lastConnected?: string
  status?: 'online' | 'offline' | 'never'
}

export default function SettingsPage() {
  const [thresholds, setThresholds] = useState({
    cpu_percent: 80,
    memory_percent: 80,
    disk_gb: 50,
    log_size_mb: 1000
  })
  const [apiKey, setApiKey] = useState(localStorage.getItem('dcc_api_key') || '')
  const [role, setRole] = useState(localStorage.getItem('dcc_role') || 'admin')
  const [user, setUser] = useState(localStorage.getItem('dcc_user') || 'dcc-user')
  const [systems, setSystems] = useState<RemoteSystem[]>(() => {
    const saved = localStorage.getItem('dcc_remote_systems')
    return saved ? JSON.parse(saved) : [{
      id: 'local',
      name: 'Local System',
      url: 'http://localhost:9876',
      apiKey: '',
      isActive: true,
      isDefault: true,
      status: 'online'
    }]
  })
  const [showAddSystem, setShowAddSystem] = useState(false)
  const [editingSystem, setEditingSystem] = useState<RemoteSystem | null>(null)

  useEffect(() => {
    loadThresholds()
    checkSystemsStatus()
  }, [])

  async function loadThresholds() {
    try {
      const response = await fetch('/api/monitoring/thresholds')
      const data = await response.json()
      setThresholds(data)
    } catch (error) {
      console.error('Failed to load thresholds:', error)
    }
  }

  async function checkSystemsStatus() {
    const updatedSystems = await Promise.all(
      systems.map(async (system) => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)
          
          const response = await fetch(`${system.url}/api/monitoring/alerts`, {
            headers: system.apiKey ? { 'X-API-Key': system.apiKey } : {},
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          return {
            ...system,
            status: response.ok ? 'online' as const : 'offline' as const,
            lastConnected: new Date().toISOString()
          }
        } catch (error) {
          const statusValue = system.lastConnected ? 'offline' : 'never'
          return {
            ...system,
            status: statusValue as 'offline' | 'never'
          }
        }
      })
    )
    setSystems(updatedSystems)
    saveSystems(updatedSystems)
  }

  function saveSystems(systemsToSave: RemoteSystem[]) {
    localStorage.setItem('dcc_remote_systems', JSON.stringify(systemsToSave))
  }

  function addSystem(system: Omit<RemoteSystem, 'id' | 'isActive' | 'isDefault'>) {
    const newSystem: RemoteSystem = {
      ...system,
      id: Date.now().toString(),
      isActive: false,
      isDefault: false,
      status: 'never'
    }
    const updated = [...systems, newSystem]
    setSystems(updated)
    saveSystems(updated)
    setShowAddSystem(false)
  }

  function updateSystem(id: string, updates: Partial<RemoteSystem>) {
    const updated = systems.map(s => s.id === id ? { ...s, ...updates } : s)
    setSystems(updated)
    saveSystems(updated)
    setEditingSystem(null)
  }

  function deleteSystem(id: string) {
    if (confirm('Are you sure you want to remove this system?')) {
      const updated = systems.filter(s => s.id !== id)
      setSystems(updated)
      saveSystems(updated)
    }
  }

  function switchToSystem(id: string) {
    const system = systems.find(s => s.id === id)
    if (system) {
      // Update active system
      const updated = systems.map(s => ({ ...s, isActive: s.id === id }))
      setSystems(updated)
      saveSystems(updated)
      
      // Update API base URL for all requests
      if (system.url !== 'http://localhost:9876') {
        alert(`Switched to ${system.name}. Reload the page to connect to ${system.url}`)
      }
    }
  }

  function setDefaultSystem(id: string) {
    const updated = systems.map(s => ({ ...s, isDefault: s.id === id }))
    setSystems(updated)
    saveSystems(updated)
  }

  async function saveThresholds() {
    try {
      await fetch('/api/monitoring/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds)
      })
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Failed to save thresholds:', error)
      alert('Failed to save settings')
    }
  }

  function saveSecurity() {
    if (apiKey) {
      localStorage.setItem('dcc_api_key', apiKey)
    } else {
      localStorage.removeItem('dcc_api_key')
    }
    localStorage.setItem('dcc_role', role)
    localStorage.setItem('dcc_user', user)
    alert('Security preferences saved!')
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Configure Docker Command Center preferences
        </p>
      </div>

      <div style={{ maxWidth: '800px' }}>
        {/* Resource Thresholds */}
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Bell size={20} color="#f59e0b" />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Alert Thresholds</h3>
          </div>

          <div style={{ display: 'grid', gap: '20px' }}>
            <SettingField
              label="CPU Usage Threshold (%)"
              value={thresholds.cpu_percent}
              onChange={(v: number) => setThresholds({ ...thresholds, cpu_percent: v })}
              description="Alert when container CPU usage exceeds this percentage"
            />

            <SettingField
              label="Memory Usage Threshold (%)"
              value={thresholds.memory_percent}
              onChange={(v: number) => setThresholds({ ...thresholds, memory_percent: v })}
              description="Alert when container memory usage exceeds this percentage"
            />

            <SettingField
              label="Disk Usage Threshold (GB)"
              value={thresholds.disk_gb}
              onChange={(v: number) => setThresholds({ ...thresholds, disk_gb: v })}
              description="Alert when disk usage exceeds this amount"
            />

            <SettingField
              label="Log Size Threshold (MB)"
              value={thresholds.log_size_mb}
              onChange={(v: number) => setThresholds({ ...thresholds, log_size_mb: v })}
              description="Alert when log file size exceeds this amount"
            />
          </div>

          <button
            onClick={saveThresholds}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Save Changes
          </button>
        </div>

        {/* Features */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <SettingsIcon size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Features</h3>
          </div>

          <div style={{ display: 'grid', gap: '15px' }}>
            <FeatureToggle
              title="Zero-Lock-In Ghost Mode"
              description="Bidirectional sync with docker-compose.yml files"
              enabled={true}
            />
            <FeatureToggle
              title="Smart Dependency Analysis"
              description="Health-check propagation and impact visualization"
              enabled={true}
            />
            <FeatureToggle
              title="Container Archaeology"
              description="Historical state tracking and time-travel debugging"
              enabled={true}
            />
            <FeatureToggle
              title="Integrated Proxy Manager"
              description="Automatic reverse proxy for easy local domains"
              enabled={true}
            />
          </div>
        </div>

        {/* Security */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <SettingsIcon size={20} color="#10b981" />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Security & RBAC</h3>
          </div>
          <div style={{ display: 'grid', gap: '15px' }}>
            <SettingField
              label="API Key"
              value={apiKey}
              onChange={(v: string) => setApiKey(v)}
              description="Optional: set to match DCC_API_KEY"
            />
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
              <p style={{ marginTop: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Controls access to stack actions and settings
              </p>
            </div>
            <SettingField
              label="User"
              value={user}
              onChange={(v: string) => setUser(v)}
              description="Audit log display name"
            />
          </div>
          <button
            onClick={saveSecurity}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Save Security Settings
          </button>
        </div>

        {/* Access Control */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <SettingsIcon size={20} color="#10b981" />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Access Control</h3>
          </div>

          <div style={{ display: 'grid', gap: '15px' }}>
            <SettingField
              label="API Key (optional)"
              value={apiKey}
              onChange={(v: string) => setApiKey(v)}
              description="Set to match DCC_API_KEY if enabled on the server"
              inputType="text"
            />
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <SettingField
              label="User"
              value={user}
              onChange={(v: string) => setUser(v)}
              description="Displayed in audit logs"
              inputType="text"
            />
          </div>

          <button
            onClick={saveSecurity}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Save Access Settings
          </button>
        </div>

        {/* Remote Systems Management */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={20} color="#8b5cf6" />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Remote Systems</h3>
            </div>
            <button
              onClick={() => setShowAddSystem(true)}
              style={{
                padding: '8px 16px',
                background: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} />
              Add System
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Manage multiple Docker hosts from a single interface (Cockpit-style)
          </p>

          <div style={{ display: 'grid', gap: '12px' }}>
            {systems.map(system => (
              <div
                key={system.id}
                style={{
                  padding: '16px',
                  background: system.isActive ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                  border: system.isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: system.status === 'online' ? 'var(--accent-green)' : 
                                 system.status === 'offline' ? 'var(--accent-red)' : '#666'
                    }} />
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>
                      {system.name}
                      {system.isDefault && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          padding: '2px 6px',
                          background: 'var(--accent-blue)',
                          borderRadius: '4px'
                        }}>
                          DEFAULT
                        </span>
                      )}
                      {system.isActive && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          padding: '2px 6px',
                          background: 'var(--accent-green)',
                          borderRadius: '4px'
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {system.url}
                  </div>
                  {system.lastConnected && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Last connected: {new Date(system.lastConnected).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!system.isActive && (
                    <button
                      onClick={() => switchToSystem(system.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent-green)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Switch
                    </button>
                  )}
                  {!system.isDefault && (
                    <button
                      onClick={() => setDefaultSystem(system.id)}
                      title="Set as default"
                      style={{
                        padding: '6px 8px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingSystem(system)}
                    style={{
                      padding: '6px 8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  {system.id !== 'local' && (
                    <button
                      onClick={() => deleteSystem(system.id)}
                      style={{
                        padding: '6px 8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--accent-red)'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={checkSystemsStatus}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Refresh Status
          </button>
        </div>

        {/* Add/Edit System Modal */}
        {(showAddSystem || editingSystem) && (
          <SystemModal
            system={editingSystem}
            onSave={(data) => {
              if (editingSystem) {
                updateSystem(editingSystem.id, data)
              } else {
                addSystem(data)
              }
            }}
            onCancel={() => {
              setShowAddSystem(false)
              setEditingSystem(null)
            }}
          />
        )}

        {/* Info */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>
            About Docker Command Center
          </h4>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '8px' }}>Version: 2.1.0</p>
            <p style={{ marginBottom: '8px' }}>Built with Go + React + TypeScript</p>
            <p>A next-generation Docker management tool without vendor lock-in</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingField({ label, value, onChange, description }: any) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '500',
        marginBottom: '8px'
      }}>
        {label}
      </label>
      <input
        type={typeof value === 'number' ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(typeof value === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '14px'
        }}
      />
      <p style={{
        marginTop: '5px',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        {description}
      </p>
    </div>
  )
}

function FeatureToggle({ title, description, enabled }: any) {
  return (
    <div style={{
      padding: '15px',
      background: 'var(--bg-tertiary)',
      borderRadius: '6px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {description}
        </div>
      </div>
      <div style={{
        width: '50px',
        height: '28px',
        borderRadius: '14px',
        background: enabled ? 'var(--accent-green)' : 'var(--border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '3px',
          left: enabled ? '25px' : '3px',
          transition: 'left 0.2s'
        }} />
      </div>
    </div>
  )
}

function SystemModal({ system, onSave, onCancel }: {
  system: RemoteSystem | null
  onSave: (data: Omit<RemoteSystem, 'id' | 'isActive' | 'isDefault'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(system?.name || '')
  const [url, setUrl] = useState(system?.url || '')
  const [apiKey, setApiKey] = useState(system?.apiKey || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(`${url}/api/monitoring/alerts`, {
        headers: apiKey ? { 'X-API-Key': apiKey } : {}
      })
      setTestResult(response.ok ? 'success' : 'failed')
    } catch (error) {
      setTestResult('failed')
    } finally {
      setTesting(false)
    }
  }

  function handleSave() {
    if (!name || !url) {
      alert('Please fill in all required fields')
      return
    }
    onSave({ name, url, apiKey })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
          {system ? 'Edit System' : 'Add New System'}
        </h3>

        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              System Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Production Server"
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://prod.example.com:9876"
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              API Key (optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Leave empty if not required"
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {testResult && (
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            background: testResult === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${testResult === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px'
          }}>
            {testResult === 'success' ? <CheckCircle size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
            {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check URL and API key.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={testConnection}
            disabled={testing || !url}
            style={{
              flex: 1,
              padding: '10px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: testing ? 'not-allowed' : 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '10px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {system ? 'Update' : 'Add'} System
          </button>
        </div>
      </div>
    </div>
  )
}

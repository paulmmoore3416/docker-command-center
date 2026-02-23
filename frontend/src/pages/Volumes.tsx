import { useState, useEffect } from 'react'
import { HardDrive, Folder, Trash2 } from 'lucide-react'

export default function Volumes() {
  const [volumes, setVolumes] = useState<any[]>([])
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null)
  const [files, setFiles] = useState<any[]>([])

  useEffect(() => {
    loadVolumes()
  }, [])

  useEffect(() => {
    if (selectedVolume) {
      loadVolumeFiles(selectedVolume)
    }
  }, [selectedVolume])

  async function loadVolumes() {
    try {
      const response = await fetch('/api/volumes')
      const data = await response.json()
      setVolumes(data.Volumes || [])
    } catch (error) {
      console.error('Failed to load volumes:', error)
    }
  }

  async function loadVolumeFiles(volumeName: string) {
    try {
      const response = await fetch(`/api/volumes/${volumeName}/browse`)
      const data = await response.json()
      setFiles(data || [])
    } catch (error) {
      console.error('Failed to load volume files:', error)
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Volumes
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Persistent storage management with file explorer
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 200px)' }}>
        {/* Volumes List */}
        <div style={{
          width: '350px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'auto'
        }}>
          {volumes.map(volume => (
            <div
              key={volume.Name}
              onClick={() => setSelectedVolume(volume.Name)}
              style={{
                padding: '15px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selectedVolume === volume.Name ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => {
                if (selectedVolume !== volume.Name) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }
              }}
              onMouseLeave={e => {
                if (selectedVolume !== volume.Name) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <HardDrive size={18} color="#f59e0b" />
                <span style={{ fontWeight: '500', fontSize: '14px' }}>
                  {volume.Name.slice(0, 30)}...
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {volume.Driver} • {volume.Scope}
              </div>
            </div>
          ))}
        </div>

        {/* File Browser */}
        <div style={{
          flex: 1,
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'auto'
        }}>
          {selectedVolume ? (
            <>
              <div style={{
                padding: '15px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Folder size={20} color="#3b82f6" />
                <span style={{ fontWeight: '600' }}>Files in {selectedVolume}</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Size</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {file.isDir ? '📁 ' : '📄 '}
                        {file.path}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {file.isDir ? '-' : formatBytes(file.size)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {file.isDir ? 'Directory' : 'File'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {!file.isDir && (
                          <button
                            style={{
                              padding: '4px 8px',
                              background: 'var(--accent-red)',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)'
            }}>
              Select a volume to browse files
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

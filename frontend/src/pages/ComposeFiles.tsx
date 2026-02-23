import { useState, useEffect } from 'react'
import { FileText, Edit, Save, RefreshCw, CheckCircle, AlertCircle, History } from 'lucide-react'

export default function ComposeFiles() {
  const [files, setFiles] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [validateResult, setValidateResult] = useState<any>(null)
  const [draftResult, setDraftResult] = useState<any>(null)
  const [versions, setVersions] = useState<any[]>([])

  useEffect(() => {
    loadFiles()
  }, [])

  useEffect(() => {
    const last = localStorage.getItem('dcc_last_compose_path')
    if (last) {
      setSelectedFile(last)
      localStorage.removeItem('dcc_last_compose_path')
    }
  }, [])

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile)
      loadVersions(selectedFile)
    }
  }, [selectedFile])

  async function loadFiles() {
    try {
      const response = await fetch('/api/compose/files')
      const data = await response.json()
      setFiles(data || [])
    } catch (error) {
      console.error('Failed to load compose files:', error)
    }
  }

  async function loadFileContent(path: string) {
    try {
      const response = await fetch(`/api/compose/file?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      setContent(data.content)
      setEditing(false)
    } catch (error) {
      console.error('Failed to load file content:', error)
    }
  }

  async function loadVersions(path: string) {
    try {
      const response = await fetch(`/api/compose/versions?file=${encodeURIComponent(path)}`)
      const data = await response.json()
      setVersions(data || [])
    } catch (error) {
      console.error('Failed to load versions:', error)
    }
  }

  async function restoreVersion(versionPath: string) {
    if (!selectedFile) return
    await fetch('/api/compose/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: selectedFile, version_path: versionPath })
    })
    loadFileContent(selectedFile)
    loadVersions(selectedFile)
  }

  async function saveFile() {
    if (!selectedFile) return

    try {
      await fetch('/api/compose/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFile,
          content: content
        })
      })
      setEditing(false)
      alert('File saved successfully!')
      loadVersions(selectedFile)
    } catch (error) {
      console.error('Failed to save file:', error)
      alert('Failed to save file')
    }
  }

  async function validateYaml() {
    const response = await fetch('/api/compose/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    setValidateResult(await response.json())
  }

  async function runDraft() {
    const response = await fetch('/api/compose/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    setDraftResult(await response.json())
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Compose Files
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Edit docker-compose.yml files with bidirectional sync
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 200px)' }}>
        {/* Files List */}
        <div style={{
          width: '350px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'auto'
        }}>
          <div style={{
            padding: '15px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Compose Files</span>
            <button
              onClick={loadFiles}
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {files.map((file, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedFile(file.path)}
              style={{
                padding: '15px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selectedFile === file.path ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => {
                if (selectedFile !== file.path) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }
              }}
              onMouseLeave={e => {
                if (selectedFile !== file.path) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <FileText size={16} color="#10b981" />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  {file.path.split('/').pop()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '26px' }}>
                {file.path}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '26px', marginTop: '5px' }}>
                {Object.keys(file.services?.services || {}).length} services
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{
          flex: 1,
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedFile ? (
            <>
              <div style={{
                padding: '15px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600' }}>{selectedFile.split('/').pop()}</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={validateYaml}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={14} />
                    Validate
                  </button>
                  <button
                    onClick={runDraft}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle size={14} />
                    Draft
                  </button>
                  {editing ? (
                    <button
                      onClick={saveFile}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent-green)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Save size={14} />
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={!editing}
                style={{
                  flex: 1,
                  padding: '20px',
                  background: 'var(--bg-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)'
            }}>
              Select a compose file to view/edit
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <History size={16} color="#f59e0b" />
            <span style={{ fontWeight: 600 }}>Version History</span>
          </div>
          {versions.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No saved versions yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {versions.map((version, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <span>{new Date(version.timestamp).toLocaleString()}</span>
                  <button
                    onClick={() => restoreVersion(version.path)}
                    style={{
                      padding: '6px 10px',
                      background: 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}

          {validateResult && (
            <div style={{ marginTop: '10px', fontSize: '12px' }}>
              {validateResult.valid ? '✅ YAML is valid' : `❌ ${validateResult.error}`}
            </div>
          )}
          {draftResult && (
            <div style={{ marginTop: '6px', fontSize: '12px' }}>
              Draft status: {draftResult.status} • services: {draftResult.services} • warnings: {draftResult.warnings?.length || 0}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}>
        💡 <strong>Ghost Mode Active:</strong> Changes made here are saved to the actual file. 
        Edits made in VS Code will be reflected here instantly.
      </div>
    </div>
  )
}

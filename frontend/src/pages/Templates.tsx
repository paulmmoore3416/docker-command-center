import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Plus, Search, Cloud, Globe, BarChart3, Database,
  FileText, Settings, HardDrive, Box, Shield, CheckCircle, X, Loader2
} from 'lucide-react'

interface TemplateItem {
  name: string
  description: string
  category: string
}

/* ── colour & icon maps keyed by category ─────────────────────── */
const categoryMeta: Record<string, { color: string; bg: string; label: string }> = {
  storage:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Storage' },
  network:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'Network' },
  monitoring: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Monitoring' },
  database:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Database' },
  cms:        { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', label: 'CMS' },
  management: { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', label: 'Management' },
}

const templateIcons: Record<string, JSX.Element> = {
  nextcloud:            <Cloud size={20} />,
  traefik:              <Globe size={20} />,
  prometheus:           <BarChart3 size={20} />,
  wordpress:            <FileText size={20} />,
  postgresql:           <Database size={20} />,
  redis:                <HardDrive size={20} />,
  mongodb:              <Database size={20} />,
  'nginx-proxy-manager': <Shield size={20} />,
  portainer:            <Settings size={20} />,
}

export default function Templates() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({ text: '', visible: false })
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => { loadTemplates() }, [])

  /* auto-dismiss toast */
  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000)
    return () => clearTimeout(t)
  }, [toast.visible])

  async function loadTemplates() {
    setLoading(true)
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data || [])
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = useCallback(async (name: string) => {
    setCreating(name)
    try {
      const response = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      const data = await response.json()
      localStorage.setItem('dcc_last_compose_path', data.path)
      setToast({ text: `${name} template created at ${data.path}`, visible: true })
    } finally {
      setCreating(null)
    }
  }, [])

  /* derive categories from data */
  const categories = useMemo(() => {
    const cats = Array.from(new Set(templates.map(t => t.category)))
    return ['all', ...cats]
  }, [templates])

  /* filtered list */
  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchCat = activeCategory === 'all' || t.category === activeCategory
      const matchSearch = search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [templates, activeCategory, search])

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div className="fade-in" style={{ padding: '30px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Templates</h1>
            <span style={{
              fontSize: '12px', fontWeight: 600, background: 'var(--accent-blue)',
              color: '#fff', borderRadius: '12px', padding: '2px 10px', lineHeight: '20px'
            }}>
              {templates.length}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            One-click templates for common self-hosted applications.
          </p>
        </div>

        {/* SEARCH */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {categories.map(cat => {
          const meta = categoryMeta[cat]
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                transition: 'all 0.2s ease',
                background: isActive
                  ? (meta?.bg ?? 'var(--accent-blue)')
                  : 'var(--bg-secondary)',
                color: isActive
                  ? (meta?.color ?? '#fff')
                  : 'var(--text-secondary)',
                boxShadow: isActive ? `0 0 0 1px ${meta?.color ?? 'var(--accent-blue)'}` : 'none'
              }}
            >
              {meta?.label ?? 'All'}
            </button>
          )
        })}
      </div>

      {/* TOAST */}
      {toast.visible && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '16px', padding: '10px 14px',
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '8px', fontSize: '13px', color: 'var(--accent-green)',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <CheckCircle size={16} />
          <span style={{ flex: 1 }}>{toast.text}</span>
          <X size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setToast(prev => ({ ...prev, visible: false }))} />
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="pulse" style={{
              height: '160px', background: 'var(--bg-secondary)', borderRadius: '10px',
              border: '1px solid var(--border)'
            }} />
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <Box size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 600 }}>No templates found</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search or category filter.</p>
        </div>
      )}

      {/* TEMPLATE GRID */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map(template => {
            const meta = categoryMeta[template.category]
            const icon = templateIcons[template.name]
            const isCreating = creating === template.name
            return (
              <div key={template.name} className="hover-lift fade-in" style={{
                padding: '20px',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                transition: 'border-color 0.2s ease',
              }}>
                {/* card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: meta?.bg ?? 'rgba(255,255,255,0.06)',
                      color: meta?.color ?? '#fff',
                    }}>
                      {icon ?? <Box size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', textTransform: 'capitalize' }}>
                        {template.name.replace(/-/g, ' ')}
                      </div>
                    </div>
                  </div>
                  {/* category badge */}
                  {meta && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.5px', padding: '3px 8px', borderRadius: '6px',
                      background: meta.bg, color: meta.color, whiteSpace: 'nowrap'
                    }}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {/* description */}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1, lineHeight: '1.45' }}>
                  {template.description}
                </div>

                {/* create button */}
                <button
                  className="btn-hover"
                  disabled={isCreating}
                  onClick={() => createTemplate(template.name)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 14px', width: '100%',
                    background: isCreating ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
                    color: 'white', border: 'none', borderRadius: '8px',
                    cursor: isCreating ? 'default' : 'pointer', fontWeight: 600, fontSize: '13px',
                    opacity: isCreating ? 0.7 : 1,
                  }}
                >
                  {isCreating
                    ? <><Loader2 size={14} className="pulse" /> Creating…</>
                    : <><Plus size={14} /> Deploy Template</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

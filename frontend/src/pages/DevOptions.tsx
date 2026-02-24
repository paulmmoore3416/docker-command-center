import { Terminal, Code, Cpu, Database, Sliders } from 'lucide-react'

interface DevCard {
  icon: React.ElementType
  title: string
  description: string
  badge?: string
}

const DEV_CARDS: DevCard[] = [
  {
    icon: Terminal,
    title: 'Debug Console',
    description: 'Access internal debug logs, trace requests, and inspect WebSocket events in real time.',
    badge: 'Live',
  },
  {
    icon: Code,
    title: 'API Explorer',
    description: 'Browse and test all REST API endpoints exposed by the DCC backend directly from this panel.',
  },
  {
    icon: Cpu,
    title: 'Performance Profiler',
    description: 'View backend latency metrics, goroutine counts, and memory usage for the running process.',
  },
  {
    icon: Database,
    title: 'Audit Store',
    description: 'Inspect and flush the on-disk audit log file at /tmp/dcc-audit.log.',
  },
  {
    icon: Sliders,
    title: 'Feature Flags',
    description: 'Enable or disable experimental features without restarting the server.',
    badge: 'Experimental',
  },
]

export function DevOptions() {
  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Code size={28} color="#a855f7" />
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Developer Options</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Advanced tooling — restricted to administrators
          </p>
        </div>
      </div>

      <div style={{
        padding: '14px 18px',
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#c084fc',
        marginBottom: '28px',
      }}>
        Warning: changes made here directly affect the running backend process. Use with caution.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {DEV_CARDS.map(card => (
          <div
            key={card.title}
            style={{
              padding: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'border-color 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#a855f7')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <card.icon size={22} color="#a855f7" />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>{card.title}</span>
              {card.badge && (
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'rgba(168,85,247,0.15)',
                  color: '#a855f7',
                  fontWeight: '600',
                }}>
                  {card.badge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {card.description}
            </p>
            <button
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                alignSelf: 'flex-start',
                marginTop: 'auto',
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

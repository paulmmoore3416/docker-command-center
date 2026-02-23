import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Network, HardDrive, AlertTriangle, Activity, TrendingUp, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

interface Stats {
  containers: { total: number; running: number; stopped: number }
  networks: number
  volumes: number
  alerts: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    containers: { total: 0, running: 0, stopped: 0 },
    networks: 0,
    volumes: 0,
    alerts: 0
  })
  const [cpuData, setCpuData] = useState<any[]>([])
  const [memoryData, setMemoryData] = useState<any[]>([])
  const [networkData, setNetworkData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [systemMetrics, setSystemMetrics] = useState({
    totalCPU: 0,
    totalMemory: 0,
    networkIn: 0,
    networkOut: 0
  })

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const [containers, networks, volumes, alertData] = await Promise.all([
        fetch('/api/containers').then(r => r.json()),
        fetch('/api/networks').then(r => r.json()),
        fetch('/api/volumes').then(r => r.json()),
        fetch('/api/monitoring/alerts').then(r => r.json())
      ])

      setStats({
        containers: {
          total: containers.length,
          running: containers.filter((c: any) => c.State === 'running').length,
          stopped: containers.filter((c: any) => c.State !== 'running').length
        },
        networks: networks.length,
        volumes: volumes.length,
        alerts: alertData.length
      })
      
      setAlerts(alertData)

      // Generate mock real-time metrics
      const now = Date.now()
      const cpuVal = Math.random() * 100
      const memVal = Math.random() * 100
      const netIn = Math.random() * 1000
      const netOut = Math.random() * 800

      setSystemMetrics({
        totalCPU: cpuVal,
        totalMemory: memVal,
        networkIn: netIn,
        networkOut: netOut
      })

      setCpuData(prev => [...prev, {
        time: new Date(now).toLocaleTimeString(),
        value: cpuVal
      }].slice(-20))
      
      setMemoryData(prev => [...prev, {
        time: new Date(now).toLocaleTimeString(),
        value: memVal
      }].slice(-20))

      setNetworkData(prev => [...prev, {
        time: new Date(now).toLocaleTimeString(),
        in: netIn,
        out: netOut
      }].slice(-20))

    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const triggerHaptic = () => {
    if (navigator?.vibrate) {
      navigator.vibrate(20)
    }
  }

  const goTo = (path: string) => {
    triggerHaptic()
    navigate(path)
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Overview of your Docker infrastructure
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <StatCard
          icon={<Container size={24} />}
          title="Containers"
          value={stats.containers.total}
          subtitle={`${stats.containers.running} running, ${stats.containers.stopped} stopped`}
          color="#3b82f6"
          onClick={() => goTo('/containers')}
        />
        <StatCard
          icon={<Network size={24} />}
          title="Networks"
          value={stats.networks}
          subtitle="Active networks"
          color="#10b981"
          onClick={() => goTo('/networks')}
        />
        <StatCard
          icon={<HardDrive size={24} />}
          title="Volumes"
          value={stats.volumes}
          subtitle="Storage volumes"
          color="#f59e0b"
          onClick={() => goTo('/volumes')}
        />
        <StatCard
          icon={<AlertTriangle size={24} />}
          title="Alerts"
          value={stats.alerts}
          subtitle="Active alerts"
          color="#ef4444"
          onClick={() => goTo('/security')}
        />
      </div>

      {/* Real-time Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Activity size={20} color="#3b82f6" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>System CPU</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>
            {systemMetrics.totalCPU.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across all containers
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <HardDrive size={20} color="#8b5cf6" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Memory Usage</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>
            {systemMetrics.totalMemory.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            System memory utilized
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <TrendingUp size={20} color="#10b981" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Network In</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
            {systemMetrics.networkIn.toFixed(0)} KB/s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Incoming traffic
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Zap size={20} color="#f59e0b" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Network Out</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
            {systemMetrics.networkOut.toFixed(0)} KB/s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Outgoing traffic
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <ChartCard title="CPU Usage" data={cpuData} color="#3b82f6" />
        <ChartCard title="Memory Usage" data={memoryData} color="#8b5cf6" />
      </div>

      {/* Network Traffic Chart */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>
          Network Traffic
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={networkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Area type="monotone" dataKey="in" stackId="1" stroke="#10b981" fill="#10b98133" name="In (KB/s)" />
            <Area type="monotone" dataKey="out" stackId="1" stroke="#f59e0b" fill="#f59e0b33" name="Out (KB/s)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <ChartCard title="CPU Usage" data={cpuData} color="#3b82f6" />
        <ChartCard title="Memory Usage" data={memoryData} color="#8b5cf6" />
      </div>

      {/* Quick Actions + Alerts */}
      <div style={{
        marginTop: '30px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <ActionButton onClick={() => goTo('/compose')}>Deploy Compose</ActionButton>
            <ActionButton onClick={() => goTo('/environments')}>Create Environment</ActionButton>
            <ActionButton onClick={() => goTo('/proxy')}>Add Proxy Route</ActionButton>
            <ActionButton onClick={() => goTo('/logs')}>View Logs</ActionButton>
            <ActionButton onClick={() => goTo('/stacks')}>Stacks</ActionButton>
            <ActionButton onClick={() => goTo('/builder')}>Visual Builder</ActionButton>
            <ActionButton onClick={() => goTo('/templates')}>Templates</ActionButton>
            <ActionButton onClick={() => goTo('/updates')}>Updates</ActionButton>
          </div>
        </div>

        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>
            Recent Alerts
          </h3>
          {alerts.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              No active alerts.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {alerts.map((alert: any, idx: number) => (
                <div
                  key={idx}
                  className="hover-lift"
                  style={{
                    padding: '10px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{alert.type || 'Alert'}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{alert.message || 'Resource threshold exceeded'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, subtitle, color, onClick }: any) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: onClick ? 'pointer' : 'default'
    }}
    className="fade-in hover-lift"
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
          {title}
        </span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '5px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {subtitle}
      </div>
    </div>
  )
}

function ChartCard({ title, data, color }: any) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border)'
    }} className="fade-in">
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
          <YAxis stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
          <Tooltip 
            contentStyle={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '6px'
            }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ActionButton({ children, onClick }: any) {
  return (
    <button style={{
      padding: '10px 20px',
      background: 'var(--accent-blue)',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
    className="btn-hover"
    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    onClick={onClick}
    >
      {children}
    </button>
  )
}

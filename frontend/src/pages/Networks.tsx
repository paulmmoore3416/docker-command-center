import { useState, useEffect } from 'react'
import { Network as NetworkIcon, Activity, Wifi, Globe, Server } from 'lucide-react'

export default function Networks() {
  const [networks, setNetworks] = useState<any[]>([])
  const [containers, setContainers] = useState<any[]>([])
  const [networkStats, setNetworkStats] = useState({
    totalNetworks: 0,
    bridgeNetworks: 0,
    overlayNetworks: 0,
    connectedContainers: 0
  })

  useEffect(() => {
    loadNetworks()
    loadContainers()
  }, [])

  useEffect(() => {
    if (networks.length > 0) {
      const bridgeCount = networks.filter(n => n.Driver === 'bridge').length
      const overlayCount = networks.filter(n => n.Driver === 'overlay').length
      const totalConnections = networks.reduce((sum, n) => 
        sum + Object.keys(n.Containers || {}).length, 0
      )
      
      setNetworkStats({
        totalNetworks: networks.length,
        bridgeNetworks: bridgeCount,
        overlayNetworks: overlayCount,
        connectedContainers: totalConnections
      })
    }
  }, [networks])

  async function loadContainers() {
    try {
      const response = await fetch('/api/containers')
      const data = await response.json()
      setContainers(data)
    } catch (error) {
      console.error('Failed to load containers:', error)
    }
  }

  async function loadNetworks() {
    try {
      const response = await fetch('/api/networks')
      const data = await response.json()
      setNetworks(data)
    } catch (error) {
      console.error('Failed to load networks:', error)
    }
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Networks
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Docker network infrastructure and connectivity
        </p>
      </div>

      {/* Network Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
            <NetworkIcon size={20} color="#3b82f6" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Networks</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>
            {networkStats.totalNetworks}
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Wifi size={20} color="#10b981" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bridge Networks</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
            {networkStats.bridgeNetworks}
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Globe size={20} color="#8b5cf6" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Overlay Networks</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#8b5cf6' }}>
            {networkStats.overlayNetworks}
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Server size={20} color="#f59e0b" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Connected Containers</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
            {networkStats.connectedContainers}
          </div>
        </div>
      </div>

      {/* Container Network Status */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} color="#10b981" />
          Container Network Status
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>Container</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>Network Mode</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>IP Address</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>Ports</th>
              </tr>
            </thead>
            <tbody>
              {containers.slice(0, 10).map((container) => (
                <tr key={container.Id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>{container.Names?.[0]?.replace('/', '')}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {container.HostConfig?.NetworkMode || 'bridge'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#60a5fa' }}>
                    {container.NetworkSettings?.IPAddress || 'N/A'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {container.Ports?.length > 0 
                      ? container.Ports.map((p: any) => `${p.PublicPort || p.PrivatePort}`).join(', ')
                      : 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network Cards */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
          Network Details
        </h2>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {networks.map(network => (
          <div
            key={network.Id}
            style={{
              padding: '20px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              transition: 'transform 0.2s'
            }}
            className="fade-in"
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <NetworkIcon size={24} color="#3b82f6" />
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
                {network.Name}
              </h3>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Driver:</span>
              <span style={{ fontSize: '14px', marginLeft: '8px' }}>{network.Driver}</span>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Scope:</span>
              <span style={{ fontSize: '14px', marginLeft: '8px' }}>{network.Scope}</span>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Containers:</span>
              <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                {Object.keys(network.Containers || {}).length}
              </span>
            </div>

            {network.IPAM?.Config?.[0]?.Subnet && (
              <div style={{
                marginTop: '15px',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                {network.IPAM.Config[0].Subnet}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

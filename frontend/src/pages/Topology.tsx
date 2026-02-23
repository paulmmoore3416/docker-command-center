import TopologyMap from '../components/TopologyMap'

export default function Topology() {
  return (
    <div style={{ padding: '30px', height: 'calc(100vh - 60px)' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Container Topology
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Interactive visualization of container dependencies and relationships
        </p>
      </div>
      <TopologyMap fullscreen height="calc(100% - 80px)" />
    </div>
  )
}

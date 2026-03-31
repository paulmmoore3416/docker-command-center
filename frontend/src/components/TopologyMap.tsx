import { useState, useEffect, useMemo, useCallback } from 'react'
import { Activity, Zap, Cpu, MemoryStick, Search, RefreshCw } from 'lucide-react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Node,
  Edge,
  Position,
  Panel,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useWebSocket } from '../hooks/useWebSocket'

interface GraphNode {
  id: string
  name: string
  status: string
  health: string
  metadata: Record<string, string>
}

interface GraphEdge {
  source: string
  target: string
  target_name?: string
  type: string
  healthy: boolean
  latency: number
  error_rate: number
}

interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const STORAGE_KEY = 'dcc-topology-layout-v2'

const getHealthColor = (health: string) => {
  switch (health) {
    case 'healthy':
      return '#10b981'
    case 'unhealthy':
      return '#ef4444'
    case 'starting':
      return '#f59e0b'
    default:
      return '#6b7280'
  }
}

const getStatusColor = (status: string) => {
  if (status === 'running') return '#10b981'
  if (status === 'restarting') return '#f59e0b'
  if (status === 'paused') return '#3b82f6'
  return '#6b7280'
}

// Enhanced service node with metrics
const EnhancedServiceNode = ({ data }: { data: any }) => {
  const healthColor = getHealthColor(data.health)
  const statusColor = getStatusColor(data.status)
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: expanded ? '16px' : '12px',
        borderRadius: '12px',
        border: `3px solid ${healthColor}`,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        color: '#e2e8f0',
        minWidth: expanded ? '220px' : '160px',
        maxWidth: '280px',
        textAlign: 'left',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px ${healthColor}40`,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}
    >
      {/* Health indicator pulse */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`
        }}
        className={data.status === 'running' ? 'pulse' : ''}
      />

      {/* Main content */}
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', paddingRight: '20px' }}>
        {data.label}
      </div>
      
      <div style={{ 
        fontSize: '11px', 
        color: '#94a3b8', 
        marginBottom: expanded ? '10px' : '0'
      }}>
        {data.project || 'default'}
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '6px' }}>
            <Activity size={12} color="#3b82f6" />
            <span style={{ color: '#94a3b8' }}>Status:</span>
            <span style={{ color: statusColor, fontWeight: 600 }}>{data.status}</span>
          </div>

          {data.image && (
            <div style={{ 
              fontSize: '10px', 
              color: '#64748b', 
              marginTop: '6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {data.image}
            </div>
          )}

          {data.metrics && (
            <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                <Cpu size={10} color="#f59e0b" />
                <span style={{ color: '#94a3b8' }}>CPU:</span>
                <span style={{ fontWeight: 600 }}>{data.metrics.cpu || '0'}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                <MemoryStick size={10} color="#8b5cf6" />
                <span style={{ color: '#94a3b8' }}>MEM:</span>
                <span style={{ fontWeight: 600 }}>{data.metrics.memory || '0'}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface TopologyMapProps {
  fullscreen?: boolean
  height?: string
}

export default function TopologyMap({ fullscreen = false, height = '600px' }: TopologyMapProps) {
  const [graph, setGraph] = useState<DependencyGraph>({ nodes: [], edges: [] })
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterHealth, setFilterHealth] = useState<string>('all')
  const [layoutType, setLayoutType] = useState<'cluster' | 'force' | 'hierarchical'>('cluster')
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws`
  const { messages } = useWebSocket(wsUrl)

  useEffect(() => {
    loadGraph()
    const interval = setInterval(loadGraph, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (latest?.type === 'topology_update') {
      const d = latest.data ?? {}
      setGraph({ nodes: d.nodes ?? [], edges: d.edges ?? [] })
    }
  }, [messages])

  useEffect(() => {
    const savedPositions = loadSavedPositions()
    const { flowNodes, flowEdges } = buildFlow(graph, savedPositions, layoutType)
    
    // Apply filters
    let filteredNodes = flowNodes
    let filteredEdges = flowEdges

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredNodes = flowNodes.filter(n => 
        n.data?.label?.toLowerCase().includes(searchLower) ||
        n.data?.project?.toLowerCase().includes(searchLower) ||
        n.data?.image?.toLowerCase().includes(searchLower)
      )
      const nodeIds = new Set(filteredNodes.map(n => n.id))
      filteredEdges = flowEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    }

    if (filterProject !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.data?.project === filterProject || n.type === 'group')
      const nodeIds = new Set(filteredNodes.map(n => n.id))
      filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    }

    if (filterHealth !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.data?.health === filterHealth || n.type === 'group')
      const nodeIds = new Set(filteredNodes.map(n => n.id))
      filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    }

    setNodes(filteredNodes)
    setEdges(filteredEdges)
  }, [graph, setNodes, setEdges, searchTerm, filterProject, filterHealth, layoutType])

  useEffect(() => {
    savePositions(nodes)
  }, [nodes])

  async function loadGraph() {
    try {
      const response = await fetch('/api/health/graph')
      const data = await response.json()
      setGraph({
        nodes: data.nodes ?? [],
        edges: data.edges ?? []
      })
    } catch (error) {
      console.error('Failed to load dependency graph:', error)
    }
  }

  const projects = useMemo(() => {
    const set = new Set<string>()
    graph.nodes.forEach(n => {
      if (n.metadata?.project) set.add(n.metadata.project)
    })
    return Array.from(set).sort()
  }, [graph])

  const stats = useMemo(() => {
    const total = graph.nodes.length
    const healthy = graph.nodes.filter(n => n.health === 'healthy').length
    const unhealthy = graph.nodes.filter(n => n.health === 'unhealthy').length
    const running = graph.nodes.filter(n => n.status === 'running').length
    return { total, healthy, unhealthy, running }
  }, [graph])

  const nodeTypes = useMemo(() => ({ serviceNode: EnhancedServiceNode }), [])

  const handleRefresh = useCallback(() => {
    loadGraph()
  }, [])

  return (
    <div style={{ 
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: fullscreen ? '0' : '20px',
      height: fullscreen ? '100%' : 'auto'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px',
        padding: fullscreen ? '20px 20px 0' : '0'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Zap size={20} color="#f59e0b" />
            <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Live Topology Map</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Real-time container dependency visualization with health monitoring
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px'
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        padding: fullscreen ? '0 20px' : '0',
        flexWrap: 'wrap'
      }}>
        <div style={{
          flex: '1',
          minWidth: '120px',
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Nodes</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>{stats.total}</div>
        </div>
        <div style={{
          flex: '1',
          minWidth: '120px',
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Running</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>{stats.running}</div>
        </div>
        <div style={{
          flex: '1',
          minWidth: '120px',
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Healthy</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>{stats.healthy}</div>
        </div>
        <div style={{
          flex: '1',
          minWidth: '120px',
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Unhealthy</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{stats.unhealthy}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        padding: fullscreen ? '0 20px' : '0',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search containers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />
        </div>

        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Projects</option>
          {projects.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterHealth}
          onChange={e => setFilterHealth(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Health States</option>
          <option value="healthy">Healthy</option>
          <option value="unhealthy">Unhealthy</option>
          <option value="starting">Starting</option>
          <option value="unknown">Unknown</option>
        </select>

        <select
          value={layoutType}
          onChange={e => setLayoutType(e.target.value as any)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="cluster">Cluster Layout</option>
          <option value="force">Force Layout</option>
          <option value="hierarchical">Hierarchical</option>
        </select>
      </div>

      {/* Topology Visualization */}
      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '10px',
        padding: '10px',
        height: fullscreen ? 'calc(100vh - 320px)' : height,
        margin: fullscreen ? '0 20px 20px' : '0'
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }
          }}
        >
          <Background 
            color="rgba(100, 116, 139, 0.3)" 
            gap={16}
            size={1}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'group') return 'rgba(30, 41, 59, 0.6)'
              return node.data?.health ? getHealthColor(node.data.health) : '#6b7280'
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)'
            }}
          />
          <Controls 
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)'
            }}
          />
          <Panel position="top-right" style={{
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span>💡 Click nodes to expand details</span>
              <span>🔍 Drag to pan, scroll to zoom</span>
              <span>🎯 Double-click to fit view</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginTop: '16px', 
        fontSize: '12px', 
        color: 'var(--text-secondary)',
        padding: fullscreen ? '0 20px 20px' : '0',
        flexWrap: 'wrap'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} /> Healthy
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} /> Starting
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} /> Unhealthy
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6b7280' }} /> Unknown
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
          Updates every 15s via WebSocket
        </span>
      </div>
    </div>
  )
}

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function savePositions(nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((node) => {
    if (node.type === 'serviceNode') {
      positions[node.id] = { x: node.position.x, y: node.position.y }
    }
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

function buildFlow(
  graph: DependencyGraph, 
  saved: Record<string, { x: number; y: number }>,
  layoutType: 'cluster' | 'force' | 'hierarchical'
) {
  if (layoutType === 'cluster') {
    return buildClusterLayout(graph, saved)
  } else if (layoutType === 'force') {
    return buildForceLayout(graph, saved)
  } else {
    return buildHierarchicalLayout(graph, saved)
  }
}

function buildClusterLayout(graph: DependencyGraph, saved: Record<string, { x: number; y: number }>) {
  const groups = new Map<string, GraphNode[]>()
  graph.nodes.forEach((node) => {
    const project = node.metadata?.project || 'default'
    if (!groups.has(project)) groups.set(project, [])
    groups.get(project)!.push(node)
  })

  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []
  const groupIndex = Array.from(groups.keys())

  const clusterWidth = 360
  const clusterHeight = 260
  const columns = 3

  groupIndex.forEach((project, index) => {
    const groupId = `group-${project}`
    const col = index % columns
    const row = Math.floor(index / columns)
    const baseX = 40 + col * (clusterWidth + 100)
    const baseY = 40 + row * (clusterHeight + 100)

    flowNodes.push({
      id: groupId,
      type: 'group',
      data: { label: project },
      position: { x: baseX, y: baseY },
      style: {
        background: 'rgba(30, 41, 59, 0.3)',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        width: clusterWidth,
        height: clusterHeight,
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }
    })

    const nodes = groups.get(project) || []
    const radius = 70 + Math.max(0, nodes.length - 3) * 12
    const centerX = baseX + clusterWidth / 2
    const centerY = baseY + clusterHeight / 2

    nodes.forEach((node, nodeIndex) => {
      const savedPos = saved[node.id]
      const angle = (nodeIndex / Math.max(nodes.length, 1)) * Math.PI * 2
      const fallback = {
        x: centerX + radius * Math.cos(angle) - baseX - 80,
        y: centerY + radius * Math.sin(angle) - baseY - 30
      }

      flowNodes.push({
        id: node.id,
        type: 'serviceNode',
        data: {
          label: node.name.replace('/', ''),
          status: node.status,
          health: node.health,
          image: node.metadata?.image,
          project,
          metrics: {
            cpu: Math.floor(Math.random() * 100),
            memory: Math.floor(Math.random() * 100)
          }
        },
        position: savedPos || fallback,
        parentNode: groupId,
        extent: 'parent',
        sourcePosition: Position.Right,
        targetPosition: Position.Left
      })
    })
  })

  graph.edges.forEach((edge, index) => {
    if (!graph.nodes.find((n) => n.id === edge.source) || !graph.nodes.find((n) => n.id === edge.target)) {
      return
    }
    const latencyLabel = edge.latency > 0 ? `${edge.latency}ms` : edge.type
    flowEdges.push({
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      label: latencyLabel,
      animated: edge.healthy,
      style: {
        stroke: edge.healthy ? '#10b981' : '#f59e0b',
        strokeWidth: 2.5
      },
      labelStyle: { 
        fill: '#e2e8f0', 
        fontSize: 10,
        fontWeight: 600
      },
      labelBgStyle: {
        fill: 'rgba(15, 23, 42, 0.8)',
        fillOpacity: 0.9
      }
    })
  })

  return { flowNodes, flowEdges }
}

function buildForceLayout(graph: DependencyGraph, saved: Record<string, { x: number; y: number }>) {
  // Simplified force-directed layout
  const flowNodes: Node[] = graph.nodes.map((node, index) => {
    const savedPos = saved[node.id]
    const angle = (index / graph.nodes.length) * Math.PI * 2
    const radius = 200
    const fallback = {
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle)
    }

    return {
      id: node.id,
      type: 'serviceNode',
      data: {
        label: node.name.replace('/', ''),
        status: node.status,
        health: node.health,
        image: node.metadata?.image,
        project: node.metadata?.project || 'default',
        metrics: {
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100)
        }
      },
      position: savedPos || fallback
    }
  })

  const flowEdges: Edge[] = graph.edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.latency > 0 ? `${edge.latency}ms` : edge.type,
    animated: edge.healthy,
    style: {
      stroke: edge.healthy ? '#10b981' : '#f59e0b',
      strokeWidth: 2.5
    },
    labelStyle: { fill: '#e2e8f0', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: 'rgba(15, 23, 42, 0.8)', fillOpacity: 0.9 }
  }))

  return { flowNodes, flowEdges }
}

function buildHierarchicalLayout(graph: DependencyGraph, saved: Record<string, { x: number; y: number }>) {
  // Simplified hierarchical layout
  const levels = new Map<string, number>()
  const levelNodes = new Map<number, GraphNode[]>()

  // Assign levels based on dependencies
  graph.nodes.forEach(node => {
    const incomingEdges = graph.edges.filter(e => e.target === node.id)
    const level = incomingEdges.length === 0 ? 0 : 1
    levels.set(node.id, level)
    if (!levelNodes.has(level)) levelNodes.set(level, [])
    levelNodes.get(level)!.push(node)
  })

  const flowNodes: Node[] = []
  levelNodes.forEach((nodes, level) => {
    nodes.forEach((node, index) => {
      const savedPos = saved[node.id]
      const fallback = {
        x: 100 + index * 250,
        y: 100 + level * 200
      }

      flowNodes.push({
        id: node.id,
        type: 'serviceNode',
        data: {
          label: node.name.replace('/', ''),
          status: node.status,
          health: node.health,
          image: node.metadata?.image,
          project: node.metadata?.project || 'default',
          metrics: {
            cpu: Math.floor(Math.random() * 100),
            memory: Math.floor(Math.random() * 100)
          }
        },
        position: savedPos || fallback
      })
    })
  })

  const flowEdges: Edge[] = graph.edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.latency > 0 ? `${edge.latency}ms` : edge.type,
    animated: edge.healthy,
    style: {
      stroke: edge.healthy ? '#10b981' : '#f59e0b',
      strokeWidth: 2.5
    },
    labelStyle: { fill: '#e2e8f0', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: 'rgba(15, 23, 42, 0.8)', fillOpacity: 0.9 }
  }))

  return { flowNodes, flowEdges }
}

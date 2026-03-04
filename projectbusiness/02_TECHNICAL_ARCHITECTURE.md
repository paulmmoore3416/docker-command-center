# Docker Command Center (DCC)
## Technical Architecture & System Design

**Version:** 2.3.0
**Document Date:** March 4, 2026
**Classification:** Technical

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Component Design](#component-design)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Scalability & Performance](#scalability--performance)
7. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Layer                               │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │   Web Frontend     │  │  Mobile App        │                  │
│  │   (React/Vite)     │  │  (Jetpack Compose) │                  │
│  │   typescript       │  │  (Kotlin)          │                  │
│  └────────┬───────────┘  └────────┬───────────┘                  │
└───────────┼──────────────────────┼──────────────────────────────┘
            │ HTTPS/WebSocket      │ HTTPS/TLS
            │                      │
┌───────────┼──────────────────────┼──────────────────────────────┐
│           │         API Gateway Layer                            │
│           └──────────┬─────────────────────────────────────────┘│
│                      │ REST + WebSocket                         │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  DCC Server (Go)                                            ││
│  │  ├── API Router (chi)                                      ││
│  │  ├── WebSocket Hub                                         ││
│  │  ├── Authentication Middleware                            ││
│  │  ├── Audit Logger                                         ││
│  │  └── Request Validator                                    ││
│  └────────────┬───────────────────────────────────────────────┤│
└───────────────┼────────────────────────────────────────────────┘┘
                │ Unix Socket / TCP
                │
    ┌───────────┴──────────────┬──────────────────┐
    │                          │                  │
┌───┴──────────┐  ┌───────────┴────┐  ┌─────────┴──────────┐
│  Docker      │  │  Audit Log     │  │  Monitoring       │
│  API Client  │  │  Aggregator    │  │  Metrics         │
│              │  │                │  │                  │
└──────────────┘  └────────────────┘  └──────────────────┘
```

### Core Components

#### 1. Backend Service (Go)
- **Framework:** Chi HTTP router
- **Port:** 9876 (configurable)
- **API:** RESTful + WebSocket
- **Architecture:** Modular, handler-based

#### 2. Frontend (React)
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Material Design / CSS-in-JS
- **State:** React Query + Context API
- **Port:** 3000 (dev), embedded in binary (prod)

#### 3. Mobile App (Android/Kotlin)
- **Framework:** Jetpack Compose
- **Architecture:** MVVM + Repository pattern
- **Language:** Kotlin
- **Data:** Room DB + DataStore preferences
- **Network:** Retrofit + OkHttp

---

## Technology Stack

### Backend Stack

```
┌─────────────────────────────────────────────┐
│  Go 1.21+                                    │
│  ├── Chi Router (HTTP routing)              │
│  ├── Gorilla WebSocket (real-time updates)  │
│  ├── Docker SDK (container management)      │
│  ├── YAML parser (compose files)            │
│  └── syslog integration (logging)           │
└─────────────────────────────────────────────┘
```

### Frontend Stack

```
┌─────────────────────────────────────────────┐
│  Node.js + TypeScript                       │
│  ├── React 18+                              │
│  ├── Vite 5.0+                              │
│  ├── React Query (TanStack)                 │
│  ├── Material-UI                            │
│  ├── Visx (charting)                        │
│  └── ESLint + Prettier                      │
└─────────────────────────────────────────────┘
```

### Mobile Stack

```
┌─────────────────────────────────────────────┐
│  Android 8.0+ (Kotlin)                      │
│  ├── Jetpack Compose UI                     │
│  ├── Retrofit + OkHttp (networking)         │
│  ├── Room Database (local persistence)      │
│  ├── DataStore (preferences)                │
│  ├── Coroutines (async)                     │
│  └── Hilt (dependency injection)            │
└─────────────────────────────────────────────┘
```

### Infrastructure Stack

```
┌─────────────────────────────────────────────┐
│  Docker & Linux                             │
│  ├── systemd (service management)           │
│  ├── syslog (centralized logging)          │
│  ├── SQLite (metadata storage)              │
│  └── JSON (configuration)                   │
└─────────────────────────────────────────────┘
```

---

## Component Design

### Backend Modules

#### 1. Docker Client (`internal/docker/client.go`)
**Responsibility:** Interface with Docker daemon

```go
type Client struct {
    api *client.Client           // Docker SDK client
    ctx context.Context          // Request context
    mu  sync.RWMutex            // Thread-safe operations
}

// Core Methods:
- ListContainers()
- GetContainer(id)
- StartContainer(id)
- StopContainer(id)
- GetLogs(id) stream
- ListVolumes()
- BrowseVolume(name, path)
- ListNetworks()
- CreateNetwork(config)
- InspectNetwork(id)
- ListStacks()
- ComposeUp(project)
- ComposeDown(project)
```

**Key Patterns:**
- Streaming responses for logs
- Timeout handling for long operations
- Error wrapping with context
- Atomic operations where possible

#### 2. WebSocket Hub (`internal/websockets/hub.go`)
**Responsibility:** Real-time updates to connected clients

```go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan Message
    register   chan *Client
    unregister chan *Client
}

// Broadcasting Strategy:
- Container state changes
- Metrics updates (every 5s)
- Log entries (real-time streaming)
- System events
```

**Connection Lifecycle:**
```
Client connects → Register in Hub → Send updates → Unregister on disconnect
                    ↓
              Broadcast to all subscribed clients
```

#### 3. Audit Logger (`internal/audit/logger.go`)
**Responsibility:** Compliance and security logging

```go
type AuditLog struct {
    Timestamp   time.Time
    User        string
    Action      string         // e.g., "container.start"
    Resource    string         // e.g., "container:abc123"
    Details     map[string]any
    Result      string         // "success" or error message
    IPAddress   string
}

// Logged Actions:
- container.start, .stop, .restart, .delete
- compose.up, .down, .scale
- network.create, .delete, .connect
- volume.create, .delete
- system.auth (login/logout)
- settings.update
```

#### 4. File Watcher (`internal/filewatch/watcher.go`)
**Responsibility:** Monitor volume and config changes

```go
// Detects:
- New/deleted files in volumes
- Directory structure changes
- Large file creations
- Permissions changes
```

#### 5. Drift Detector (`internal/drift/detector.go`)
**Responsibility:** Identify configuration and resource drift

```go
type DriftReport struct {
    Container    string
    Expected     ConfigState
    Actual       ConfigState
    Differences  []DriftItem
    Severity     string // "warning", "error"
}

// Detects:
- Unexpected network connections
- Resource limit violations
- Volume mount mismatches
- Environment variable changes
```

#### 6. Proxy Manager (`internal/proxy/manager.go`)
**Responsibility:** HTTP proxy to container services

```go
// Routes requests:
/proxy/{containerID}/... → container:exposed_port

// Features:
- Connection pooling
- Timeout management
- Header rewriting
- CORS handling
```

#### 7. Sandbox Manager (`internal/sandbox/manager.go`)
**Responsibility:** Isolated test environments

```go
type Sandbox struct {
    ID          string
    CreatedAt   time.Time
    Containers  []string
    Networks    []string
    Volumes     []string
}

// Capabilities:
- Create ephemeral containers
- Network isolation
- Volume snapshots
- Automatic cleanup
```

#### 8. Security Scanner (`internal/security/scanner.go`)
**Responsibility:** Image and container security analysis

```go
type ScanResult struct {
    ImageID     string
    Vulnerabilities []CVE
    Compliance  ComplianceStatus
}

// Checks:
- CVE database matching
- Dockerfile best practices
- Runtime security violations
```

### Frontend Architecture

#### Component Hierarchy

```
App
├── SystemsContext (multi-machine state)
├── AppNavigation
│   ├── Drawer
│   │   ├── SystemSwitcher
│   │   └── NavItems
│   └── TopAppBar
└── NavHost
    ├── DashboardScreen
    │   ├── StatsCard
    │   ├── ContainerList
    │   └── QuickActions
    ├── ContainersScreen
    │   ├── ContainerCard
    │   └── DetailModal
    ├── StacksScreen
    │   ├── StackCard
    │   └── ServiceTree
    ├── NetworksScreen
    │   ├── NetworkCard (expandable)
    │   └── ContainerGrid
    ├── VolumesScreen
    │   ├── VolumeCard
    │   └── FileBrowser
    ├── SettingsScreen
    │   ├── SystemSettings
    │   ├── Appearance
    │   └── Developer Options
    └── ...
```

#### State Management

```typescript
// Global State (Context)
- SystemsContext
  ├── activeSystem: RemoteSystem
  ├── systems: RemoteSystem[]
  ├── connectionStatus: "online" | "offline"
  └── systemLatency: number

// Local State (ViewModel)
- ContainersViewModel
  ├── containers: Container[]
  ├── selectedContainer: Container
  ├── logs: LogLine[]
  └── filters: ContainerFilter

- StacksViewModel
  ├── stacks: Stack[]
  ├── selectedStack: Stack
  └── services: Service[]
```

#### Data Flow

```
User Action (click button)
    ↓
Hook calls API via useApi()
    ↓
API request to active system
    ↓
Response → ViewModel update
    ↓
UI re-renders via React state
    ↓
Optimistic updates for UX
```

### Mobile App Architecture

#### MVVM + Repository Pattern

```
UI Layer (Screens)
    ↓
ViewModel (StateFlow management)
    ↓
Repository (data abstraction)
    ↓
Data Sources
├── RemoteDataSource (API)
└── LocalDataSource (Room DB)
```

#### Key ViewModels

```kotlin
// SystemsViewModel
- load()                      // Load from DataStore
- addSystem(name, url, key)  // Persist new system
- removeSystem(id)            // Delete system
- switchTo(id)                // Change active system

// ContainersViewModel
- refresh()
- startContainer(id)
- stopContainer(id)
- viewLogs(id)

// StacksViewModel
- loadStacks()
- startStack(name)
- stopStack(name)
- deployCompose(file)
```

---

## Data Flow

### Real-Time Container Updates Flow

```
┌─────────────────────────────────────────────────────┐
│ Docker Event Stream                                  │
│ (container start/stop/die/health_status)           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│ Docker Client (internal/docker/client.go)           │
│ Polls docker events or listens to Docker events     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│ WebSocket Hub (internal/websockets/hub.go)          │
│ Broadcasts {type: "container", state: "running"}   │
└──────────────────┬──────────────────────────────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
    Web Client            Mobile Client
  (WebSocket)            (WebSocket)
      │                         │
      └─────────────┬───────────┘
                    │
          UI Updates in Real-time
```

### Log Streaming Flow

```
Client: GET /api/containers/{id}/logs?follow=true
    ↓
Backend: Creates streaming response
    ↓
Docker API: Connects to container log stream
    ↓
Backend: Reads from Docker stream, formats JSON
    ↓
Sends each log line to client (chunked transfer)
    ↓
Client: Displays logs in real-time
```

### Multi-Machine Proxy Flow

```
Web Client → API Request
    ↓
DCC Gateway (primary host)
    ↓
Lookup target system
    ↓
Forward request via HTTP/SSH tunnel
    ↓
Target DCC instance
    ↓
Docker daemon
    ↓
Response propagated back to client
```

---

## Security Architecture

### Authentication & Authorization

```
┌──────────────────────────────────┐
│ API Request with API Key         │
└──────────────┬───────────────────┘
               │
┌──────────────▼───────────────────┐
│ Middleware: ValidateAPIKey()     │
│ - Hash API key                   │
│ - Compare with stored hash       │
│ - Check key expiration           │
└──────────────┬───────────────────┘
               │
        ┌──────┴──────┐
        │             │
    Valid        Invalid
        │             │
        │        Return 401
        │
┌───────▼──────────────────────────┐
│ Add to request context:          │
│ - api_key_id                     │
│ - user_id (if tied to key)       │
│ - permissions (future: RBAC)     │
└───────┬──────────────────────────┘
        │
   Continue to handler
```

### Audit Trail

Every action logged with:
- `timestamp`: RFC3339 format
- `user_id`: From API key
- `action`: "container.start", etc.
- `resource_id`: Affected resource
- `details`: JSON with parameters
- `result`: "success" or error
- `ip_address`: Client IP
- `user_agent`: Client info

**Storage:** Append-only syslog for immutability

### Data Protection

```
┌─────────────────────────────────────┐
│ API Key Management                  │
│ - Keys generated as UUIDs          │
│ - Only hashes stored in DB         │
│ - 60-day expiration (configurable)  │
│ - Rotation recommended every 90d    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TLS/HTTPS                           │
│ - All network traffic encrypted     │
│ - Self-signed certs supported       │
│ - Let's Encrypt integration (future)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ WebSocket Security                  │
│ - WSS (secure WebSocket)            │
│ - Same auth as HTTP endpoints       │
│ - Per-connection rate limiting      │
└─────────────────────────────────────┘
```

---

## Scalability & Performance

### Horizontal Scaling

DCC can be deployed in multi-instance configuration:

```
┌─────────────────────────────────────┐
│ Load Balancer (nginx/HAProxy)       │
│ Session affinity enabled            │
└────────────┬────────────┬───────────┘
             │            │
    ┌────────▼──┐  ┌─────▼────────┐
    │ DCC-1     │  │ DCC-2        │
    │ :9876     │  │ :9876        │
    └───────────┘  └──────────────┘
         │              │
    docker.sock    docker.sock
    (Host A)       (Host A or B)
```

### Performance Optimizations

| Optimization | Implementation |
|---|---|
| **Caching** | Redis cache for container lists, TTL: 5s |
| **Compression** | gzip for HTTP responses |
| **Connection Pooling** | Docker API client connection reuse |
| **Batch Operations** | Combine multiple actions in single API call |
| **Rate Limiting** | Token bucket (100 req/sec per API key) |
| **Pagination** | Default 50 items/page for large lists |
| **Lazy Loading** | Load details on-demand in UI |

### Monitoring Hooks

```go
// Metrics exported (Prometheus format)
- dcc_containers_count
- dcc_api_request_duration_ms
- dcc_docker_api_errors_total
- dcc_websocket_connections_active
- dcc_audit_logs_total
- system_cpu_percent
- system_memory_bytes
```

---

## Deployment Architecture

### Docker Compose (Self-Hosted)

```yaml
version: '3.8'
services:
  dcc:
    image: dcc:2.0.0
    ports:
      - "9876:9876"
      - "8081:8081"        # Web UI
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - dcc-data:/etc/dcc
    environment:
      DCC_PORT: 9876
      DCC_UI_PORT: 8081
      DCC_LOG_LEVEL: info
    restart: unless-stopped

volumes:
  dcc-data:
```

### Systemd Service (Linux)

```ini
[Unit]
Description=Docker Command Center
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/dcc
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5s
EnvironmentFile=/etc/dcc/dcc.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dcc

[Install]
WantedBy=multi-user.target
```

### Container Resource Limits

```
Memory: 512MB minimum, 2GB recommended
CPU:    0.5-2.0 cores
Disk:   2GB for application + logs
Network: 100Mbps minimum
```

---

## API Specification Summary

### REST Endpoints (Key)

```
GET    /api/containers              - List all containers
GET    /api/containers/{id}         - Get container details
POST   /api/containers/{id}/start   - Start container
POST   /api/containers/{id}/stop    - Stop container
GET    /api/containers/{id}/logs    - Stream logs

GET    /api/stacks                  - List compose projects
POST   /api/compose/up              - Deploy stack
POST   /api/compose/down            - Stop stack
POST   /api/compose/start           - Start all in stack

GET    /api/volumes                 - List volumes
GET    /api/volumes/{id}/browse     - Browse contents
DELETE /api/volumes/{id}            - Delete volume

GET    /api/networks                - List networks
GET    /api/networks/{id}           - Get details
POST   /api/networks                - Create network

GET    /api/monitoring/alerts       - Current alerts
GET    /api/monitoring/health       - System health
POST   /api/auth/validate-key       - Check API key

GET    /ws                          - WebSocket upgrade
```

### WebSocket Messages

```json
{
  "type": "container_status_change",
  "container_id": "abc123",
  "status": "running",
  "timestamp": "2026-02-22T12:34:56Z"
}

{
  "type": "log_line",
  "container_id": "abc123",
  "message": "[INFO] Application started",
  "timestamp": "2026-02-22T12:34:56Z"
}

{
  "type": "system_metric",
  "metric": "cpu_usage",
  "value": 45.2,
  "unit": "percent"
}
```

---

## Conclusion

Docker Command Center's architecture combines proven patterns (MVVM, REST APIs, event-driven updates) with modern technologies (Go, React, Kotlin) to create a scalable, responsive, and secure container management platform. The modular design enables easy feature additions while maintaining code quality and performance.

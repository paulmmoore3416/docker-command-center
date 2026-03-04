# DCC Optimization Recommendations (8 Priority Items)

> Generated: 2026-02-22
> Focus: Performance & Functionality Enhancements

---

## 1. **Response Caching Layer with TTL**

**Current State**: Every API request hits the Docker daemon directly (e.g., `ListContainers`, `ListVolumes`, `ListNetworks`)
- `GET /api/containers` → 5-10ms per call from Docker
- Multiple simultaneous clients = N × latency

**Problem**: High latency for rapid consecutive calls; wasted compute on unchanged data

**Recommendation**:
- Add in-memory cache with configurable TTL (default 2-5 seconds)
- Implement cache invalidation on write operations (start/stop/create)
- Use sync.Map for thread-safe, lock-free reads

**Implementation Location**: `internal/docker/client.go`
```go
type CachedResponse struct {
    Data      interface{}
    ExpiresAt time.Time
    mu        sync.RWMutex
}

type Client struct {
    // ... existing fields
    cache     map[string]*CachedResponse
    cacheTTL  time.Duration
}

// Add methods: GetCached(key), SetCached(key, data), InvalidateCache(key)
```

**Expected Benefit**: 50-80% reduction in response latency for list operations; reduced Docker daemon load

**Effort**: Medium (4-6 hours)

---

## 2. **Connection Pooling & Rate Limiting**

**Current State**: HTTP handler spawns new goroutine per request; no connection pooling; Docker CLI is unbounded

**Problem**:
- Goroutine explosion under load (1000+ requests = 1000+ goroutines)
- Docker daemon file descriptor limits hit quickly
- No backpressure mechanism

**Recommendation**:
- Add `golang.org/x/time/rate` for per-IP rate limiting
- Implement Docker API connection pool with max 20-50 concurrent calls
- Add HTTP server with `MaxHeaderBytes` and `MaxConns` limits

**Implementation Location**: `cmd/dcc/main.go` (main function)
```go
import "golang.org/x/time/rate"

// Per-IP limiter
ipLimiters := make(map[string]*rate.Limiter)
rateLimitMiddleware := func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := r.RemoteAddr
        limiter := ipLimiters[ip]
        if limiter == nil {
            limiter = rate.NewLimiter(rate.Limit(100), 10) // 100 req/s, burst 10
            ipLimiters[ip] = limiter
        }
        if !limiter.Allow() {
            http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// Apply to all API routes
api.Use(rateLimitMiddleware)

// Limit server connections
server := &http.Server{
    MaxHeaderBytes: 1 << 20,     // 1MB
    MaxConns:      500,           // max concurrent
    // ...
}
```

**Expected Benefit**: Stable performance under load; prevents DoS; prevents goroutine leaks

**Effort**: Medium (5-7 hours)

---

## 3. **WebSocket Message Batching & Debouncing**

**Current State**: Every monitoring event broadcasts immediately
- Monitoring checks every 5 seconds (StartMonitoring ticker)
- 100 containers = 100 separate JSON encodes/broadcasts per cycle
- Clients receive 20 messages/sec (5-second check, 100 containers)

**Problem**: Network congestion; JSON marshaling CPU overhead; client UI thrashing

**Recommendation**:
- Batch messages into single broadcast per monitoring cycle
- Debounce rapid alerts (same alert within 10s = suppress)
- Add message type filtering on client subscribe

**Implementation Location**: `internal/docker/client.go` & `internal/websockets/hub.go`

```go
// In client.go:
type MonitoringBatch struct {
    Timestamp   time.Time       `json:"timestamp"`
    Alerts      []Alert         `json:"alerts"`
    Statistics  map[string]interface{} `json:"stats"`
    Events      []string        `json:"events"`
}

// In checkResourceThresholds:
func (c *Client) checkResourceThresholds(ctx context.Context, hub *websockets.Hub) {
    batch := &MonitoringBatch{
        Timestamp: time.Now(),
        Alerts:    []Alert{},
        Events:    []string{},
    }
    
    // ... collect alerts into batch ...
    
    hub.Broadcast(map[string]interface{}{"type": "monitoring", "data": batch})
}

// In hub.go - add message deduplication:
func (h *Hub) BroadcastOnce(key string, data interface{}) {
    // Only broadcast if message key hasn't been seen in last 10s
}
```

**Expected Benefit**: 70-80% reduction in websocket messages; lower CPU on client; smoother UI

**Effort**: Small (2-3 hours)

---

## 4. **Pagination for List Endpoints**

**Current State**: All list endpoints return entire result set
- `GET /api/containers` returns all containers (1000+ = 1-2MB JSON)
- `GET /api/volumes` returns all volumes
- Frontend/Android loads all data at once

**Problem**: 
- High memory usage (client & server)
- Slow initial load
- Wastes bandwidth for off-screen data
- Large JSON parsing on mobile

**Recommendation**:
- Add `?limit=50&offset=0` query params to all list endpoints
- Return metadata: `{"data": [...], "total": 500, "limit": 50, "offset": 0}`
- Frontend/Android handles lazy-load or infinite scroll

**Implementation Location**: `internal/docker/client.go` (all List* methods)

```go
func (c *Client) ListContainers(w http.ResponseWriter, r *http.Request) {
    limit := 50
    offset := 0
    if l := r.URL.Query().Get("limit"); l != "" {
        limit, _ = strconv.Atoi(l)
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        offset, _ = strconv.Atoi(o)
    }
    
    containers, _ := c.cli.ContainerList(ctx, container.ListOptions{})
    
    total := len(containers)
    if offset < total {
        containers = containers[offset : offset+limit]
    } else {
        containers = []*container.Summary{}
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data":   containers,
        "total":  total,
        "limit":  limit,
        "offset": offset,
    })
}
```

**Expected Benefit**: 90% faster initial load; 50-70% less memory; better mobile UX

**Effort**: Medium (6-8 hours)

---

## 5. **Search & Filter Optimization**

**Current State**: No built-in search; filtering happens on client
- Client downloads all containers, filters locally
- No indexed lookups
- Case-sensitive matching

**Problem**: 
- Slow with large datasets
- Duplicated filtering logic between frontend/Android
- No server-side optimization

**Recommendation**:
- Add `?search=nginx&filter=status:running&sort=name` to list endpoints
- Implement server-side filtering before returning data
- Add full-text search support for compose files, environment names

**Implementation Location**: `internal/docker/client.go` (add helper)

```go
func (c *Client) ListContainers(w http.ResponseWriter, r *http.Request) {
    limit, offset := getPaginationParams(r)
    search := strings.ToLower(r.URL.Query().Get("search"))
    status := r.URL.Query().Get("filter.status")
    
    containers, _ := c.cli.ContainerList(ctx, container.ListOptions{})
    
    // Apply filters server-side
    var filtered []*container.Summary
    for _, cont := range containers {
        if search != "" && !strings.Contains(strings.ToLower(cont.Names[0]), search) {
            continue
        }
        if status != "" && cont.State != status {
            continue
        }
        filtered = append(filtered, cont)
    }
    
    // Pagination
    total := len(filtered)
    if offset < total && offset+limit <= total {
        filtered = filtered[offset : offset+limit]
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data":  filtered,
        "total": total,
    })
}
```

**Expected Benefit**: Faster client search (100-1000× for large datasets); cleaner client code; reduced bandwidth

**Effort**: Medium (4-5 hours)

---

## 6. **Async/Defer Pattern for Long Operations**

**Current State**: Deploy/Start/Stop operations are synchronous
- `POST /api/compose/deploy` blocks until complete
- Client can't cancel or check progress
- Timeout on slow deploys

**Problem**:
- Poor UX (spinners hang)
- No progress feedback
- Fails silently on timeout

**Recommendation**:
- Add job queue system with async handling
- Return job ID immediately with `202 Accepted`
- Add `GET /api/jobs/{id}` to poll progress
- Optional webhook for completion

**Implementation Location**: New file `internal/jobs/queue.go`

```go
type Job struct {
    ID        string            `json:"id"`
    Type      string            `json:"type"`
    Status    string            `json:"status"` // queued, running, completed, failed
    Progress  int               `json:"progress"`
    Result    interface{}       `json:"result,omitempty"`
    Error     string            `json:"error,omitempty"`
    CreatedAt time.Time         `json:"created_at"`
    UpdatedAt time.Time         `json:"updated_at"`
}

type Queue struct {
    jobs map[string]*Job
    mu   sync.RWMutex
}

// In client.go:
func (c *Client) DeployCompose(w http.ResponseWriter, r *http.Request) {
    var req struct {
        FilePath string `json:"file_path"`
        Project  string `json:"project"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    
    job := &Job{
        ID:        uuid.New().String(),
        Type:      "compose:deploy",
        Status:    "queued",
        CreatedAt: time.Now(),
    }
    c.jobQueue.Enqueue(job)
    
    // Return immediately
    w.WriteHeader(http.StatusAccepted)
    json.NewEncoder(w).Encode(job)
    
    // Run async
    go func() {
        job.Status = "running"
        // ... do deploy ...
        job.Status = "completed"
    }()
}

// New endpoint
func (c *Client) GetJobStatus(w http.ResponseWriter, r *http.Request) {
    id := mux.Vars(r)["id"]
    job := c.jobQueue.Get(id)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(job)
}
```

**Routes**: 
- `POST /api/jobs/{type}` → submit job, get ID
- `GET /api/jobs/{id}` → poll progress

**Expected Benefit**: Responsive UI; no timeouts; progress feedback; user can cancel jobs

**Effort**: High (8-10 hours including client updates)

---

## 7. **Efficient Resource Monitoring (Sampling + Aggregation)**

**Current State**: Full stats fetch every 5 seconds per container
- `ContainerStats()` returns full CPU, memory, network, I/O
- Processed but only thresholds checked (wasted I/O)
- Monotonically growing history (memory leak)

**Problem**:
- Docker daemon I/O overhead
- High CPU for stats decoding
- Memory leak in `containerHistory` map
- History never cleaned up

**Recommendation**:
- Sample every Nth check (e.g., collect stats every 3rd cycle for averaging)
- Store only aggregates (min/max/avg) not raw values
- Rotate history with fixed-size buffer (keep last 1000 entries)
- Add separate "fast path" for clients only needing status (skip stats)

**Implementation Location**: `internal/docker/client.go`

```go
type Client struct {
    // ... existing
    historyBuffer  map[string]*RingBuffer // fixed-size ring buffer
    statsCache     map[string]*types.StatsJSON
    lastStatsFetch map[string]time.Time
}

type RingBuffer struct {
    data  []HistoryEntry
    index int
    size  int
    mu    sync.RWMutex
}

func (rb *RingBuffer) Append(entry HistoryEntry) {
    rb.mu.Lock()
    rb.data[rb.index] = entry
    rb.index = (rb.index + 1) % rb.size
    rb.mu.Unlock()
}

// In checkResourceThresholds - add sampling:
func (c *Client) checkResourceThresholds(ctx context.Context, hub *websockets.Hub) {
    // Only fetch full stats every 3rd cycle
    cycle := (time.Now().Unix() / 5) % 3
    shouldFetchStats := cycle == 0
    
    // ... fetch and check only if cycle allows ...
}

// Add method to cleanup old history:
func (c *Client) cleanupHistory() {
    c.mu.Lock()
    for containerID := range c.containerHistory {
        if len(c.containerHistory[containerID]) > 1000 {
            c.containerHistory[containerID] = c.containerHistory[containerID][100:]
        }
    }
    c.mu.Unlock()
}
```

**Expected Benefit**: 70% reduction in Docker daemon I/O; prevents memory leak; faster threshold checks; lower CPU

**Effort**: Medium (5-6 hours)

---

## 8. **Graceful Degradation & Circuit Breaker**

**Current State**: Any Docker daemon failure = entire API down
- No timeout on Docker calls
- No fallback or cached data
- No circuit breaker to stop hammering failing daemon

**Problem**:
- Bad UX if Docker is temporarily down
- Cascading failures
- No ability to serve cached data

**Recommendation**:
- Add circuit breaker pattern (fail-fast after N consecutive failures)
- Implement timeout on all Docker API calls (30s default, configurable)
- Serve cached data on circuit-open
- Add `/api/health` endpoint with component status

**Implementation Location**: `internal/docker/client.go` & `cmd/dcc/main.go`

```go
type CircuitBreaker struct {
    maxFailures  int
    timeout      time.Duration
    halfOpenAt   time.Time
    state        string // "closed", "open", "half-open"
    failureCount int
    mu           sync.RWMutex
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    if cb.state == "open" {
        if time.Now().After(cb.halfOpenAt) {
            cb.state = "half-open"
        } else {
            return errors.New("circuit breaker open")
        }
    }
    
    ctx, cancel := context.WithTimeout(context.Background(), cb.timeout)
    defer cancel()
    
    err := fn()
    
    if err != nil {
        cb.failureCount++
        if cb.failureCount >= cb.maxFailures {
            cb.state = "open"
            cb.halfOpenAt = time.Now().Add(30 * time.Second)
        }
        return err
    }
    
    cb.failureCount = 0
    cb.state = "closed"
    return nil
}

// In ListContainers:
func (c *Client) ListContainers(w http.ResponseWriter, r *http.Request) {
    err := c.breaker.Call(func() error {
        containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{})
        // ... process ...
        return err
    })
    
    if err != nil && c.lastContainerList != nil {
        // Serve cached data on circuit-open
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("X-Cached", "true")
        json.NewEncoder(w).Encode(c.lastContainerList)
        return
    }
    
    if err != nil {
        http.Error(w, "Docker daemon unreachable", http.StatusServiceUnavailable)
        return
    }
    
    // normal response
}

// Health endpoint
func (c *Client) GetHealth(w http.ResponseWriter, r *http.Request) {
    c.mu.RLock()
    health := map[string]interface{}{
        "status":           "healthy",
        "docker":           "connected",
        "circuitBreaker":   c.breaker.state,
        "cachedContainers": len(c.lastContainerList),
        "websocketClients": c.wsClientCount,
    }
    c.mu.RUnlock()
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(health)
}
```

**Routes**:
- `GET /api/health` → component status

**Expected Benefit**: Graceful degradation; better MTTR (Mean Time To Recovery); informed monitoring; user transparency

**Effort**: Medium (5-7 hours)

---

## Summary Table

| # | Recommendation | Type | Effort | Impact | Priority |
|---|---|---|---|---|---|
| 1 | Response Caching | Perf | Medium | High (50-80%) | **HIGH** |
| 2 | Connection Pooling | Perf | Medium | High | **HIGH** |
| 3 | WebSocket Batching | Perf | Small | Medium (70-80%) | **MEDIUM** |
| 4 | Pagination | Perf+UX | Medium | High (90%) | **HIGH** |
| 5 | Search/Filter | UX | Medium | Medium | **MEDIUM** |
| 6 | Async Jobs | UX+Reliability | High | High | **HIGH** |
| 7 | Monitoring Optimization | Perf | Medium | Medium (70%) | **MEDIUM** |
| 8 | Circuit Breaker | Reliability | Medium | High | **HIGH** |

---

## Recommended Implementation Order

1. **Phase 1 (This Week)**: #1, #2, #4
   - Quick wins with major performance impact
   - ~15-20 hours
   - Expect 80%+ latency reduction

2. **Phase 2 (Next Week)**: #3, #7, #8
   - Polish & reliability
   - ~12-15 hours
   - Production stability

3. **Phase 3 (Optional)**: #5, #6
   - Advanced features
   - ~13-18 hours
   - Enhanced UX & scalability

---

## Testing Checklist

After each implementation:
- [ ] Load test with `ab -n 1000 -c 50 http://localhost:9876/api/containers`
- [ ] Memory profile: `go test -memprofile=mem.prof`
- [ ] WebSocket stress test with 100+ concurrent clients
- [ ] Failure injection tests (kill docker daemon, measure fallback)
- [ ] Android app test with poor network (3G throttling)

---

## Files to Update

**Backend**:
- `internal/docker/client.go` — caching, timeouts, circuit breaker, efficient monitoring
- `internal/websockets/hub.go` — message batching, deduplication
- `internal/jobs/queue.go` — NEW: async job system
- `cmd/dcc/main.go` — rate limiting, health endpoint, job queue init

**Android**:
- `data/repository/DccRepository.kt` — handle pagination, add search params
- `viewmodel/ViewModels.kt` — implement lazy loading, error handling
- `ui/screens/*.kt` — update to use paginated data, show job progress

**Frontend** (React/TSX):
- `frontend/src/pages/*.tsx` — implement infinite scroll, pagination
- `frontend/src/hooks/*.ts` — add job polling hook


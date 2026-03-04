# DCC Optimization Implementation Checklist

> Complete guide for executing the 8 recommendations
> Print this, check items off, track progress

---

## 📋 Phase 1: Performance Foundations (Week 1-2)

### Item 1.1: Response Caching Layer ⚡

#### Setup
- [ ] Read [OPTIMIZATION_RECOMMENDATIONS.md](OPTIMIZATION_RECOMMENDATIONS.md#1-response-caching-layer-with-ttl)
- [ ] Understand cache invalidation strategy
- [ ] Review cache key naming convention

#### Implementation
- [ ] Open `internal/docker/client.go`
- [ ] Add `CachedValue` struct (type + fields)
- [ ] Add cache-related fields to `Client` struct
- [ ] Implement `GetCached(key string)` method
- [ ] Implement `SetCached(key, data)` method
- [ ] Implement `InvalidateCache(key)` method
- [ ] Implement `InvalidateCacheAll()` method
- [ ] Update `NewClient()` to initialize cache with TTL=3s
- [ ] Update `ListContainers()` to use cache
- [ ] Update `ListNetworks()` to use cache
- [ ] Update `ListVolumes()` to use cache
- [ ] Update `ListComposeProjects()` to use cache
- [ ] Add cache invalidation to `StartContainer()`
- [ ] Add cache invalidation to `StopContainer()`
- [ ] Add cache invalidation to `RestartContainer()`
- [ ] Add cache invalidation to `RemoveContainer()`
- [ ] Add cache invalidation to `ComposeDown()`
- [ ] Add cache invalidation to `ComposeStart()`
- [ ] Add `X-Cache: HIT/MISS` header to responses

#### Testing
- [ ] Test with `curl -v http://localhost:9876/api/containers`
- [ ] Verify first call shows `X-Cache: MISS`
- [ ] Verify second call (within 3s) shows `X-Cache: HIT`
- [ ] Verify response time drops from 500ms to <5ms
- [ ] Test cache invalidation: call start/stop, verify cache clears
- [ ] Load test: `ab -n 100 -c 10 http://localhost:9876/api/containers`

#### Metrics
- [ ] Latency before: _____ ms
- [ ] Latency after (cached): _____ ms
- [ ] Cache hit ratio: _____%
- [ ] Baseline throughput: _____ RPS

#### Review & Commit
- [ ] Code review: self or peer
- [ ] All tests passing
- [ ] No new warnings/errors
- [ ] Commit message: `"opt: Add response caching with 3s TTL"`
- [ ] Document cache TTL config in code comment

---

### Item 1.2: Connection Pooling & Rate Limiting 🛡️

#### Setup
- [ ] Read [OPTIMIZATION_QUICK_START.md](OPTIMIZATION_QUICK_START.md#phase-2-connection-pooling--rate-limiting-2-3-hours)
- [ ] Install `golang.org/x/time/rate` if not present
- [ ] Review rate limiting algorithm (token bucket)

#### Implementation - Rate Limiting
- [ ] Open `cmd/dcc/main.go`
- [ ] Add import: `import "golang.org/x/time/rate"`
- [ ] Add global `ipLimiters` map
- [ ] Add `limiterMu` RWMutex for thread-safety
- [ ] Implement `getIPLimiter(ip string)` function
- [ ] Implement `rateLimitMiddleware(next http.Handler)` middleware
- [ ] Wrap API routes with middleware: `api.Use(rateLimitMiddleware)`

#### Implementation - Connection Limits
- [ ] Replace `http.ListenAndServe()` with `http.Server` struct
- [ ] Set `MaxHeaderBytes: 1 << 20` (1MB)
- [ ] Set `MaxConns: 500`
- [ ] Set `ReadTimeout: 15 * time.Second`
- [ ] Set `WriteTimeout: 15 * time.Second`
- [ ] Set `IdleTimeout: 60 * time.Second`
- [ ] Verify server starts with new config

#### Testing - Rate Limiting
- [ ] Normal load (should pass): `ab -n 100 -c 10`
- [ ] Verify no 429 errors in normal usage
- [ ] Burst test: `ab -n 1000 -c 50` (monitor for 429s)
- [ ] Verify 429 Too Many Requests returned when limit exceeded
- [ ] Test from different IPs (if available)

#### Testing - Connection Limits
- [ ] Monitor connection count during load
- [ ] Verify no "too many open files" errors
- [ ] Test with `MaxConns` limit, observe queueing behavior
- [ ] Test timeout: kill slow Docker daemon, verify 503s not hangs

#### Metrics
- [ ] Normal RPS capacity (non-burst): _____ RPS
- [ ] Burst RPS capacity: _____ RPS
- [ ] Concurrent connection limit: _____ (should be 500)
- [ ] Timeout behavior: _____ (should be fast, not hanging)

#### Review & Commit
- [ ] Code review
- [ ] Load test complete and documented
- [ ] No connection errors under moderate load
- [ ] Commit message: `"opt: Add rate limiting (100 req/s per IP) and connection pooling (max 500)"`

---

### Item 1.3: Pagination Support 📄

#### Setup
- [ ] Read [OPTIMIZATION_QUICK_START.md](OPTIMIZATION_QUICK_START.md#phase-3-pagination-2-25-hours)
- [ ] Review JSON:API pagination spec (reference)
- [ ] Plan response format: `{"data": [...], "total": N, "limit": L, "offset": O}`

#### Implementation
- [ ] Open `internal/docker/client.go`
- [ ] Add `PaginationParams` struct or helper function
- [ ] Implement `getPaginationParams(r *http.Request)` helper
- [ ] Update `ListContainers()` to support `?limit=50&offset=0`
- [ ] Update `ListNetworks()` for pagination
- [ ] Update `ListVolumes()` for pagination
- [ ] Update `ListComposeProjects()` for pagination
- [ ] Update `ListEnvironments()` for pagination
- [ ] Return metadata with each response
- [ ] Set default limit to 50, max 500
- [ ] Validate limit/offset params (no negative, no >500)

#### Testing - API Contract
- [ ] Test default: `curl http://localhost:9876/api/containers`
  - [ ] Returns all items (backward compatible)
- [ ] Test pagination: `curl 'http://localhost:9876/api/containers?limit=10&offset=0'`
  - [ ] Returns 10 items
  - [ ] Includes `"total"`, `"limit"`, `"offset"` in response
- [ ] Test next page: `curl 'http://localhost:9876/api/containers?limit=10&offset=10'`
  - [ ] Returns items 10-20
- [ ] Test invalid params: `curl 'http://localhost:9876/api/containers?limit=-1'`
  - [ ] Uses default limit
- [ ] Test exceeding max: `curl 'http://localhost:9876/api/containers?limit=1000'`
  - [ ] Caps at 500

#### Testing - Performance
- [ ] Measure response size before: _____ KB
- [ ] Measure response size after: _____ KB
- [ ] Measure response time: _____ ms (should be same or faster)
- [ ] Load test pagination: `ab -n 100 -c 10 'http://localhost:9876/api/containers?limit=50&offset=0'`

#### Metrics
- [ ] Bandwidth reduction: ____% (should be 80-90%)
- [ ] Latency change: _____ (should be same or faster)
- [ ] Total items returned: _____ (matches `"total"`)

#### Review & Commit
- [ ] Code review
- [ ] Backward compatibility verified (no limit param = all items)
- [ ] All endpoints updated
- [ ] Commit message: `"opt: Add pagination support to list endpoints (limit, offset)"`

#### Android/Frontend Update (Separate PR)
- [ ] [ ] Update Android repository to handle paginated responses
- [ ] [ ] Update frontend to request paginated data
- [ ] [ ] Implement lazy loading or infinite scroll
- [ ] [ ] Test on mobile (3G network simulation)

---

## 🧪 Phase 1 Validation

### Load Testing (After all 3 items complete)

```bash
# Setup: Have ~50 containers running locally
# Install tools: apt-get install apache2-utils

# Test 1: Cache effectiveness
for i in {1..10}; do
  curl -s -o /dev/null -w "%{time_total}s\n" http://localhost:9876/api/containers
done
# First should be ~500ms, rest should be <5ms

# Test 2: Rate limiting
ab -n 1000 -c 100 http://localhost:9876/api/containers
# Should complete without errors (429 ok if burst exceeded)

# Test 3: Pagination
curl 'http://localhost:9876/api/containers?limit=10' | jq '.total'
# Should return total count

# Test 4: Concurrent load
ab -n 500 -c 50 http://localhost:9876/api/containers
# Should complete in <5s (if cached)
```

### Checklist
- [ ] Cache latency: first 500ms, rest <5ms ✅
- [ ] Throughput: Can handle 50+ concurrent requests ✅
- [ ] Pagination: Returns correct subset of data ✅
- [ ] Rate limiting: Allows normal usage, blocks abuse ✅
- [ ] Errors: No 5xx errors in normal operation ✅
- [ ] Memory: Stable (not growing) ✅

---

## 📊 Phase 1 Success Criteria

Mark complete when:

- [ ] **Latency**: API responses for cached endpoints < 10ms (was 500ms)
- [ ] **Throughput**: Can sustain 100+ RPS (was 10 RPS)
- [ ] **Memory**: Stable, not growing unbounded
- [ ] **Cache Hit**: 80%+ cache hits on list endpoints
- [ ] **Pagination**: All list endpoints support limit/offset
- [ ] **Rate Limiting**: Prevents abuse without affecting normal usage
- [ ] **Backward Compatible**: Old clients still work (no limit param)
- [ ] **Monitored**: Metrics being collected and visible

### Sign-Off
- Implementation Date: __________
- Engineer: __________
- Reviewed By: __________
- Performance Improvement: ________ (target: 80%+)

---

## 📈 Phase 2: Reliability & Optimization (Week 2-3)

### Item 2.1: WebSocket Message Batching ✅
- [ ] Create `MonitoringBatch` struct
- [ ] Batch alerts in `checkResourceThresholds()`
- [ ] Add message deduplication (10s window)
- [ ] Test WebSocket traffic (should be 0.25 msgs/sec, not 20)
- [ ] Verify client-side still works (batching is transparent)

### Item 2.2: Efficient Monitoring ✅
- [ ] Implement `RingBuffer` for history
- [ ] Add sampling (fetch stats every 3rd cycle)
- [ ] Add cleanup task (remove old history)
- [ ] Monitor memory before/after (should drop 50%+)
- [ ] Document history buffer size config

### Item 2.3: Circuit Breaker ✅
- [ ] Implement `CircuitBreaker` struct
- [ ] Add timeouts to Docker API calls (30s)
- [ ] Update list operations to serve cache on circuit-open
- [ ] Test failure scenario (kill Docker daemon)
- [ ] Verify graceful degradation (returns cached data)
- [ ] Add `/api/health` endpoint

---

## 🚀 Phase 3: Advanced (Week 3-4)

### Item 3.1: Async Jobs ✅
- [ ] Create `internal/jobs/queue.go` (new file)
- [ ] Implement async `DeployCompose()` returning 202 + job ID
- [ ] Add `GET /api/jobs/{id}` progress polling
- [ ] Update Android app to poll job status
- [ ] Test with slow deploy (should not timeout)

### Item 3.2: Search & Filter ✅
- [ ] Add `?search=term` support to list endpoints
- [ ] Add `?filter.status=running` support
- [ ] Implement server-side filtering (before pagination)
- [ ] Benchmark: local vs server-side filter
- [ ] Update frontend to use server filters

---

## 🎯 Final Metrics

After all optimizations:

| Metric | Target | Actual | ✅ |
|--------|--------|--------|-----|
| API Latency (p95) | <20ms | _____ | ☐ |
| Throughput (RPS) | 200+ | _____ | ☐ |
| Memory (stable) | 24h flat | _____ | ☐ |
| Cache Hit % | 90%+ | _____ | ☐ |
| WS Msgs/min | <15 | _____ | ☐ |
| Concurrent Users | 1000 | _____ | ☐ |
| Error Rate | <0.01% | _____ | ☐ |

---

## 📚 Reference Documents

During implementation, use:
- **Code help**: [OPTIMIZATION_QUICK_START.md](OPTIMIZATION_QUICK_START.md)
- **Technical details**: [OPTIMIZATION_RECOMMENDATIONS.md](OPTIMIZATION_RECOMMENDATIONS.md)
- **Timeline**: [OPTIMIZATION_ROADMAP.md](OPTIMIZATION_ROADMAP.md)
- **Performance goals**: [PERFORMANCE_COMPARISON.md](PERFORMANCE_COMPARISON.md)

---

## 🐛 Troubleshooting

### Issue: Cache not working
- [ ] Check cache TTL is set (default 3s)
- [ ] Verify `X-Cache` header in response
- [ ] Check that write operations invalidate cache
- [ ] Look for error in invalidation logic

### Issue: Rate limiting too strict
- [ ] Increase burst from 10 to 20
- [ ] Increase limit from 100 to 200 per second
- [ ] Check if multiple IPs behind load balancer (see X-Forwarded-For)
- [ ] Add per-endpoint limits (separate from global)

### Issue: Memory still growing
- [ ] Verify ring buffer is working
- [ ] Check that old history is being removed
- [ ] Look for goroutine leaks (pprof)
- [ ] Verify context cancellation is working

### Issue: Pagination breaking clients
- [ ] Ensure backward compatibility (no limit = all items)
- [ ] Update all clients (Android, frontend) together
- [ ] Test with old clients first
- [ ] Return both paginated and total count

### Issue: Circuit breaker causes 503s
- [ ] Increase max failures threshold from 5 to 10
- [ ] Increase reset timeout from 30s to 60s
- [ ] Ensure cached data is being returned
- [ ] Check Docker daemon logs for issues

---

## 🏁 Completion Checklist

Phase 1 Complete:
- [ ] All 3 items implemented
- [ ] Load tested and validated
- [ ] Performance metrics documented
- [ ] Code reviewed and merged
- [ ] Team trained on changes
- [ ] Deployed to production
- [ ] Monitoring dashboards set up

Phase 2 Complete:
- [ ] All 3 items implemented
- [ ] Integration tested
- [ ] Performance verified
- [ ] Production stable
- [ ] Metrics improving

Phase 3 Complete:
- [ ] All 2 items implemented
- [ ] End-to-end tested
- [ ] Clients updated
- [ ] Full optimization deployed

All Phases Complete:
- [ ] 100× latency improvement achieved ✅
- [ ] 20× throughput increase ✅
- [ ] Memory stable 24/7 ✅
- [ ] Graceful degradation working ✅
- [ ] Zero-timeout deployments ✅
- [ ] System ready for scale ✅

---

**Last Updated**: 2026-02-22
**Status**: Ready for Phase 1 implementation
**Next**: Pick an engineer and start with Item 1.1 (Caching)


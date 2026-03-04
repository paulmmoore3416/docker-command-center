# Changelog

All notable changes to Docker Command Center are documented here.

---

## [2.3.0] — 2026-03-04

### Added
- **Session-based authentication** — login with username/password, secure 24-byte Bearer token issued on success
- **Role-based access control (RBAC)** — `operator` and `admin` roles with per-route enforcement
- **Admin Panel** — live user management, active session tracking, container bulk operations, system prune tools (containers/images/volumes/networks), alert threshold configuration, Docker daemon info, and audit activity feed
- **Developer Options** (admin only) — real-time feature flags, live API explorer with 50+ route listing, debug console with auto-refresh, performance profiler
- **Boot screen** — cinematic animated video on first launch (skipped on subsequent loads via localStorage flag)
- **Admin Docker module** (`internal/docker/admin.go`) — bulk container management and system-level Docker operations via admin API
- **Developer tools module** (`internal/devtools/`) — debug logging, feature flag registry, request profiler
- **Animated showcase video** added to repository and README

### Changed
- Authentication upgraded from API-key-only to session-based with roles
- Navigation filtered by role — Admin Panel and Developer Options visible to `admin` only
- All API routes enforce role permissions at the backend middleware level

---

## [2.2.0] — 2026-02-22

### Added
- **Security Page**: JSON/CSV/Print export of CVE scan results
- **Logs Page**: copy-to-clipboard, TXT/JSON export, color-coded severity badges, virtualized rendering for large log sets
- **Dashboard**: real-time CPU/Memory/Network metrics cards with area charts (5s refresh interval)
- **Networks Page**: network stats (total/bridge/overlay/connected), per-container network table

### Fixed
- Syntax errors in Docker client (`internal/docker/client.go`)
- Topology graph metrics calculation and layout stability

---

## [2.1.0] — 2026-02-10

### Added
- Drift detection engine — compares running container state against `docker-compose.yml` every 30 seconds
- Topology map with Force and Cluster layout modes, health-aware node coloring
- MCP Gateway — AI-friendly JSON-RPC interface with 12 Docker operations
- CVE security scanning via Trivy integration with hardening recommendations
- Sandboxed execution with Seccomp profiles (strict/moderate/permissive)
- Log aggregation: unified stream, real-time grep, watchword alerts, level filtering

---

## [2.0.0] — 2026-01-15

### Added
- Initial public release
- Single self-contained binary (~14 MB) with embedded React/TypeScript frontend
- Bidirectional `docker-compose.yml` sync (Ghost Mode)
- Dependency-aware container restart orchestration
- Ephemeral environment support with TTL-based auto-cleanup
- Real-time WebSocket hub for live container state
- Reverse proxy manager
- Audit trail logging
- 21-page React UI: Dashboard, Topology, Stacks, Containers, Networks, Volumes, Environments, Compose Files, Visual Builder, Templates, Proxy Manager, Drift Detection, Security, Logs, Stack Logs, Updates, Settings, Admin Panel, Developer Options, and more

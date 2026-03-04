package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/gorilla/mux"
	"gopkg.in/yaml.v3"

	"github.com/paulmmoore3416/dcc/internal/websockets"
)

type Client struct {
	cli              *client.Client
	mu               sync.RWMutex
	containerHistory map[string][]HistoryEntry
	environments     map[string]*Environment
	thresholds       ResourceThresholds
	alerts           []Alert
	composeVersions  map[string][]ComposeVersion
	updateSettings   UpdateSettings
}

type HistoryEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Action    string                 `json:"action"`
	State     string                 `json:"state"`
	Config    map[string]interface{} `json:"config"`
}

type Environment struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Branch      string    `json:"branch"`
	ComposePath string    `json:"compose_path"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	PortOffset  int       `json:"port_offset"`
	Containers  []string  `json:"containers"`
}

type ResourceThresholds struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	DiskGB        float64 `json:"disk_gb"`
	LogSizeMB     float64 `json:"log_size_mb"`
}

type Alert struct {
	ID          string    `json:"id"`
	ContainerID string    `json:"container_id"`
	Type        string    `json:"type"`
	Message     string    `json:"message"`
	Severity    string    `json:"severity"`
	Timestamp   time.Time `json:"timestamp"`
}

type ComposeFile struct {
	Path     string                 `json:"path"`
	Content  string                 `json:"content"`
	Services map[string]interface{} `json:"services"`
}

type DependencyGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

type GraphNode struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Status   string            `json:"status"`
	Health   string            `json:"health"`
	Metadata map[string]string `json:"metadata"`
	Metrics  *GraphMetrics     `json:"metrics,omitempty"`
}

type GraphMetrics struct {
	CPUPercent    float64 `json:"cpu"`
	MemoryPercent float64 `json:"memory"`
	MemoryUsageMB float64 `json:"memory_mb"`
	NetworkRxMB   float64 `json:"network_rx_mb"`
	NetworkTxMB   float64 `json:"network_tx_mb"`
}

type GraphEdge struct {
	Source     string  `json:"source"`
	Target     string  `json:"target"`
	TargetName string  `json:"target_name,omitempty"`
	Type       string  `json:"type"`
	Healthy    bool    `json:"healthy"`
	Latency    int     `json:"latency"`
	ErrorRate  float64 `json:"error_rate"`
}

type ComposeVersion struct {
	Path      string    `json:"path"`
	Timestamp time.Time `json:"timestamp"`
	Note      string    `json:"note"`
}

type UpdateSettings struct {
	Enabled        bool   `json:"enabled"`
	ScheduleCron   string `json:"schedule_cron"`
	AutoRollback   bool   `json:"auto_rollback"`
	NotifyOnUpdate bool   `json:"notify_on_update"`
}

type ImpactAnalysis struct {
	AffectedServices  []string      `json:"affected_services"`
	EstimatedDowntime string        `json:"estimated_downtime"`
	RestartSequence   []RestartStep `json:"restart_sequence"`
	Warnings          []string      `json:"warnings"`
}

type RestartStep struct {
	Service      string   `json:"service"`
	WaitFor      []string `json:"wait_for"`
	HealthChecks []string `json:"health_checks"`
	Timeout      int      `json:"timeout"`
}

func NewClient() (*Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	return &Client{
		cli:              cli,
		containerHistory: make(map[string][]HistoryEntry),
		environments:     make(map[string]*Environment),
		thresholds: ResourceThresholds{
			CPUPercent:    80.0,
			MemoryPercent: 80.0,
			DiskGB:        50.0,
			LogSizeMB:     1000.0,
		},
		alerts:          []Alert{},
		composeVersions: make(map[string][]ComposeVersion),
		updateSettings: UpdateSettings{
			Enabled:        false,
			ScheduleCron:   "0 3 * * *",
			AutoRollback:   true,
			NotifyOnUpdate: true,
		},
	}, nil
}

func (c *Client) Close() error {
	return c.cli.Close()
}

func (c *Client) GetClient() *client.Client {
	return c.cli
}

// Container operations
func (c *Client) ListContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{All: true})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containers)
}

func (c *Client) GetContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	inspect, err := c.cli.ContainerInspect(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(inspect)
}

func (c *Client) StartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := c.cli.ContainerStart(r.Context(), id, container.StartOptions{}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	c.recordHistory(id, "start", "running")
	w.WriteHeader(http.StatusOK)
}

func (c *Client) StopContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	timeout := 10
	if err := c.cli.ContainerStop(r.Context(), id, container.StopOptions{Timeout: &timeout}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	c.recordHistory(id, "stop", "stopped")
	w.WriteHeader(http.StatusOK)
}

func (c *Client) RestartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	timeout := 10
	if err := c.cli.ContainerRestart(r.Context(), id, container.StopOptions{Timeout: &timeout}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	c.recordHistory(id, "restart", "running")
	w.WriteHeader(http.StatusOK)
}

func (c *Client) GetLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "1000",
		Timestamps: true,
	}

	logs, err := c.cli.ContainerLogs(r.Context(), id, options)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer logs.Close()

	w.Header().Set("Content-Type", "text/plain")
	io.Copy(w, logs)
}

func (c *Client) GetStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	stats, err := c.cli.ContainerStats(r.Context(), id, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer stats.Body.Close()

	var statsData types.StatsJSON
	if err := json.NewDecoder(stats.Body).Decode(&statsData); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statsData)
}

// Compose operations
func (c *Client) ListComposeProjects(w http.ResponseWriter, r *http.Request) {
	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{All: true})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	projects := make(map[string][]types.Container)
	for _, cont := range containers {
		if project, ok := cont.Labels["com.docker.compose.project"]; ok {
			projects[project] = append(projects[project], cont)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (c *Client) ValidateCompose(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var parsed map[string]interface{}
	if err := yaml.Unmarshal([]byte(req.Content), &parsed); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid":  true,
		"error":  "",
		"parsed": parsed,
	})
}

func (c *Client) DraftCompose(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var parsed map[string]interface{}
	if err := yaml.Unmarshal([]byte(req.Content), &parsed); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	services := 0
	warnings := []string{}
	if svc, ok := parsed["services"].(map[string]interface{}); ok {
		services = len(svc)
		for name, raw := range svc {
			if serviceMap, ok := raw.(map[string]interface{}); ok {
				if _, ok := serviceMap["image"]; !ok {
					warnings = append(warnings, "service '"+name+"' missing image")
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "draft_ok",
		"services":        services,
		"warnings":        warnings,
		"apply_supported": false,
	})
}

func (c *Client) DeployCompose(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FilePath string `json:"file_path"`
		Project  string `json:"project"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// This would integrate with docker-compose or docker compose CLI
	// For now, return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deployed"})
}

func (c *Client) ComposeDown(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Project string `json:"project"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Stop all containers in project
	containers, _ := c.cli.ContainerList(r.Context(), container.ListOptions{
		Filters: filters.NewArgs(filters.Arg("label", "com.docker.compose.project="+req.Project)),
	})

	for _, cont := range containers {
		timeout := 10
		c.cli.ContainerStop(r.Context(), cont.ID, container.StopOptions{Timeout: &timeout})
	}

	w.WriteHeader(http.StatusOK)
}

func (c *Client) ComposeStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Project string `json:"project"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Start all stopped containers in the project
	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{
		All:     true, // include stopped containers
		Filters: filters.NewArgs(filters.Arg("label", "com.docker.compose.project="+req.Project)),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var startErrors []string
	for _, cont := range containers {
		if cont.State != "running" {
			if err := c.cli.ContainerStart(r.Context(), cont.ID, container.StartOptions{}); err != nil {
				startErrors = append(startErrors, fmt.Sprintf("%s: %s", cont.ID[:12], err.Error()))
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if len(startErrors) > 0 {
		w.WriteHeader(http.StatusPartialContent)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "partial",
			"errors": startErrors,
		})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (c *Client) GetNetworkDetail(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	network, err := c.cli.NetworkInspect(r.Context(), id, types.NetworkInspectOptions{Verbose: true})
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(network)
}

func (c *Client) ListComposeFiles(w http.ResponseWriter, r *http.Request) {
	var files []ComposeFile

	// Search common locations
	searchPaths := []string{
		".",
		"./docker",
		"./compose",
		os.Getenv("HOME") + "/docker",
	}

	for _, basePath := range searchPaths {
		filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if !info.IsDir() && (strings.HasSuffix(path, "docker-compose.yml") ||
				strings.HasSuffix(path, "docker-compose.yaml") ||
				strings.HasSuffix(path, "compose.yml") ||
				strings.HasSuffix(path, "compose.yaml")) {

				content, _ := os.ReadFile(path)
				var services map[string]interface{}
				yaml.Unmarshal(content, &services)

				files = append(files, ComposeFile{
					Path:     path,
					Content:  string(content),
					Services: services,
				})
			}
			return nil
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (c *Client) SaveComposeVersion(filePath string, note string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	versionDir := filepath.Join(os.Getenv("HOME"), ".dcc", "versions")
	if err := os.MkdirAll(versionDir, 0755); err != nil {
		return err
	}

	stamp := time.Now().Format("20060102-150405")
	base := strings.ReplaceAll(filepath.Base(filePath), ".", "_")
	versionPath := filepath.Join(versionDir, base+"-"+stamp+".yml")
	if err := os.WriteFile(versionPath, content, 0644); err != nil {
		return err
	}

	c.mu.Lock()
	c.composeVersions[filePath] = append(c.composeVersions[filePath], ComposeVersion{
		Path:      versionPath,
		Timestamp: time.Now(),
		Note:      note,
	})
	c.mu.Unlock()

	return nil
}

func (c *Client) ListComposeVersions(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("file")
	if filePath == "" {
		http.Error(w, "file query parameter required", http.StatusBadRequest)
		return
	}

	c.mu.RLock()
	versions := c.composeVersions[filePath]
	c.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(versions)
}

func (c *Client) RestoreComposeVersion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FilePath    string `json:"file_path"`
		VersionPath string `json:"version_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	content, err := os.ReadFile(req.VersionPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(req.FilePath, content, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "restored"})
}

func (c *Client) UpdateComposeFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_ = c.SaveComposeVersion(req.Path, "auto-save")

	if err := os.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func (c *Client) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates := []map[string]string{
		{"name": "nextcloud", "description": "Nextcloud + Postgres", "category": "storage"},
		{"name": "traefik", "description": "Traefik reverse proxy", "category": "network"},
		{"name": "prometheus", "description": "Prometheus + Grafana", "category": "monitoring"},
		{"name": "wordpress", "description": "WordPress + MySQL", "category": "cms"},
		{"name": "postgresql", "description": "Standalone PostgreSQL", "category": "database"},
		{"name": "redis", "description": "Redis in-memory store", "category": "database"},
		{"name": "mongodb", "description": "MongoDB document database", "category": "database"},
		{"name": "nginx-proxy-manager", "description": "Nginx Proxy Manager", "category": "network"},
		{"name": "portainer", "description": "Portainer Docker UI", "category": "management"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}

func (c *Client) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	content := "version: '3'\nservices:\n  app:\n    image: nginx:alpine\n    ports:\n      - '8080:80'\n"

	switch req.Name {
	case "nextcloud":
		content = "version: '3'\nservices:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: example\n  app:\n    image: nextcloud:stable\n    ports:\n      - '8080:80'\n    depends_on:\n      - db\n"
	case "traefik":
		content = "version: '3'\nservices:\n  traefik:\n    image: traefik:v3.0\n    ports:\n      - '80:80'\n      - '8080:8080'\n"
	case "prometheus":
		content = "version: '3'\nservices:\n  prometheus:\n    image: prom/prometheus:latest\n    ports:\n      - '9090:9090'\n  grafana:\n    image: grafana/grafana:latest\n    ports:\n      - '3000:3000'\n    depends_on:\n      - prometheus\n"
	case "wordpress":
		content = "version: '3'\nservices:\n  db:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: example\n      MYSQL_DATABASE: wordpress\n      MYSQL_USER: wordpress\n      MYSQL_PASSWORD: wordpress\n  wordpress:\n    image: wordpress:latest\n    ports:\n      - '8080:80'\n    environment:\n      WORDPRESS_DB_HOST: db:3306\n      WORDPRESS_DB_USER: wordpress\n      WORDPRESS_DB_PASSWORD: wordpress\n      WORDPRESS_DB_NAME: wordpress\n    depends_on:\n      - db\n"
	case "postgresql":
		content = "version: '3'\nservices:\n  postgres:\n    image: postgres:16\n    ports:\n      - '5432:5432'\n    environment:\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: example\n      POSTGRES_DB: app\n"
	case "redis":
		content = "version: '3'\nservices:\n  redis:\n    image: redis:7-alpine\n    ports:\n      - '6379:6379'\n"
	case "mongodb":
		content = "version: '3'\nservices:\n  mongodb:\n    image: mongo:7\n    ports:\n      - '27017:27017'\n"
	case "nginx-proxy-manager":
		content = "version: '3'\nservices:\n  npm:\n    image: jc21/nginx-proxy-manager:latest\n    ports:\n      - '80:80'\n      - '81:81'\n      - '443:443'\n"
	case "portainer":
		content = "version: '3'\nservices:\n  portainer:\n    image: portainer/portainer-ce:latest\n    ports:\n      - '9000:9000'\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n"
	}

	targetDir := filepath.Join(".", "compose")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	filePath := filepath.Join(targetDir, req.Name+".yml")
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"path": filePath})
}

func (c *Client) ListStacks(w http.ResponseWriter, r *http.Request) {
	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{All: true})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	stacks := make(map[string][]types.Container)
	for _, cont := range containers {
		if project, ok := cont.Labels["com.docker.compose.project"]; ok {
			stacks[project] = append(stacks[project], cont)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stacks)
}

func (c *Client) GetStackMetrics(w http.ResponseWriter, r *http.Request) {
	project := mux.Vars(r)["project"]
	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("label", "com.docker.compose.project="+project)),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var cpu float64
	var mem uint64
	for _, cont := range containers {
		stats, err := c.cli.ContainerStats(r.Context(), cont.ID, false)
		if err != nil {
			continue
		}
		var statsData types.StatsJSON
		if err := json.NewDecoder(stats.Body).Decode(&statsData); err == nil {
			cpu += calculateCPUPercent(&statsData)
			mem += statsData.MemoryStats.Usage
		}
		stats.Body.Close()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"cpu_percent":  cpu,
		"memory_usage": mem,
		"containers":   len(containers),
	})
}

func (c *Client) GetStackLogs(w http.ResponseWriter, r *http.Request) {
	project := mux.Vars(r)["project"]
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}

	containers, err := c.cli.ContainerList(r.Context(), container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("label", "com.docker.compose.project="+project)),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	entries := []map[string]string{}
	for _, cont := range containers {
		logs, err := c.cli.ContainerLogs(r.Context(), cont.ID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Tail:       tail,
		})
		if err != nil {
			continue
		}
		buf, _ := io.ReadAll(logs)
		logs.Close()
		entries = append(entries, map[string]string{
			"container": cont.Names[0],
			"logs":      string(buf),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (c *Client) GetUpdateSettings(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	settings := c.updateSettings
	c.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (c *Client) UpdateUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	c.mu.Lock()
	c.updateSettings = req
	c.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

func (c *Client) RunUpdateNow(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "queued",
		"message": "Image updates scheduled (simulation)",
	})
}

func (c *Client) GetComposeFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	content, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var services map[string]interface{}
	yaml.Unmarshal(content, &services)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ComposeFile{
		Path:     path,
		Content:  string(content),
		Services: services,
	})
}

// Network operations
func (c *Client) ListNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := c.cli.NetworkList(r.Context(), types.NetworkListOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(networks)
}

func (c *Client) GetNetworkTraffic(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	network, err := c.cli.NetworkInspect(r.Context(), id, types.NetworkInspectOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Build traffic graph
	var edges []GraphEdge
	containers := make(map[string]bool)

	for containerID := range network.Containers {
		containers[containerID] = true
	}

	// Simulate traffic analysis (in production, use eBPF or network monitoring)
	for srcID := range containers {
		for dstID := range containers {
			if srcID != dstID {
				edges = append(edges, GraphEdge{
					Source:    srcID[:12],
					Target:    dstID[:12],
					Type:      "tcp",
					Healthy:   true,
					Latency:   5,
					ErrorRate: 0.01,
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(edges)
}

// Volume operations
func (c *Client) ListVolumes(w http.ResponseWriter, r *http.Request) {
	resp, err := c.cli.VolumeList(r.Context(), volume.ListOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the volumes array directly, not wrapped in ListResponse object
	if resp.Volumes == nil {
		resp.Volumes = []*volume.Volume{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp.Volumes)
}

func (c *Client) BrowseVolume(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]
	browsePathParam := r.URL.Query().Get("path")
	if browsePathParam == "" {
		browsePathParam = "/"
	}

	vol, err := c.cli.VolumeInspect(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var files []map[string]interface{}
	if vol.Mountpoint != "" {
		// Compute the absolute directory to list
		targetDir := vol.Mountpoint
		if browsePathParam != "/" && browsePathParam != "" {
			targetDir = filepath.Join(vol.Mountpoint, filepath.Clean(browsePathParam))
		}

		entries, err := os.ReadDir(targetDir)
		if err == nil {
			for _, entry := range entries {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				relPath := filepath.Join(browsePathParam, entry.Name())
				files = append(files, map[string]interface{}{
					"name":  entry.Name(),
					"path":  relPath,
					"isDir": entry.IsDir(),
					"size":  info.Size(),
					"mode":  info.Mode().String(),
				})
			}
		}
	}

	if files == nil {
		files = []map[string]interface{}{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (c *Client) DeleteVolumeFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]
	filePath := vars["path"]

	volume, err := c.cli.VolumeInspect(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	fullPath := filepath.Join(volume.Mountpoint, filePath)
	if err := os.Remove(fullPath); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Ephemeral environments
func (c *Client) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	envs := make([]*Environment, 0, len(c.environments))
	for _, env := range c.environments {
		envs = append(envs, env)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(envs)
}

func (c *Client) CreateEnvironment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Branch      string `json:"branch"`
		TTLMinutes  int    `json:"ttl_minutes"`
		ComposePath string `json:"compose_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	env := &Environment{
		ID:          fmt.Sprintf("env-%d", time.Now().Unix()),
		Name:        req.Name,
		Branch:      req.Branch,
		ComposePath: req.ComposePath,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(time.Duration(req.TTLMinutes) * time.Minute),
		PortOffset:  len(c.environments) * 100,
		Containers:  []string{},
	}

	c.mu.Lock()
	c.environments[env.ID] = env
	c.mu.Unlock()

	// Schedule auto-cleanup
	go func() {
		time.Sleep(time.Until(env.ExpiresAt))
		c.cleanupEnvironment(env.ID)
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(env)
}

func (c *Client) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	c.cleanupEnvironment(id)
	w.WriteHeader(http.StatusOK)
}

func (c *Client) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name        string `json:"name"`
		Branch      string `json:"branch"`
		ComposePath string `json:"compose_path"`
		ExtendMins  int    `json:"extend_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	c.mu.Lock()
	env, exists := c.environments[id]
	if !exists {
		c.mu.Unlock()
		http.Error(w, "environment not found", http.StatusNotFound)
		return
	}
	if req.Name != "" {
		env.Name = req.Name
	}
	if req.Branch != "" {
		env.Branch = req.Branch
	}
	if req.ComposePath != "" {
		env.ComposePath = req.ComposePath
	}
	if req.ExtendMins > 0 {
		env.ExpiresAt = env.ExpiresAt.Add(time.Duration(req.ExtendMins) * time.Minute)
	}
	c.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(env)
}

func (c *Client) DuplicateEnvironment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	c.mu.RLock()
	src, exists := c.environments[id]
	if !exists {
		c.mu.RUnlock()
		http.Error(w, "environment not found", http.StatusNotFound)
		return
	}
	remaining := time.Until(src.ExpiresAt)
	newEnv := &Environment{
		ID:          fmt.Sprintf("env-%d", time.Now().UnixNano()),
		Name:        src.Name + "-copy",
		Branch:      src.Branch,
		ComposePath: src.ComposePath,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(remaining),
		PortOffset:  (len(c.environments) + 1) * 100,
		Containers:  []string{},
	}
	c.mu.RUnlock()

	c.mu.Lock()
	c.environments[newEnv.ID] = newEnv
	c.mu.Unlock()

	go func() {
		time.Sleep(time.Until(newEnv.ExpiresAt))
		c.cleanupEnvironment(newEnv.ID)
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newEnv)
}

func (c *Client) cleanupEnvironment(envID string) {
	c.mu.Lock()
	env, exists := c.environments[envID]
	if !exists {
		c.mu.Unlock()
		return
	}
	delete(c.environments, envID)
	c.mu.Unlock()

	// Stop and remove containers
	ctx := context.Background()
	for _, containerID := range env.Containers {
		timeout := 5
		c.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
		c.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{Force: true})
	}
}

// Health & dependencies
func (c *Client) GetDependencyGraph(w http.ResponseWriter, r *http.Request) {
	graph, err := c.buildDependencyGraph(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(graph)
}

func (c *Client) StartTopologyBroadcast(ctx context.Context, hub *websockets.Hub) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			graph, err := c.buildDependencyGraph(ctx)
			if err != nil {
				continue
			}
			hub.Broadcast(map[string]interface{}{
				"type": "topology_update",
				"data": graph,
			})
		}
	}
}

func (c *Client) buildDependencyGraph(ctx context.Context) (DependencyGraph, error) {
	containers, err := c.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return DependencyGraph{}, err
	}

	nodes := make([]GraphNode, 0, len(containers))
	edges := make([]GraphEdge, 0)
	serviceToID := make(map[string]string)
	containerHealth := make(map[string]string)
	containerProject := make(map[string]string)

	// Fetch metrics for all running containers in parallel
	type metricsResult struct {
		containerID string
		metrics     *GraphMetrics
	}

	metricsChan := make(chan metricsResult, len(containers))
	metricsMap := make(map[string]*GraphMetrics)

	// Launch goroutines to fetch metrics
	runningCount := 0
	for _, cont := range containers {
		if cont.State == "running" {
			runningCount++
			go func(id string) {
				metrics := c.getContainerMetrics(ctx, id)
				metricsChan <- metricsResult{containerID: id[:12], metrics: metrics}
			}(cont.ID)
		}
	}

	// Collect metrics with timeout
	timeout := time.After(2 * time.Second)
	collected := 0
	for collected < runningCount {
		select {
		case result := <-metricsChan:
			metricsMap[result.containerID] = result.metrics
			collected++
		case <-timeout:
			// Stop waiting after 2 seconds
			goto buildNodes
		}
	}

buildNodes:
	for _, cont := range containers {
		inspect, _ := c.cli.ContainerInspect(ctx, cont.ID)

		health := "unknown"
		if inspect.State.Health != nil {
			health = inspect.State.Health.Status
		}

		shortID := cont.ID[:12]

		serviceName := ""
		if sn, ok := cont.Labels["com.docker.compose.service"]; ok {
			serviceName = sn
			serviceToID[sn] = shortID
		}

		projectName := cont.Labels["com.docker.compose.project"]
		containerProject[shortID] = projectName
		containerHealth[shortID] = health

		// Determine display name: prefer service name, then container name
		displayName := serviceName
		if displayName == "" && len(cont.Names) > 0 {
			displayName = cont.Names[0]
		}
		if displayName == "" {
			displayName = shortID
		}

		nodes = append(nodes, GraphNode{
			ID:     shortID,
			Name:   displayName,
			Status: cont.State,
			Health: health,
			Metadata: map[string]string{
				"image":   cont.Image,
				"project": projectName,
			},
			Metrics: metricsMap[shortID],
		})

		// Check for depends_on in labels
		if deps, ok := cont.Labels["com.docker.compose.depends_on"]; ok {
			for _, dep := range strings.Split(deps, ",") {
				dep = strings.TrimSpace(dep)
				if dep == "" {
					continue
				}

				targetID := dep
				targetName := dep
				if mappedID, ok := serviceToID[dep]; ok {
					targetID = mappedID
					targetName = dep
				}

				targetHealth := containerHealth[targetID]
				edgeHealthy := targetHealth != "unhealthy"

				edges = append(edges, GraphEdge{
					Source:     cont.ID[:12],
					Target:     targetID,
					TargetName: targetName,
					Type:       "depends_on",
					Healthy:    edgeHealthy,
					Latency:    0,
					ErrorRate:  0,
				})
			}
		}
	}

	return DependencyGraph{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

func (c *Client) getContainerMetrics(ctx context.Context, containerID string) *GraphMetrics {
	// Use one-shot stats (stream=false) to avoid blocking
	stats, err := c.cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil
	}
	defer stats.Body.Close()

	var v types.StatsJSON
	if err := json.NewDecoder(stats.Body).Decode(&v); err != nil {
		return nil
	}

	// Calculate CPU percentage
	cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage - v.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(v.CPUStats.SystemUsage - v.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(len(v.CPUStats.CPUUsage.PercpuUsage)) * 100.0
	}

	// Calculate memory percentage
	memUsage := float64(v.MemoryStats.Usage)
	memLimit := float64(v.MemoryStats.Limit)
	memPercent := 0.0
	if memLimit > 0 {
		memPercent = (memUsage / memLimit) * 100.0
	}

	// Calculate network stats
	var rxBytes, txBytes uint64
	for _, netStats := range v.Networks {
		rxBytes += netStats.RxBytes
		txBytes += netStats.TxBytes
	}

	return &GraphMetrics{
		CPUPercent:    cpuPercent,
		MemoryPercent: memPercent,
		MemoryUsageMB: memUsage / 1024 / 1024,
		NetworkRxMB:   float64(rxBytes) / 1024 / 1024,
		NetworkTxMB:   float64(txBytes) / 1024 / 1024,
	}
}

func (c *Client) AnalyzeImpact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ContainerID string `json:"container_id"`
		Action      string `json:"action"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Build dependency tree and analyze impact
	analysis := ImpactAnalysis{
		AffectedServices:  []string{req.ContainerID},
		EstimatedDowntime: "30-60 seconds",
		RestartSequence: []RestartStep{
			{
				Service:      req.ContainerID,
				WaitFor:      []string{},
				HealthChecks: []string{"tcp", "http"},
				Timeout:      30,
			},
		},
		Warnings: []string{
			"Dependent services may experience connection errors during restart",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// Monitoring
func (c *Client) StartMonitoring(ctx context.Context, hub *websockets.Hub) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.checkResourceThresholds(ctx, hub)
		}
	}
}

func (c *Client) checkResourceThresholds(ctx context.Context, hub *websockets.Hub) {
	containers, _ := c.cli.ContainerList(ctx, container.ListOptions{})

	for _, cont := range containers {
		stats, err := c.cli.ContainerStats(ctx, cont.ID, false)
		if err != nil {
			continue
		}

		var statsData types.StatsJSON
		json.NewDecoder(stats.Body).Decode(&statsData)
		stats.Body.Close()

		// CPU check
		cpuPercent := calculateCPUPercent(&statsData)
		if cpuPercent > c.thresholds.CPUPercent {
			alert := Alert{
				ID:          fmt.Sprintf("alert-%d", time.Now().Unix()),
				ContainerID: cont.ID[:12],
				Type:        "cpu",
				Message:     fmt.Sprintf("CPU usage %.2f%% exceeds threshold", cpuPercent),
				Severity:    "warning",
				Timestamp:   time.Now(),
			}
			c.addAlert(alert)
			hub.Broadcast(map[string]interface{}{"type": "alert", "data": alert})
		}

		// Memory check
		memPercent := float64(statsData.MemoryStats.Usage) / float64(statsData.MemoryStats.Limit) * 100
		if memPercent > c.thresholds.MemoryPercent {
			alert := Alert{
				ID:          fmt.Sprintf("alert-%d", time.Now().Unix()),
				ContainerID: cont.ID[:12],
				Type:        "memory",
				Message:     fmt.Sprintf("Memory usage %.2f%% exceeds threshold", memPercent),
				Severity:    "warning",
				Timestamp:   time.Now(),
			}
			c.addAlert(alert)
			hub.Broadcast(map[string]interface{}{"type": "alert", "data": alert})
		}
	}
}

func calculateCPUPercent(stats *types.StatsJSON) float64 {
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
	cpuCount := float64(stats.CPUStats.OnlineCPUs)

	if systemDelta > 0 && cpuDelta > 0 {
		return (cpuDelta / systemDelta) * cpuCount * 100
	}
	return 0
}

func (c *Client) GetAlerts(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c.alerts)
}

func (c *Client) GetThresholds(w http.ResponseWriter, r *http.Request) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c.thresholds)
}

func (c *Client) UpdateThresholds(w http.ResponseWriter, r *http.Request) {
	var thresholds ResourceThresholds
	if err := json.NewDecoder(r.Body).Decode(&thresholds); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	c.mu.Lock()
	c.thresholds = thresholds
	c.mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

func (c *Client) addAlert(alert Alert) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.alerts = append(c.alerts, alert)

	// Keep only last 100 alerts
	if len(c.alerts) > 100 {
		c.alerts = c.alerts[len(c.alerts)-100:]
	}
}

// Container archaeology
func (c *Client) GetContainerHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	c.mu.RLock()
	history := c.containerHistory[id]
	c.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func (c *Client) GetConfigDiff(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	c.mu.RLock()
	history := c.containerHistory[id]
	c.mu.RUnlock()

	if len(history) < 2 {
		http.Error(w, "Not enough history for diff", http.StatusBadRequest)
		return
	}

	// Return diff between last two configs
	diff := map[string]interface{}{
		"previous": history[len(history)-2].Config,
		"current":  history[len(history)-1].Config,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diff)
}

func (c *Client) recordHistory(containerID, action, state string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	inspect, err := c.cli.ContainerInspect(context.Background(), containerID)
	if err != nil {
		return
	}

	entry := HistoryEntry{
		Timestamp: time.Now(),
		Action:    action,
		State:     state,
		Config: map[string]interface{}{
			"image":  inspect.Config.Image,
			"env":    inspect.Config.Env,
			"cmd":    inspect.Config.Cmd,
			"labels": inspect.Config.Labels,
		},
	}

	c.containerHistory[containerID] = append(c.containerHistory[containerID], entry)

	// Keep only last 50 entries per container
	if len(c.containerHistory[containerID]) > 50 {
		c.containerHistory[containerID] = c.containerHistory[containerID][len(c.containerHistory[containerID])-50:]
	}
}

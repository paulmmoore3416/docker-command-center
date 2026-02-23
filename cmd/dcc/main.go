package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"

	"github.com/paulmmoore3416/dcc/internal/audit"
	"github.com/paulmmoore3416/dcc/internal/auth"
	"github.com/paulmmoore3416/dcc/internal/docker"
	"github.com/paulmmoore3416/dcc/internal/drift"
	"github.com/paulmmoore3416/dcc/internal/filewatch"
	"github.com/paulmmoore3416/dcc/internal/logs"
	"github.com/paulmmoore3416/dcc/internal/mcp"
	"github.com/paulmmoore3416/dcc/internal/proxy"
	"github.com/paulmmoore3416/dcc/internal/sandbox"
	"github.com/paulmmoore3416/dcc/internal/security"
	"github.com/paulmmoore3416/dcc/internal/websockets"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func main() {
	log.Println("🚀 Docker Command Center starting...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Docker client
	dockerClient, err := docker.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}
	defer dockerClient.Close()

	// Initialize WebSocket hub
	hub := websockets.NewHub()
	go hub.Run()

	// Initialize file watcher
	watcher := filewatch.NewWatcher(hub)
	go watcher.Start(ctx)

	// Initialize proxy manager
	proxyMgr := proxy.NewManager()
	go proxyMgr.Start(ctx)

	// Initialize drift detector
	driftDetector := drift.NewDriftDetector(dockerClient.GetClient(), hub)
	go driftDetector.StartMonitoring(ctx)

	// Initialize security scanner
	securityScanner := security.NewSecurityScanner(dockerClient.GetClient(), hub)

	// Initialize sandbox manager
	sandboxMgr := sandbox.NewSandboxManager(dockerClient.GetClient())

	// Initialize MCP gateway
	mcpGateway := mcp.NewMCPGateway(dockerClient.GetClient())

	// Initialize log aggregator
	logAggregator := logs.NewLogAggregator(dockerClient.GetClient(), hub)
	go logAggregator.StartAggregation(ctx)

	// Initialize monitoring
	go dockerClient.StartMonitoring(ctx, hub)
	go dockerClient.StartTopologyBroadcast(ctx, hub)

	// Initialize audit logger and auth configuration
	auditLogger := audit.NewLogger("/tmp/dcc-audit.log")
	authCfg := auth.Config{APIKey: os.Getenv("DCC_API_KEY")}

	// Setup HTTP router
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	secured := func(permission auth.Permission, action string, handler http.HandlerFunc) http.HandlerFunc {
		wrapped := auth.Middleware(authCfg, permission, http.HandlerFunc(handler))
		return func(w http.ResponseWriter, r *http.Request) {
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			wrapped.ServeHTTP(recorder, r)
			auditLogger.Log(audit.Event{
				Timestamp: time.Now(),
				User:      auth.UserFromContext(r.Context()),
				Role:      auth.RoleFromContext(r.Context()),
				Action:    action,
				Method:    r.Method,
				Path:      r.URL.Path,
				Status:    recorder.status,
			})
		}
	}
	
	// Container operations
	api.HandleFunc("/containers", secured(auth.PermRead, "containers.list", dockerClient.ListContainers)).Methods("GET")
	api.HandleFunc("/containers/{id}", secured(auth.PermRead, "containers.get", dockerClient.GetContainer)).Methods("GET")
	api.HandleFunc("/containers/{id}/start", secured(auth.PermWrite, "containers.start", dockerClient.StartContainer)).Methods("POST")
	api.HandleFunc("/containers/{id}/stop", secured(auth.PermWrite, "containers.stop", dockerClient.StopContainer)).Methods("POST")
	api.HandleFunc("/containers/{id}/restart", secured(auth.PermWrite, "containers.restart", dockerClient.RestartContainer)).Methods("POST")
	api.HandleFunc("/containers/{id}/logs", secured(auth.PermRead, "containers.logs", dockerClient.GetLogs)).Methods("GET")
	api.HandleFunc("/containers/{id}/stats", secured(auth.PermRead, "containers.stats", dockerClient.GetStats)).Methods("GET")
	
	// Compose operations
	api.HandleFunc("/compose/projects", secured(auth.PermRead, "compose.projects", dockerClient.ListComposeProjects)).Methods("GET")
	api.HandleFunc("/compose/deploy", secured(auth.PermWrite, "compose.deploy", dockerClient.DeployCompose)).Methods("POST")
	api.HandleFunc("/compose/down", secured(auth.PermWrite, "compose.down", dockerClient.ComposeDown)).Methods("POST")
	api.HandleFunc("/compose/start", secured(auth.PermWrite, "compose.start", dockerClient.ComposeStart)).Methods("POST")
	api.HandleFunc("/compose/files", secured(auth.PermRead, "compose.files", dockerClient.ListComposeFiles)).Methods("GET")
	api.HandleFunc("/compose/file", secured(auth.PermRead, "compose.file.get", dockerClient.GetComposeFile)).Methods("GET")
	api.HandleFunc("/compose/file", secured(auth.PermWrite, "compose.file.update", dockerClient.UpdateComposeFile)).Methods("PUT")
	api.HandleFunc("/compose/validate", secured(auth.PermRead, "compose.validate", dockerClient.ValidateCompose)).Methods("POST")
	api.HandleFunc("/compose/draft", secured(auth.PermRead, "compose.draft", dockerClient.DraftCompose)).Methods("POST")
	api.HandleFunc("/compose/versions", secured(auth.PermRead, "compose.versions", dockerClient.ListComposeVersions)).Methods("GET")
	api.HandleFunc("/compose/restore", secured(auth.PermWrite, "compose.restore", dockerClient.RestoreComposeVersion)).Methods("POST")

	// Network operations
	api.HandleFunc("/networks", secured(auth.PermRead, "networks.list", dockerClient.ListNetworks)).Methods("GET")
	api.HandleFunc("/networks/{id}", secured(auth.PermRead, "networks.detail", dockerClient.GetNetworkDetail)).Methods("GET")
	api.HandleFunc("/networks/{id}/traffic", secured(auth.PermRead, "networks.traffic", dockerClient.GetNetworkTraffic)).Methods("GET")
	
	// Volume operations
	api.HandleFunc("/volumes", secured(auth.PermRead, "volumes.list", dockerClient.ListVolumes)).Methods("GET")
	api.HandleFunc("/volumes/{name}/browse", secured(auth.PermRead, "volumes.browse", dockerClient.BrowseVolume)).Methods("GET")
	api.HandleFunc("/volumes/{name}/files/{path:.*}", secured(auth.PermWrite, "volumes.file.delete", dockerClient.DeleteVolumeFile)).Methods("DELETE")
	
	// Ephemeral environments
	api.HandleFunc("/environments", secured(auth.PermRead, "env.list", dockerClient.ListEnvironments)).Methods("GET")
	api.HandleFunc("/environments", secured(auth.PermWrite, "env.create", dockerClient.CreateEnvironment)).Methods("POST")
	api.HandleFunc("/environments/{id}", secured(auth.PermWrite, "env.delete", dockerClient.DeleteEnvironment)).Methods("DELETE")
	
	// Health & dependencies
	api.HandleFunc("/health/graph", secured(auth.PermRead, "health.graph", dockerClient.GetDependencyGraph)).Methods("GET")
	api.HandleFunc("/health/impact", secured(auth.PermWrite, "health.impact", dockerClient.AnalyzeImpact)).Methods("POST")
	
	// Proxy management
	api.HandleFunc("/proxy/routes", secured(auth.PermRead, "proxy.list", proxyMgr.ListRoutes)).Methods("GET")
	api.HandleFunc("/proxy/routes", secured(auth.PermWrite, "proxy.add", proxyMgr.AddRoute)).Methods("POST")
	api.HandleFunc("/proxy/routes/{id}", secured(auth.PermWrite, "proxy.delete", proxyMgr.DeleteRoute)).Methods("DELETE")

	// Templates
	api.HandleFunc("/templates", secured(auth.PermRead, "templates.list", dockerClient.ListTemplates)).Methods("GET")
	api.HandleFunc("/templates/create", secured(auth.PermWrite, "templates.create", dockerClient.CreateTemplate)).Methods("POST")

	// Stacks
	api.HandleFunc("/stacks", secured(auth.PermRead, "stacks.list", dockerClient.ListStacks)).Methods("GET")
	api.HandleFunc("/stacks/{project}/metrics", secured(auth.PermRead, "stacks.metrics", dockerClient.GetStackMetrics)).Methods("GET")
	api.HandleFunc("/stacks/{project}/logs", secured(auth.PermRead, "stacks.logs", dockerClient.GetStackLogs)).Methods("GET")
	
	// Resource monitoring
	api.HandleFunc("/monitoring/alerts", secured(auth.PermRead, "monitoring.alerts", dockerClient.GetAlerts)).Methods("GET")
	api.HandleFunc("/monitoring/thresholds", secured(auth.PermRead, "monitoring.thresholds.get", dockerClient.GetThresholds)).Methods("GET")
	api.HandleFunc("/monitoring/thresholds", secured(auth.PermWrite, "monitoring.thresholds.update", dockerClient.UpdateThresholds)).Methods("PUT")
	
	// Container archaeology
	api.HandleFunc("/archaeology/{id}", secured(auth.PermRead, "archaeology.history", dockerClient.GetContainerHistory)).Methods("GET")
	api.HandleFunc("/archaeology/{id}/diff", secured(auth.PermRead, "archaeology.diff", dockerClient.GetConfigDiff)).Methods("GET")
	
	// Drift detection
	api.HandleFunc("/drift", secured(auth.PermRead, "drift.list", driftDetector.GetDrifts)).Methods("GET")
	api.HandleFunc("/drift/{id}", secured(auth.PermRead, "drift.get", driftDetector.GetContainerDrift)).Methods("GET")
	api.HandleFunc("/drift/fix", secured(auth.PermWrite, "drift.fix", driftDetector.FixDrift)).Methods("POST")
	
	// Security scanning
	api.HandleFunc("/security/scan/{image:.*}", secured(auth.PermWrite, "security.scan.image", securityScanner.ScanImage)).Methods("POST")
	api.HandleFunc("/security/scan/all", secured(auth.PermWrite, "security.scan.all", securityScanner.ScanAllContainers)).Methods("POST")
	api.HandleFunc("/security/results", secured(auth.PermRead, "security.results", securityScanner.GetScanResults)).Methods("GET")
	api.HandleFunc("/security/results/{image:.*}", secured(auth.PermRead, "security.results.image", securityScanner.GetImageScan)).Methods("GET")
	api.HandleFunc("/security/trivy/install", secured(auth.PermRead, "security.trivy.install", securityScanner.InstallTrivyGuide)).Methods("GET")
	
	// Sandboxed execution
	api.HandleFunc("/sandbox/profiles", secured(auth.PermRead, "sandbox.profiles", sandboxMgr.GetProfiles)).Methods("GET")
	api.HandleFunc("/sandbox/run", secured(auth.PermWrite, "sandbox.run", sandboxMgr.RunSandboxed)).Methods("POST")
	api.HandleFunc("/sandbox/containers", secured(auth.PermRead, "sandbox.list", sandboxMgr.ListSandboxed)).Methods("GET")
	
	// MCP Gateway (Model Context Protocol)
	api.HandleFunc("/mcp/tools", secured(auth.PermRead, "mcp.tools", mcpGateway.ListTools)).Methods("GET")
	api.HandleFunc("/mcp/execute", secured(auth.PermWrite, "mcp.execute", mcpGateway.ExecuteTool)).Methods("POST")
	api.HandleFunc("/mcp/capabilities", secured(auth.PermRead, "mcp.capabilities", mcpGateway.GetCapabilities)).Methods("GET")
	api.HandleFunc("/mcp/sse", secured(auth.PermRead, "mcp.sse", mcpGateway.HandleSSE)).Methods("GET")
	
	// Log aggregation
	api.HandleFunc("/logs/aggregated", secured(auth.PermRead, "logs.aggregated", logAggregator.GetAggregatedLogs)).Methods("GET")
	api.HandleFunc("/logs/stream", secured(auth.PermRead, "logs.stream", logAggregator.StreamLogs)).Methods("GET")
	api.HandleFunc("/logs/filters", secured(auth.PermRead, "logs.filters.list", logAggregator.GetFilters)).Methods("GET")
	api.HandleFunc("/logs/filters", secured(auth.PermWrite, "logs.filters.add", logAggregator.AddFilter)).Methods("POST")
	api.HandleFunc("/logs/filters", secured(auth.PermWrite, "logs.filters.clear", logAggregator.ClearFilters)).Methods("DELETE")
	api.HandleFunc("/logs/watchwords", secured(auth.PermRead, "logs.watchwords.list", logAggregator.GetWatchWords)).Methods("GET")
	api.HandleFunc("/logs/watchwords", secured(auth.PermWrite, "logs.watchwords.add", logAggregator.AddWatchWord)).Methods("POST")

	// Image updates
	api.HandleFunc("/updates/settings", secured(auth.PermRead, "updates.settings.get", dockerClient.GetUpdateSettings)).Methods("GET")
	api.HandleFunc("/updates/settings", secured(auth.PermWrite, "updates.settings.update", dockerClient.UpdateUpdateSettings)).Methods("PUT")
	api.HandleFunc("/updates/run", secured(auth.PermWrite, "updates.run", dockerClient.RunUpdateNow)).Methods("POST")

	// Audit logs
	api.HandleFunc("/audit", secured(auth.PermAdmin, "audit.read", func(w http.ResponseWriter, r *http.Request) {
		limit := 200
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil {
				limit = parsed
			}
		}
		events, err := auditLogger.ReadLast(limit)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(events)
	})).Methods("GET")
	
	// WebSocket
	api.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websockets.ServeWs(hub, w, r)
	})

	// Serve static files (frontend) with SPA fallback
	staticDir := "./frontend/dist"
	fileServer := http.FileServer(http.Dir(staticDir))
	r.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, r.URL.Path)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		indexPath := filepath.Join(staticDir, "index.html")
		http.ServeFile(w, r, indexPath)
	}))

	// CORS
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}).Handler(r)

	// Start server
	srv := &http.Server{
		Addr:         ":9876",
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		log.Println("Shutting down server...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
		cancel()
	}()

	log.Printf("✨ Server running on http://localhost:9876")
	log.Printf("📊 WebSocket endpoint: ws://localhost:9876/api/ws")
	
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server stopped")
}

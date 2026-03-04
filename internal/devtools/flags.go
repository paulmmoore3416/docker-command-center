package devtools

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

// FeatureFlag is a named server-side toggle.
type FeatureFlag struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	Category    string `json:"category"`
}

// FlagStore is an in-memory store for feature flags.
type FlagStore struct {
	mu    sync.RWMutex
	flags map[string]*FeatureFlag
}

// NewFlagStore returns a FlagStore pre-seeded with default flags.
func NewFlagStore() *FlagStore {
	return &FlagStore{
		flags: map[string]*FeatureFlag{
			"websocket_debug": {
				Name:        "websocket_debug",
				Description: "Log all WebSocket messages to the debug console",
				Enabled:     false,
				Category:    "debugging",
			},
			"request_tracing": {
				Name:        "request_tracing",
				Description: "Trace all HTTP requests with detailed timing",
				Enabled:     false,
				Category:    "debugging",
			},
			"extended_audit": {
				Name:        "extended_audit",
				Description: "Include request bodies in audit log entries",
				Enabled:     false,
				Category:    "audit",
			},
			"sandbox_networking": {
				Name:        "sandbox_networking",
				Description: "Allow sandboxed containers to access external networks",
				Enabled:     false,
				Category:    "sandbox",
			},
			"drift_auto_fix": {
				Name:        "drift_auto_fix",
				Description: "Automatically fix detected drift without confirmation",
				Enabled:     false,
				Category:    "drift",
			},
			"topology_animations": {
				Name:        "topology_animations",
				Description: "Enable live topology map animations",
				Enabled:     true,
				Category:    "ui",
			},
			"mcp_experimental": {
				Name:        "mcp_experimental",
				Description: "Enable experimental MCP Gateway tool executions",
				Enabled:     false,
				Category:    "mcp",
			},
		},
	}
}

// IsEnabled returns true if the named flag is currently active.
func (s *FlagStore) IsEnabled(name string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if f, ok := s.flags[name]; ok {
		return f.Enabled
	}
	return false
}

// HandleList writes all flags as a JSON array.
func (s *FlagStore) HandleList(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	out := make([]*FeatureFlag, 0, len(s.flags))
	for _, f := range s.flags {
		out = append(out, f)
	}
	s.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// HandleToggle flips the enabled state of the flag named by the last URL segment.
func (s *FlagStore) HandleToggle(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	name := parts[len(parts)-1]

	s.mu.Lock()
	flag, ok := s.flags[name]
	if !ok {
		s.mu.Unlock()
		http.Error(w, `{"error":"flag not found"}`, http.StatusNotFound)
		return
	}
	flag.Enabled = !flag.Enabled
	result := *flag
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

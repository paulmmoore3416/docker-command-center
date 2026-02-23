package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"

	"github.com/gorilla/mux"
)

type Manager struct {
	mu     sync.RWMutex
	routes map[string]*Route
	server *http.Server
}

type Route struct {
	ID          string `json:"id"`
	Domain      string `json:"domain"`
	Target      string `json:"target"`
	ContainerID string `json:"container_id"`
	Active      bool   `json:"active"`
}

func NewManager() *Manager {
	return &Manager{
		routes: make(map[string]*Route),
	}
}

func (m *Manager) Start(ctx context.Context) {
	r := mux.NewRouter()
	
	r.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		host := req.Host
		
		m.mu.RLock()
		route, exists := m.routes[host]
		m.mu.RUnlock()

		if !exists {
			http.Error(w, "No route configured for "+host, http.StatusNotFound)
			return
		}

		if !route.Active {
			http.Error(w, "Route is disabled", http.StatusServiceUnavailable)
			return
		}

		// Proxy the request
		target, err := url.Parse(route.Target)
		if err != nil {
			http.Error(w, "Invalid target URL", http.StatusInternalServerError)
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ServeHTTP(w, req)
	})

	m.server = &http.Server{
		Addr:    ":8081",
		Handler: r,
	}

	go func() {
		log.Println("🔀 Proxy manager listening on :8081")
		if err := m.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Proxy server error: %v", err)
		}
	}()

	<-ctx.Done()
	m.server.Shutdown(context.Background())
}

func (m *Manager) ListRoutes(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	routes := make([]*Route, 0, len(m.routes))
	for _, route := range m.routes {
		routes = append(routes, route)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes)
}

func (m *Manager) AddRoute(w http.ResponseWriter, r *http.Request) {
	var route Route
	if err := json.NewDecoder(r.Body).Decode(&route); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if route.ID == "" {
		route.ID = fmt.Sprintf("route-%d", len(m.routes)+1)
	}
	route.Active = true

	m.mu.Lock()
	m.routes[route.Domain] = &route
	m.mu.Unlock()

	log.Printf("Added route: %s -> %s", route.Domain, route.Target)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(route)
}

func (m *Manager) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	m.mu.Lock()
	defer m.mu.Unlock()

	for domain, route := range m.routes {
		if route.ID == id {
			delete(m.routes, domain)
			log.Printf("Deleted route: %s", domain)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	http.Error(w, "Route not found", http.StatusNotFound)
}

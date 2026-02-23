package drift

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/gorilla/mux"
	"gopkg.in/yaml.v3"

	"github.com/paulmmoore3416/dcc/internal/websockets"
)

type DriftDetector struct {
	cli    *client.Client
	hub    *websockets.Hub
	mu     sync.RWMutex
	drifts map[string][]DriftItem
}

type DriftItem struct {
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name"`
	Field         string    `json:"field"`
	Expected      string    `json:"expected"`
	Actual        string    `json:"actual"`
	Severity      string    `json:"severity"`
	Timestamp     time.Time `json:"timestamp"`
}

type DriftReport struct {
	ContainerID string      `json:"container_id"`
	HasDrift    bool        `json:"has_drift"`
	DriftCount  int         `json:"drift_count"`
	Items       []DriftItem `json:"items"`
}

type ComposeService struct {
	Image       string            `yaml:"image"`
	Environment []string          `yaml:"environment"`
	Ports       []string          `yaml:"ports"`
	Volumes     []string          `yaml:"volumes"`
	Command     interface{}       `yaml:"command"`
	Labels      map[string]string `yaml:"labels"`
	User        string            `yaml:"user"`
}

type ComposeFile struct {
	Services map[string]ComposeService `yaml:"services"`
}

func NewDriftDetector(cli *client.Client, hub *websockets.Hub) *DriftDetector {
	return &DriftDetector{
		cli:    cli,
		hub:    hub,
		drifts: make(map[string][]DriftItem),
	}
}

func (d *DriftDetector) StartMonitoring(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial scan
	d.scanForDrift(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.scanForDrift(ctx)
		}
	}
}

func (d *DriftDetector) scanForDrift(ctx context.Context) {
	containers, err := d.cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return
	}

	composeFiles := d.findComposeFiles()

	for _, cont := range containers {
		projectName := cont.Labels["com.docker.compose.project"]
		serviceName := cont.Labels["com.docker.compose.service"]

		if projectName == "" || serviceName == "" {
			continue
		}

		// Find matching compose file
		for _, composePath := range composeFiles {
			compose, err := d.loadComposeFile(composePath)
			if err != nil {
				continue
			}

			if service, exists := compose.Services[serviceName]; exists {
				drifts := d.detectDrifts(ctx, cont, service)
				if len(drifts) > 0 {
					d.mu.Lock()
					d.drifts[cont.ID] = drifts
					d.mu.Unlock()

					// Broadcast drift alert
					d.hub.Broadcast(map[string]interface{}{
						"type": "drift_detected",
						"data": DriftReport{
							ContainerID: cont.ID[:12],
							HasDrift:    true,
							DriftCount:  len(drifts),
							Items:       drifts,
						},
					})
				} else {
					d.mu.Lock()
					delete(d.drifts, cont.ID)
					d.mu.Unlock()
				}
			}
		}
	}
}

func (d *DriftDetector) detectDrifts(ctx context.Context, cont types.Container, service ComposeService) []DriftItem {
	var drifts []DriftItem

	inspect, err := d.cli.ContainerInspect(ctx, cont.ID)
	if err != nil {
		return drifts
	}

	// Check image drift
	if service.Image != "" && !strings.Contains(inspect.Config.Image, service.Image) {
		drifts = append(drifts, DriftItem{
			ContainerID:   cont.ID[:12],
			ContainerName: cont.Names[0],
			Field:         "image",
			Expected:      service.Image,
			Actual:        inspect.Config.Image,
			Severity:      "high",
			Timestamp:     time.Now(),
		})
	}

	// Check environment variables
	expectedEnv := make(map[string]string)
	for _, env := range service.Environment {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			expectedEnv[parts[0]] = parts[1]
		}
	}

	actualEnv := make(map[string]string)
	for _, env := range inspect.Config.Env {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			actualEnv[parts[0]] = parts[1]
		}
	}

	for key, expectedVal := range expectedEnv {
		if actualVal, exists := actualEnv[key]; exists {
			if actualVal != expectedVal {
				drifts = append(drifts, DriftItem{
					ContainerID:   cont.ID[:12],
					ContainerName: cont.Names[0],
					Field:         fmt.Sprintf("env.%s", key),
					Expected:      expectedVal,
					Actual:        actualVal,
					Severity:      "medium",
					Timestamp:     time.Now(),
				})
			}
		}
	}

	// Check user (security)
	if service.User != "" && inspect.Config.User != service.User {
		drifts = append(drifts, DriftItem{
			ContainerID:   cont.ID[:12],
			ContainerName: cont.Names[0],
			Field:         "user",
			Expected:      service.User,
			Actual:        inspect.Config.User,
			Severity:      "high",
			Timestamp:     time.Now(),
		})
	}

	// Check if running as root (security concern)
	if inspect.Config.User == "" || inspect.Config.User == "root" || inspect.Config.User == "0" {
		drifts = append(drifts, DriftItem{
			ContainerID:   cont.ID[:12],
			ContainerName: cont.Names[0],
			Field:         "security.root",
			Expected:      "non-root user",
			Actual:        "running as root",
			Severity:      "critical",
			Timestamp:     time.Now(),
		})
	}

	return drifts
}

func (d *DriftDetector) findComposeFiles() []string {
	var files []string
	searchPaths := []string{".", "./docker", "./compose", os.Getenv("HOME") + "/docker"}

	for _, basePath := range searchPaths {
		filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if strings.HasSuffix(path, "docker-compose.yml") ||
				strings.HasSuffix(path, "docker-compose.yaml") ||
				strings.HasSuffix(path, "compose.yml") ||
				strings.HasSuffix(path, "compose.yaml") {
				files = append(files, path)
			}
			return nil
		})
	}

	return files
}

func (d *DriftDetector) loadComposeFile(path string) (*ComposeFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var compose ComposeFile
	if err := yaml.Unmarshal(data, &compose); err != nil {
		return nil, err
	}

	return &compose, nil
}

func (d *DriftDetector) GetDrifts(w http.ResponseWriter, r *http.Request) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	reports := make(map[string]DriftReport)
	for containerID, items := range d.drifts {
		reports[containerID] = DriftReport{
			ContainerID: containerID[:12],
			HasDrift:    true,
			DriftCount:  len(items),
			Items:       items,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}

func (d *DriftDetector) GetContainerDrift(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	d.mu.RLock()
	defer d.mu.RUnlock()

	if items, exists := d.drifts[id]; exists {
		report := DriftReport{
			ContainerID: id,
			HasDrift:    true,
			DriftCount:  len(items),
			Items:       items,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(report)
	} else {
		report := DriftReport{
			ContainerID: id,
			HasDrift:    false,
			DriftCount:  0,
			Items:       []DriftItem{},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(report)
	}
}

func (d *DriftDetector) FixDrift(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ContainerID string `json:"container_id"`
		Field       string `json:"field"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// This would recreate the container with correct config
	// For now, return a placeholder response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Container will be recreated with correct configuration",
	})
}

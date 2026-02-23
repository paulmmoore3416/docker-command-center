package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

type MCPGateway struct {
	cli *client.Client
}

type MCPRequest struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
	ID     string                 `json:"id"`
}

type MCPResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  *MCPError   `json:"error,omitempty"`
	ID     string      `json:"id"`
}

type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

func NewMCPGateway(cli *client.Client) *MCPGateway {
	return &MCPGateway{cli: cli}
}

func (m *MCPGateway) ListTools(w http.ResponseWriter, r *http.Request) {
	tools := []MCPTool{
		{
			Name:        "docker.container.list",
			Description: "List all Docker containers with their status",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"all": map[string]interface{}{
						"type":        "boolean",
						"description": "Show all containers (default shows just running)",
					},
				},
			},
		},
		{
			Name:        "docker.container.start",
			Description: "Start a stopped container",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "Container ID or name",
					},
				},
				"required": []string{"id"},
			},
		},
		{
			Name:        "docker.container.stop",
			Description: "Stop a running container",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "Container ID or name",
					},
				},
				"required": []string{"id"},
			},
		},
		{
			Name:        "docker.container.restart",
			Description: "Restart a container",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "Container ID or name",
					},
				},
				"required": []string{"id"},
			},
		},
		{
			Name:        "docker.container.logs",
			Description: "Get logs from a container",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "Container ID or name",
					},
					"tail": map[string]interface{}{
						"type":        "integer",
						"description": "Number of lines to show from the end of logs",
						"default":     100,
					},
				},
				"required": []string{"id"},
			},
		},
		{
			Name:        "docker.container.inspect",
			Description: "Get detailed information about a container",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "Container ID or name",
					},
				},
				"required": []string{"id"},
			},
		},
		{
			Name:        "docker.image.list",
			Description: "List all Docker images",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "docker.compose.deploy",
			Description: "Deploy a Docker Compose project",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"file": map[string]interface{}{
						"type":        "string",
						"description": "Path to docker-compose.yml file",
					},
					"project": map[string]interface{}{
						"type":        "string",
						"description": "Project name",
					},
				},
				"required": []string{"file"},
			},
		},
		{
			Name:        "docker.compose.down",
			Description: "Stop and remove a Docker Compose project",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"project": map[string]interface{}{
						"type":        "string",
						"description": "Project name",
					},
				},
				"required": []string{"project"},
			},
		},
		{
			Name:        "docker.network.list",
			Description: "List all Docker networks",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "docker.volume.list",
			Description: "List all Docker volumes",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "docker.stats",
			Description: "Get resource usage statistics for containers",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tools": tools,
	})
}

func (m *MCPGateway) ExecuteTool(w http.ResponseWriter, r *http.Request) {
	var req MCPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		m.sendError(w, req.ID, -32700, "Parse error")
		return
	}

	result, err := m.dispatchTool(r.Context(), req.Method, req.Params)
	if err != nil {
		m.sendError(w, req.ID, -32603, err.Error())
		return
	}

	response := MCPResponse{
		Result: result,
		ID:     req.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MCPGateway) dispatchTool(ctx context.Context, method string, params map[string]interface{}) (interface{}, error) {
	switch method {
	case "docker.container.list":
		showAll := false
		if all, ok := params["all"].(bool); ok {
			showAll = all
		}
		return m.cli.ContainerList(ctx, container.ListOptions{All: showAll})

	case "docker.container.start":
		id, ok := params["id"].(string)
		if !ok {
			return nil, fmt.Errorf("missing required parameter: id")
		}
		err := m.cli.ContainerStart(ctx, id, container.StartOptions{})
		return map[string]string{"status": "started", "id": id}, err

	case "docker.container.stop":
		id, ok := params["id"].(string)
		if !ok {
			return nil, fmt.Errorf("missing required parameter: id")
		}
		timeout := 10
		err := m.cli.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
		return map[string]string{"status": "stopped", "id": id}, err

	case "docker.container.restart":
		id, ok := params["id"].(string)
		if !ok {
			return nil, fmt.Errorf("missing required parameter: id")
		}
		timeout := 10
		err := m.cli.ContainerRestart(ctx, id, container.StopOptions{Timeout: &timeout})
		return map[string]string{"status": "restarted", "id": id}, err

	case "docker.container.logs":
		id, ok := params["id"].(string)
		if !ok {
			return nil, fmt.Errorf("missing required parameter: id")
		}
		tail := "100"
		if t, ok := params["tail"].(float64); ok {
			tail = fmt.Sprintf("%d", int(t))
		}
		logs, err := m.cli.ContainerLogs(ctx, id, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Tail:       tail,
		})
		if err != nil {
			return nil, err
		}
		defer logs.Close()

		buf := make([]byte, 8192)
		n, _ := logs.Read(buf)
		return map[string]string{"logs": string(buf[:n])}, nil

	case "docker.container.inspect":
		id, ok := params["id"].(string)
		if !ok {
			return nil, fmt.Errorf("missing required parameter: id")
		}
		return m.cli.ContainerInspect(ctx, id)

	case "docker.image.list":
		return m.cli.ImageList(ctx, types.ImageListOptions{})

	case "docker.network.list":
		return m.cli.NetworkList(ctx, types.NetworkListOptions{})

	case "docker.volume.list":
		return m.cli.VolumeList(ctx, volume.ListOptions{})

	case "docker.stats":
		containers, err := m.cli.ContainerList(ctx, container.ListOptions{All: false})
		if err != nil {
			return nil, err
		}

		stats := make([]map[string]interface{}, 0)
		for _, cont := range containers {
			stat, err := m.cli.ContainerStats(ctx, cont.ID, false)
			if err != nil {
				continue
			}
			defer stat.Body.Close()

			var v types.StatsJSON
			if err := json.NewDecoder(stat.Body).Decode(&v); err != nil {
				continue
			}

			stats = append(stats, map[string]interface{}{
				"id":           cont.ID[:12],
				"name":         cont.Names[0],
				"cpu_percent":  calculateCPUPercent(&v),
				"memory_usage": v.MemoryStats.Usage,
				"memory_limit": v.MemoryStats.Limit,
			})
		}
		return stats, nil

	default:
		return nil, fmt.Errorf("unknown method: %s", method)
	}
}

func (m *MCPGateway) sendError(w http.ResponseWriter, id string, code int, message string) {
	response := MCPResponse{
		Error: &MCPError{
			Code:    code,
			Message: message,
		},
		ID: id,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(response)
}

func calculateCPUPercent(stats *types.StatsJSON) float64 {
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
	cpuCount := float64(len(stats.CPUStats.CPUUsage.PercpuUsage))

	if systemDelta > 0 && cpuDelta > 0 && cpuCount > 0 {
		return (cpuDelta / systemDelta) * cpuCount * 100.0
	}
	return 0.0
}

func (m *MCPGateway) GetCapabilities(w http.ResponseWriter, r *http.Request) {
	capabilities := map[string]interface{}{
		"name":    "Docker Command Center MCP Server",
		"version": "1.0.0",
		"vendor":  "DCC",
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{
				"supported": true,
				"count":     12,
			},
			"prompts": map[string]interface{}{
				"supported": false,
			},
			"resources": map[string]interface{}{
				"supported": false,
			},
		},
		"serverInfo": map[string]interface{}{
			"name":    "dcc-mcp",
			"version": "1.0.0",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(capabilities)
}

func (m *MCPGateway) HandleSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Send initial connection message
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ready\"}\n\n")
	flusher.Flush()

	// Keep connection alive
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, "event: ping\ndata: {\"time\":\"%s\"}\n\n", time.Now().Format(time.RFC3339))
			flusher.Flush()
		}
	}
}

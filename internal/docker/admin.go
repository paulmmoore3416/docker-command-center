package docker

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/docker/docker/api/types/filters"
)

// SystemInfoResponse contains a summary of the Docker daemon state.
type SystemInfoResponse struct {
	Containers        int    `json:"containers"`
	ContainersRunning int    `json:"containers_running"`
	ContainersPaused  int    `json:"containers_paused"`
	ContainersStopped int    `json:"containers_stopped"`
	Images            int    `json:"images"`
	DockerVersion     string `json:"docker_version"`
	OperatingSystem   string `json:"operating_system"`
	NCPU              int    `json:"ncpu"`
	MemTotalMB        int64  `json:"mem_total_mb"`
}

// PruneResult summarises the output of a prune operation.
type PruneResult struct {
	Deleted        []string `json:"deleted"`
	SpaceReclaimed uint64   `json:"space_reclaimed"`
}

// GetSystemInfo writes a DockerSystemInfoResponse as JSON.
func (c *Client) GetSystemInfo(w http.ResponseWriter, r *http.Request) {
	info, err := c.cli.Info(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := SystemInfoResponse{
		Containers:        info.Containers,
		ContainersRunning: info.ContainersRunning,
		ContainersPaused:  info.ContainersPaused,
		ContainersStopped: info.ContainersStopped,
		Images:            info.Images,
		DockerVersion:     info.ServerVersion,
		OperatingSystem:   info.OperatingSystem,
		NCPU:              info.NCPU,
		MemTotalMB:        info.MemTotal / 1024 / 1024,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// PruneContainers removes all stopped containers.
func (c *Client) PruneContainers(w http.ResponseWriter, r *http.Request) {
	report, err := c.cli.ContainersPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := report.ContainersDeleted
	if deleted == nil {
		deleted = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PruneResult{
		Deleted:        deleted,
		SpaceReclaimed: report.SpaceReclaimed,
	})
}

// PruneImages removes dangling images.
func (c *Client) PruneImages(w http.ResponseWriter, r *http.Request) {
	report, err := c.cli.ImagesPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := make([]string, 0, len(report.ImagesDeleted))
	for _, d := range report.ImagesDeleted {
		if d.Deleted != "" {
			deleted = append(deleted, d.Deleted)
		} else if d.Untagged != "" {
			deleted = append(deleted, d.Untagged)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PruneResult{
		Deleted:        deleted,
		SpaceReclaimed: report.SpaceReclaimed,
	})
}

// PruneVolumes removes unused volumes.
func (c *Client) PruneVolumes(w http.ResponseWriter, r *http.Request) {
	report, err := c.cli.VolumesPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := report.VolumesDeleted
	if deleted == nil {
		deleted = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PruneResult{
		Deleted:        deleted,
		SpaceReclaimed: report.SpaceReclaimed,
	})
}

// PruneNetworks removes unused networks.
func (c *Client) PruneNetworks(w http.ResponseWriter, r *http.Request) {
	report, err := c.cli.NetworksPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := report.NetworksDeleted
	if deleted == nil {
		deleted = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PruneResult{
		Deleted:        deleted,
		SpaceReclaimed: 0,
	})
}

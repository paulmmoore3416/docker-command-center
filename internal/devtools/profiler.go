package devtools

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"
)

var serverStartTime = time.Now()

// RuntimeMetrics is a snapshot of Go runtime statistics.
type RuntimeMetrics struct {
	Timestamp   time.Time `json:"timestamp"`
	Goroutines  int       `json:"goroutines"`
	MemAllocMB  float64   `json:"mem_alloc_mb"`
	MemSysMB    float64   `json:"mem_sys_mb"`
	GCRuns      uint32    `json:"gc_runs"`
	HeapObjects uint64    `json:"heap_objects"`
	Uptime      string    `json:"uptime"`
}

// HandleMetrics writes a fresh RuntimeMetrics snapshot as JSON.
func HandleMetrics(w http.ResponseWriter, r *http.Request) {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	m := RuntimeMetrics{
		Timestamp:   time.Now(),
		Goroutines:  runtime.NumGoroutine(),
		MemAllocMB:  float64(ms.Alloc) / 1024 / 1024,
		MemSysMB:    float64(ms.Sys) / 1024 / 1024,
		GCRuns:      ms.NumGC,
		HeapObjects: ms.HeapObjects,
		Uptime:      time.Since(serverStartTime).Round(time.Second).String(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

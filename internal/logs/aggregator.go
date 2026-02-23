package logs

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"

	"github.com/paulmmoore3416/dcc/internal/websockets"
)

type LogAggregator struct {
	cli       *client.Client
	hub       *websockets.Hub
	mu        sync.RWMutex
	streams   map[string]*LogStream
	filters   []LogFilter
	watchwords []WatchWord
}

type LogStream struct {
	ContainerID   string
	ContainerName string
	Cancel        context.CancelFunc
}

type LogEntry struct {
	Timestamp     time.Time `json:"timestamp"`
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name"`
	Level         string    `json:"level"`
	Message       string    `json:"message"`
	Raw           string    `json:"raw"`
}

type LogFilter struct {
	Pattern     string `json:"pattern"`
	IsRegex     bool   `json:"is_regex"`
	Level       string `json:"level"`
	ContainerID string `json:"container_id"`
}

type WatchWord struct {
	Pattern     string `json:"pattern"`
	IsRegex     bool   `json:"is_regex"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

type AggregatedLogs struct {
	Entries []LogEntry `json:"entries"`
	Total   int        `json:"total"`
}

func NewLogAggregator(cli *client.Client, hub *websockets.Hub) *LogAggregator {
	return &LogAggregator{
		cli:        cli,
		hub:        hub,
		streams:    make(map[string]*LogStream),
		filters:    []LogFilter{},
		watchwords: []WatchWord{
			{Pattern: "error", IsRegex: false, Description: "Error detected", Severity: "high"},
			{Pattern: "fatal", IsRegex: false, Description: "Fatal error", Severity: "critical"},
			{Pattern: "panic", IsRegex: false, Description: "Panic detected", Severity: "critical"},
			{Pattern: "exception", IsRegex: false, Description: "Exception caught", Severity: "high"},
			{Pattern: "warning", IsRegex: false, Description: "Warning issued", Severity: "medium"},
			{Pattern: "OOM", IsRegex: false, Description: "Out of memory", Severity: "critical"},
			{Pattern: "timeout", IsRegex: false, Description: "Timeout occurred", Severity: "medium"},
		},
	}
}

func (la *LogAggregator) StartAggregation(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Initial start
	la.updateStreams(ctx)

	for {
		select {
		case <-ctx.Done():
			la.stopAllStreams()
			return
		case <-ticker.C:
			la.updateStreams(ctx)
		}
	}
}

func (la *LogAggregator) updateStreams(ctx context.Context) {
	containers, err := la.cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return
	}

	// Track current containers
	currentIDs := make(map[string]bool)
	for _, cont := range containers {
		currentIDs[cont.ID] = true

		la.mu.RLock()
		_, exists := la.streams[cont.ID]
		la.mu.RUnlock()

		if !exists {
			la.startStream(ctx, cont.ID, cont.Names[0])
		}
	}

	// Stop streams for removed containers
	la.mu.Lock()
	for id, stream := range la.streams {
		if !currentIDs[id] {
			stream.Cancel()
			delete(la.streams, id)
		}
	}
	la.mu.Unlock()
}

func (la *LogAggregator) startStream(parentCtx context.Context, containerID, containerName string) {
	ctx, cancel := context.WithCancel(parentCtx)

	stream := &LogStream{
		ContainerID:   containerID,
		ContainerName: containerName,
		Cancel:        cancel,
	}

	la.mu.Lock()
	la.streams[containerID] = stream
	la.mu.Unlock()

	go func() {
		logs, err := la.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     true,
			Timestamps: true,
		})
		if err != nil {
			return
		}
		defer logs.Close()

		reader := bufio.NewReader(logs)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				line, err := reader.ReadString('\n')
				if err != nil {
					if err != io.EOF {
						return
					}
					continue
				}

				entry := la.parseLogLine(line, containerID, containerName)
				if la.matchesFilters(entry) {
					// Broadcast log entry
					la.hub.Broadcast(map[string]interface{}{
						"type": "log_entry",
						"data": entry,
					})

					// Check watchwords
					for _, ww := range la.watchwords {
						if la.matchesWatchWord(entry, ww) {
							la.hub.Broadcast(map[string]interface{}{
								"type": "watchword_alert",
								"data": map[string]interface{}{
									"watchword":      ww,
									"container_id":   containerID,
									"container_name": containerName,
									"message":        entry.Message,
									"timestamp":      entry.Timestamp,
								},
							})
						}
					}
				}
			}
		}
	}()
}

func (la *LogAggregator) parseLogLine(line, containerID, containerName string) LogEntry {
	// Remove Docker log prefix (8 bytes)
	if len(line) > 8 {
		line = line[8:]
	}

	line = strings.TrimSpace(line)

	entry := LogEntry{
		Timestamp:     time.Now(),
		ContainerID:   containerID[:12],
		ContainerName: containerName,
		Raw:           line,
		Level:         "info",
	}

	// Try to parse timestamp
	parts := strings.SplitN(line, " ", 2)
	if len(parts) == 2 {
		if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
			entry.Timestamp = t
			line = parts[1]
		}
	}

	// Detect log level
	lineLower := strings.ToLower(line)
	if strings.Contains(lineLower, "error") || strings.Contains(lineLower, "err:") {
		entry.Level = "error"
	} else if strings.Contains(lineLower, "fatal") || strings.Contains(lineLower, "panic") {
		entry.Level = "fatal"
	} else if strings.Contains(lineLower, "warn") {
		entry.Level = "warning"
	} else if strings.Contains(lineLower, "debug") {
		entry.Level = "debug"
	}

	entry.Message = line
	return entry
}

func (la *LogAggregator) matchesFilters(entry LogEntry) bool {
	la.mu.RLock()
	defer la.mu.RUnlock()

	if len(la.filters) == 0 {
		return true
	}

	for _, filter := range la.filters {
		// Check container filter
		if filter.ContainerID != "" && filter.ContainerID != entry.ContainerID {
			continue
		}

		// Check level filter
		if filter.Level != "" && filter.Level != entry.Level {
			continue
		}

		// Check pattern filter
		if filter.Pattern != "" {
			if filter.IsRegex {
				if matched, _ := regexp.MatchString(filter.Pattern, entry.Message); !matched {
					continue
				}
			} else {
				if !strings.Contains(strings.ToLower(entry.Message), strings.ToLower(filter.Pattern)) {
					continue
				}
			}
		}

		return true
	}

	return false
}

func (la *LogAggregator) matchesWatchWord(entry LogEntry, ww WatchWord) bool {
	if ww.IsRegex {
		matched, _ := regexp.MatchString(ww.Pattern, entry.Message)
		return matched
	}
	return strings.Contains(strings.ToLower(entry.Message), strings.ToLower(ww.Pattern))
}

func (la *LogAggregator) stopAllStreams() {
	la.mu.Lock()
	defer la.mu.Unlock()

	for _, stream := range la.streams {
		stream.Cancel()
	}
	la.streams = make(map[string]*LogStream)
}

func (la *LogAggregator) GetAggregatedLogs(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	containerID := query.Get("container_id")
	level := query.Get("level")
	search := query.Get("search")
	tail := query.Get("tail")

	if tail == "" {
		tail = "100"
	}

	ctx := r.Context()
	var allEntries []LogEntry

	la.mu.RLock()
	streams := make(map[string]*LogStream)
	for k, v := range la.streams {
		streams[k] = v
	}
	la.mu.RUnlock()

	for id, stream := range streams {
		if containerID != "" && id != containerID {
			continue
		}

		logs, err := la.cli.ContainerLogs(ctx, id, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: true,
			Tail:       tail,
		})
		if err != nil {
			continue
		}

		scanner := bufio.NewScanner(logs)
		for scanner.Scan() {
			line := scanner.Text()
			entry := la.parseLogLine(line, id, stream.ContainerName)

			// Apply filters
			if level != "" && entry.Level != level {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(entry.Message), strings.ToLower(search)) {
				continue
			}

			allEntries = append(allEntries, entry)
		}
		logs.Close()
	}

	result := AggregatedLogs{
		Entries: allEntries,
		Total:   len(allEntries),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (la *LogAggregator) AddFilter(w http.ResponseWriter, r *http.Request) {
	var filter LogFilter
	if err := json.NewDecoder(r.Body).Decode(&filter); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	la.mu.Lock()
	la.filters = append(la.filters, filter)
	la.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "filter added"})
}

func (la *LogAggregator) GetFilters(w http.ResponseWriter, r *http.Request) {
	la.mu.RLock()
	defer la.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(la.filters)
}

func (la *LogAggregator) ClearFilters(w http.ResponseWriter, r *http.Request) {
	la.mu.Lock()
	la.filters = []LogFilter{}
	la.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "filters cleared"})
}

func (la *LogAggregator) AddWatchWord(w http.ResponseWriter, r *http.Request) {
	var ww WatchWord
	if err := json.NewDecoder(r.Body).Decode(&ww); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	la.mu.Lock()
	la.watchwords = append(la.watchwords, ww)
	la.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "watchword added"})
}

func (la *LogAggregator) GetWatchWords(w http.ResponseWriter, r *http.Request) {
	la.mu.RLock()
	defer la.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(la.watchwords)
}

func (la *LogAggregator) StreamLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// This is handled by WebSocket, but provide SSE fallback
	fmt.Fprintf(w, "data: {\"status\":\"connected\"}\n\n")
	flusher.Flush()

	<-r.Context().Done()
}

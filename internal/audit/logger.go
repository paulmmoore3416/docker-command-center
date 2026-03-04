package audit

import (
	"bufio"
	"encoding/json"
	"os"
	"sync"
	"time"
)

type Event struct {
	Timestamp time.Time         `json:"timestamp"`
	User      string            `json:"user"`
	Role      string            `json:"role"`
	Action    string            `json:"action"`
	Method    string            `json:"method"`
	Path      string            `json:"path"`
	Status    int               `json:"status"`
	Meta      map[string]string `json:"meta,omitempty"`
}

type Logger struct {
	path string
	mu   sync.Mutex
}

func NewLogger(path string) *Logger {
	return &Logger{path: path}
}

func (l *Logger) Log(event Event) {
	l.mu.Lock()
	defer l.mu.Unlock()

	file, err := os.OpenFile(l.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer file.Close()

	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	file.Write(append(data, '\n'))
}

func (l *Logger) ReadLast(limit int) ([]Event, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	file, err := os.OpenFile(l.path, os.O_RDONLY|os.O_CREATE, 0644)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var events []Event
	for scanner.Scan() {
		var event Event
		if err := json.Unmarshal(scanner.Bytes(), &event); err == nil {
			events = append(events, event)
		}
	}

	if limit <= 0 || len(events) <= limit {
		return events, nil
	}
	return events[len(events)-limit:], nil
}

// LogStats holds metadata about the audit log file.
type LogStats struct {
	Path      string `json:"path"`
	SizeBytes int64  `json:"size_bytes"`
	LineCount int    `json:"line_count"`
}

// Stats returns file size and entry count without reading event data.
func (l *Logger) Stats() LogStats {
	l.mu.Lock()
	defer l.mu.Unlock()

	stats := LogStats{Path: l.path}
	if info, err := os.Stat(l.path); err == nil {
		stats.SizeBytes = info.Size()
	}

	file, err := os.Open(l.path)
	if err != nil {
		return stats
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		if len(scanner.Bytes()) > 0 {
			stats.LineCount++
		}
	}
	return stats
}

// Flush truncates the audit log file, removing all entries.
func (l *Logger) Flush() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	return os.WriteFile(l.path, []byte{}, 0644)
}

package devtools

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const maxLogEntries = 500

// LogEntry is a captured server log line.
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
}

// DebugLogger is a bounded ring-buffer that captures server log output.
type DebugLogger struct {
	mu      sync.Mutex
	entries []LogEntry
}

// GlobalDebugLogger is the singleton used by NewDebugWriter.
var GlobalDebugLogger = &DebugLogger{}

type debugWriter struct {
	orig   io.Writer
	logger *DebugLogger
}

func (w *debugWriter) Write(p []byte) (n int, err error) {
	line := strings.TrimSpace(string(p))
	if line != "" {
		level := "INFO"
		lower := strings.ToLower(line)
		switch {
		case strings.Contains(lower, "fatal") || strings.Contains(lower, "error"):
			level = "ERROR"
		case strings.Contains(lower, "warn"):
			level = "WARN"
		}
		w.logger.mu.Lock()
		w.logger.entries = append(w.logger.entries, LogEntry{
			Timestamp: time.Now(),
			Level:     level,
			Message:   line,
		})
		if len(w.logger.entries) > maxLogEntries {
			w.logger.entries = w.logger.entries[len(w.logger.entries)-maxLogEntries:]
		}
		w.logger.mu.Unlock()
	}
	return w.orig.Write(p)
}

// NewDebugWriter wraps an existing writer and also captures each write to the
// global debug logger so it appears in the Debug Console UI.
func NewDebugWriter(orig io.Writer) io.Writer {
	return &debugWriter{orig: orig, logger: GlobalDebugLogger}
}

// HandleGetLogs writes all captured log entries as JSON.
func (d *DebugLogger) HandleGetLogs(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	out := make([]LogEntry, len(d.entries))
	copy(out, d.entries)
	d.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// HandleClearLogs empties the in-memory log buffer.
func (d *DebugLogger) HandleClearLogs(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	d.entries = d.entries[:0]
	d.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

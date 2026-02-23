package filewatch

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/paulmmoore3416/dcc/internal/websockets"
)

type Watcher struct {
	watcher *fsnotify.Watcher
	hub     *websockets.Hub
	watched map[string]bool
}

func NewWatcher(hub *websockets.Hub) *Watcher {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("Failed to create file watcher: %v", err)
	}

	return &Watcher{
		watcher: watcher,
		hub:     hub,
		watched: make(map[string]bool),
	}
}

func (w *Watcher) Start(ctx context.Context) {
	defer w.watcher.Close()

	// Watch common docker-compose locations
	w.addWatchPaths()

	log.Println("📁 File watcher started - monitoring docker-compose.yml files")

	for {
		select {
		case <-ctx.Done():
			return

		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}

			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
				if w.isComposeFile(event.Name) {
					log.Printf("File changed: %s", event.Name)
					
					// Read file content
					content, err := os.ReadFile(event.Name)
					if err != nil {
						continue
					}

					// Broadcast change via WebSocket
					w.hub.Broadcast(map[string]interface{}{
						"type": "file_change",
						"data": map[string]interface{}{
							"path":      event.Name,
							"content":   string(content),
							"timestamp": time.Now().Unix(),
						},
					})
				}
			}

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("File watcher error: %v", err)
		}
	}
}

func (w *Watcher) addWatchPaths() {
	searchPaths := []string{
		".",
		"./docker",
		"./compose",
		os.Getenv("HOME") + "/docker",
	}

	for _, basePath := range searchPaths {
		if _, err := os.Stat(basePath); os.IsNotExist(err) {
			continue
		}

		filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}

			if info.IsDir() {
				if !w.watched[path] {
					w.watcher.Add(path)
					w.watched[path] = true
				}
			} else if w.isComposeFile(path) {
				dir := filepath.Dir(path)
				if !w.watched[dir] {
					w.watcher.Add(dir)
					w.watched[dir] = true
					log.Printf("Watching: %s", dir)
				}
			}
			return nil
		})
	}
}

func (w *Watcher) isComposeFile(path string) bool {
	name := filepath.Base(path)
	return strings.HasSuffix(name, "docker-compose.yml") ||
		strings.HasSuffix(name, "docker-compose.yaml") ||
		strings.HasSuffix(name, "compose.yml") ||
		strings.HasSuffix(name, "compose.yaml")
}

func (w *Watcher) AddPath(path string) error {
	if w.watched[path] {
		return nil
	}

	if err := w.watcher.Add(path); err != nil {
		return err
	}

	w.watched[path] = true
	log.Printf("Added watch path: %s", path)
	return nil
}

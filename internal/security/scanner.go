package security

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/gorilla/mux"

	"github.com/paulmmoore3416/dcc/internal/websockets"
)

type SecurityScanner struct {
	cli         *client.Client
	hub         *websockets.Hub
	mu          sync.RWMutex
	scanResults map[string]*ScanResult
}

type ScanResult struct {
	ImageName       string          `json:"image_name"`
	ScanDate        time.Time       `json:"scan_date"`
	TotalVulns      int             `json:"total_vulns"`
	Critical        int             `json:"critical"`
	High            int             `json:"high"`
	Medium          int             `json:"medium"`
	Low             int             `json:"low"`
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
	Recommendations []string        `json:"recommendations"`
	TrivyAvailable  bool            `json:"trivy_available"`
}

type Vulnerability struct {
	ID          string `json:"id"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Package     string `json:"package"`
	Version     string `json:"version"`
	FixedIn     string `json:"fixed_in"`
	URL         string `json:"url"`
}

type TrivyOutput struct {
	Results []struct {
		Vulnerabilities []struct {
			VulnerabilityID string `json:"VulnerabilityID"`
			PkgName         string `json:"PkgName"`
			InstalledVersion string `json:"InstalledVersion"`
			FixedVersion    string `json:"FixedVersion"`
			Severity        string `json:"Severity"`
			Title           string `json:"Title"`
			Description     string `json:"Description"`
			PrimaryURL      string `json:"PrimaryURL"`
		} `json:"Vulnerabilities"`
	} `json:"Results"`
}

func NewSecurityScanner(cli *client.Client, hub *websockets.Hub) *SecurityScanner {
	return &SecurityScanner{
		cli:         cli,
		hub:         hub,
		scanResults: make(map[string]*ScanResult),
	}
}

func (s *SecurityScanner) isTrivyInstalled() bool {
	_, err := exec.LookPath("trivy")
	return err == nil
}

func (s *SecurityScanner) ScanImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	image := vars["image"]

	result, err := s.performScan(r.Context(), image)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *SecurityScanner) performScan(ctx context.Context, image string) (*ScanResult, error) {
	result := &ScanResult{
		ImageName:       image,
		ScanDate:        time.Now(),
		Vulnerabilities: []Vulnerability{},
		Recommendations: []string{},
		TrivyAvailable:  s.isTrivyInstalled(),
	}

	if !result.TrivyAvailable {
		result.Recommendations = append(result.Recommendations,
			"Install Trivy for vulnerability scanning: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin")
		
		// Still provide container hardening recommendations
		result.Recommendations = append(result.Recommendations, s.getHardeningRecommendations(ctx, image)...)
		
		s.mu.Lock()
		s.scanResults[image] = result
		s.mu.Unlock()
		
		return result, nil
	}

	// Run Trivy scan
	cmd := exec.CommandContext(ctx, "trivy", "image", "--format", "json", "--quiet", image)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("trivy scan failed: %v", err)
	}

	// Parse Trivy output
	var trivyOutput TrivyOutput
	if err := json.Unmarshal(output, &trivyOutput); err != nil {
		return nil, fmt.Errorf("failed to parse trivy output: %v", err)
	}

	// Convert to our format
	for _, tr := range trivyOutput.Results {
		for _, v := range tr.Vulnerabilities {
			vuln := Vulnerability{
				ID:          v.VulnerabilityID,
				Severity:    strings.ToLower(v.Severity),
				Title:       v.Title,
				Description: v.Description,
				Package:     v.PkgName,
				Version:     v.InstalledVersion,
				FixedIn:     v.FixedVersion,
				URL:         v.PrimaryURL,
			}
			result.Vulnerabilities = append(result.Vulnerabilities, vuln)

			switch vuln.Severity {
			case "critical":
				result.Critical++
			case "high":
				result.High++
			case "medium":
				result.Medium++
			case "low":
				result.Low++
			}
		}
	}

	result.TotalVulns = len(result.Vulnerabilities)

	// Add hardening recommendations
	result.Recommendations = s.getHardeningRecommendations(ctx, image)

	// Store result
	s.mu.Lock()
	s.scanResults[image] = result
	s.mu.Unlock()

	// Broadcast if critical or high vulns found
	if result.Critical > 0 || result.High > 0 {
		s.hub.Broadcast(map[string]interface{}{
			"type": "security_alert",
			"data": map[string]interface{}{
				"image":    image,
				"critical": result.Critical,
				"high":     result.High,
			},
		})
	}

	return result, nil
}

func (s *SecurityScanner) getHardeningRecommendations(ctx context.Context, image string) []string {
	var recommendations []string

	// Check if running as root
	containers, _ := s.cli.ContainerList(ctx, container.ListOptions{All: true})
	for _, cont := range containers {
		if cont.Image == image {
			inspect, err := s.cli.ContainerInspect(ctx, cont.ID)
			if err == nil {
				if inspect.Config.User == "" || inspect.Config.User == "root" || inspect.Config.User == "0" {
					recommendations = append(recommendations,
						"⚠️ Container is running as root. Add 'user: 1000:1000' to your compose file or use USER in Dockerfile")
				}

				if !inspect.HostConfig.ReadonlyRootfs {
					recommendations = append(recommendations,
						"💡 Enable read-only root filesystem: 'read_only: true' in compose file")
				}

				if len(inspect.HostConfig.CapAdd) > 0 {
					recommendations = append(recommendations,
						fmt.Sprintf("⚠️ Container has additional capabilities: %v. Remove unless necessary", inspect.HostConfig.CapAdd))
				}

				if inspect.HostConfig.Privileged {
					recommendations = append(recommendations,
						"🚨 Container is running in privileged mode - this is a security risk!")
				}

				if len(inspect.HostConfig.SecurityOpt) == 0 {
					recommendations = append(recommendations,
						"💡 Consider adding security options: seccomp, AppArmor, or SELinux profiles")
				}
			}
		}
	}

	// General recommendations
	recommendations = append(recommendations,
		"💡 Use specific image tags instead of 'latest'",
		"💡 Scan images regularly and update to patched versions",
		"💡 Use multi-stage builds to reduce attack surface",
		"💡 Implement health checks for better monitoring",
	)

	return recommendations
}

func (s *SecurityScanner) ScanAllContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := s.cli.ContainerList(r.Context(), container.ListOptions{All: false})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	results := make(map[string]*ScanResult)
	seen := make(map[string]bool)

	for _, cont := range containers {
		if !seen[cont.Image] {
			seen[cont.Image] = true
			result, err := s.performScan(r.Context(), cont.Image)
			if err == nil {
				results[cont.Image] = result
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (s *SecurityScanner) GetScanResults(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.scanResults)
}

func (s *SecurityScanner) GetImageScan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	image := vars["image"]

	s.mu.RLock()
	result, exists := s.scanResults[image]
	s.mu.RUnlock()

	if !exists {
		http.Error(w, "No scan results found for this image", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *SecurityScanner) InstallTrivyGuide(w http.ResponseWriter, r *http.Request) {
	guide := map[string]interface{}{
		"installed": s.isTrivyInstalled(),
		"install_commands": map[string]string{
			"linux":   "curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin",
			"mac":     "brew install trivy",
			"windows": "choco install trivy",
		},
		"description": "Trivy is a comprehensive security scanner that detects vulnerabilities, misconfigurations, and secrets in containers",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(guide)
}

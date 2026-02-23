package sandbox

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

type SandboxManager struct {
	cli *client.Client
}

type SandboxProfile struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Seccomp     string   `json:"seccomp"`
	Capabilities []string `json:"capabilities"`
	ReadOnly    bool     `json:"read_only"`
	NoPrivilege bool     `json:"no_privilege"`
	NetworkMode string   `json:"network_mode"`
}

type SandboxRequest struct {
	Image       string   `json:"image"`
	Command     []string `json:"command"`
	Profile     string   `json:"profile"`
	Environment []string `json:"environment"`
	Volumes     []string `json:"volumes"`
}

func NewSandboxManager(cli *client.Client) *SandboxManager {
	return &SandboxManager{cli: cli}
}

func (sm *SandboxManager) GetProfiles(w http.ResponseWriter, r *http.Request) {
	profiles := []SandboxProfile{
		{
			Name:        "strict",
			Description: "Maximum security - blocks dangerous syscalls, no network, read-only filesystem",
			Seccomp:     "strict",
			Capabilities: []string{},
			ReadOnly:    true,
			NoPrivilege: true,
			NetworkMode: "none",
		},
		{
			Name:        "moderate",
			Description: "Balanced security - limits syscalls, restricted network, writable /tmp",
			Seccomp:     "moderate",
			Capabilities: []string{"CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"},
			ReadOnly:    false,
			NoPrivilege: true,
			NetworkMode: "bridge",
		},
		{
			Name:        "permissive",
			Description: "Minimal restrictions - default Docker seccomp, normal networking",
			Seccomp:     "default",
			Capabilities: []string{"CHOWN", "DAC_OVERRIDE", "FOWNER", "FSETID", "KILL", "SETGID", "SETUID", "NET_BIND_SERVICE"},
			ReadOnly:    false,
			NoPrivilege: true,
			NetworkMode: "bridge",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profiles)
}

func (sm *SandboxManager) RunSandboxed(w http.ResponseWriter, r *http.Request) {
	var req SandboxRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	profile := sm.getProfile(req.Profile)
	if profile == nil {
		http.Error(w, "Invalid profile", http.StatusBadRequest)
		return
	}

	// Create seccomp profile file
	seccompPath, err := sm.createSeccompProfile(profile.Seccomp)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create seccomp profile: %v", err), http.StatusInternalServerError)
		return
	}
	defer os.Remove(seccompPath)

	// Pull image if needed
	_, _, err = sm.cli.ImageInspectWithRaw(r.Context(), req.Image)
	if err != nil {
		http.Error(w, fmt.Sprintf("Image not found: %v", err), http.StatusNotFound)
		return
	}

	// Build container config
	config := &container.Config{
		Image: req.Image,
		Cmd:   req.Command,
		Env:   req.Environment,
		User:  "1000:1000", // Non-root user
		Labels: map[string]string{
			"dcc.sandbox":         "true",
			"dcc.sandbox.profile": profile.Name,
		},
	}

	hostConfig := &container.HostConfig{
		ReadonlyRootfs: profile.ReadOnly,
		Privileged:     false,
		NetworkMode:    container.NetworkMode(profile.NetworkMode),
		SecurityOpt: []string{
			fmt.Sprintf("seccomp=%s", seccompPath),
			"no-new-privileges",
		},
		CapDrop: []string{"ALL"},
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024, // 512MB limit
			NanoCPUs: 1000000000,         // 1 CPU limit
		},
	}

	// Add limited capabilities if specified
	if len(profile.Capabilities) > 0 {
		hostConfig.CapAdd = profile.Capabilities
	}

	// Create and start container
	resp, err := sm.cli.ContainerCreate(r.Context(), config, hostConfig, nil, nil, "")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create container: %v", err), http.StatusInternalServerError)
		return
	}

	if err := sm.cli.ContainerStart(r.Context(), resp.ID, container.StartOptions{}); err != nil {
		http.Error(w, fmt.Sprintf("Failed to start container: %v", err), http.StatusInternalServerError)
		return
	}

	// Wait for container to finish
	statusCh, errCh := sm.cli.ContainerWait(r.Context(), resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			http.Error(w, fmt.Sprintf("Container wait error: %v", err), http.StatusInternalServerError)
			return
		}
	case <-statusCh:
	}

	// Get logs
	logs, err := sm.cli.ContainerLogs(r.Context(), resp.ID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get logs: %v", err), http.StatusInternalServerError)
		return
	}
	defer logs.Close()

	// Read logs
	buf := make([]byte, 8192)
	n, _ := logs.Read(buf)
	output := string(buf[:n])

	// Remove container
	sm.cli.ContainerRemove(r.Context(), resp.ID, container.RemoveOptions{Force: true})

	result := map[string]interface{}{
		"container_id": resp.ID[:12],
		"output":       output,
		"profile":      profile.Name,
		"warnings":     resp.Warnings,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (sm *SandboxManager) getProfile(name string) *SandboxProfile {
	profiles := []SandboxProfile{
		{
			Name:        "strict",
			Seccomp:     "strict",
			Capabilities: []string{},
			ReadOnly:    true,
			NoPrivilege: true,
			NetworkMode: "none",
		},
		{
			Name:        "moderate",
			Seccomp:     "moderate",
			Capabilities: []string{"CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"},
			ReadOnly:    false,
			NoPrivilege: true,
			NetworkMode: "bridge",
		},
		{
			Name:        "permissive",
			Seccomp:     "default",
			Capabilities: []string{"CHOWN", "DAC_OVERRIDE", "FOWNER", "FSETID", "KILL", "SETGID", "SETUID", "NET_BIND_SERVICE"},
			ReadOnly:    false,
			NoPrivilege: true,
			NetworkMode: "bridge",
		},
	}

	for _, p := range profiles {
		if p.Name == name {
			return &p
		}
	}
	return nil
}

func (sm *SandboxManager) createSeccompProfile(profileType string) (string, error) {
	var profile map[string]interface{}

	switch profileType {
	case "strict":
		profile = map[string]interface{}{
			"defaultAction": "SCMP_ACT_ERRNO",
			"architectures": []string{"SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_AARCH64"},
			"syscalls": []map[string]interface{}{
				{
					"names": []string{
						"read", "write", "open", "close", "stat", "fstat", "lstat",
						"poll", "lseek", "mmap", "mprotect", "munmap", "brk",
						"rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
						"access", "pipe", "select", "sched_yield", "mremap",
						"msync", "mincore", "madvise", "dup", "dup2", "pause",
						"nanosleep", "getitimer", "alarm", "setitimer", "getpid",
						"socket", "connect", "accept", "sendto", "recvfrom",
						"sendmsg", "recvmsg", "shutdown", "bind", "listen",
						"getsockname", "getpeername", "socketpair", "setsockopt",
						"getsockopt", "clone", "fork", "vfork", "execve", "exit",
						"wait4", "kill", "uname", "fcntl", "flock", "fsync",
						"fdatasync", "truncate", "ftruncate", "getdents", "getcwd",
						"chdir", "fchdir", "readlink", "gettimeofday", "getrlimit",
						"getrusage", "sysinfo", "times", "ptrace", "getuid", "syslog",
						"getgid", "setuid", "setgid", "geteuid", "getegid", "setpgid",
					},
					"action": "SCMP_ACT_ALLOW",
				},
			},
		}
	case "moderate":
		profile = map[string]interface{}{
			"defaultAction": "SCMP_ACT_ERRNO",
			"architectures": []string{"SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_AARCH64"},
			"syscalls": []map[string]interface{}{
				{
					"names": []string{
						"accept", "accept4", "access", "adjtimex", "alarm", "bind", "brk",
						"capget", "capset", "chdir", "chmod", "chown", "chown32", "clock_adjtime",
						"clock_getres", "clock_gettime", "clock_nanosleep", "close", "connect",
						"copy_file_range", "creat", "dup", "dup2", "dup3", "epoll_create", "epoll_create1",
						"epoll_ctl", "epoll_ctl_old", "epoll_pwait", "epoll_wait", "epoll_wait_old",
						"eventfd", "eventfd2", "execve", "execveat", "exit", "exit_group", "faccessat",
						"fadvise64", "fallocate", "fanotify_mark", "fchdir", "fchmod", "fchmodat",
						"fchown", "fchown32", "fchownat", "fcntl", "fcntl64", "fdatasync", "fgetxattr",
						"flistxattr", "flock", "fork", "fremovexattr", "fsetxattr", "fstat", "fstat64",
						"fstatat64", "fstatfs", "fstatfs64", "fsync", "ftruncate", "ftruncate64",
						"futex", "getcpu", "getcwd", "getdents", "getdents64", "getegid", "getegid32",
						"geteuid", "geteuid32", "getgid", "getgid32", "getgroups", "getgroups32",
						"getitimer", "getpeername", "getpgid", "getpgrp", "getpid", "getppid",
						"getpriority", "getrandom", "getresgid", "getresgid32", "getresuid", "getresuid32",
						"getrlimit", "get_robust_list", "getrusage", "getsid", "getsockname", "getsockopt",
						"get_thread_area", "gettid", "gettimeofday", "getuid", "getuid32", "getxattr",
						"inotify_add_watch", "inotify_init", "inotify_init1", "inotify_rm_watch",
						"io_cancel", "ioctl", "io_destroy", "io_getevents", "ioprio_get", "ioprio_set",
						"io_setup", "io_submit", "kill", "lchown", "lchown32", "lgetxattr", "link",
						"linkat", "listen", "listxattr", "llistxattr", "lremovexattr", "lseek", "lsetxattr",
						"lstat", "lstat64", "madvise", "memfd_create", "mincore", "mkdir", "mkdirat",
						"mknod", "mknodat", "mlock", "mlock2", "mlockall", "mmap", "mmap2", "mprotect",
						"mq_getsetattr", "mq_notify", "mq_open", "mq_timedreceive", "mq_timedsend",
						"mq_unlink", "mremap", "msgctl", "msgget", "msgrcv", "msgsnd", "msync", "munlock",
						"munlockall", "munmap", "nanosleep", "newfstatat", "open", "openat", "pause",
						"pipe", "pipe2", "poll", "ppoll", "prctl", "pread64", "preadv", "preadv2",
						"prlimit64", "pselect6", "pwrite64", "pwritev", "pwritev2", "read", "readahead",
						"readlink", "readlinkat", "readv", "recv", "recvfrom", "recvmsg", "recvmmsg",
						"remap_file_pages", "removexattr", "rename", "renameat", "renameat2", "restart_syscall",
						"rmdir", "rt_sigaction", "rt_sigpending", "rt_sigprocmask", "rt_sigqueueinfo",
						"rt_sigreturn", "rt_sigsuspend", "rt_sigtimedwait", "rt_tgsigqueueinfo",
						"sched_getaffinity", "sched_getattr", "sched_getparam", "sched_get_priority_max",
						"sched_get_priority_min", "sched_getscheduler", "sched_rr_get_interval",
						"sched_setaffinity", "sched_setattr", "sched_setparam", "sched_setscheduler",
						"sched_yield", "seccomp", "select", "semctl", "semget", "semop", "semtimedop",
						"send", "sendfile", "sendfile64", "sendmmsg", "sendmsg", "sendto", "setfsgid",
						"setfsgid32", "setfsuid", "setfsuid32", "setgid", "setgid32", "setgroups",
						"setgroups32", "setitimer", "setpgid", "setpriority", "setregid", "setregid32",
						"setresgid", "setresgid32", "setresuid", "setresuid32", "setreuid", "setreuid32",
						"setrlimit", "set_robust_list", "setsid", "setsockopt", "set_thread_area",
						"set_tid_address", "setuid", "setuid32", "setxattr", "shmat", "shmctl", "shmdt",
						"shmget", "shutdown", "sigaltstack", "signalfd", "signalfd4", "sigreturn",
						"socket", "socketcall", "socketpair", "splice", "stat", "stat64", "statfs",
						"statfs64", "statx", "symlink", "symlinkat", "sync", "sync_file_range",
						"syncfs", "sysinfo", "tee", "tgkill", "time", "timer_create", "timer_delete",
						"timerfd_create", "timerfd_gettime", "timerfd_settime", "timer_getoverrun",
						"timer_gettime", "timer_settime", "times", "tkill", "truncate", "truncate64",
						"ugetrlimit", "umask", "uname", "unlink", "unlinkat", "utime", "utimensat",
						"utimes", "vfork", "vmsplice", "wait4", "waitid", "waitpid", "write", "writev",
					},
					"action": "SCMP_ACT_ALLOW",
				},
			},
		}
	default:
		// Use Docker's default seccomp profile
		return "unconfined", nil
	}

	// Write profile to temp file
	tmpDir := os.TempDir()
	tmpFile := filepath.Join(tmpDir, fmt.Sprintf("seccomp-%s.json", profileType))

	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return "", err
	}

	return tmpFile, nil
}

func (sm *SandboxManager) ListSandboxed(w http.ResponseWriter, r *http.Request) {
	containers, err := sm.cli.ContainerList(r.Context(), container.ListOptions{
		All: true,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var sandboxed []map[string]interface{}
	for _, cont := range containers {
		if cont.Labels["dcc.sandbox"] == "true" {
			sandboxed = append(sandboxed, map[string]interface{}{
				"id":      cont.ID[:12],
				"image":   cont.Image,
				"profile": cont.Labels["dcc.sandbox.profile"],
				"state":   cont.State,
				"created": cont.Created,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sandboxed)
}

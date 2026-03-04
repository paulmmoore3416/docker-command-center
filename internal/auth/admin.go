package auth

import "time"

// UserInfo is a sanitized user record without credentials.
type UserInfo struct {
	Username       string `json:"username"`
	Name           string `json:"name"`
	Role           string `json:"role"`
	ActiveSessions int    `json:"active_sessions"`
}

// SessionInfo is a session record safe for admin display.
type SessionInfo struct {
	Token     string    `json:"token"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// ListUsers returns all registered users with their active session counts.
func ListUsers() []UserInfo {
	sessionsMu.RLock()
	counts := map[string]int{}
	now := time.Now()
	for _, s := range sessions {
		if now.Sub(s.CreatedAt) <= sessionTTL {
			counts[s.Username]++
		}
	}
	sessionsMu.RUnlock()

	result := make([]UserInfo, 0, len(users))
	for _, u := range users {
		result = append(result, UserInfo{
			Username:       u.Username,
			Name:           u.Name,
			Role:           u.Role,
			ActiveSessions: counts[u.Username],
		})
	}
	return result
}

// ListActiveSessions returns all non-expired sessions.
func ListActiveSessions() []SessionInfo {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	now := time.Now()
	result := make([]SessionInfo, 0)
	for _, s := range sessions {
		if now.Sub(s.CreatedAt) <= sessionTTL {
			result = append(result, SessionInfo{
				Token:     s.Token,
				Username:  s.Username,
				Role:      s.Role,
				CreatedAt: s.CreatedAt,
				ExpiresAt: s.CreatedAt.Add(sessionTTL),
			})
		}
	}
	return result
}

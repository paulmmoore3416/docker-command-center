package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	ContextUser contextKey = "dcc.user"
	ContextRole contextKey = "dcc.role"
)

type Config struct {
	APIKey string
}

type Permission string

const (
	PermRead  Permission = "read"
	PermWrite Permission = "write"
	PermAdmin Permission = "admin"
)

var rolePermissions = map[string]map[Permission]bool{
	"viewer":   {PermRead: true},
	"operator": {PermRead: true, PermWrite: true},
	"admin":    {PermRead: true, PermWrite: true, PermAdmin: true},
}

// Middleware validates the session token (or falls back to legacy API key +
// X-Role header) and enforces the required permission.
func Middleware(cfg Config, permission Permission, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username := ""
		role := ""

		// Prefer session-token auth.
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			session, ok := LookupSession(token)
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte("session expired or invalid — please log in again"))
				return
			}
			username = session.Username
			role = session.Role
		} else {
			// Legacy: allow API-key + X-Role header path (dev/testing).
			if cfg.APIKey != "" {
				apiKey := r.Header.Get("X-API-Key")
				if apiKey == "" || apiKey != cfg.APIKey {
					w.WriteHeader(http.StatusUnauthorized)
					w.Write([]byte("missing or invalid API key"))
					return
				}
			}
			role = r.Header.Get("X-Role")
			username = r.Header.Get("X-User")
			if role == "" {
				role = "admin"
			}
		}

		perms, ok := rolePermissions[role]
		if !ok || !perms[permission] {
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte("insufficient permissions"))
			return
		}

		ctx := context.WithValue(r.Context(), ContextUser, username)
		ctx = context.WithValue(ctx, ContextRole, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ContextUser).(string); ok {
		return v
	}
	return ""
}

func RoleFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ContextRole).(string); ok {
		return v
	}
	return ""
}

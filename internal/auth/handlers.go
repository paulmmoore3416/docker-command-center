package auth

import (
	"encoding/json"
	"net/http"
	"strings"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token    string `json:"token"`
	Role     string `json:"role"`
	Username string `json:"username"`
	Name     string `json:"name"`
}

// LoginHandler handles POST /api/auth/login.
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, ok := ValidateCredentials(req.Username, req.Password)
	if !ok {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	session, err := CreateSession(user)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{
		Token:    session.Token,
		Role:     session.Role,
		Username: user.Username,
		Name:     user.Name,
	})
}

// LogoutHandler handles POST /api/auth/logout.
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	token := tokenFromRequest(r)
	if token != "" {
		DeleteSession(token)
	}
	w.WriteHeader(http.StatusNoContent)
}

// MeHandler handles GET /api/auth/me — returns the current session info.
func MeHandler(w http.ResponseWriter, r *http.Request) {
	token := tokenFromRequest(r)
	if token == "" {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	session, ok := LookupSession(token)
	if !ok {
		http.Error(w, "session expired or invalid", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"username": session.Username,
		"role":     session.Role,
	})
}

// tokenFromRequest extracts the bearer token from the Authorization header.
func tokenFromRequest(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}
	return ""
}

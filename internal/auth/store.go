package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// User represents a local user with credentials and role.
type User struct {
	Username string
	Password string
	Role     string
	Name     string
}

// Session holds a login session.
type Session struct {
	Token     string
	Username  string
	Role      string
	CreatedAt time.Time
}

var (
	// users is the static credential store.
	users = map[string]User{
		"demo": {
			Username: "demo",
			Password: "demo123",
			Role:     "operator",
			Name:     "Demo User",
		},
		"pepaw34": {
			Username: "pepaw34",
			Password: "BigBlock2634!$",
			Role:     "admin",
			Name:     "Administrator",
		},
	}

	sessionsMu sync.RWMutex
	sessions   = map[string]Session{}

	// sessionTTL is how long sessions remain valid.
	sessionTTL = 24 * time.Hour
)

// ValidateCredentials checks username/password and returns the matching User.
func ValidateCredentials(username, password string) (User, bool) {
	u, ok := users[username]
	if !ok || u.Password != password {
		return User{}, false
	}
	return u, true
}

// CreateSession mints a new random token for the given user.
func CreateSession(u User) (Session, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return Session{}, err
	}
	token := hex.EncodeToString(b)

	s := Session{
		Token:     token,
		Username:  u.Username,
		Role:      u.Role,
		CreatedAt: time.Now(),
	}

	sessionsMu.Lock()
	sessions[token] = s
	sessionsMu.Unlock()

	return s, nil
}

// LookupSession finds a valid (non-expired) session by token.
func LookupSession(token string) (Session, bool) {
	sessionsMu.RLock()
	s, ok := sessions[token]
	sessionsMu.RUnlock()

	if !ok {
		return Session{}, false
	}
	if time.Since(s.CreatedAt) > sessionTTL {
		sessionsMu.Lock()
		delete(sessions, token)
		sessionsMu.Unlock()
		return Session{}, false
	}
	return s, true
}

// DeleteSession revokes a session token.
func DeleteSession(token string) {
	sessionsMu.Lock()
	delete(sessions, token)
	sessionsMu.Unlock()
}

# ─── Stage 1: Build frontend ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Build Go binary ──────────────────────────────────────────────
FROM golang:1.24-alpine AS go-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o dcc ./cmd/dcc/

# ─── Stage 3: Final image ──────────────────────────────────────────────────
FROM alpine:3.19

WORKDIR /app

# ca-certificates needed for Docker client TLS
RUN apk add --no-cache ca-certificates

COPY --from=go-builder /app/dcc ./dcc
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 9876

# Docker socket is mounted at runtime: -v /var/run/docker.sock:/var/run/docker.sock
ENTRYPOINT ["./dcc"]

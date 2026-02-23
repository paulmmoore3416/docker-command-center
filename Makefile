.PHONY: build install run clean frontend backend all

all: frontend backend build

frontend:
	cd frontend && npm install && npm run build

backend:
	go mod download

build: frontend backend
	go build -o dcc cmd/dcc/main.go

install: build
	sudo cp dcc /usr/local/bin/dcc
	@echo "DCC installed to /usr/local/bin/dcc"

run: build
	./dcc

clean:
	rm -f dcc
	rm -rf frontend/dist
	rm -rf frontend/node_modules

dev-backend:
	go run cmd/dcc/main.go

dev-frontend:
	cd frontend && npm run dev

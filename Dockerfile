# Multi-stage Dockerfile for Slotopol Server
# Usage:
#   docker build -t slotopol-server .
#   docker run -p 8080:8080 slotopol-server

# Frontend build stage. The resulting static application is copied into the
# Nginx image below and is served from the same origin as the API.
FROM node:20.19.6-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run typecheck && npm run build

# Build stage
FROM golang:1.25-bookworm AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o slot-server main.go

# Nginx image for the production frontend and reverse proxy.
FROM nginx:1.27-alpine AS nginx-runtime

COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Runtime stage
FROM ubuntu:22.04 AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/slot-server .
COPY --from=builder /app/config ./config
COPY --from=builder /app/appdata ./appdata
COPY --from=builder /app/deploy/slot-app.prod.yaml ./deploy/slot-app.prod.yaml
COPY --from=builder /app/migrations ./migrations

# Run the application without root privileges. The database volume is mounted
# at /app/data and is initialized from this directory's ownership when empty.
RUN groupadd --gid 10001 slotopol \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin slotopol \
    && mkdir -p /app/data \
    && chown -R 10001:10001 /app/data

USER 10001:10001

# Expose port
EXPOSE 8080

# Set environment variables
ENV SLOTOPOL_DBDRIVER=sqlite3
ENV SLOTOPOL_CLUBDSN=/app/data/slot-club.sqlite
ENV SLOTOPOL_SPINDSN=/app/data/slot-spin.sqlite

# Run the application
CMD ["./slot-server", "-v", "web"]

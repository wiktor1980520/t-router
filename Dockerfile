# Build Stage
FROM golang:alpine AS builder

WORKDIR /app

# Install git and build tools if needed
RUN apk add --no-cache git

# Copy go.mod and go.sum first for dependency caching
COPY go.mod ./
# COPY go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
# -s -w: Strip debug symbols to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o trouter-gateway cmd/gateway/main.go

# Run Stage
FROM alpine:latest

WORKDIR /app

# Install CA certificates for HTTPS requests (if needed)
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/trouter-gateway .

# Expose port
EXPOSE 8080

# Run the application
CMD ["./trouter-gateway"]

# Build Stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy source code first (simplest approach for now)
COPY . .

# Build the binary
# -s -w: Strip debug symbols to reduce binary size
# Must initialize module first if not present in container (though COPY should bring it)
RUN ls -la
RUN go mod download
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

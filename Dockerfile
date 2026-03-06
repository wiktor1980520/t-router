# Build Stage
# Use public.ecr.aws to avoid Docker Hub rate limits and 1Panel mirror issues
FROM public.ecr.aws/docker/library/golang:1.23-alpine AS builder

WORKDIR /app

# Set GOPROXY for better connectivity in China (common for 1Panel users)
ENV GOPROXY=https://goproxy.cn,direct

# Install git for cloning if source is missing
RUN apk add --no-cache git

# Copy source code
COPY . .

# Auto-clone source code if go.mod is missing (handles case where user only uploaded Dockerfile)
# This allows building even if only Dockerfile and docker-compose.yml are present
RUN if [ ! -f go.mod ]; then \
    echo "go.mod not found, cloning from GitHub..."; \
    git clone https://github.com/wiktor1980520/t-router.git /tmp/source && \
    cp -r /tmp/source/* . && \
    rm -rf /tmp/source; \
    fi

# Build the binary
# -s -w: Strip debug symbols to reduce binary size
RUN ls -la
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o trouter-gateway cmd/gateway/main.go

# Run Stage
FROM public.ecr.aws/docker/library/alpine:3.20

WORKDIR /app

# Install CA certificates for HTTPS requests (if needed)
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/trouter-gateway .

# Expose port
EXPOSE 8080

# Run the application
CMD ["./trouter-gateway"]

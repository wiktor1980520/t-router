# Build Stage
# Use public.ecr.aws to avoid Docker Hub rate limits and 1Panel mirror issues
FROM public.ecr.aws/docker/library/golang:1.23-alpine AS builder

WORKDIR /app

# Set GOPROXY for better connectivity in China (common for 1Panel users)
ENV GOPROXY=https://goproxy.cn,direct

# Copy source code
COPY . .

# Build the binary
# -s -w: Strip debug symbols to reduce binary size
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

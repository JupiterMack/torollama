# TorOllama MCP Server Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install TOR and required packages
RUN apk add --no-cache \
    tor \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S torollama && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G torollama torollama

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create TOR configuration directory
RUN mkdir -p /app/tor-config /app/tor-data && \
    chown -R torollama:torollama /app

# Create TOR configuration file
RUN cat > /app/tor-config/torrc << 'EOF'
# TorOllama MCP Server Configuration
SocksPort 0.0.0.0:9050
ControlPort 127.0.0.1:9051
DataDirectory /app/tor-data

# Circuit settings for better anonymity
CircuitBuildTimeout 60
NewCircuitPeriod 30
MaxCircuitDirtiness 300
LearnCircuitBuildTimeout 0

# Exit node preferences
ExitNodes {us},{ca},{gb},{de},{fr},{nl},{se},{no},{dk},{au}
StrictNodes 0

# Security settings
CookieAuthentication 1
CookieAuthFile /app/tor-data/control_auth_cookie
ControlSocket /app/tor-data/control_socket
ControlSocketsGroupWritable 1

# Disable features not needed
ClientOnly 1
DisableDebuggerAttachment 0

# Logging
Log notice stdout
Log warn stdout
EOF

# Set proper permissions
RUN chown -R torollama:torollama /app/tor-config /app/tor-data && \
    chmod 700 /app/tor-data && \
    chmod 644 /app/tor-config/torrc

# Health check script
RUN cat > /app/healthcheck.sh << 'EOF'
#!/bin/sh
# Health check for TorOllama MCP Server

# Check if TOR is running
if ! pgrep tor > /dev/null; then
    echo "TOR process not running"
    exit 1
fi

# Check if SOCKS port is listening
if ! netstat -tln | grep -q ":9050.*LISTEN"; then
    echo "TOR SOCKS port not listening"
    exit 1
fi

# Test TOR connectivity
if ! curl -s --socks5 127.0.0.1:9050 --connect-timeout 10 \
    https://check.torproject.org/api/ip | grep -q '"IsTor":true'; then
    echo "TOR connectivity test failed"
    exit 1
fi

echo "Health check passed"
exit 0
EOF

RUN chmod +x /app/healthcheck.sh

# Startup script
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
set -e

echo "[TorOllama] Starting TOR daemon..."
tor -f /app/tor-config/torrc &
TOR_PID=$!

# Wait for TOR to be ready
echo "[TorOllama] Waiting for TOR to establish circuits..."
for i in $(seq 1 60); do
    if curl -s --socks5 127.0.0.1:9050 --connect-timeout 5 \
        https://check.torproject.org/api/ip >/dev/null 2>&1; then
        echo "[TorOllama] TOR is ready"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "[TorOllama] TOR startup timeout"
        exit 1
    fi
    sleep 2
done

echo "[TorOllama] Starting MCP Server..."
exec node /app/dist/index.js
EOF

RUN chmod +x /app/start.sh

# Switch to non-root user
USER torollama

# Expose ports
EXPOSE 9050 9051

# Environment variables
ENV NODE_ENV=production
ENV TOR_SOCKS_PORT=9050
ENV TOR_CONTROL_PORT=9051
ENV TOR_DATA_DIR=/app/tor-data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh

# Set entrypoint with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]

# Labels for metadata
LABEL maintainer="TorOllama Team"
LABEL description="MCP server providing TOR network connectivity for AI models"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="TorOllama MCP Server"
LABEL org.opencontainers.image.description="Anonymous AI connectivity through TOR"
LABEL org.opencontainers.image.vendor="TorOllama"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.schema-version="1.0"
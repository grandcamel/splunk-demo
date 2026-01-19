# Queue Manager Dockerfile
FROM node:20-slim

# Install Docker CLI and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd from GitHub releases (not available in Debian bookworm repos)
# SHA256 checksum from official release: https://github.com/tsl0922/ttyd/releases/download/1.7.7/SHA256SUMS
ARG TTYD_VERSION=1.7.7
ARG TTYD_SHA256=8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55

RUN curl -fsSL -o /usr/local/bin/ttyd \
    https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64 \
    && echo "${TTYD_SHA256}  /usr/local/bin/ttyd" | sha256sum -c - \
    && chmod +x /usr/local/bin/ttyd

# Install Python dependencies for cleanup script (Splunk SDK)
RUN pip3 install --break-system-packages --no-cache-dir \
    splunk-sdk>=2.0.0 \
    requests

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]

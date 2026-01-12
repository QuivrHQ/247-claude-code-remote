# Multi-stage Dockerfile for 247 Cloud Agent
# Build: docker build -t 247-cloud-agent .

# =============================================================================
# Stage 1: Build the 247-agent
# =============================================================================
FROM node:22-slim AS builder

WORKDIR /build

# Install build dependencies for node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy monorepo files needed for build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/agent ./apps/agent
COPY apps/cloud-agent/package.cloud.json ./apps/agent/package.json

# Install all dependencies
RUN pnpm install --frozen-lockfile=false

# Build shared package first (required by agent)
RUN cd packages/shared && pnpm build

# Build the agent
RUN cd apps/agent && pnpm build

# =============================================================================
# Stage 2: Final Ubuntu image with all dev tools
# =============================================================================
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

# Create user 'ariana' with sudo privileges
# Delete ubuntu user if exists (Ubuntu 24.04 has a default ubuntu user with UID 1000)
RUN userdel -r ubuntu 2>/dev/null || true && \
    useradd -m -s /bin/bash -u 1000 ariana && \
    echo 'ariana ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && \
    mkdir -p /home/ariana/.local/bin && \
    chown -R ariana:ariana /home/ariana

# Install base packages
RUN apt-get update && apt-get install -y \
    curl wget git build-essential cmake \
    software-properties-common apt-transport-https \
    ca-certificates gnupg lsb-release \
    tmux zsh fzf jq unzip zip ripgrep fd-find \
    sqlite3 ffmpeg imagemagick \
    locales sudo \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Python 3 + tools
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    && pip3 install --break-system-packages poetry uv \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (LTS) + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm@9 && \
    rm -rf /var/lib/apt/lists/*

# Go 1.23
RUN wget -q https://go.dev/dl/go1.23.4.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz && \
    rm go1.23.4.linux-amd64.tar.gz
ENV PATH=$PATH:/usr/local/go/bin:/home/ariana/go/bin

# Rust (as ariana user)
USER ariana
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
USER root
ENV PATH=$PATH:/home/ariana/.cargo/bin

# Docker CLI (no daemon - for building images)
RUN curl -fsSL https://get.docker.com | sh && \
    usermod -aG docker ariana

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun /home/ariana/.bun && \
    chown -R ariana:ariana /home/ariana/.bun
ENV PATH=$PATH:/home/ariana/.bun/bin

# Deno
USER ariana
RUN curl -fsSL https://deno.land/install.sh | sh
USER root
ENV PATH=$PATH:/home/ariana/.deno/bin

# Java 11 + Maven + Gradle
RUN apt-get update && apt-get install -y openjdk-11-jdk maven && \
    wget -q https://services.gradle.org/distributions/gradle-8.12-bin.zip && \
    unzip -d /opt gradle-8.12-bin.zip && rm gradle-8.12-bin.zip && \
    rm -rf /var/lib/apt/lists/*
ENV PATH=$PATH:/opt/gradle-8.12/bin
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64

# .NET 8
RUN wget -q https://dot.net/v1/dotnet-install.sh && \
    chmod +x dotnet-install.sh && \
    ./dotnet-install.sh --channel 8.0 --install-dir /usr/share/dotnet && \
    ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet && \
    rm dotnet-install.sh
ENV DOTNET_ROOT=/usr/share/dotnet

# PHP 8.3 + Composer (Ubuntu 24.04 has PHP 8.3 in main repos)
RUN apt-get update && apt-get install -y php php-cli php-mbstring php-xml php-curl && \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && \
    rm -rf /var/lib/apt/lists/*

# =============================================================================
# Install 247-agent
# =============================================================================
WORKDIR /opt/247-agent

# Copy built agent from builder stage
COPY --from=builder /build/apps/agent/dist ./dist
COPY --from=builder /build/apps/agent/node_modules ./node_modules
COPY --from=builder /build/apps/agent/package.json ./

# Create agent config directory
RUN mkdir -p /home/ariana/.247/data && \
    chown -R ariana:ariana /home/ariana/.247

# Copy cloud-specific config
COPY apps/cloud-agent/config.cloud.json /home/ariana/.247/config.json
RUN chown ariana:ariana /home/ariana/.247/config.json

# =============================================================================
# Setup workspace and environment
# =============================================================================
RUN mkdir -p /workspace && chown ariana:ariana /workspace
WORKDIR /workspace

# Set environment
ENV HOME=/home/ariana
ENV USER=ariana
ENV NODE_ENV=production

# Expose agent WebSocket port
EXPOSE 8911

# Run as ariana user
USER ariana

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8911/health || exit 1

# Start the agent
CMD ["node", "/opt/247-agent/dist/index.js"]

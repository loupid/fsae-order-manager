# Multi-stage Dockerfile for FSAE Order Manager (Optimized for Raspberry Pi / ARM64 & ARMv7)
# Architecture: Single-container unified SPA + REST API + SQLite WAL (< 45MB RAM)

# ===================================================
# --- Stage 1: Build the React 19 Frontend Bundle ---
# ===================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install dependencies (including devDependencies required for Vite & Tailwind)
COPY package*.json ./
RUN npm ci

# Copy frontend source code and compile production distribution
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# ===================================================
# --- Stage 2: Production Node.js Server & Host ---
# ===================================================
FROM node:20-alpine AS production
WORKDIR /app

# Install temporary build tools for native better-sqlite3 compilation on Alpine ARM
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Production environment configurations & V8 memory optimization (< 45MB RAM)
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/fsae_orders.db \
    NODE_OPTIONS="--max-old-space-size=128 --optimize-for-size"

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force && \
    apk del .build-deps

# Copy backend server codebase
COPY server/ ./server/

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Create persistent storage directories for SQLite database and PDF invoices
RUN mkdir -p /app/data /app/uploads/invoices

# Expose backend & frontend unified HTTP port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start backend server (executes migrations automatically on startup)
CMD ["node", "server/index.js"]

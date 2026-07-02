#!/bin/bash
set -e

# Bootstrap dependencies if node_modules are missing
if [ ! -d "/home/runner/workspace/node_modules/.pnpm" ]; then
  echo "node_modules missing — running pnpm install..."
  pnpm install --frozen-lockfile
fi

# Clear any stale process on the API port
echo "Clearing API port..."
fuser -k "${API_PORT:-8080}/tcp" 2>/dev/null || true

# Build and start the API server (frontend is served by artifacts/p2p-exchange: web)
echo "Building API server..."
pnpm --filter @workspace/api-server run build

echo "Starting API server on port ${API_PORT:-8080}..."
exec pnpm --filter @workspace/api-server run start

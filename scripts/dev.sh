#!/bin/bash
set -e

# Clear any stale process on the API port (artifact workflow may have grabbed it)
fuser -k ${API_PORT:-8080}/tcp 2>/dev/null || true

# Build and start the API server in the background
echo "Building API server..."
pnpm --filter @workspace/api-server run build

echo "Starting API server on port ${API_PORT:-8080}..."
pnpm --filter @workspace/api-server run start &
API_PID=$!

echo "Starting frontend dev server on port ${PORT:-5000}..."
pnpm --filter @workspace/p2p-exchange run dev &
FRONTEND_PID=$!

# Wait for both processes and exit if either dies
wait $API_PID $FRONTEND_PID

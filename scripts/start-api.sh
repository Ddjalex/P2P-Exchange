#!/bin/bash
set -e

if [ ! -d "/home/runner/workspace/node_modules/.pnpm" ]; then
  echo "node_modules missing — running pnpm install..."
  pnpm install --frozen-lockfile
fi

fuser -k "${API_PORT:-8080}/tcp" 2>/dev/null || true

exec pnpm --filter @workspace/api-server run dev

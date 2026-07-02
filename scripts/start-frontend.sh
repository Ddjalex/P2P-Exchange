#!/bin/bash
set -e

if [ ! -d "/home/runner/workspace/node_modules/.pnpm" ]; then
  echo "node_modules missing — running pnpm install..."
  pnpm install --frozen-lockfile
fi

fuser -k "${PORT:-5000}/tcp" 2>/dev/null || true

exec pnpm --filter @workspace/p2p-exchange run dev

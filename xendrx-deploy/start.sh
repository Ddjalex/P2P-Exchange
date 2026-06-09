#!/usr/bin/env bash
# Quick start without PM2 (for testing only)
# For production use: pm2 start ecosystem.config.js

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  echo "Copy .env.example to .env and fill in your values:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

set -a
source .env
set +a

mkdir -p logs uploads

echo "Starting Xendrx API server on port ${PORT:-8080}..."
node --enable-source-maps ./api/dist/index.mjs

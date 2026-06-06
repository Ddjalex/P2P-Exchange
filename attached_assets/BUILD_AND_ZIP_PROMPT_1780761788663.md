# Xendrx — Build + Zip for VPS Deployment
# Paste this into Replit AI

---

## TASK
Build the entire project for production and create a downloadable ZIP file
containing everything needed to deploy on a VPS.

---

## STEP 1 — Install zip tool

Run in shell:
```bash
nix-env -iA nixpkgs.zip && echo "ZIP INSTALLED"
```

---

## STEP 2 — Build frontend (React)

```bash
cd artifacts/p2p-exchange
pnpm run build
echo "FRONTEND BUILD DONE"
ls dist/
```

---

## STEP 3 — Build backend (Express)

```bash
cd /home/runner/workspace/artifacts/api-server
pnpm run build
echo "BACKEND BUILD DONE"
ls dist/
```

---

## STEP 4 — Create deployment package

Run this entire script in shell:

```bash
#!/bin/bash
set -e

echo "=== Creating Xendrx deployment package ==="

# Clean old deploy folder
rm -rf /home/runner/workspace/xendrx-deploy
mkdir -p /home/runner/workspace/xendrx-deploy

# ── Frontend ──
mkdir -p /home/runner/workspace/xendrx-deploy/frontend
cp -r /home/runner/workspace/artifacts/p2p-exchange/dist/. \
      /home/runner/workspace/xendrx-deploy/frontend/
echo "✅ Frontend copied"

# ── Backend ──
mkdir -p /home/runner/workspace/xendrx-deploy/backend
cp -r /home/runner/workspace/artifacts/api-server/dist/. \
      /home/runner/workspace/xendrx-deploy/backend/
cp /home/runner/workspace/artifacts/api-server/package.json \
   /home/runner/workspace/xendrx-deploy/backend/
echo "✅ Backend copied"

# ── PM2 ecosystem config ──
cat > /home/runner/workspace/xendrx-deploy/ecosystem.config.js << 'PMEOF'
module.exports = {
  apps: [{
    name: 'xendrx-api',
    script: './backend/index.js',
    cwd: '/var/www/xendrx',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/var/log/xendrx/error.log',
    out_file: '/var/log/xendrx/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
PMEOF
echo "✅ PM2 config created"

# ── Nginx config ──
cat > /home/runner/workspace/xendrx-deploy/nginx.conf << 'NGEOF'
server {
    listen 80;
    server_name xendrx.com www.xendrx.com;

    root /var/www/xendrx/frontend;
    index index.html;

    # React Router — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Static files cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf|mp3)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # PWA files — no cache
    location ~* \.(json|html)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # File upload size
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json
               application/javascript text/xml
               application/xml application/xml+rss text/javascript;
}
NGEOF
echo "✅ Nginx config created"

# ── .env template ──
cat > /home/runner/workspace/xendrx-deploy/.env.production << 'ENVEOF'
# ─── Database ────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/xendrx

# ─── User Auth ───────────────────────────────────
JWT_SECRET=CHANGE_THIS_TO_LONG_RANDOM_STRING_MIN_32_CHARS

# ─── Admin Auth ──────────────────────────────────
ADMIN_EMAIL=admin@xendrx.com
ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
ADMIN_JWT_SECRET=CHANGE_THIS_TO_ANOTHER_LONG_RANDOM_STRING

# ─── Server ──────────────────────────────────────
PORT=8080
NODE_ENV=production
LOG_LEVEL=info

# ─── App URL ─────────────────────────────────────
APP_URL=https://xendrx.com

# ─── Telegram Bot ────────────────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=XendrxBot

# ─── Push Notifications (VAPID) ──────────────────
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:support@xendrx.com

# ─── Cloudflare Turnstile ────────────────────────
TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret

ENVEOF
echo "✅ .env template created"

# ── Deploy instructions ──
cat > /home/runner/workspace/xendrx-deploy/DEPLOY.md << 'DOCEOF'
# Xendrx VPS Deployment Guide

## Files in this package:
- frontend/     → React build (serve with Nginx)
- backend/      → Express API build (run with PM2)
- ecosystem.config.js → PM2 config
- nginx.conf    → Nginx site config
- .env.production → Fill this with your real values

## Quick Deploy:
1. Upload this zip to /var/www/ on your VPS
2. unzip xendrx-deploy.zip
3. mv xendrx-deploy xendrx
4. cd xendrx
5. cp .env.production .env
6. nano .env  (fill in real values)
7. cd backend && npm install --production && cd ..
8. pm2 start ecosystem.config.js
9. Copy nginx.conf to /etc/nginx/sites-available/xendrx
10. ln -s /etc/nginx/sites-available/xendrx /etc/nginx/sites-enabled/
11. nginx -t && systemctl restart nginx
12. certbot --nginx -d xendrx.com -d www.xendrx.com
DOCEOF
echo "✅ Deploy guide created"

# ── Zip everything ──
cd /home/runner/workspace
zip -r xendrx-deploy.zip xendrx-deploy/
echo ""
echo "================================================"
echo "✅ BUILD COMPLETE!"
echo "File: /home/runner/workspace/xendrx-deploy.zip"
ls -lh xendrx-deploy.zip
echo "================================================"
echo "Download xendrx-deploy.zip from the Files panel"
```

---

## STEP 5 — Verify ZIP contents

```bash
unzip -l /home/runner/workspace/xendrx-deploy.zip | head -30
```

The ZIP should contain:
```
xendrx-deploy/
  frontend/         ← React build files
  backend/          ← Express build files
  ecosystem.config.js
  nginx.conf
  .env.production
  DEPLOY.md
```


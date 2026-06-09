# Xendrx — VPS Deployment Guide (Contabo)

## What's inside this package

```
xendrx-deploy/
├── api/dist/          Node.js API server (self-contained esbuild bundle)
├── public/            React frontend (static HTML/CSS/JS — serve via Nginx)
├── uploads/           Directory for user-uploaded files (KYC docs, etc.)
├── .env.example       All required environment variables
├── nginx.conf         Nginx reverse-proxy + SSL configuration
├── ecosystem.config.js  PM2 process manager config
├── start.sh           Quick manual start (testing only)
└── DEPLOY.md          This file
```

---

## Architecture Overview

```
Browser / Mobile
      │
      ▼
  Nginx (port 443 SSL)
      │
      ├── /           → serves  public/index.html  (React SPA)
      ├── /assets/*   → serves  public/assets/*    (JS/CSS, cached 1y)
      ├── /uploads/*  → serves  uploads/           (KYC documents)
      └── /api/*      → proxy → Node.js API (port 8080)
                                     │
                                     ▼
                              Neon PostgreSQL
                           (cloud-hosted, TLS)
```

### API Server
- **Runtime**: Node.js 20+ (ESM bundle, no node_modules needed)
- **Framework**: Express 5
- **Port**: 8080 (never exposed directly — only via Nginx proxy)
- **Auth**: JWT (HS256). Tokens stored in browser localStorage.
- **Real-time**: Server-Sent Events (SSE) at `/api/sse/events`
- **Uploads**: Multer → saved to `./uploads/` folder

### Database
- **Provider**: Neon PostgreSQL (cloud-managed, always TLS)
- **ORM**: Drizzle ORM
- **Connection**: Set `NEON_DATABASE_URL` in `.env`
- **Schema push**: Run `pnpm --filter @workspace/db run push` on the source machine to push schema changes to Neon

### Frontend
- **Framework**: React + Vite (single-page app)
- **Served**: as static files by Nginx
- **API calls**: relative URLs (e.g., `/api/auth/login`) — Nginx proxies them to the API server
- **Real-time**: SSE connection to `/api/sse/events` for live order/chat updates

---

## Prerequisites on the VPS

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx
sudo apt install -y nginx

# PM2 (process manager)
sudo npm install -g pm2

# Certbot (free SSL)
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step-by-Step Deployment

### 1. Upload the package
```bash
scp xendrx-deploy.zip root@YOUR_VPS_IP:/var/www/
ssh root@YOUR_VPS_IP
cd /var/www
unzip xendrx-deploy.zip
```

### 2. Set up environment variables
```bash
cp .env.example .env
nano .env   # fill in NEON_DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, etc.
```

Generate JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Run twice — once for JWT_SECRET, once for ADMIN_JWT_SECRET
```

### 3. Configure Nginx
```bash
# Copy config (replace yourdomain.com with your actual domain)
sudo cp nginx.conf /etc/nginx/sites-available/xendrx
sudo nano /etc/nginx/sites-available/xendrx   # update server_name

sudo ln -s /etc/nginx/sites-available/xendrx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Get free SSL certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 5. Copy static files to web root
```bash
sudo mkdir -p /var/www/xendrx
sudo cp -r public /var/www/xendrx/public
sudo mkdir -p /var/www/xendrx/uploads
sudo chown -R www-data:www-data /var/www/xendrx/public /var/www/xendrx/uploads
```

### 6. Start the API server with PM2
```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

### 7. Verify everything
```bash
pm2 status              # should show xendrx-api as "online"
pm2 logs xendrx-api     # check for startup errors
curl http://localhost:8080/api/health  # should return {"status":"ok"}
```

Then open `https://yourdomain.com` in your browser.

---

## Uploads directory
User-uploaded files (KYC identity documents) are saved to `./uploads/`. Make sure this path has write permission for the Node.js process user:
```bash
chown -R nodeuser:nodeuser /var/www/xendrx-deploy/uploads
```
Or adjust the path via the API server configuration.

## Updating the app
1. Rebuild on the Replit workspace (run the build again)
2. Download the new `xendrx-deploy.zip`
3. On the VPS:
```bash
pm2 stop xendrx-api
unzip -o xendrx-deploy.zip        # overwrite existing files
sudo cp -r public /var/www/xendrx/public
pm2 start xendrx-api
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API returns 502 Bad Gateway | `pm2 status` — API server may have crashed. Check `pm2 logs xendrx-api` |
| "Cannot connect to database" | Check `NEON_DATABASE_URL` in `.env`. Neon pauses idle projects — check Neon dashboard |
| Frontend shows blank page | Check browser console. Make sure `/var/www/xendrx/public/index.html` exists |
| SSE chat not updating | Nginx must have `proxy_buffering off` for `/api/sse/` — see `nginx.conf` |
| File uploads fail | Check `uploads/` directory exists and is writable |

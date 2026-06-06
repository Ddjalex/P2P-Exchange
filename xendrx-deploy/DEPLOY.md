# Xendrx VPS Deployment Guide

## Files in this package
- `frontend/`            → React build (served by Nginx)
- `backend/`             → Express API build (run with PM2)
- `ecosystem.config.js`  → PM2 process config
- `nginx.conf`           → Nginx site config
- `.env.production`      → Fill with your real values

## Prerequisites on VPS
```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
npm install -g pm2
```

## Deploy Steps

```bash
# 1. Upload and extract
scp xendrx-deploy.zip user@your-vps:/var/www/
ssh user@your-vps
cd /var/www && unzip xendrx-deploy.zip && mv xendrx-deploy xendrx

# 2. Configure environment
cd /var/www/xendrx
cp .env.production .env
nano .env   # fill in all real values

# 3. Install backend deps and start
cd backend && npm install --production && cd ..
mkdir -p /var/log/xendrx
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 4. Configure Nginx
cp nginx.conf /etc/nginx/sites-available/xendrx
ln -s /etc/nginx/sites-available/xendrx /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 5. SSL with Let's Encrypt
certbot --nginx -d xendrx.com -d www.xendrx.com

# 6. Run DB migrations (first deploy only)
# Connect to your Postgres and run Drizzle migrations
```

## Push Notifications — generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
Copy the output into your `.env`.

## Useful PM2 commands
```bash
pm2 status
pm2 logs xendrx-api
pm2 restart xendrx-api
```

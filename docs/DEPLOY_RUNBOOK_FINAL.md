# Production Deployment Runbook (Final Release)

This document provides complete, repeatable instructions for deploying the Mobile Shop Website & ERP platform into production environments.

---

## 1. System Architecture & Requirements

- **Runtime**: Node.js `v20.x` LTS or `v22.x`
- **Database**: PostgreSQL `v15.x` or `v16.x`
- **Reverse Proxy**: Nginx `1.22+` with SSL (Certbot / Let's Encrypt)
- **Process Manager**: PM2 `v5.x+` or `systemd`
- **Memory**: Minimum 2 GB RAM (4 GB recommended for Next.js build)
- **Disk**: Minimum 20 GB SSD

### Architecture Overview
```
Clients (Web & Mobile Browsers)
          │
          ▼
   Nginx (Port 443 / SSL)
    ├── /api/v1/*  ──▶  NestJS API Daemon (Port 4000) ──▶ PostgreSQL (Port 5432)
    └── /*          ──▶  Next.js Storefront (Port 3000)
```

---

## 2. Environment Configuration

### Backend API (`api/.env`)
```bash
NODE_ENV=production
PORT=4000
API_PREFIX=api/v1

# Database Connection (Direct Connection for migrations & pooling)
DATABASE_URL="postgresql://db_user:STRONG_PASSWORD@127.0.0.1:5432/novamobile?schema=public&connection_limit=25"

# Cryptographic Secrets (Generate with `openssl rand -hex 32`)
JWT_ACCESS_SECRET="GENERATE_64_CHAR_HEX_SECRET_FOR_ACCESS"
JWT_REFRESH_SECRET="GENERATE_64_CHAR_HEX_SECRET_FOR_REFRESH"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Storage Directories
UPLOAD_DIR="./uploads"
PRIVATE_UPLOAD_DIR="./private-uploads"
MAX_FILE_SIZE_BYTES=10485760 # 10MB

# Storefront URL for CORS & Payment Redirects
FRONTEND_URL="https://yourdomain.com"
```

### Storefront Frontend (`.env.production`)
```bash
NODE_ENV=production
PORT=3000

# Public API URL (accessible by browser)
NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api/v1"

# Internal API URL (for Server-Side Rendering fast path)
INTERNAL_API_URL="http://127.0.0.1:4000/api/v1"

# Site Metadata
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
```

---

## 3. Deployment Procedure

### Step 1: Pre-Flight Repository Hygiene
```bash
# Pull production release branch
git fetch origin
git checkout main
git pull --ff-only origin main

# Confirm working tree is clean
git status --porcelain
# Expected output: (empty)
```

### Step 2: Database Schema Migration
Always run migrations before building code:
```bash
cd api
npx prisma migrate deploy
npx prisma generate
cd ..
```

### Step 3: API Production Build & Launch
```bash
cd api
# Clean install dependencies
npm ci --omit=dev

# Compile TypeScript
npm run build

# Start or reload API daemon in PM2
pm2 start dist/src/main.js --name "novamobile-api" --time
cd ..
```

### Step 4: Storefront Production Build & Launch
```bash
# Clean install dependencies
npm ci

# Compile Next.js bundle
npm run build

# Start or reload Next.js in PM2
pm2 start npm --name "novamobile-web" -- start -- -p 3000
```

### Step 5: Save PM2 Process List
```bash
pm2 save
pm2 startup
```

---

## 4. Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/novamobile.conf`:

```nginx
# Rate limiting zone (10 requests/sec per IP)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# ----------------- API DOMAIN -----------------
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    client_max_body_size 12M;

    # Security Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Private uploads MUST never be served statically
    location ^~ /private-uploads/ {
        deny all;
        return 404;
    }

    # Public static uploads
    location ^~ /uploads/ {
        alias /var/www/novamobile/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # API Proxy
    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

# ----------------- STOREFRONT DOMAIN -----------------
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    client_max_body_size 5M;

    # Security Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    # Next.js Static Assets
    location /_next/static/ {
        alias /var/www/novamobile/.next/static/;
        expires 365d;
        access_log off;
    }

    # Public Storefront Static Files
    location /images/ {
        alias /var/www/novamobile/public/images/;
        expires 30d;
        access_log off;
    }

    # Next.js Application Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload Nginx:
```bash
ln -sf /etc/nginx/sites-available/novamobile.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 5. Post-Deployment Verification

Run the automated live smoke verification tool:
```bash
node scripts/qa/smoke_production.mjs --url=https://api.yourdomain.com --store-url=https://yourdomain.com
```

Confirm all 12+ tests report `[PASS]` and complete manual verification items in [`docs/POST_DEPLOY_CHECKLIST.md`](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/POST_DEPLOY_CHECKLIST.md).

---

## 6. Rollback Procedures

If a critical issue occurs during deployment:

### Fast Code Rollback
```bash
# 1. Rollback to previous Git tag or commit
git reset --hard PREVIOUS_STABLE_COMMIT_HASH

# 2. Re-install & Re-build
cd api && npm ci && npm run build && cd ..
npm ci && npm run build

# 3. Reload PM2 processes
pm2 reload all
```

### Database Rollback
If a schema migration corrupted state:
```bash
# 1. Stop app traffic
pm2 stop novamobile-api

# 2. Restore pre-deployment database backup
dropdb -U postgres novamobile
createdb -U postgres novamobile
psql -U postgres novamobile < /var/backups/novamobile_pre_deploy.sql

# 3. Restart app
pm2 restart novamobile-api
```

---

## 7. Maintenance & Operations

- **PM2 Log Inspection**: `pm2 logs --lines 100`
- **Nginx Error Logs**: `tail -f /var/log/nginx/error.log`
- **PostgreSQL Service**: `systemctl status postgresql`
- **Restart Application**: `pm2 restart all`

# Deployment Runbook — Pass 50 Pre-Deployment Hardening

**Target Host:** Hostinger KVM VPS (Ubuntu 22.04 / Debian)  
**Deploy User:** `deploy`  
**Database:** PostgreSQL 14 (local instance on `localhost:5432`)  
**Services:** Next.js Storefront (`:3000`), NestJS API (`:4000`), Nginx Reverse Proxy  

---

## Pre-Requisites & Checklist

Ensure SSH access with sudo privileges under the `deploy` user before beginning.

---

## Step 1: Create and Secure Private Uploads Directory

Run as user with sudo privileges:

```bash
# 1. Create private directory outside the public UPLOAD_ROOT
sudo mkdir -p /var/www/novamobile/private-uploads

# 2. Set ownership to deploy user
sudo chown -R deploy:deploy /var/www/novamobile/private-uploads

# 3. Set strict directory permissions (owner rwx, group rx, others none)
sudo chmod -R 750 /var/www/novamobile/private-uploads

# 4. Verify permissions
ls -ld /var/www/novamobile/private-uploads
# Output should show: drwxr-x--- ... deploy deploy /var/www/novamobile/private-uploads
```

---

## Step 2: Update Environment Variables

Ensure `.env.production` files contain valid values with `https://` protocol prefixes:

### `api/.env.production`
```ini
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://novamobile:YOUR_DB_PASSWORD@localhost:5432/novamobile?schema=public"

# File Storage
UPLOAD_ROOT="/var/www/novamobile/uploads"
PRIVATE_UPLOAD_ROOT="/var/www/novamobile/private-uploads"

# URLs (Must include https://)
FRONTEND_URL="https://mobilehubbd.tech"
API_URL="https://api.mobilehubbd.tech/api/v1"
INTERNAL_FRONTEND_URL="http://localhost:3000"
ALLOWED_ORIGINS="https://mobilehubbd.tech,https://www.mobilehubbd.tech"

# Security & Cache
REVALIDATION_SECRET="YOUR_RANDOM_HEX_SECRET"
```

### `.env.production` (Frontend Root)
```ini
NEXT_PUBLIC_SITE_URL="https://mobilehubbd.tech"
NEXT_PUBLIC_API_URL="https://api.mobilehubbd.tech/api/v1"
NEXT_PUBLIC_BACKEND_URL="https://api.mobilehubbd.tech"
INTERNAL_BACKEND_URL="http://localhost:4000"
REVALIDATION_SECRET="YOUR_RANDOM_HEX_SECRET"
```

---

## Step 3: Pre-Deployment Database Backup

Before applying any migration, create a full snapshot of PostgreSQL:

```bash
mkdir -p ~/backups
pg_dump -U novamobile -h localhost -d novamobile -Fc -f ~/backups/novamobile_pre_pass50_$(date +%Y%m%d_%H%M%S).dump
ls -lh ~/backups/
```

---

## Step 4: Code Update & Production Builds

```bash
cd /var/www/novamobile

# Pull latest commits
git pull origin main

# Build Backend
cd api
npm ci
npm run build

# Build Frontend
cd ..
npm ci
npm run build
```

---

## Step 5: Apply Database Migration

Apply the single additive schema migration cleanly:

```bash
cd /var/www/novamobile/api
npx prisma migrate deploy

# Verify clean status
npx prisma migrate status
# Expected: "Database schema is up to date!"
```

---

## Step 6: Migrate Existing Private Uploads

Run the idempotent migration script to move existing sensitive documents out of the public static root:

```bash
cd /var/www/novamobile/api

# Step 6a: Dry-Run (Verifies files and targets without moving)
npx ts-node ../scripts/migrate-private-uploads.ts

# Step 6b: Apply (Live file migration with size validation)
npx ts-node ../scripts/migrate-private-uploads.ts --apply

# Step 6c: Idempotency Check (Should scan 0 or already migrated)
npx ts-node ../scripts/migrate-private-uploads.ts --apply
```

---

## Step 7: Apply Nginx Directives & Reload

1. Edit your Nginx configuration according to [docs/DEPLOY_NGINX_REQUIREMENTS.md](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/DEPLOY_NGINX_REQUIREMENTS.md).
2. Test configuration syntax:
   ```bash
   sudo nginx -t
   ```
3. Reload Nginx without downtime:
   ```bash
   sudo systemctl reload nginx
   ```

---

## Step 8: Restart Application Services

Restart Node processes using PM2:

```bash
pm2 restart api
pm2 restart storefront
pm2 status
```

---

## Step 9: Post-Deployment Verification Curls

Execute these curls to verify operational readiness:

```bash
# 1. API Health Check (Must return 200)
curl -I https://api.mobilehubbd.tech/health

# 2. Private static upload blocks (Must return 403 Forbidden)
curl -I https://api.mobilehubbd.tech/uploads/staff-documents/sample.pdf
curl -I https://api.mobilehubbd.tech/uploads/purchase-documents/sample.pdf
curl -I https://api.mobilehubbd.tech/uploads/expenses/sample.pdf

# 3. Storefront Status (Must return 200)
curl -I https://mobilehubbd.tech/
```

# Post-Deployment Verification & Go-Live Operations Checklist

This document defines the mandatory operational procedures to execute immediately following any live production deployment of the Mobile Shop Website & ERP platform.

---

## 1. Automated Live Smoke Verification

Immediately following container startup or process reload, run the automated smoke test suite against the live production URLs:

```bash
# 1. Read-Only Production Health Sweep (Zero mutations)
node scripts/qa/smoke_production.mjs --url=https://api.yourdomain.com --store-url=https://yourdomain.com

# 2. Ephemeral End-to-End Probe (Creates and scrubs 1 probe account)
node scripts/qa/smoke_production.mjs --url=https://api.yourdomain.com --store-url=https://yourdomain.com --with-write-tests
```

**Passing Criteria:**
- All 14 automated health checks report `[PASS]` with exit code `0`.
- Zero 5xx errors across core API routes.

---

## 2. Network, SSL & Security Headers

| Check | Tool / Method | Expected Result | Verified By |
| :--- | :--- | :--- | :--- |
| **HTTPS Enforcement** | `curl -I http://yourdomain.com` | `301 Moved Permanently` to `https://` | [ ] |
| **SSL Certificate Validity** | Browser / `openssl s_client` | Valid certificate with > 30 days expiry | [ ] |
| **Security Headers** | `curl -I https://yourdomain.com` | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` | [ ] |
| **Private File Shield** | `curl -I https://api.yourdomain.com/private-uploads/test.pdf` | `403 Forbidden` or `404 Not Found` (never served statically) | [ ] |
| **CORS Policy** | `curl -H "Origin: https://malicious.com" -I https://api.yourdomain.com/api/v1/business-settings` | Access-Control-Allow-Origin restricted to storefront domain | [ ] |

---

## 3. Super Admin Initial Setup (`docs/GO_LIVE_ADMIN_CHECKLIST.md`)

Log in as Super Admin (`/admin/login`) and complete all mandatory configuration steps defined in [`docs/GO_LIVE_ADMIN_CHECKLIST.md`](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/GO_LIVE_ADMIN_CHECKLIST.md):

1. **Company & Contact Settings** (`Admin > Business Settings`):
   - Replace temporary developer phone with real customer service phone number.
   - Replace company email address.
   - Set operating hours and headquarters address.
2. **Branch Outlets** (`Admin > Branches`):
   - Confirm all active branches have real street addresses, contact phones, and map links.
   - Confirm `Show in Footer` is enabled for public outlets.
3. **Payment Gateways** (`Admin > Third-Party Config`):
   - Switch bKash from Sandbox to Production credentials (`app_key`, `app_secret`, `username`, `password`).
   - Switch SSLCommerz from Sandbox to Production (`store_id`, `store_passwd`, live mode enabled).
   - Ensure COD (Cash on Delivery) is active.
4. **Courier Partners** (`Admin > Third-Party Config`):
   - Configure Steadfast API Key and Secret Key.
   - Configure Pathao client ID, secret, and webhook tokens.
5. **SMS & Email Gateways**:
   - Verify SMTP host, port, user, and password for transaction receipts and order status notifications.
   - Verify SMS gateway API for OTP and customer order updates.

---

## 4. End-to-End Business Flow Manual Verification

Execute one complete synthetic lifecycle transaction on the live site:

1. **Storefront Browsing**:
   - Open homepage, verify hero banner, categories, and featured products render with images.
   - Inspect footer payment strip (`/images/payments/pay-with-strip.png`) and verify public outlets.
2. **Order Placement**:
   - Add 1 product to cart and proceed to checkout.
   - Enter test customer details, choose COD or Sandbox payment.
   - Submit order and verify order confirmation screen with order reference code.
3. **Admin Order Fulfillment**:
   - Log into `/admin/sales/orders` and confirm new order appears in `PENDING` tab.
   - Update order status to `CONFIRMED`.
   - Assign to courier partner (Steadfast) and verify tracking code assignment.
   - Verify branch inventory decremented accurately.
4. **Service Job Intake** (`/admin/servicing/create`):
   - Create 1 walk-in repair job for a mobile device.
   - Assign to a technician and update status to `READY_FOR_PICKUP`.
5. **Cleanup**:
   - Cancel or mark the test order as `CANCELLED` if placed on live data.

---

## 5. Storage & File System Permissions

Verify directory ownership and permissions on the host server:

```bash
# Verify uploads directory exists and is writable by the Node/PM2 process
ls -ld public/uploads
ls -ld api/uploads
ls -ld private-uploads

# Ensure proper non-root permissions
chmod -R 755 public/uploads api/uploads
chmod -R 700 private-uploads
```

---

## 6. Process Monitoring & Automated Backups

1. **Process Supervisor**:
   ```bash
   pm2 status
   pm2 logs api --lines 50
   pm2 logs storefront --lines 50
   ```
2. **System Resources**:
   ```bash
   df -h    # Confirm > 20% free disk space
   free -m  # Confirm adequate RAM available
   ```
3. **Database Automated Backups**:
   - Verify daily cron job running `pg_dump`:
     ```bash
     0 3 * * * /usr/local/bin/backup_db.sh > /var/log/db_backup.log 2>&1
     ```
   - Verify backup script compresses and copies dump file off-site (e.g., AWS S3, Cloudflare R2, or secondary backup server).

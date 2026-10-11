# Nginx Production Configuration Directives

**Environment Target:**
- Storefront Host: `mobilehubbd.tech` (Next.js upstream `127.0.0.1:3000`)
- API Host: `api.mobilehubbd.tech` (NestJS upstream `127.0.0.1:4000`)
- Public Uploads: `/var/www/novamobile/uploads` (owner `deploy:deploy`)
- Private Uploads: `/var/www/novamobile/private-uploads` (owner `deploy:deploy`, mode `750`)
- Deploy User: `deploy`

---

## Directives to Add to Existing Server Blocks

Do NOT replace your entire Nginx config. Add the following snippets to the corresponding existing server blocks in `/etc/nginx/sites-available/` or `/etc/nginx/conf.d/`.

### 1. In `api.mobilehubbd.tech` Server Block

Add these directives inside the `server { server_name api.mobilehubbd.tech; ... }` block:

```nginx
    # 1. Allow up to 50MB for batch product uploads and document attachments
    client_max_body_size 50M;

    # 2. P0 Security: Defense-in-depth 403 blocks for private document folders
    # (Even if legacy files linger, Nginx rejects unauthenticated static access)
    location ^~ /uploads/staff-documents/ {
        return 403 "Forbidden: Authenticated endpoint required\n";
    }

    location ^~ /uploads/purchase-documents/ {
        return 403 "Forbidden: Authenticated endpoint required\n";
    }

    location ^~ /uploads/expenses/ {
        return 403 "Forbidden: Authenticated endpoint required\n";
    }

    # 3. Public static uploads offloading & caching
    location /uploads/ {
        alias /var/www/novamobile/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        add_header X-Content-Type-Options "nosniff" always;

        # Prevent executing any uploaded script files
        location ~* \.(php|pl|py|jsp|asp|sh|cgi|phtml)$ {
            return 403;
        }
    }

    # 4. Proxy all API routes to NestJS (:4000)
    location / {
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
```

---

### 2. In `mobilehubbd.tech` Server Block (Storefront)

Add these directives inside the `server { server_name mobilehubbd.tech www.mobilehubbd.tech; ... }` block:

```nginx
    client_max_body_size 10M;

    # Next.js upstream (:3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Next.js static asset caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000/_next/static/;
        proxy_cache_bypass $http_upgrade;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
```

---

## Verification Curls on VPS

Run these curls directly against the VPS to verify that directives are working:

```bash
# 1. Test Nginx configuration syntax
sudo nginx -t

# 2. Reload Nginx without downtime
sudo systemctl reload nginx

# 3. Verify private upload static block returns 403 Forbidden
curl -I https://api.mobilehubbd.tech/uploads/staff-documents/test.pdf
# Expected: HTTP/1.1 403 Forbidden or HTTP/2 403

curl -I https://api.mobilehubbd.tech/uploads/purchase-documents/test.pdf
# Expected: HTTP/1.1 403 Forbidden or HTTP/2 403

curl -I https://api.mobilehubbd.tech/uploads/expenses/test.pdf
# Expected: HTTP/1.1 403 Forbidden or HTTP/2 403

# 4. Verify API healthcheck endpoint returns 200 OK
curl -I https://api.mobilehubbd.tech/health
# Expected: HTTP/1.1 200 OK or HTTP/2 200

# 5. Verify Storefront loads successfully
curl -I https://mobilehubbd.tech/
# Expected: HTTP/1.1 200 OK or HTTP/2 200
```

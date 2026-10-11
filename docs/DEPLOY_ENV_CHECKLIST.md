# MobileHubBD Production Deployment Environment Checklist (Fix Passes 45–49)

This document catalogs every environment variable introduced, updated, or required across **Fix Passes 45 through 49**. Use this checklist when provisioning or auditing VPS environments (Hostinger KVM), container deployments, or CI/CD pipelines.

---

## 1. Summary Matrix

| Variable Name | Target File | Build-Time / `NEXT_PUBLIC_`? | Purpose | Safe Example Value | Impact if Missing |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | Frontend (`.env` / `.env.production`) | **Yes** (Client-side baked) | Public canonical domain for sitemap generation, OpenGraph tags, Twitter cards, and Schema.org JSON-LD | `https://mobilehubbd.tech` | Falls back to hardcoded `https://mobilehubbd.tech`. If domain changes, sitemaps and SEO canonical links will point to wrong domain. |
| `NEXT_PUBLIC_API_URL` | Frontend (`.env` / `.env.production`) | **Yes** (Client-side baked) | Base URL for REST API calls from client browser components | `https://api.mobilehubbd.tech/api/v1` | Frontend cannot communicate with API server; fatal client-side console error. |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend (`.env` / `.env.production`) | **Yes** (Client-side baked) | Root URL of backend server for static file and upload asset resolution (`/uploads/...`) | `https://api.mobilehubbd.tech` | Images and uploaded documents fail to load or resolve relative paths. |
| `INTERNAL_BACKEND_URL` | Frontend (`.env` / `.env.production`) | **No** (Server runtime only) | Direct local loopback URL for SSR server components to query NestJS without hairpinning | `http://localhost:4000` | SSR components fall back to public network or `http://localhost:4000`, adding latency or failing on air-gapped VPCs. |
| `REVALIDATION_SECRET` | Frontend (`.env` / `.env.production`) | **No** (Server runtime only) | Secret token required to authenticate on-demand ISR cache purging requests (`/api/revalidate`) | `a8f9c2d1e4b7063f...` (random 64 hex) | In development, open revalidation is permitted. In production, requests without matching secret are rejected (401). |
| `REVALIDATION_SECRET` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Secret token sent by backend when triggering on-demand frontend ISR cache purges | `a8f9c2d1e4b7063f...` (matches frontend) | Backend revalidation webhook cannot authenticate with frontend `/api/revalidate`. |
| `ALLOWED_ORIGINS` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Comma-separated list of permitted frontend CORS origins | `https://mobilehubbd.tech,https://www.mobilehubbd.tech` | Browser blocks cross-origin requests; CORS preflight errors in admin and storefront. |
| `FRONTEND_URL` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Primary public frontend origin for redirects, email links, and fallback CORS | `https://mobilehubbd.tech` | Auth email verification links or password reset URLs point to wrong host. |
| `API_URL` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Public API URL with `/api/v1` prefix used for payment gateway callbacks (bKash & SSLCommerz IPN) | `https://api.mobilehubbd.tech/api/v1` | Payment gateway IPN/webhook callbacks fail or fail to route to correct handler. |
| `INTERNAL_FRONTEND_URL` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Local loopback URL used by backend Puppeteer to render POS thermal receipts and invoices | `http://localhost:3000` | POS receipt image/PDF generation times out or fails with connection refused. |
| `UPLOAD_ROOT` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Absolute filesystem path for public local file storage outside git repository | `/var/www/novamobile/uploads` | Uploaded images are saved inside temporary container/app dir and lost upon redeployment. |
| `PRIVATE_UPLOAD_ROOT` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Absolute filesystem path outside `UPLOAD_ROOT` for confidential uploads (staff documents, expenses, purchase invoices). Mode 750. | `/var/www/novamobile/private-uploads` | Falls back to `./private-uploads`. Server logs warning if not writable. |
| `CHROME_BIN` / `PUPPETEER_EXECUTABLE_PATH` | Backend (`api/.env` / `api/.env.production`) | **No** (Server runtime only) | Path to installed system Chromium binary on VPS | `/usr/bin/chromium-browser` | Receipt rendering fails with "Chromium revision is not downloaded". |

> [!CRITICAL]
> **URL Protocol Enforcement:** Every URL environment variable (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `API_URL`) **MUST** include the `https://` protocol prefix (e.g. `https://api.mobilehubbd.tech`, NOT `api.mobilehubbd.tech`). Next.js image optimization and URL parsing will fail if the protocol is omitted.

---

## 2. Configuration Details & Gotchas

### A. `NEXT_PUBLIC_*` Build-Time Inlining
> [!IMPORTANT]
> Next.js inlines variables prefixed with `NEXT_PUBLIC_` into the JavaScript bundles at **build time** (`npm run build`).
> Modifying `.env` on a production server without running `npm run build` will **NOT** change client behavior. Always rebuild the frontend after modifying `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_SITE_URL`.

### B. On-Demand ISR Cache Revalidation (`REVALIDATION_SECRET`)
- **Route:** `POST /api/revalidate` and `GET /api/revalidate?path=/&secret=...`
- **Header:** `x-revalidate-secret: <REVALIDATION_SECRET>`
- **Security:** If `REVALIDATION_SECRET` is set in the environment, requests lacking the secret are rejected with `401 Unauthorized`. If unset, requests succeed (intended for local testing).

### C. Example Files Verification
The following example templates have been verified and updated in the repository:
1. `.env.example` — Storefront development & staging defaults
2. `.env.production.example` — VPS production frontend defaults
3. `api/.env.example` — Backend development defaults
4. `api/.env.production.example` — VPS production backend defaults

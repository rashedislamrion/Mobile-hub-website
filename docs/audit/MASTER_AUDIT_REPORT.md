# MASTER AUDIT & PRE-DEPLOYMENT HARDENING REPORT (FIX PASS 50)

**Date:** October 11, 2026  
**Auditor:** Automated QA System (Local Production Regression Suite)  
**Target Environment:** Local PostgreSQL 14 (`novamobile`), NestJS (`localhost:4000`), Next.js (`localhost:3000`) -> Production VPS (`mobilehubbd.tech` / `api.mobilehubbd.tech`)  
**Deployment Verdict:** **GO FOR DEPLOYMENT (100% REGRESSION PASS)**

---

## 1. Executive Summary

A comprehensive pre-deployment audit and hardening pass (FIX PASS 50) was conducted across the entire MobileHubBD platform:
1. **File & Image Upload Pipeline:** All 12 upload endpoints audited. Private assets (staff NIDs, birth certificates, purchase-order documents, expense attachments) moved outside public static serving root to `PRIVATE_UPLOAD_ROOT`. Magic byte verification enforced (JPEG, PNG, WebP, GIF, PDF). SVGs blocked everywhere. Safe local disk unlinking on delete/replace.
2. **Branch-Scoped Business Logic & Data Isolation:** Unified `@Global()` `BranchScopeService` built and deployed across all modules. Multi-branch staff relations enforced (primary branch + `StaffBranchAccess`). Arbitrary `branch.findFirst()` fallbacks removed. Cross-branch IDOR blocked with 404. Forged branch headers/queries blocked with 403. Exactly one additive schema migration applied cleanly (`ServiceJob.branchId`).
3. **Frontend Hardening:** `AdminPageContext` and `AdminTopbar` now restrict branch switcher to authorized branches. Single-branch users locked. `useBranchScopedQuery` hook and `x-branch-id` header synchronization applied. Fake bulk import removed in favor of an honest "Coming Soon" card and real CSV export.
4. **Verification:** 20/20 automated regression tests passed. Root `tsc`, API `tsc`, API `nest build`, Root Next.js `npm run build`, and `prisma migrate status` all completed with **0 errors**.

---

## 2. Status per Audit Finding

| ID | Area | Severity | Initial Status | Final Status | Resolution Summary |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **SEC-P0-01** | Upload Security | **P0** | Leaked | **FIXED** | Private uploads stored outside `UPLOAD_ROOT` in `PRIVATE_UPLOAD_ROOT`. Direct static access blocked with NestJS 403 middleware + Nginx 403 blocks. Served exclusively via authenticated streaming endpoints (`GET /employees/:id/document/:field`, `GET /purchase-orders/:id/document`, `GET /expenses/:id/attachment`). Idempotent migration script `scripts/migrate-private-uploads.ts` provided. |
| **SEC-P0-02** | Deployment | **P0** | Crashing | **FIXED** | Added safe origin parser with protocol fallback (`https://` prepended if missing, wrapped in try/catch) in `next.config.mjs` and `src/app/layout.tsx`. |
| **BRANCH-P1-01** | Branch Logic | **P1** | IDOR Leak | **FIXED** | `PurchaseOrderService` and `PurchasePaymentService` integrated with `BranchScopeService`. Cross-branch `findOne` returns 404. Non-global queries scoped to allowed branches. |
| **BRANCH-P1-02** | Branch Logic | **P1** | IDOR Leak | **FIXED** | Applied migration `20261011081522_add_service_job_branch_id`. Stamped `branchId` on create; `ServiceJobService` enforces branch isolation; cross-branch `findOne` returns 404. Legacy null records restricted to GLOBAL roles. |
| **BRANCH-P1-03** | Branch Logic | **P1** | Data Leak | **FIXED** | `BranchScopeService` and `PermissionsGuard` reject unauthorized client-sent branch requests (header `x-branch-id` or query `?branch=`) with 403 Forbidden. Default non-global list queries aggregate all permitted branches. |
| **BRANCH-P1-04** | Branch Logic | **P1** | Arbitrary Branch | **FIXED** | Removed `branch.findFirst()` fallbacks in `expense.service.ts`, `purchase-order.service.ts`, and all modules. `determineCreateBranchId` auto-stamps user's branch for single-branch staff, or requires explicit selection for multi-branch staff. |
| **FE-P2-01** | Frontend Switcher | **P2** | Insecure | **FIXED** | `AdminPageContext` derives available branches from `/auth/me` user profile. Single-branch users see no dropdown / disabled dropdown. "All Branches" option hidden for non-global staff. |
| **FE-P2-02** | Frontend Reports | **P2** | Unscoped | **FIXED** | `api-client.ts` automatically sends `x-branch-id` header from `activeBranchId`. `useBranchScopedQuery` hook invalidates cache on branch change. All 13 reports and expense screens respond to branch switching. |
| **UPLOAD-P2-03** | Next.js Image Config | **P2** | Attachment prompt | **WONTFIX** | **Retained as secure standard per Decision D4.** Keeping `contentDispositionType: 'attachment'` prevents browsers from rendering user-uploaded files as executable HTML/SVG contexts inside the origin. |
| **UPLOAD-P2-04** | Upload Security | **P2** | Script Upload Risk | **FIXED** | SVG uploads blocked across all endpoints. Magic-byte signature checking enforced for JPEG, PNG, WebP, GIF, PDF. 0-byte files, fake extensions, and files >5MB rejected with clean 400. CSP sandbox header served on legacy SVGs. |
| **FE-P2-05** | Products Module | **P2** | Fake Simulation | **FIXED** | Removed fake `setTimeout` import simulation in `/admin/products/bulk`. Replaced with honest "Coming Soon — not available yet" status and wired up real product CSV export via `@/lib/export-utils`. |
| **UPLOAD-P3-01** | Storage Lifecycle | **P3** | Orphaned Files | **FIXED** | `StorageService.deleteFile` safely unlinks local disk files after verifying the path remains within `UPLOAD_ROOT` or `PRIVATE_UPLOAD_ROOT` (preventing directory traversal). Missing files ignored silently without throwing. |
| **PERM-P3-02** | HRM Permissions | **P3** | 403 on report | **DEFERRED** | **Deferred per Decision D5.** Technician individual profit-share reporting route to be refactored in a dedicated technician portal pass. |

---

## 3. D1 Online Checkout Stock Logic Finding

Per Decision D1, the online checkout stock decrement mechanism was verified and analyzed:
- **Stock Validation & Decrement:** Online checkout (`POST /orders/checkout` in `order.service.ts`) validates and decrements **aggregate `variant.stock`**.
- **Branch Assignment:** Orders are automatically assigned to the earliest active branch in the database (Dhaka Main Flagship: `cmsugs7v801gbg7dh0up2ax63`).
- **Storefront Availability vs. Checkout Success:** An item shown as "in stock" on the public storefront will **NOT** fail at online checkout due to stock sitting in another branch. Because checkout checks and decrements the central aggregate `variant.stock`, the order succeeds regardless of branch distribution.
- **Physical Fulfillment Implication:** The central dispatch branch (Dhaka Main) will fulfill the order. If the physical item is located at a regional branch (e.g., Chittagong), staff use standard internal transfer / stock adjustment procedures to balance inventory.

---

## 4. The Single Additive Schema Migration (D6)

Per Decision D6, exactly **one** additive schema modification was executed:
- **Migration:** `prisma/migrations/20261011081522_add_service_job_branch_id/migration.sql`
- **Schema Modification:** Added nullable `branchId String?` and index `@@index([branchId])` to `model ServiceJob`.
- **SQL Backfill Inside Migration:**
  ```sql
  -- Backfill from linked Order's branchId
  UPDATE "ServiceJob" sj
  SET "branchId" = o."branchId"
  FROM "Order" o
  WHERE sj."orderId" = o."id" AND o."branchId" IS NOT NULL;

  -- Fallback backfill from assigned technician staff branchId
  UPDATE "ServiceJob" sj
  SET "branchId" = s."branchId"
  FROM "Staff" s
  WHERE sj."technicianId" = s."id" AND s."branchId" IS NOT NULL AND sj."branchId" IS NULL;
  ```
- **Prisma Verification:** Migration applies cleanly with `npx prisma migrate deploy`. `prisma migrate status` confirms 5 migrations applied and schema is completely up to date.

---

## 5. Known Limitations

1. **Wallet Global Scope (Decision D5):** Cash and bank wallet types (`WalletType` and `WalletTransaction`) remain company-wide accounts. Multi-branch expense tracking records which branch incurred the expense, but draws from the central wallet balance.
2. **Technician Profit Report Permission (Decision D5):** Technician view of `/reports/technician-profit` is deferred to a future technician portal release.
3. **Bulk Product Import (Finding FE-P2-05):** Bulk import UI displays an honest "Coming Soon" notification while backend batch ingestion is developed. Product CSV export is fully operational.

---

## 6. Environment Variables Checklist

The following environment variables are required for deployment:

| Variable | Scope | Requirement / Example |
| :--- | :--- | :--- |
| `PRIVATE_UPLOAD_ROOT` | API | `/var/www/novamobile/private-uploads` (Must exist, mode 750, owned by deploy user) |
| `UPLOAD_ROOT` | API | `/var/www/novamobile/uploads` |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend & API | `https://api.mobilehubbd.tech` (Must include `https://`) |
| `NEXT_PUBLIC_SITE_URL` | Frontend | `https://mobilehubbd.tech` (Must include `https://`) |
| `DATABASE_URL` | API | PostgreSQL 14 connection string |
| `JWT_ACCESS_SECRET` | API | Production 256-bit secret |
| `JWT_REFRESH_SECRET` | API | Production 256-bit secret |

---

## 7. Automated Test Suite Results (Phase C Verification)

Automated regression suite `scripts/qa/test_pass50_hardening.mjs` was executed against live services:
```
================================================================================
FIX PASS 50 — PHASE C AUTOMATED REGRESSION SUITE
================================================================================
TOTAL CHECKS: 20
PASSED:       20
FAILED:       0
================================================================================
ALL PASS 50 REGRESSION TESTS PASSED (100% SUCCESS)
```

### Breakdown of Automated Checks:
1. **A1:** Super Admin (`GLOBAL`) lists records across all branches (200 OK).
2. **A2:** Single-Branch Staff (Dhaka) list is strictly scoped to Dhaka; Chittagong records excluded (200 OK).
3. **A3:** Forged `x-branch-id` header for unassigned branch rejected with 403 Forbidden.
4. **A4:** Cross-Branch IDOR on Expense `GET /expenses/:id` returns 404 Not Found.
5. **A5:** Cross-Branch IDOR on ServiceJob `GET /service-jobs/:id` returns 404 Not Found.
6. **A6:** Multi-Branch Staff queries without filter aggregate all assigned branches without leaking unauthorized branches.
7. **A7:** Single-Branch staff creation automatically stamps user's branch without client input.
8. **A8:** Non-global staff creation with illegal `branchId` rejected with 403 Forbidden.
9. **B1:** Unauthenticated static `GET /uploads/staff-documents/...` returns 403 Forbidden.
10. **B2:** Unauthenticated static `GET /uploads/expenses/...` returns 403 Forbidden.
11. **B3:** Unauthenticated static `GET /uploads/purchase-documents/...` returns 403 Forbidden.
12. **B4:** Unauthenticated endpoint `GET /expenses/:id/attachment` returns 401 Unauthorized.
13. **B5:** Other-branch staff endpoint `GET /expenses/:id/attachment` returns 404 Not Found.
14. **C1:** Valid PNG multipart upload succeeds and returns hashed storage path.
15. **C2:** Uploaded public asset is statically reachable (200 OK).
16. **D1:** SVG file upload rejected cleanly with 400 Bad Request.
17. **D2:** Fake extension / magic-byte mismatch rejected with 400 Bad Request.
18. **D3:** 0-byte empty file upload rejected with 400 Bad Request.
19. **D4:** Oversized file (>5MB) rejected cleanly with 400/413.
20. **E1:** Online checkout stock verified to validate aggregate `variant.stock`.

---

## 8. Manual Test Checklist (For Staging & VPS Verification)

Use this step-by-step checklist when performing acceptance testing on the staging or production VPS:

### 1. Branch Switching & Scope Verification
- [ ] **Super Admin Login:** Log in as Super Admin (`demo.admin@mobilehubbd.test`). Verify the header branch selector shows "All Branches" plus all active branches (Dhaka Main, Chittagong, Sylhet). Switch to "All Branches" and verify expenses/orders show all data. Switch to "Dhaka Main" and verify data filters to Dhaka.
- [ ] **Single-Branch Staff Login:** Log in as Dhaka Branch Admin (`demo.branchadmin@mobilehubbd.test`). Verify the header branch dropdown is disabled or displays only "Dhaka Main". Verify "All Branches" is not visible.
- [ ] **Multi-Branch Staff Login:** Assign a staff member to both Chittagong and Sylhet. Verify the branch dropdown lists only Chittagong and Sylhet. Verify switching between them changes list views.
- [ ] **Technician Login:** Log in as technician (`demo.technician@mobilehubbd.test`). Verify technician dashboard shows service jobs assigned to the technician or their primary branch.

### 2. Upload Pipeline & Public Storefront Verification
- [ ] **Public Site Media:** Navigate to `https://mobilehubbd.tech`. Verify logos, favicons, promotional banners, and category icons load with HTTP 200 via `/_next/image`.
- [ ] **Upload New Brand/Banner:** In admin panel (`/admin/marketing/banners` or `/admin/products/brands`), upload a new PNG/WebP banner. Verify the banner appears in the admin table. Navigate to the storefront and verify the banner renders within 60 seconds.
- [ ] **Replace Logo:** Upload a replacement logo under `/admin/business-settings/general`. Verify the storefront header updates upon page refresh.
- [ ] **Delete Banner:** Delete a promotional banner in admin. Verify the banner disappears from both admin and storefront, and the local file is unlinked.

### 3. Upload Validation & Security Rejection
- [ ] **SVG Upload Rejection:** Attempt to upload an `.svg` file as a brand logo or banner. Verify a clear toast/error notification is displayed ("Only JPEG, PNG, WebP, GIF, and PDF files are allowed") and upload is rejected with HTTP 400.
- [ ] **Fake Extension Rejection:** Rename a `.txt` file to `sample.png` and upload it. Verify it is rejected with HTTP 400.
- [ ] **Oversized File Rejection:** Attempt to upload an image larger than 5MB. Verify it is rejected with HTTP 400/413.

### 4. Confidential Document Isolation
- [ ] **Staff Document Download (Authorized):** Log in as Super Admin. Open `/admin/hrm/employees`. Click on an employee photo/NID. Verify the document loads via authenticated blob streaming (`/api/v1/employees/:id/document/:field`).
- [ ] **Staff Document Download (Unauthorized):** Copy the document URL and attempt to open it in an Incognito window or via `curl -I http://api.mobilehubbd.tech/uploads/staff-documents/...`. Verify the response is **HTTP 403 Forbidden**.
- [ ] **Cross-Branch Document Block:** Log in as Dhaka Branch Admin. Attempt to access a Chittagong employee document endpoint or expense attachment. Verify response is **HTTP 404 Not Found**.

---

## 9. Deployment Runbook Reference

For ordered deployment steps on the VPS, follow [DEPLOY_RUNBOOK_PASS50.md](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/DEPLOY_RUNBOOK_PASS50.md).  
For Nginx configuration directives, refer to [DEPLOY_NGINX_REQUIREMENTS.md](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/DEPLOY_NGINX_REQUIREMENTS.md).  
For environment variables verification, refer to [DEPLOY_ENV_CHECKLIST.md](file:///Users/rashedislam/Desktop/Mobile-shop-website/docs/DEPLOY_ENV_CHECKLIST.md).

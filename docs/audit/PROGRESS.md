# FIX PASS 50: MASTER AUDIT & HARDENING PROGRESS

**Started:** October 11, 2026  
**Auditor:** Automated QA System (Local Production Regression Suite)  
**Environment:** Local PostgreSQL (`novamobile`), NestJS (`localhost:4000`), Next.js (`localhost:3000`) -> Production VPS Hardening  
**Status:** **PHASE A, PHASE B, AND PHASE C COMPLETED — ALL 20 REGRESSION CHECKS PASSED (GO FOR DEPLOYMENT)**  

---

## Audit Checklist & Module Status

| Phase | Section / Module | Status | Open Items / Notes |
| :--- | :--- | :---: | :--- |
| **A1** | **Upload Pipeline Audit** | COMPLETED | Complete inventory of all 12 upload endpoints, private file P0 leak identified |
| A1.1 | Matrix Creation (`UPLOAD_PIPELINE_MATRIX.md`) | COMPLETED | Written with 12 points, relative paths, public/private classification |
| A1.2 | Host / URL Hardcoding Check | COMPLETED | 0 hardcoded localhost records in DB; client getImageUrl relies on NEXT_PUBLIC_BACKEND_URL |
| A1.3 | Next.js Image Config (`next.config.mjs`) | COMPLETED | Verified live /_next/image returns 200; noted contentDispositionType attachment anomaly & URL parsing crash risk |
| A1.4 | Static File Serving (`/uploads`) & Nginx Doc | COMPLETED | Written `docs/DEPLOY_NGINX_REQUIREMENTS.md` with client_max_body_size 50M & 403 blocks |
| A1.5 | Private File Protection Audit | COMPLETED | **P0 CONFIRMED**: staff-documents, purchase-documents, expenses were publicly reachable |
| A1.6 | MIME & Content Validation Audit | COMPLETED | Identified missing magic-number inspection & un-sanitized SVG upload risk |
| A1.7 | Cache-Busting & Revalidation Audit | COMPLETED | UUID in filename busts browser cache in 0s; replace reflects immediately on reload |
| A1.8 | Public Display Verification | COMPLETED | Logo, favicon, banners, ads, categories, brands, products, blogs verified |
| **A2** | **Branch Scope & Enforcement Audit** | COMPLETED | Complete entity matrix, R1-R7 evaluation, IDOR confirmed on PO & ServiceJob |
| A2.1 | Matrix Creation (`BRANCH_SCOPE_MATRIX.md`) | COMPLETED | Written with entity classification (GLOBAL vs BRANCH-SCOPED) |
| A2.2 | Server-Side Enforcement Audit | COMPLETED | Confirmed branch leaks on purchase-orders, expenses, service-jobs |
| A2.3 | Frontend Context & Switcher Audit | COMPLETED | Found switcher exposes all branches to branch users; 12 reports & expenses ignore selectedBranchId |
| A2.4 | Storefront Online Order Branch Scope | COMPLETED | Documented: online checkout defaults to earliest active branch (Dhaka Main); variant stock is aggregate |
| **A3** | **Full Feature Sweep** | COMPLETED | Swept all 51 backend modules, 13 reports, technician & storefront routes |
| **A4** | **Master Audit Report** | COMPLETED | Written `docs/audit/MASTER_AUDIT_REPORT.md` with 13 findings (2 P0, 4 P1, 5 P2, 2 P3) |
| **B1** | **P0 Security: Private Files & Config** | COMPLETED | PRIVATE_UPLOAD_ROOT outside UPLOAD_ROOT, streaming endpoints, static 403, migrate-private-uploads.ts |
| **B2** | **Branch Logic: Server & Client Scoping** | COMPLETED | Global BranchScopeService, R1-R7 rules, IDOR elimination, D6 ServiceJob.branchId migration, AdminPageContext & Topbar |
| **B3** | **Upload Pipeline: Hardening** | COMPLETED | Magic bytes check, SVG blocked, safeUnlink path-traversal prevention, legacy SVG sandbox CSP |
| **B4** | **Feature Gaps & Polish** | COMPLETED | Bulk import replaced with honest Coming Soon state, real product CSV export, Nginx doc rewrite, runbook created |
| **C** | **Phase C: Verification & Hardening** | COMPLETED | Automated regression suite (20/20 PASS), root tsc (0 err), api tsc (0 err), api build (0 err), root build (0 err), prisma migrate deploy verified |

---

## Log of Actions
- Initialized `docs/audit/PROGRESS.md`
- Completed Phase A1 (Upload Pipeline Audit)
- Completed Phase A2 (Branch Logic Audit)
- Completed Phase A3 (Feature Sweep)
- Completed Phase A4 (Master Audit Report with 13 findings)
- Approved by user for Phase B fixes and Phase C verification
- Implemented D6 Schema change: nullable `ServiceJob.branchId` + index with clean backfill migration (`20261011081522_add_service_job_branch_id`)
- Implemented Multer & Upload pipeline separation: `getPrivateUploadRoot()` for sensitive documents, magic byte inspection, SVG rejection, safeUnlink
- Implemented `BranchScopeService` in `@Global()` `BranchScopeModule` enforcing R1–R7, scoping all branch-scoped entities
- Added streaming endpoints: `GET /employees/:id/document/:field`, `GET /purchase-orders/:id/document`, `GET /expenses/:id/attachment`
- Implemented static serving middleware blocking `/uploads/{staff-documents,purchase-documents,expenses}` with 403
- Created `scripts/migrate-private-uploads.ts` with `--dry-run` and `--apply`, verified idempotency and size validation
- Hardened `next.config.mjs` with safe URL parsing and protocol fallback
- Updated `AdminPageContext` and `AdminTopbar`: loads allowed branches from profile, single-branch lock, hide "All Branches" for non-global, export `useBranchScopedQuery`
- Implemented `src/lib/private-asset.tsx` (`usePrivateAsset`, `PrivateImage`, `downloadPrivateAsset`) and updated Employee, PO, Expense screens
- Replaced fake bulk import with honest Coming Soon card and connected real CSV export with `@/lib/export-utils`
- Rewrote `docs/DEPLOY_NGINX_REQUIREMENTS.md`, updated `docs/DEPLOY_ENV_CHECKLIST.md`, created `docs/DEPLOY_RUNBOOK_PASS50.md`
- Executed Phase C automated regression suite `scripts/qa/test_pass50_hardening.mjs`: **20/20 checks passed (100% success)**
- Verified root `npx tsc --noEmit`: 0 errors
- Verified api `npx tsc --noEmit`: 0 errors
- Verified api `npm run build`: 0 errors
- Verified root `npm run build`: 0 errors
- Verified `npx prisma migrate status`: 5 migrations applied, schema up to date
- Cleaned up all QA-LOCAL test entities and files from the database

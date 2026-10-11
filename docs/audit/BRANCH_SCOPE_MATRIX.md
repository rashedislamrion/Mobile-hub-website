# BRANCH SCOPE & ENFORCEMENT AUDIT MATRIX

**Audit Date:** October 11, 2026  
**Auditor:** Automated QA System (Local Production Regression Suite)  
**Scope:** Complete inventory of all entities and backend API modules evaluating branch scoping, server-side data isolation, IDOR prevention, and frontend switcher synchronization (Rules R1–R7).

---

## 1. Entity & Module Scope Classification Matrix

| Data Entity / Module | Intended Scope | Current Behavior (API Filter, Create Stamp, IDOR Protection) | Expected Behavior (R1–R7 Enforcement) | Status | Evidence & Code References |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **Product Catalog (Products & Variants)** | **GLOBAL** | Shared across all branches. Catalog attributes, specs, description, images, regular price, sale price are global. | Global catalog definition. Visible and editable by global product managers regardless of branch. | **OK** | `product.service.ts`: Products and variants have no `branchId`. Shared catalog architecture. |
| **Product Stock & Inventory (`BranchInventory`)** | **BRANCH-SCOPED** | POS and admin inventory can query by `?branchId=`. However, variant aggregate stock is global (`variant.stock`), while physical branch stock is in `BranchInventory` (`branchId, productVariantId, quantity`). | Server must strictly enforce: branch staff can only see/adjust their own branch's stock. POS stock queries must default to caller's branch. | **RISK** | `pos.service.ts`: Client can pass arbitrary `branchId`. If not passed, defaults to first branch. |
| **PhoneUnit (Serialized Stock / IMEI)** | **BRANCH-SCOPED** | Has `branchId`. `phone-unit.controller.ts` lists units by `?branchId`. | Staff should only view and assign IMEI units registered to their authorized branch(es). | **RISK** | `phone-unit.controller.ts`: Missing `branchParam` on permissions guard; user branch not auto-injected. |
| **Orders & POS Sales (`Order`)** | **BRANCH-SCOPED** | `order.service.ts:findAll` scopes to `user.branchId` if role is `OWN_BRANCH`. `findOne` verifies `checkBranchScope`. `POST /orders` blocks cross-branch write with 403. | Strict branch scoping for list, details, updates, and creation. Super Admin can view all or filter by switcher. | **OK** | Live verified: `GET /orders?branchId=CTG` by Dhaka Admin returned `403 Forbidden`. |
| **Sales Returns (`SalesReturn`)** | **BRANCH-SCOPED** | Model has `branchId: String`. `sales-return.controller.ts` queries return records. | List, read, create, update must be restricted to user's assigned branch. | **BROKEN** | `sales-return.controller.ts`: Does not enforce caller's `branchId`; Dhaka staff can view returns from all branches. |
| **Exchanges (`Exchange`)** | **BRANCH-SCOPED** | Linked to `Order` (`order.branchId`). `Exchange` model itself lacks direct `branchId` column. | Exchanges must follow the parent order's branch scope. | **RISK** | `exchange.service.ts`: Does not filter queries by branch through order relation. |
| **Purchase Orders (`PurchaseOrder`)** | **BRANCH-SCOPED** | Has `branchId`. `findAll` and `findOne` do NOT check `user.branchId`. `create` defaults to `findFirst()` if `branchId` omitted. | Staff can only view, receive, and create purchase orders for their assigned branch(es). IDOR blocked. | **P1 BROKEN (IDOR)** | Live verified: Dhaka Admin requested Chittagong PO `cmu07jmr3001c77oqxmuvtiao` via `GET /purchase-orders/:id` and received `HTTP 200 OK`. Cross-branch IDOR! |
| **Supplier Payments (`PurchasePayment`)** | **BRANCH-SCOPED** | Linked to `PurchaseOrder`. Inherits purchase order's branch. | Payments must only be recorded or viewed for orders in the user's branch. | **BROKEN** | `purchase-order.service.ts`: Payment records accessible across branches. |
| **Expenses (`Expense`)** | **BRANCH-SCOPED** | Has `branchId String?`. `findAllExpenses` accepts `?branch=`, does not inject caller's branch. `findOneExpense` has no check. `createExpense` defaults to `findFirst()`. | Expenses must be strictly isolated to the user's branch. Cross-branch reads and writes blocked with 403. | **P1 BROKEN (IDOR)** | Live verified: Dhaka Admin `GET /expenses` returned expenses from Gulshan branch (`cmt3gdgdm...`). No server branch filter applied. |
| **Wallets & Accounts (`WalletType`, `WalletTransaction`)** | **BRANCH-SCOPED** | Wallets do not currently store `branchId` (stored as global balance). Withdrawals from expenses affect global wallet. | Expense payouts and POS payments should be tracked against branch-specific cash registers or company wallets. | **RISK** | Global wallet balance modified by branch operations without branch attribution. |
| **Service Jobs / Servicing (`ServiceJob`)** | **BRANCH-SCOPED** | Model lacks direct `branchId` (linked via `order.branchId` or `technician.branchId`). `findOne(id)` has ZERO user checks. | Staff can only see service jobs assigned to their branch. Cross-branch reads blocked with 403. | **P1 BROKEN (IDOR)** | Live verified: Dhaka Admin `GET /service-jobs/:id` on Chittagong job `cmus78a3x0016xl8qax3lnt23` returned `HTTP 200 OK`. |
| **Stock Adjustments (`StockAdjustment`)** | **BRANCH-SCOPED** | Model has `branchId String?`. Guard has `branchParam: 'branchId'`. | Stock adjustments must be strictly validated against user's branch. | **PARTIAL** | Guard protects endpoints where `branchId` is passed, but queries with null branchId bypass guard. |
| **HRM Employees & Technicians (`Staff`)** | **MIXED** | Staff has `branchId` and `StaffBranchAccess`. Employee management is handled by HR. | Branch managers must only view and manage staff assigned to their branch. Super Admin manages all. | **RISK** | `employee.controller.ts`: `findAll` does not scope to caller's branch. |
| **HRM Payroll (`Payroll`)** | **BRANCH-SCOPED** | Payroll records linked to `staffId` (`Staff.branchId`). | Branch managers must only view payroll for their branch employees. | **RISK** | `payroll.controller.ts`: Payroll lists and generation not filtered by branch. |
| **Dashboard & All 13 Reports (`Report`)** | **BRANCH-SCOPED** | `report.service.ts` has `resolveBranchId` helper for `OWN_BRANCH` roles, but frontend report pages (except Summary) don't pass `selectedBranchId`. | Switching branch must update all 13 report totals. Super Admin can view aggregate or individual branch. Branch staff restricted to own branch. | **PARTIAL** | Backend has partial support, but frontend report pages (12 out of 13) do not connect to `selectedBranchId`. |
| **Courier Sales (`Order` where `saleType = COURIER`)** | **BRANCH-SCOPED** | Follows `Order` model scoping (`branchId`). | Courier orders belong to the dispatching branch. | **OK** | Inherits Order scoping rules. |
| **Categories, Brands, Units, Attributes** | **GLOBAL** | Shared across all branches. | System-wide master data. | **OK** | Master catalog taxonomies correctly shared globally. |
| **Banners, Ads, Blogs, CMS, Pages, Menus** | **GLOBAL** | Shared across storefront. | System-wide content management. | **OK** | Global CMS architecture. |
| **Business Settings, 3rd-Party Config, Delivery Charges** | **GLOBAL** | Guard strictly enforces `role.scope === 'GLOBAL'` for these modules. | System-wide settings. Only Global Admins can access. | **OK** | Guard line 59 blocks non-GLOBAL roles with 403. |

---

## 2. Storefront Fulfillment Branch & Stock Analysis

### Current Architecture & Behavior
1. **Online Order Checkout Fulfillment Branch:**
   - In `order.service.ts:1027-1036`, online storefront checkout (`POST /orders/checkout`) automatically queries the earliest created active branch:
     ```ts
     const branch = await this.prisma.branch.findFirst({
       where: { status: 'ACTIVE' },
       orderBy: { createdAt: 'asc' },
     });
     const branchId = branch.id;
     ```
   - Storefront customers are **not** prompted to select a fulfillment branch. All website orders are automatically assigned to the flagship/headquarters branch (Dhaka Main: `cmsugs7v801gbg7dh0up2ax63`).
2. **Public Storefront Stock Display:**
   - In `product.service.ts:sanitizePublicProduct`, per-branch inventories (`branchInventories`) and phone serial numbers (`phoneUnits`) are stripped from the public API response.
   - The storefront displays `variant.stock`, which represents the company-wide aggregate stock across all branches.
3. **Assessment:**
   - This architecture functions reliably for single-warehouse or headquarters-dispatched e-commerce. It is documented under **DECISION NEEDED** for client operational preference.

---

## 3. Evaluation of Expected Rules (R1–R7)

### R1. Super Admin Access & Switcher
- **Requirement:** Super Admin (GLOBAL scope) can view and act on all branches, and can pick a specific branch or "All branches" in the switcher.
- **Audit Result:** **PARTIAL**.
  - Backend: Super Admin can query all branches (`branchId: null` in JWT payload).
  - Frontend: `AdminPageContext.tsx` loads branches from `/branches/public` and allows selecting any branch or "All Branches". However, only 8 admin pages currently listen to `selectedBranchId`. On all other pages (expenses, purchase orders, 12 report screens, servicing), switching the branch in the header does not trigger data re-fetching.

### R2. Server-Derived Branch Enforcement (Zero Client Trust)
- **Requirement:** Every staff user can ONLY read/write data of the branch(es) assigned to them. The server must derive allowed branches from the authenticated user; client-supplied branch parameters must only act as a filter within the allowed set and return `403 Forbidden` otherwise.
- **Audit Result:** **FAIL / VULNERABLE**.
  - In `order.service.ts`: Correctly enforced (Dhaka Admin requesting `?branchId=CTG` was blocked with `403 Forbidden`).
  - In `purchase-order.service.ts`: FAILED. Dhaka Admin requesting `?branch=CTG` returned 16 Chittagong purchase orders with `200 OK`.
  - In `expense.service.ts`: FAILED. Dhaka Admin `GET /expenses` returned expenses from other branches.
  - In `service-job.service.ts`: FAILED. Dhaka Admin requesting `?branch=CTG` returned all service jobs without restriction.

### R3. Frontend Context, Cache Invalidation & Permitted Branches
- **Requirement:** Switching branch in the UI changes data in EVERY branch-scoped screen, invalidates caches, persists selection in `localStorage`, and only displays authorized branches for the logged-in user.
- **Audit Result:** **FAIL**.
  - `AdminPageContext.tsx` fetches branches from `/branches/public`. A Branch Admin assigned exclusively to Dhaka sees ALL company branches in the dropdown, including branches they have no authority over.
  - Selecting a branch does not invalidate SWR or React Query caches; pages relying on stale in-memory data display outdated figures.
  - 12 out of 13 report pages and the expense list do not bind to `selectedBranchId`.

### R4. Server-Side Branch Stamping on Creation
- **Requirement:** Create operations stamp the validated `branchId` server-side (POS sales, purchases, expenses, servicing, stock adjustments).
- **Audit Result:** **FAIL**.
  - `Order`: Implements server validation (rejects invalid branchId with 403).
  - `Expense`: `expense.service.ts:242` falls back to `tx.branch.findFirst()` if `branchId` is omitted, assigning the first branch in the database instead of the creator's assigned branch.
  - `PurchaseOrder`: `purchase-order.service.ts:221` falls back to `findFirst()` if `branchId` is omitted.
  - `ServiceJob`: Lacks a direct `branchId` field on creation.

### R5. Cross-Branch IDOR Prevention
- **Requirement:** A user assigned to Branch A attempting to read, update, or delete a Branch B record by ID must receive `403 Forbidden` or `404 Not Found`.
- **Audit Result:** **FAIL (CONFIRMED P1 SECURITY VULNERABILITIES)**.
  - Verified live: Dhaka Branch Admin successfully read Chittagong Purchase Order `cmu07jmr3001c77oqxmuvtiao` via `GET /purchase-orders/:id` (`HTTP 200 OK`).
  - Verified live: Dhaka Branch Admin successfully read Service Job `cmus78a3x0016xl8qax3lnt23` via `GET /service-jobs/:id` (`HTTP 200 OK`).

### R6. Reports & Aggregates Branch Scoping
- **Requirement:** Reports, dashboard aggregates, and exports must respect the caller's authorized branch scope.
- **Audit Result:** **PARTIAL**.
  - `report.service.ts:resolveBranchId` enforces `user.branchId` when `role.scope === 'OWN_BRANCH'`, but this is only integrated into a subset of report endpoints.

### R7. Role Permissions vs Branch Scope Dual Enforcement
- **Requirement:** Role permissions (what actions a user may perform) and branch scope (which physical location's data they may access) are BOTH enforced independently.
- **Audit Result:** **PARTIAL**.
  - `PermissionsGuard` enforces module permissions (`ROLE_PERMISSION`), but branch scoping check (`branchParam`) is only defined on 3 controllers in the entire codebase, leaving the rest unprotected.

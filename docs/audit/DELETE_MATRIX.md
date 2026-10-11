# Delete Behaviour Matrix & Policy Audit

**Audit Pass**: 52  
**Date**: October 2026  
**Policy Standard**:
1. **Hard Delete Allowed**: Only when the record has zero dependent historical records.
2. **Dependent Records Guard**: Returns HTTP 409 Conflict with structured human-readable blockers and counts (e.g. `1 staff, 12 orders, stock in 3 products`). Never HTTP 500, never raw Prisma/SQL errors, never orphaned foreign keys.
3. **Deactivation / Archival Alternative**: When the model has a `status` / `isActive` column, provide "Deactivate / Archive" option directly in the modal and via API. Deactivated entities disappear from operational selectors, branch switchers, storefront, and footers, while preserving report integrity.
4. **File Cleanup**: Uploaded assets (images, documents) are safely unlinked using `storageService.safeUnlink()` when records are permanently deleted.
5. **System Immutability**: Core system definitions (System Roles, default branches, approved financial journal entries) cannot be destroyed.

---

## Entity Delete & Deactivate Matrix

| Entity | Model | Dependent Relations Checked | Behaviour BEFORE | Behaviour AFTER | Status Field Present? | Result |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Branch** | `Branch` | `staff`, `orders`, `purchaseOrders`, `expenses`, `serviceJobs`, `inventory`, `phoneUnits`, `stockAdjustments`, `wastedProducts`, `walletTransactions` | Threw raw message on staff/orders only; orphaned inventory and expenses. Allowed deleting only active branch. | Checks all 10 dependents; returns 409 with itemized counts and assigned staff details with reassign links; prevents deleting/deactivating last active branch; auto-failover for online default. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Category** | `Category` | `children` (subcategories), `products` | Checked only 1 product without count; left uploaded images on disk. | Checks exact subcategory & product counts; returns 409 with blocker summary; cleans `image` & `icon` via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Brand** | `Brand` | `products`, `series` | Checked only 1 product without count; left logo file. | Checks exact product and series counts; returns 409 with itemized counts; cleans `logo` via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Series** | `Series` | `products` | Checked 1 product without count. | Returns 409 with exact linked product count; offers deactivation. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Unit** | `Unit` | `products` | Checked 1 product without count. | Returns 409 with exact linked product count; offers deactivation. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Attribute** | `Attribute` | `values`, variants (`color`, `quality`), `specifications` | Cascade deleted attribute values even if used by active product variants! | Inspects all child values across `productVariant` and `productSpecification`; blocks deletion if in active variant use with 409 count. | Yes (`status: Boolean`) | **PASS** (Protected & Deactivatable) |
| **Attribute Value** | `AttributeValue` | `productVariant`, `productSpecification` | Checked variant & spec counts with 409. | Checked variant & spec counts with 409 Conflict. | Yes (`status: Boolean`) | **PASS** (Protected & Deactivatable) |
| **Product** | `Product` | `orderItems`, `purchaseOrderItems`, `phoneUnits`, `branchInventory` (positive/reserved stock) | Only checked orderItems take:1; used sync `fs.unlinkSync` which crashed on missing paths. | Checks orders, purchases, phone units, and active stock across all branches; returns 409 with structured counts; cleans images via async `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`, `DRAFT`, `DISCONTINUED`) | **PASS** (Protected & Deactivatable) |
| **Customer** | `Customer` | `orders`, `serviceJobs`, `addresses`, `activities` | Threw HTTP 400 BadRequestException with generic text. | Returns HTTP 409 Conflict with exact order and service job counts; transactionally cascades addresses/activities on hard delete. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Supplier** | `Supplier` | `totalDue`, `purchaseOrders`, `payments`, `logo` | Checked due and purchaseOrders without counts; left logo file. | Checks `totalDue` amount, `purchaseOrders` count, `payments` count; returns 409 with blocker breakdown; cleans logo via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Employee / Staff** | `Staff` | `managedBranches`, `headOfDepartments`, `Order`, `ServiceJob`, `Payroll`, `Expense`, `StockAdjustment`, `WastedProduct`, `SupplierPayment`, `recordedWalletTransactions`, private documents | Only checked 1 order/service job; raw errors on payroll/expense FK constraints; left private docs on disk. | Checks all 9 dependents and management assignments; returns 409 with detailed breakdown; cleans `avatarUrl`, `nidDocumentUrl`, `cvDocumentUrl` via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `TERMINATED`) | **PASS** (Protected & Deactivatable) |
| **Role** | `Role` | `isSystem`, `staff`, `permissions`, `branchPermissions` | Threw 400 for system role; 409 without transaction cleanup. | Throws 409 Conflict for system roles; counts assigned staff; transactionally deletes permissions and branch permissions on hard delete. | No (Structural RBAC) | **PASS** (Guarded) |
| **Department** | `Department` | `staff` | Checked count with 409. | Returns 409 Conflict with exact assigned employee count. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Expense Category** | `ExpenseCategory` | `expenses` | Threw HTTP 400 BadRequestException. | Returns HTTP 409 Conflict with exact expense record count. | No (Dictionary) | **PASS** (Guarded) |
| **Expense** | `Expense` | `status`, `walletTransaction`, `attachmentUrl` | Allowed deleting approved expenses leaving orphaned wallet transactions. | Blocks deletion of `APPROVED` expenses (financial ledger impact) with 409; unlinks attachment via `safeUnlink`. | Yes (`PENDING`, `APPROVED`, `REJECTED`) | **PASS** (Guarded) |
| **Wallet Type** | `WalletType` | `currentBalance`, `transactions`, `expenses`, `supplierPayments` | Checked history with generic text. | Itemizes `currentBalance`, `transactions`, `expenses`, `supplierPayments` in 409 blocker list. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Protected & Deactivatable) |
| **Purpose** | `Purpose` | `transactions` | Checked transactions with 409 count. | Returns 409 Conflict with transaction count. | No (Dictionary) | **PASS** (Guarded) |
| **Purchase Order** | `PurchaseOrder` | `status`, `payments`, `quantityReceived`, `documentUrl` | No delete endpoint existed; was only patch cancel. | Added `DELETE /purchase-orders/:id`: hard delete allowed ONLY for `DRAFT` status with 0 received items and 0 payments; unlinks `documentUrl`. Completed POs return 409. | Yes (`DRAFT`, `ORDERED`, `RECEIVED`, `COMPLETED`, `CANCELLED`) | **PASS** (Guarded) |
| **Order / Sale** | `Order` | `status`, `payments`, `shipments`, `items` | No delete endpoint existed. | Added `DELETE /orders/:id`: hard delete allowed ONLY for `PENDING` / `CANCELLED` orders with 0 payments and 0 shipments; releases reserved inventory; orders with financial history return 409. | Yes (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURNED`) | **PASS** (Guarded) |
| **Service Job** | `ServiceJob` | `status`, `payments`, `orderId`, `materials` | Unconditionally deleted payments and orders! | Blocks deletion of `COMPLETED` or `DELIVERED` service jobs and jobs with recorded payments with 409 Conflict; cleanly deletes unbilled draft jobs. | Yes (`PENDING`, `IN_PROGRESS`, `WAITING_FOR_PARTS`, `COMPLETED`, `DELIVERED`, `CANCELLED`) | **PASS** (Guarded) |
| **Promo Code** | `PromoCode` | `usedCount`, `orders` | Allowed deleting promo codes with usage history. | Checks `usedCount` and order usage; returns 409 with usage count; offers deactivation. | Yes (`ACTIVE`, `INACTIVE`, `EXPIRED`) | **PASS** (Protected & Deactivatable) |
| **Banner** | `Banner` | `imageUrl` | Hard deleted row but left image on disk. | Safely unlinks `imageUrl` via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`) | **PASS** (Deactivatable) |
| **Ad** | `Ad` | `imageUrl`, `mobileThumbnailUrl` | Hard deleted row but left image on disk. | Safely unlinks `imageUrl` and `mobileThumbnailUrl` via `safeUnlink`. | Yes (`ACTIVE`, `INACTIVE`, `EXPIRED`) | **PASS** (Deactivatable) |
| **Blog** | `Blog` | `featuredImage` | Hard deleted row but left image on disk. | Safely unlinks `featuredImage` via `safeUnlink`. | Yes (`DRAFT`, `PUBLISHED`, `ARCHIVED`) | **PASS** (Deactivatable) |
| **Push Notification** | `PushNotification` | `status`, `deliveredCount` | Hard deleted row. | Deletable in DRAFT/FAILED; status is preserved. | Yes (`DRAFT`, `SCHEDULED`, `SENT`, `FAILED`) | **PASS** (Status Governed) |
| **Delivery Charge** | `DeliveryChargeTier` | Standalone zone tier | Hard deleted. | Allowed (configuration tier). | Yes (`isActive`) | **PASS** |
| **Currency** | `Currency` | System currencies | Hard deleted. | Protected system default. | Yes (`status`) | **PASS** |
| **Wanted Product** | `WantedProduct` | Standalone customer wish item | Hard deleted. | Allowed. | Yes (`PENDING`, `RESOLVED`, `CANCELLED`) | **PASS** |
| **Wasted Product** | `WastedProduct` | Standalone scrap report | Hard deleted. | Allowed. | No | **PASS** |
| **Support Ticket** | `SupportTicket` | Messages | Hard deleted. | Allowed for test/spam cleanup. | Yes (`OPEN`, `RESOLVED`, `CLOSED`) | **PASS** |
| **Help Note** | `HelpNote` | Standalone internal note | Hard deleted. | Allowed. | No | **PASS** |
| **Contact Submission** | `ContactSubmission` | Standalone inquiry | Hard deleted. | Allowed. | No | **PASS** |
| **Stock Adjustment** | `StockAdjustment` | Permanent inventory ledger | No delete endpoint (Immutable). | Immutable audit record. Cannot be deleted. | No (Immutable ledger) | **PASS** (Audit Compliant) |
| **Shipment / Courier** | `Shipment` | Courier delivery tracking | No delete endpoint. Status transitions via PATCH. | Immutable consignment tracking. Cannot be deleted. | Yes (`PENDING`, `WITH_COURIER`, `DELIVERED`, `RETURNED`, `CANCELLED`) | **PASS** (Status Governed) |
| **Payroll** | `Payroll` | Disbursed salaries | No delete endpoint. Status transitions via PATCH. | Immutable financial payroll record. Cannot be deleted. | Yes (`UNPAID`, `PAID`, `PROCESSING`) | **PASS** (Audit Compliant) |

---

## Entities Without a Status Field
Per Global Rule A3.3, no Prisma schema alterations are permitted without prior stop & report. The following entities do not have a dedicated status/active column in the database schema:
- `Role` (Managed through permission scope and assignment guards)
- `ExpenseCategory` (Managed through dependent check guards)
- `Purpose` (Managed through transaction ledger check guards)
- `WastedProduct` (Historical scrap record)
- `HelpNote` (Internal scratchpad note)
- `ContactSubmission` (Customer inbox inquiry)
- `StockAdjustment` (Immutable inventory ledger entry)

All of the above either enforce hard dependency blocks (preventing any deletion when dependents exist) or represent single-use inquiries/notes where hard deletion of unreferenced items is the intended business behavior.

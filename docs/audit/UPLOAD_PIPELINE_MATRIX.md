# UPLOAD PIPELINE AUDIT MATRIX

**Audit Date:** October 11, 2026  
**Auditor:** Automated QA System (Local Production Regression Suite)  
**Scope:** Complete inventory of all file and image upload mechanisms across admin, staff, technician, and storefront panels.  
**Persistent Storage Target:** Dedicated persistent directory outside codebase (`UPLOAD_ROOT`, defaulting to `./uploads`), or Cloudflare R2 bucket when configured.

---

## 1. Upload Pipeline Matrix

| Admin / Staff UI Location | Component File | API Endpoint | Multer Limits & File Filter | Storage Location on Disk | Exact Value Saved in DB | URL Resolution for Browser | Public Storefront Render Location | Public / Private | Status | Evidence & Audit Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Business Settings > General** (Site Logo, Favicon, Watermark) | `src/app/(admin)/admin/business-settings/general/page.tsx` | `POST /api/v1/business-settings/upload` | Max 5MB; mime/ext check (`.jpg, .jpeg, .png, .webp, .gif, .svg, .pdf`) | `${UPLOAD_ROOT}/settings/${uuid}-${basename}.${ext}` | Relative path string: `/uploads/settings/...` in `BusinessSetting.branding` JSON | `getImageUrl(value)` in `api-client.ts` prepending `BACKEND_URL` | Storefront Header (`Navbar.tsx`), Footer (`Footer.tsx`), Favicon `<link rel="icon">`, error pages (`not-found.tsx`, `global-error.tsx`) | Public | **OK (RISK: MIME inspection / SVG)** | Upload successfully stores relative path. SVG allowed without sanitization. If `NEXT_PUBLIC_BACKEND_URL` in `.env` lacks `http://`, `next/image` crashes. |
| **Marketing > Banners** (Hero carousel banners) | `src/app/(admin)/admin/marketing/banners/create/page.tsx`, `banners/page.tsx` | `POST /api/v1/banners`, `PATCH /api/v1/banners/:id` | Max 5MB; `FileInterceptor('image')` | `${UPLOAD_ROOT}/banners/${uuid}-${basename}.${ext}` | Relative `/uploads/banners/...` (or R2 URL) in `Banner.imageUrl` | `getImageUrl(slide.imageUrl)` | Storefront Homepage hero carousel (`src/components/storefront/HeroCarousel.tsx:64`) | Public | **OK** | Verified live with `/_next/image` returning HTTP 200 on sample `/uploads/banners/audit-test.jpg`. Browser cache-busting handled via unique UUID in filename. |
| **Marketing > Ads** (Desktop & Mobile banners) | `src/app/(admin)/admin/marketing/ads/create/page.tsx`, `ads/page.tsx` | `POST /api/v1/ads`, `PATCH /api/v1/ads/:id` | Max 5MB per file; `FileFieldsInterceptor([desktopImage, mobileImage])` | `${UPLOAD_ROOT}/ads/${uuid}-${basename}.${ext}` | Relative `/uploads/ads/...` in `Ad.imageUrl` and `Ad.mobileThumbnailUrl` | `getImageUrl(ad.imageUrl)` | Storefront Homepage promo grids (`src/app/(storefront)/page.tsx`) | Public | **OK** | Live DB inspection confirms relative paths. Frontend renders via `getImageUrl`. |
| **Categories** (Category Banner & Icon) | `src/app/(admin)/admin/category/page.tsx` | `POST /api/v1/categories`, `PATCH /api/v1/categories/:id` | Max 5MB; `FileInterceptor('image')` | `${UPLOAD_ROOT}/categories/${uuid}-${basename}.${ext}` | Relative `/uploads/categories/...` in `Category.image`, `Category.icon` | `getImageUrl(cat.icon)` / `getImageUrl(cat.image)` | Homepage category grid (`page.tsx:180`), navigation mega-menu (`Navbar.tsx`), Category product listing (`category/[slug]`) | Public | **OK** | Stored relative. Renders properly across storefront. |
| **Brands** (Brand Logo) | `src/app/(admin)/admin/products/brands/page.tsx` | `POST /api/v1/brands`, `PATCH /api/v1/brands/:id` | Max 5MB; `FileInterceptor('logo')` | `${UPLOAD_ROOT}/brands/${uuid}-${basename}.${ext}` | Relative `/uploads/brands/...` in `Brand.logo` | `getImageUrl(brand.logo)` | Storefront Brand showcase (`page.tsx`), catalog filter sidebar | Public | **OK** | Stored relative. Tested and working. |
| **Products** (Multi-image Gallery) | `src/components/admin/ProductForm.tsx` | `POST /api/v1/products`, `PATCH /api/v1/products/:id` | Max 5MB per image, up to 10 images; `FilesInterceptor('images', 10)` | `${UPLOAD_ROOT}/products/${uuid}-${basename}.${ext}` | Relative `/uploads/products/...` in `ProductImage.url` | `getImageUrl(img.url)` | ProductCard (`ProductCard.tsx:47`), Product details hero & gallery (`ProductDetailClientView.tsx:216`), Cart & Checkout | Public | **OK** | Multi-image batch uploaded, database stores clean relative URLs. |
| **Marketing > Blogs** (Cover Image) | `src/app/(admin)/admin/marketing/blogs/create/page.tsx`, `blogs/page.tsx` | `POST /api/v1/blogs`, `PATCH /api/v1/blogs/:id` | Max 5MB; `FileInterceptor('image')` | `${UPLOAD_ROOT}/blogs/${uuid}-${basename}.${ext}` | Relative `/uploads/blogs/...` in `Blog.featuredImage` | `getImageUrl(coverImg)` | Blog listing (`BlogCard.tsx:35`), Single post header (`blog/[slug]/page.tsx:59`) | Public | **OK** | Tested relative URL storage and frontend public rendering. |
| **Customers** (Customer Avatar) | `src/app/(admin)/admin/customers/create/page.tsx`, `[id]/edit/page.tsx` | `POST /api/v1/customers/upload` | Max 5MB; `FileInterceptor('image')` | `${UPLOAD_ROOT}/customers/${uuid}-${basename}.${ext}` | Relative `/uploads/customers/...` in `Customer.avatar` | `getImageUrl(customer.avatar)` | Storefront Account Profile (`src/app/(storefront)/account/page.tsx`) | Authenticated / User Profile | **OK** | Upload endpoint requires `CUSTOMERS:CREATE` permission, returns relative path. |
| **HRM > Employees** (Profile Photo & Birth Certificate / NID) | `src/components/admin/EmployeeForm.tsx` | `POST /api/v1/employees`, `PATCH /api/v1/employees/:id` | Max 5MB each; `FileFieldsInterceptor([profilePhoto, birthCertificate])` | `${UPLOAD_ROOT}/staff-documents/${uuid}-${basename}.${ext}` | Relative `/uploads/staff-documents/...` in `Staff.photo` and `Staff.birthCertificateUrl` | Direct path / `getImageUrl` in Admin Employee view | NONE | **PRIVATE (CONFIDENTIAL SENSITIVE PERSONAL DATA)** | **P0 BROKEN / CRITICAL SECURITY LEAK** | `main.ts:54` serves all files in `UPLOAD_ROOT` via public static route `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })`. Unauthenticated requests can download NID/birth certificates directly via HTTP. |
| **Accounting > Purchase Orders** (Supplier Invoices & Bills) | `src/app/(admin)/admin/accounting/purchase/create/page.tsx` | `POST /api/v1/purchase-orders/:id/document` | Max 5MB; `FileInterceptor('document')` | `${UPLOAD_ROOT}/purchase-documents/${uuid}-${basename}.${ext}` | Relative `/uploads/purchase-documents/...` in `PurchaseOrder.documentUrl` | Download link in Purchase Order details | NONE | **PRIVATE (CONFIDENTIAL COMMERCIAL INVOICE)** | **P0 BROKEN / CRITICAL SECURITY LEAK** | Verified live with curl: `GET http://localhost:4000/uploads/purchase-documents/f0d7e406-f2c1-4306-9399-a1089c34feb3-test-invoice-pass10.pdf` returned HTTP 200 OK without any authentication header. |
| **Accounting > Expenses** (Receipts & Tax Slips) | `src/app/(admin)/admin/accounting/expense/page.tsx` | `POST /api/v1/expenses` | Max 5MB; `FileInterceptor('attachment')` | `${UPLOAD_ROOT}/expenses/${uuid}-${basename}.${ext}` | Relative `/uploads/expenses/...` in `Expense.attachmentUrl` | Attachment link in Admin Expense table | NONE | **PRIVATE (CONFIDENTIAL FINANCIAL RECEIPTS)** | **P0 BROKEN / CRITICAL SECURITY LEAK** | Unauthenticated public HTTP request fetches uploaded receipt file directly via NestJS static assets. |
| **Products > Bulk Import** (CSV / Excel Import) | `src/app/(admin)/admin/products/bulk/page.tsx` | NONE (Client simulation) | N/A | N/A | None | N/A | NONE | Staff / Admin | **RISK / STUBBED FEATURE** | UI has interactive file dropzone and preview table, but action runs simulated `setTimeout` without backend endpoint. |

---

## 2. In-Depth Technical Investigation

### a) Host & URL Hardcoding
- **Database Inspection:** Zero instances of `localhost`, `127.0.0.1`, or hardcoded domain URLs in `Banner`, `Ad`, `ProductImage`, `Category`, `Brand`, `Blog`, or `BusinessSetting`. All uploads store relative paths (e.g. `/uploads/banners/...`) or valid CDN URLs.
- **Client Resolution:** `src/lib/api-client.ts:getImageUrl(path)` dynamically resolves paths using `process.env.NEXT_PUBLIC_BACKEND_URL`.
- **Production Vulnerability:** If `NEXT_PUBLIC_BACKEND_URL` is configured without `http://` or `https://` (e.g., `api.mobilehubbd.tech`), `next.config.mjs:194` executes `new URL(process.env.NEXT_PUBLIC_BACKEND_URL).hostname`, which crashes during Next.js initialization with a fatal `TypeError: Invalid URL`.

### b) Next.js Image Optimization (`next.config.mjs`)
- `next.config.mjs` allows `images.unsplash.com`, `i.pravatar.cc`, `placehold.co`, `localhost:4000`, and all HTTPS origins via `{ protocol: 'https', hostname: '**' }`.
- Live test: `curl http://localhost:3000/_next/image?url=http%3A%2F%2Flocalhost%3A4000%2Fuploads%2Fbanners%2Faudit-test.jpg&w=640&q=75` returned `HTTP/1.1 200 OK` (Cache: MISS, Content-Length: 52701).
- **Behavioral Anomaly:** `next.config.mjs:155` specifies `contentDispositionType: 'attachment'`, causing Next.js image optimization endpoint to respond with `Content-Disposition: attachment; filename="audit-test.jpeg"`. While safe for SVGs, this forces file downloads when image URLs are opened directly in browser tabs.

### c) How `/uploads` is Served & The Reverse Proxy
- Currently, NestJS serves files directly via:
  ```ts
  // api/src/main.ts:54
  const uploadDir = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  ```
- **Performance & Security Defect:** NestJS event-loop handles disk I/O for static assets. On VPS, Nginx should serve public static uploads directly.
- **Critical Risk:** NestJS static asset middleware does not perform route authorization. Sensitive subdirectories (`purchase-documents`, `staff-documents`, `expenses`) share the same static root.

### d) Private Files Exposure (P0 Severity)
- **Vulnerability Confirmed:** `staff-documents` (NIDs, passports, birth certificates), `purchase-documents` (supplier invoices), and `expenses` (financial slips) are completely unauthenticated.
- **Reproduction:**
  ```bash
  curl -s -I "http://localhost:4000/uploads/purchase-documents/f0d7e406-f2c1-4306-9399-a1089c34feb3-test-invoice-pass10.pdf"
  # Response: HTTP/1.1 200 OK
  ```
- **Remediation Requirement:**
  1. Segregate private uploads to a non-static directory (e.g., `${UPLOAD_ROOT}/private/` or dedicated folders).
  2. Block public Nginx access to private paths: `location ^~ /uploads/(staff-documents|purchase-documents|expenses)/ { return 403; }`.
  3. Serve private files exclusively through authenticated NestJS controller streaming endpoints with `@RequirePermission`.

### e) Validation & Sanitization
- `multer.config.ts` currently verifies `file.mimetype` and file extension string:
  - Allowed: `.jpg, .jpeg, .png, .webp, .gif, .svg, .pdf`
  - MIME spoofing risk: Multer does not inspect initial buffer magic bytes.
  - SVG Risk: `image/svg+xml` is allowed in user uploads without XML sanitization (DOMPurify / sanitize-svg), presenting stored XSS risks if an attacker embeds `<script>` tags inside an SVG logo or banner.
  - Filename Safety: Filenames use `crypto.randomUUID() + sanitized_basename + extension`, successfully neutralizing path traversal and file collisions.

### f) Replace & Delete Behavior
- **Browser Cache Busting:** Because every new upload generates a new UUID (`crypto.randomUUID()`), replaced images generate completely unique URLs. Stale browser caches are automatically bypassed within 0 seconds.
- **Orphan File Handling:** When a product, banner, or category is deleted or updated in the DB, the previous physical file on disk is currently retained. Storage disk accumulates orphaned assets over time.

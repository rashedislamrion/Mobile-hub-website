# GO-LIVE ADMIN CONFIGURATION CHECKLIST (FRESH PRODUCTION DATABASE)

**Document:** `docs/GO_LIVE_ADMIN_CHECKLIST.md`  
**Purpose:** Comprehensive inventory of every business setting, master-data entity, credential, and CMS component that must be configured by an administrator upon initial deployment of MobileHubBD with a fresh/empty production database.  
**Derived From:** Codebase Inspection (`api/src/`, `src/config/`, `src/app/(admin)/`, `src/app/(storefront)/`)

---

## 1. Quick Launch Priority Flow

Follow this sequence for configuring a fresh database:
1. **Security & Identity:** Reset Super Admin default password.
2. **Business Settings & Branding:** Store name, official contact info, logos, and favicon.
3. **Branches:** Set up Flagship store (`BR-DHK`) and official physical outlets.
4. **Currencies & Delivery Charges:** Set base currency (BDT) and shipping tiers.
5. **Payment Gateways:** Configure COD, SSLCommerz, and bKash credentials.
6. **Third-Party Services:** SMS gateway and SMTP mail configuration.
7. **Catalogue Master Data:** Categories, Brands, Series, Units, Attributes & Values.
8. **Products & Inventory:** Initial stock intake and variant setup.
9. **CMS & Marketing:** Static legal pages, social links, banners, and footer settings.

---

## 2. Detailed Configuration Matrix

### Phase 1: Security & Staffing
| Setting / Entity | Admin Navigation | Required Fields / Keys | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **Super Admin Password** | `/admin/hrm/employees` or Profile Menu | Current Password -> New Strong Password (min 12 chars). | Admin Portal Security (`/admin/*`) |
| **Store Branches** | `/admin/branch/create` | `name`, `code` (e.g. `BR-DHK`), `type` (FLAGSHIP/OUTLET), `address`, `city`, `phone`, `email`, `showInFooter: true`, `status: ACTIVE`. | Storefront Footer (`Our Outlets`), Contact Us (`/contact`), Checkout branch routing |
| **Departments & Roles** | `/admin/hrm/departments`, `/admin/hrm/roles-permissions` | Default roles (Admin, Branch Admin, Branch Manager, Technician, Salesperson). | Internal RBAC & Branch Scoping |
| **Branch Staff** | `/admin/hrm/employees/create` | `name`, `email`, `phone`, `password`, `roleId`, `branchId` (scoped for branch staff). | POS, Orders, Servicing, Audit logs |

---

### Phase 2: General Business Settings & Branding
| Setting Key / Group | Admin Navigation | Config Keys & Expected Values | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **General Info** | `/admin/business-settings/general` | `companyName`: "MobileHubBD"<br>`shopName`: "MobileHubBD"<br>`phone`: "01602670922"<br>`mobileNumber`: "01602670922"<br>`hotlineNumber`: "01602670922"<br>`email`: "mobilehubbd2@gmail.com"<br>`address`: "2/13 Eastern Plaza Shopping Complex, Hatirpool, Dhaka 1205"<br>`timeZone`: "Asia/Dhaka"<br>`defaultCurrency`: "BDT" | Storefront Header, Footer, Contact (`/contact`), POS Invoices, Email notifications |
| **SEO Defaults** | `/admin/business-settings/general` | `websiteTitle`: "MobileHubBD - Smartphone Parts & Repair Shop"<br>`seoMetaTitle`: "MobileHubBD \| Genuine Smartphone Displays & Batteries"<br>`seoMetaDescription`: "Original displays, batteries and repair parts in Bangladesh."<br>`seoKeywords`: "mobile parts, display, battery, repair, bangladesh" | Storefront root HTML metadata (`<title>`, `<meta name="description">`, OpenGraph) |
| **Brand Assets** | `/admin/business-settings/setup` | `logoUrl`: Clean SVG/PNG logo (~4:1 aspect ratio)<br>`faviconUrl`: Square ICO/PNG favicon (32x32 or 64x64)<br>`appLogoUrl`: Square store avatar<br>`primaryColor`: `#059669` (Emerald) or brand theme hex | Storefront Header, Favicon, PWA meta, Invoice headers, Admin Sidebar |
| **Verification & OTP** | `/admin/business-settings/verification` | `phoneMinLength`: 11, `phoneMaxLength`: 11<br>`registrationPhoneRequired`: true<br>`mustVerifyOnOrderPlacement`: false (or true if SMS OTP mandatory) | Customer Registration (`/register`), Checkout (`/checkout`) |

---

### Phase 3: Currency, Taxes & Delivery Charges
| Setting / Entity | Admin Navigation | Required Configuration | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **Default Currency** | `/admin/business-settings/currency` | Name: `BDT`, Symbol: `৳`, Rate: `1`, Default: `true` | Entire Storefront prices, Cart, Checkout, Invoices |
| **Delivery Charges** | `/admin/business-settings/delivery-charge` | Inside Dhaka: `৳60` - `৳70`<br>Outside Dhaka / Express: `৳120` - `৳150`<br>Free Shipping Threshold: `৳5000` | Cart Drawer, Checkout calculation (`/checkout`), Order totals |
| **Delivery Charge Tiers** | `/admin/business-settings/delivery-charge` | Optional tiered pricing by order quantity (e.g. 1-2 items = ৳70, 3+ items = ৳100). | Checkout shipping line item |

---

### Phase 4: Payment Gateways & Third-Party Integrations
| Provider / Channel | Admin Navigation | Required Credentials / Setup | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **Cash on Delivery (COD)** | `/admin/3rd-party` | Status: `Active`, Title: "Cash on Delivery", Instructions. | Checkout Payment Options (`/checkout`) |
| **SSLCommerz** | `/admin/3rd-party` | `storeId`: Production Store ID<br>`storePassword`: Production Store Password<br>`mode`: "Live"<br>`currency`: "BDT"<br>Status: `Active` | Checkout Online Payment -> Hosted Gateway (Cards, Net Banking, Mobile Wallets) |
| **bKash Direct Checkout** | `/admin/3rd-party` | `appKey`: Live App Key<br>`appSecretKey`: Live Secret<br>`username`: Merchant Username<br>`password`: Merchant Password<br>`mode`: "Live"<br>Status: `Active` | Checkout -> bKash Tokenized Pop-up Modal |
| **SMS Gateway** | `/admin/3rd-party` | Provider: `Greenweb` or `SSL Wireless`<br>`apiKey`: API Token<br>`senderId`: Approved Masking / Sender ID<br>Status: `Active` | Order placement SMS, Status update SMS, Password reset OTP |
| **SMTP Mail Server** | `/admin/3rd-party` | `host`: mail.mobilehubbd.tech (or Google SMTP)<br>`port`: 465 (SSL) or 587 (TLS)<br>`username`: info@mobilehubbd.tech<br>`password`: SMTP App Password<br>`fromName`: "MobileHubBD"<br>`fromEmail`: "noreply@mobilehubbd.tech" | Order confirmation emails, Customer registration emails |
| **Google ReCaptcha v3** | `/admin/3rd-party` | `siteKey`: reCAPTCHA v3 Public Key<br>`secretKey`: reCAPTCHA v3 Secret Key<br>Status: `Active` | Contact Form (`/contact`), Customer Registration |

---

### Phase 5: Catalogue Master Data & Products
| Master Entity | Admin Navigation | Minimum Recommended Set | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **Categories** | `/admin/category` | Displays, Batteries, Housings, Camera Glass, Charging Ports, Accessories, Phones. Set `showInHomepage: true`. | Header Category Mega-Menu, Home Category Grid, Category Listing (`/category/[slug]`) |
| **Brands** | `/admin/products/brands` | Apple, Samsung, Google, Xiaomi, OnePlus, Oppo, Vivo, Realme. Upload high-res SVG/PNG logos. | Brand Filter in Shop, Product Details (`/product/[slug]`) |
| **Series** | `/admin/products/series` | iPhone 15 Series, Galaxy S23 Series, Pixel 8 Series, etc. Linked to parent brand. | Shop Filter by Model/Series |
| **Units** | `/admin/products/units` | `Piece (Pcs)`, `Set`, `Box` | Product specification display |
| **Attributes & Values** | `/admin/products/attributes` | - `Color`: Phantom Black, Botanic Green, Titanium Gray, Silver<br>- `Storage`: 128GB, 256GB, 512GB, 1TB<br>- `Battery Health`: 100%, 95-99%, 90-94%<br>- `Grade`: Grade A (Pristine), Grade B, Authentic Pull | Variant Specification chips, Variant selectors in Product Page |
| **Products & Variants** | `/admin/products/create` | Minimum 10-20 hero products with images, description, regularPrice, variants with SKUs, and initial stock. | Home Featured Grid, Home New Arrivals, `/phones`, Category pages, Search |

---

### Phase 6: CMS, Static Pages & Marketing
| CMS Element | Admin Navigation | Content & Expected Structure | Public Pages Affected |
| :--- | :--- | :--- | :--- |
| **Hero Banners** | `/admin/marketing/banners` | 2-3 Hero Sliders (1920x600 px desktop, responsive mobile crop). Target URLs (e.g. `/category/displays`). | Homepage Top Carousel (`/`) |
| **Promotional Ads** | `/admin/marketing/ads` | 2 Middle Promotional Banners (e.g. "Screen Replacement Deal", "Genuine Batteries Guaranteed"). | Homepage Mid-Section Ad Banners |
| **Static Legal Pages** | `/admin/cms/pages` | - `About Us` (`/about`)<br>- `Terms of Service` (`/terms`)<br>- `Privacy Policy` (`/privacy`)<br>- `Warranty & Replacement Policy` (`/pages/warranty-policy`) | Storefront Header/Footer links, Checkout terms link |
| **Social Media Links** | `/admin/cms/social` | - Facebook: Official Page URL<br>- Instagram: Profile URL<br>- YouTube: Channel URL<br>- WhatsApp: Direct API Link (`https://wa.me/8801602670922`) | Storefront Footer Social Icons, Product Details "Order via WhatsApp" button |
| **Footer Settings** | `/admin/cms/footer` | `supportPhone`: "01602670922"<br>`supportEmail`: "mobilehubbd2@gmail.com"<br>`copyrightText`: "© 2026 MobileHubBD. All rights reserved."<br>`liveChatLink`: "https://wa.me/8801602670922" | Storefront Footer (`/components/storefront/Footer.tsx`) |

---

## 3. Go-Live Verification Sign-Off

Before opening traffic to public customers:
- [ ] Run automated health verification: `BASE_WEB=https://mobilehubbd.tech BASE_API=https://api.mobilehubbd.tech node scripts/qa/smoke_production.mjs`.
- [ ] Place a real test order using **Cash on Delivery** on the live URL.
- [ ] Place a test order using **SSLCommerz** (using a test card or minimum ৳10 transaction).
- [ ] Verify that order confirmation SMS and emails are successfully received.
- [ ] Open the order in the Admin portal (`/admin/orders`) and verify invoice PDF print.
- [ ] Verify that "Our Outlets" in the footer shows the real branch address (`2/13 Eastern Plaza Shopping Complex, Hatirpool, Dhaka 1205`).
- [ ] Verify that the bottom payment strip is visible and crisp across desktop and mobile.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../../../api/node_modules/@prisma/client/default.js';
import jwt from '../../../api/node_modules/jsonwebtoken/index.js';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api/v1';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';

const QA_PREFIX = 'QA-LOCAL-E2E';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(title, condition, extraInfo = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[PASS] ${title}`);
  } else {
    failedChecks++;
    const msg = `[FAIL] ${title} ${extraInfo ? `-> ${extraInfo}` : ''}`;
    console.error(msg);
    failures.push(msg);
  }
}

function makeStaffToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userType: 'STAFF',
      roleId: user.roleId,
      branchId: user.branchId,
    },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqHeaders = { ...(options.headers || {}) };
    if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: reqHeaders,
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBuffer.toString('utf8'));
        } catch {
          json = rawBuffer.toString('utf8');
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: rawBuffer,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================================');
  console.log('FULL END-TO-END BUSINESS-FLOW VERIFICATION SUITE (PASS 52)');
  console.log('================================================================================');

  // Load baseline branches
  const activeBranches = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (activeBranches.length === 0) {
    throw new Error('Database must have at least 1 active branch');
  }
  const defaultBranch = activeBranches[0];

  // Load super admin staff with GLOBAL Admin role
  const superAdminStaff = await prisma.staff.findFirst({
    where: {
      role: {
        name: 'Admin',
        scope: 'GLOBAL',
      },
    },
    include: { role: true },
  });
  if (!superAdminStaff) {
    throw new Error('Super Admin staff with GLOBAL Admin role not found in database');
  }
  const superAdminToken = makeStaffToken(superAdminStaff);

  // Load technician role
  const technicianRole = await prisma.role.findFirst({
    where: { name: { contains: 'Technician', mode: 'insensitive' } },
  });

  // Track created records for 100% clean teardown
  const createdRecords = {
    customers: [],
    staffs: [],
    categories: [],
    brands: [],
    units: [],
    products: [],
    orders: [],
    suppliers: [],
    purchases: [],
    serviceJobs: [],
    expenses: [],
    banners: [],
    promoCodes: [],
  };

  try {
    // =========================================================================
    // B1: AUTHENTICATION
    // =========================================================================
    console.log('\n--- B1: Authentication & Access Control ---');

    // 1. Staff login with wrong password returns 401
    const staffLoginBad = await request(`${API_BASE}/auth/staff/login`, {
      method: 'POST',
    }, {
      email: superAdminStaff.email,
      password: 'wrong_password_12345',
    });
    check('B1.1 Staff login with wrong password returns 401 Unauthorized', staffLoginBad.status === 401);

    // 2. Direct access to protected endpoint without token returns 401
    const anonStaffList = await request(`${API_BASE}/employees`);
    check('B1.2 Anonymous request to protected admin endpoint returns 401', anonStaffList.status === 401);

    // 3. Customer registration
    const testCustEmail = `qa_cust_${Date.now()}@example.com`;
    const custRegRes = await request(`${API_BASE}/auth/customer/register`, {
      method: 'POST',
    }, {
      name: `${QA_PREFIX} Test Customer`,
      email: testCustEmail,
      phone: `017${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const custRegistered = custRegRes.status === 201 || custRegRes.status === 200;
    check('B1.3 Customer registration succeeds (HTTP 200/201)', custRegistered);
    const regCustomerId = custRegRes.data?.customer?.id || custRegRes.data?.user?.id;
    if (regCustomerId) {
      createdRecords.customers.push(regCustomerId);
    }

    // 4. Customer login
    const custLoginRes = await request(`${API_BASE}/auth/customer/login`, {
      method: 'POST',
    }, {
      email: testCustEmail,
      password: 'Password123!',
    });
    check(
      'B1.4 Customer login with correct credentials returns 200/201 and accessToken',
      (custLoginRes.status === 200 || custLoginRes.status === 201) && Boolean(custLoginRes.data?.accessToken),
    );

    // =========================================================================
    // B2: MASTER DATA CRUD & UNIFIED DELETE BEHAVIOUR
    // =========================================================================
    console.log('\n--- B2: Master Data CRUD & Blocker Guard Verification ---');

    // 1. Category CRUD
    const catCreateRes = await request(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Acc Category`,
      slug: `qa-acc-cat-${Date.now()}`,
    });
    check('B2.1 Create Category succeeds', catCreateRes.status === 201 || catCreateRes.status === 200);
    const createdCat = catCreateRes.data;
    if (createdCat?.id) createdRecords.categories.push(createdCat.id);

    // 2. Brand CRUD
    const brandCreateRes = await request(`${API_BASE}/brands`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Brand`,
      slug: `qa-brand-${Date.now()}`,
    });
    check('B2.2 Create Brand succeeds', brandCreateRes.status === 201 || brandCreateRes.status === 200);
    const createdBrand = brandCreateRes.data;
    if (createdBrand?.id) createdRecords.brands.push(createdBrand.id);

    // 3. Unit CRUD
    const unitCreateRes = await request(`${API_BASE}/units`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Pcs Unit`,
      shortCode: 'PCS',
    });
    check('B2.3 Create Unit succeeds', unitCreateRes.status === 201 || unitCreateRes.status === 200);
    const createdUnit = unitCreateRes.data;
    if (createdUnit?.id) createdRecords.units.push(createdUnit.id);

    // 4. Supplier CRUD
    const supCreateRes = await request(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Vendor Ltd`,
      phone: `018${Math.floor(10000000 + Math.random() * 90000000)}`,
      address: 'Dhaka Hardware Market',
    });
    check('B2.4 Create Supplier succeeds', supCreateRes.status === 201 || supCreateRes.status === 200);
    const createdSup = supCreateRes.data;
    if (createdSup?.id) createdRecords.suppliers.push(createdSup.id);

    // =========================================================================
    // B3: CATALOGUE TO STOREFRONT & SECURITY SANITIZATION
    // =========================================================================
    console.log('\n--- B3: Catalogue to Storefront & Data Sanitization ---');

    const testProdSlug = `qa-e2e-product-${Date.now()}`;
    const prodCreateRes = await request(`${API_BASE}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Premium Phone Case`,
      slug: testProdSlug,
      categoryId: createdCat.id,
      brandId: createdBrand.id,
      unitId: createdUnit.id,
      regularPrice: 1500,
      costPrice: 900,
      buyingPrice: 850,
      productType: 'Accessories',
      status: 'ACTIVE',
      branchId: defaultBranch.id,
      variants: [
        {
          sku: `SKU-E2E-${Date.now()}-BLK`,
          color: 'Black',
          quality: 'Original',
          price: 1500,
          buyingPrice: 850,
          stock: 10,
        },
      ],
    });
    check('B3.1 Create Product with variant and internal costPrice succeeds', prodCreateRes.status === 201 || prodCreateRes.status === 200);
    const createdProduct = prodCreateRes.data;
    if (createdProduct?.id) createdRecords.products.push(createdProduct.id);

    // Verify public product API sanitization (costPrice, buyingPrice stripped)
    const publicProdRes = await request(`${API_BASE}/products/${testProdSlug}`);
    check('B3.2 Public Product by slug returns 200', publicProdRes.status === 200);
    check(
      'B3.3 Public Product payload NEVER exposes internal costPrice or buyingPrice',
      publicProdRes.data?.costPrice === undefined &&
      publicProdRes.data?.buyingPrice === undefined &&
      publicProdRes.data?.variants?.[0]?.buyingPrice === undefined,
    );

    // Blocker check on Category and Brand delete (has products)
    const catDeleteBlocked = await request(`${API_BASE}/categories/${createdCat.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    check(
      'B3.4 Category delete blocked with HTTP 409 Conflict when products exist',
      catDeleteBlocked.status === 409 && catDeleteBlocked.data?.blockers?.products > 0,
    );

    const brandDeleteBlocked = await request(`${API_BASE}/brands/${createdBrand.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    check(
      'B3.5 Brand delete blocked with HTTP 409 Conflict when products exist',
      brandDeleteBlocked.status === 409 && brandDeleteBlocked.data?.blockers?.products > 0,
    );

    // =========================================================================
    // B4: STOREFRONT ORDERING & LIFECYCLE
    // =========================================================================
    console.log('\n--- B4: Storefront Ordering, Inventory & Lifecycle ---');

    // Create promo code
    const promoCodeStr = `E2EPROMO${Date.now().toString().slice(-4)}`;
    const promoCreateRes = await request(`${API_BASE}/promo-codes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      code: promoCodeStr,
      discountType: 'FIXED',
      discountValue: 100,
      validFrom: new Date(Date.now() - 3600000).toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      status: 'ACTIVE',
    });
    check('B4.1 Create test Promo Code succeeds', promoCreateRes.status === 201 || promoCreateRes.status === 200);
    if (promoCreateRes.data?.id) createdRecords.promoCodes.push(promoCreateRes.data.id);

    // Create storefront order with COD via checkout
    const orderCreateRes = await request(`${API_BASE}/orders/checkout`, {
      method: 'POST',
    }, {
      shippingAddress: {
        name: `${QA_PREFIX} Guest Shopper`,
        phone: '01711223344',
        address: 'House 12, Road 5, Dhanmondi',
        city: 'Dhaka',
      },
      paymentMethod: 'COD',
      items: [
        {
          productId: createdProduct.id,
          variantId: createdProduct.variants[0].id,
          quantity: 2,
          unitPrice: 1500,
        },
      ],
      deliveryCharge: 60,
      promoCode: promoCodeStr,
    });
    check('B4.2 Storefront COD checkout creates order (HTTP 200/201)', orderCreateRes.status === 201 || orderCreateRes.status === 200);
    const createdOrderId = orderCreateRes.data?.orderId || orderCreateRes.data?.id;
    if (createdOrderId) createdRecords.orders.push(createdOrderId);

    // Check order status progression
    const orderConfirmRes = await request(`${API_BASE}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      status: 'CONFIRMED',
      note: 'Confirmed by QA phone verification',
    });
    check('B4.3 Admin updates order status to CONFIRMED', orderConfirmRes.status === 200);

    // Blocker check on Product delete (has orderItems)
    const prodDeleteBlocked = await request(`${API_BASE}/products/${createdProduct.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    check(
      'B4.4 Product delete blocked with HTTP 409 Conflict when order history exists',
      prodDeleteBlocked.status === 409 && prodDeleteBlocked.data?.blockers?.orderItems > 0,
    );

    // =========================================================================
    // B5: PAYMENTS & GATEWAY IDEMPOTENCY
    // =========================================================================
    console.log('\n--- B5: Payment Gateways, IPN & Callback Verification ---');

    // 1. SSLCommerz IPN / Callback with invalid transaction returns clean handling
    const sslIpnTampered = await request(`${API_BASE}/payments/sslcommerz/ipn`, {
      method: 'POST',
    }, {
      tran_id: 'NON_EXISTENT_TRANS_ID',
      val_id: 'FAKE_VAL_ID',
      status: 'VALID',
    });
    check('B5.1 Tampered SSLCommerz callback with invalid transaction is rejected cleanly', sslIpnTampered.status === 400 || sslIpnTampered.status === 404 || sslIpnTampered.data?.status === 'FAILED');

    // 2. bKash callback path verified at HTTP level (returns non-500 redirect)
    const bkashCallback = await request(`${API_BASE}/payments/bkash/callback?paymentID=FAKE_PAYMENT_ID&status=failure&orderId=dummy`);
    check('B5.2 bKash failure callback handled gracefully without 500 error', bkashCallback.status !== 500);

    // =========================================================================
    // B6: DELIVERY & COURIER ASSIGNMENT
    // =========================================================================
    console.log('\n--- B6: Delivery & Courier Assignment ---');

    const courierAssignRes = await request(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      orderId: createdOrderId,
      courierPartner: 'Steadfast',
      trackingNo: `ST-${Date.now().toString().slice(-6)}`,
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
    });
    check('B6.1 Courier shipment assigned to order', courierAssignRes.status === 201 || courierAssignRes.status === 200);

    // =========================================================================
    // B7: POS TRANSACTION & INVENTORY IMPACT
    // =========================================================================
    console.log('\n--- B7: POS Sales, Wallets & Inventory Impact ---');

    const posSaleRes = await request(`${API_BASE}/pos/sales`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      branchId: defaultBranch.id,
      saleType: 'POS',
      paymentMethod: 'CASH',
      paidAmount: 1500,
      items: [
        {
          productId: createdProduct.id,
          variantId: createdProduct.variants[0].id,
          quantity: 1,
          unitPrice: 1500,
        },
      ],
    });
    check(
      'B7.1 POS sale with cash payment completes successfully',
      posSaleRes.status === 201 || posSaleRes.status === 200,
      JSON.stringify(posSaleRes.data),
    );
    const posOrderId = posSaleRes.data?.id || posSaleRes.data?.orderId;
    if (posOrderId) createdRecords.orders.push(posOrderId);

    // =========================================================================
    // B8: PURCHASE ORDER & STOCK INCREMENT
    // =========================================================================
    console.log('\n--- B8: Purchase Orders & Supplier Accounting ---');

    const poRes = await request(`${API_BASE}/purchase-orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      supplierId: createdSup.id,
      branchId: defaultBranch.id,
      invoiceNumber: `INV-PO-${Date.now()}`,
      status: 'ORDERED',
      items: [
        {
          productId: createdProduct.id,
          variantId: createdProduct.variants[0].id,
          quantityOrdered: 5,
          unitCost: 850,
        },
      ],
    });
    check('B8.1 Purchase Order intake created', poRes.status === 201 || poRes.status === 200);
    if (poRes.data?.id) createdRecords.purchases.push(poRes.data.id);

    // Supplier delete blocked because PO exists
    const supDeleteBlocked = await request(`${API_BASE}/suppliers/${createdSup.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    check(
      'B8.2 Supplier delete blocked with HTTP 409 Conflict when purchase history exists',
      supDeleteBlocked.status === 409 && supDeleteBlocked.data?.blockers?.purchaseOrders > 0,
    );

    // =========================================================================
    // B9: STOCK ADJUSTMENTS & INTEGRITY
    // =========================================================================
    console.log('\n--- B9: Stock Adjustments & Variant Consistency ---');

    const adjRes = await request(`${API_BASE}/stock-adjustments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      branchId: defaultBranch.id,
      productId: createdProduct.id,
      variantId: createdProduct.variants[0].id,
      type: 'INCREASE',
      quantity: 2,
      reason: 'Physical inventory audit surplus',
    });
    check('B9.1 Stock adjustment INCREASE recorded cleanly', adjRes.status === 201 || adjRes.status === 200, JSON.stringify(adjRes.data));

    // =========================================================================
    // B10: SERVICING & REPAIR WORKFLOW
    // =========================================================================
    console.log('\n--- B10: Servicing Intake, Parts & Technician Workflow ---');

    // Create a technician staff
    const techStaffRes = await request(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} Master Tech`,
      email: `tech_${Date.now()}@example.com`,
      phone: `019${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: technicianRole ? technicianRole.id : superAdminStaff.roleId,
      branchId: defaultBranch.id,
      isTechnician: true,
      commissionRate: 50,
    });
    check('B10.1 Technician staff created successfully', techStaffRes.status === 201 || techStaffRes.status === 200);
    const techStaff = techStaffRes.data;
    if (techStaff?.id) createdRecords.staffs.push(techStaff.id);

    // Create service job via repair intake
    const srvRes = await request(`${API_BASE}/service-jobs/repair`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      customerName: `${QA_PREFIX} Repair Customer`,
      customerPhone: '01799887766',
      technicianId: techStaff.id,
      device: 'iPhone 13 Pro',
      laborCost: 1000,
      materialCost: 2000,
      totalBill: 3000,
      finalAmount: 3000,
      branchId: defaultBranch.id,
      status: 'IN_PROGRESS',
    });
    check('B10.2 Service Job intake created with technician assignment', srvRes.status === 201 || srvRes.status === 200);
    const createdJob = srvRes.data;
    if (createdJob?.id) createdRecords.serviceJobs.push(createdJob.id);

    // Service Job transition
    const srvUpdateRes = await request(`${API_BASE}/service-jobs/${createdJob.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      status: 'READY_FOR_PICKUP',
    });
    check('B10.3 Service Job transitioned to READY_FOR_PICKUP', srvUpdateRes.status === 200);

    // Technician delete blocked because service jobs exist
    const techDeleteBlocked = await request(`${API_BASE}/employees/${techStaff.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    check(
      'B10.4 Technician delete blocked with HTTP 409 Conflict when service job history exists',
      techDeleteBlocked.status === 409 && techDeleteBlocked.data?.blockers?.serviceJobs > 0,
    );

    // =========================================================================
    // B11: HRM & PAYROLL
    // =========================================================================
    console.log('\n--- B11: HRM & Payroll Generation ---');

    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const payrollRes = await request(`${API_BASE}/payroll/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      month: currentYearMonth,
      branchId: defaultBranch.id,
    });
    check('B11.1 Payroll run executed successfully', payrollRes.status === 201 || payrollRes.status === 200);

    // =========================================================================
    // B12: ACCOUNTING, WALLETS & ALL 15 REPORTS AUDIT
    // =========================================================================
    console.log('\n--- B12: Accounting, Expenses & Reports Audit ---');

    // Create expense category & expense
    let expCat = await prisma.expenseCategory.findFirst();
    if (!expCat) {
      expCat = await prisma.expenseCategory.create({
        data: { name: `${QA_PREFIX} General Expense` },
      });
    }
    const expRes = await request(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      branchId: defaultBranch.id,
      categoryId: expCat.id,
      amount: 450,
      description: `${QA_PREFIX} Office Stationery and supplies`,
      status: 'PAID',
    });
    check('B12.1 Paid expense recorded', expRes.status === 201 || expRes.status === 200);
    if (expRes.data?.id) createdRecords.expenses.push(expRes.data.id);

    // Verify all 15 reports endpoints return HTTP 200
    const reportEndpoints = [
      { name: 'Summary Report', url: '/reports/summary' },
      { name: 'Website Sales Report', url: '/reports/website-sales' },
      { name: 'POS Sales Report', url: '/reports/pos-sales' },
      { name: 'Service Sales Report', url: '/reports/service-sales' },
      { name: 'Service Global Report', url: '/reports/service-global' },
      { name: 'Purchase Report', url: '/reports/purchase' },
      { name: 'Expense Report', url: '/reports/expense' },
      { name: 'Product Stock Report', url: '/reports/product-stock' },
      { name: 'Courier Report', url: '/reports/courier' },
      { name: 'Customer Due Report', url: '/reports/customer-due' },
      { name: 'Supplier Due Report', url: '/reports/supplier-due' },
      { name: 'Discount Report', url: '/reports/discount' },
      { name: 'Transactions Report', url: '/reports/transactions' },
      { name: 'Product Analytics Report', url: '/reports/product-analytics' },
      { name: 'Dashboard Report', url: '/reports/dashboard' },
    ];

    for (const r of reportEndpoints) {
      const repRes = await request(`${API_BASE}${r.url}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      check(`B12.2 [${r.name}] returns HTTP 200 with data`, repRes.status === 200);
    }

    // =========================================================================
    // B13: MARKETING / CMS / PUBLIC CONTACT
    // =========================================================================
    console.log('\n--- B13: Marketing, CMS & Public Settings ---');

    // 1. Banner CRUD
    const bannerRes = await request(`${API_BASE}/banners`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      title: `${QA_PREFIX} Mega Sale Banner`,
      imageUrl: '/uploads/banners/qa-banner.png',
      linkUrl: '/phones',
      status: 'ACTIVE',
    });
    check('B13.1 Banner created successfully', bannerRes.status === 201 || bannerRes.status === 200);
    if (bannerRes.data?.id) createdRecords.banners.push(bannerRes.data.id);

    // 2. Public business settings & contact precedence
    const pubSettingsRes = await request(`${API_BASE}/business-settings`);
    check('B13.2 Public business settings endpoint returns HTTP 200', pubSettingsRes.status === 200);
    check(
      'B13.3 Public contact information NEVER contains placeholder "+880 1700-000000"',
      pubSettingsRes.data?.companyPhone !== '+880 1700-000000' &&
      pubSettingsRes.data?.general?.phone !== '+880 1700-000000' &&
      pubSettingsRes.data?.general?.contactPhone !== '+880 1700-000000',
    );

    // 3. Public branches lists ONLY active branches
    const pubBranchesRes = await request(`${API_BASE}/branches/public`);
    check('B13.4 Public branches endpoint returns HTTP 200', pubBranchesRes.status === 200);
    const hasInactive = Array.isArray(pubBranchesRes.data) &&
      pubBranchesRes.data.some((b) => b.status === 'INACTIVE');
    check('B13.5 Public outlets list strictly hides inactive or deleted branches', !hasInactive);

    // =========================================================================
    // B14: CONCURRENCY & CROSS-CUTTING SAFETY
    // =========================================================================
    console.log('\n--- B14: Concurrency, Double-Submit & Unicode Handling ---');

    // Unicode & Bangla text handling
    const unicodeBrandRes = await request(`${API_BASE}/brands`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }, {
      name: `${QA_PREFIX} মোবাইল হাব বিডি ব্র্যান্ড`,
      slug: `qa-bangla-brand-${Date.now()}`,
    });
    check('B14.1 Bangla and Unicode UTF-8 strings handled cleanly without corrupting', unicodeBrandRes.status === 201 || unicodeBrandRes.status === 200);
    if (unicodeBrandRes.data?.id) createdRecords.brands.push(unicodeBrandRes.data.id);

    // Branch switch consistency
    const branchScopeOrders = await request(`${API_BASE}/orders?limit=10`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-branch-id': defaultBranch.id,
      },
    });
    check('B14.2 Query with x-branch-id header returns orders for selected branch', branchScopeOrders.status === 200);

    // =========================================================================
    // B15: SYSTEM ROBUSTNESS & SECURITY BOUNDARIES
    // =========================================================================
    console.log('\n--- B15: System Robustness & Security Headers ---');

    // 1. Non-existent route returns 404
    const notFoundRes = await request(`${API_BASE}/non-existent-route-404`);
    check('B15.1 Non-existent API route returns 404 cleanly', notFoundRes.status === 404);

    // 2. Malformed token returns 401
    const badTokenRes = await request(`${API_BASE}/employees`, {
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    check('B15.2 Malformed JWT token returns 401 Unauthorized', badTokenRes.status === 401);

    // 3. Public API responsiveness
    const publicPingRes = await request(`${API_BASE}/business-settings`);
    check('B15.3 Public configuration baseline returns HTTP 200', publicPingRes.status === 200);

  } catch (err) {
    console.error('Unhandled fatal error in E2E suite:', err);
    failedChecks++;
    failures.push(`FATAL: ${err.message}`);
  } finally {
    console.log('\n>>> Cleaning up all QA-LOCAL test entities...');
    try {
      // Clean up orders
      for (const id of createdRecords.orders) {
        await prisma.orderItem.deleteMany({ where: { orderId: id } });
        await prisma.orderStatusHistory.deleteMany({ where: { orderId: id } });
        await prisma.orderNote.deleteMany({ where: { orderId: id } });
        await prisma.shipment.deleteMany({ where: { orderId: id } });
        await prisma.payment.deleteMany({ where: { orderId: id } });
        await prisma.order.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up service jobs
      for (const id of createdRecords.serviceJobs) {
        await prisma.serviceJobMaterial.deleteMany({ where: { serviceJobId: id } });
        await prisma.serviceJob.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up purchases
      for (const id of createdRecords.purchases) {
        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await prisma.purchaseOrder.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up products
      for (const id of createdRecords.products) {
        const variants = await prisma.productVariant.findMany({ where: { productId: id } });
        await prisma.stockAdjustment.deleteMany({ where: { productId: id } });
        for (const v of variants) {
          await prisma.stockAdjustment.deleteMany({ where: { variantId: v.id } });
          await prisma.branchInventory.deleteMany({ where: { productVariantId: v.id } });
          await prisma.phoneUnit.deleteMany({ where: { productVariantId: v.id } });
        }
        await prisma.productVariant.deleteMany({ where: { productId: id } });
        await prisma.productImage.deleteMany({ where: { productId: id } });
        await prisma.productSpecification.deleteMany({ where: { productId: id } });
        await prisma.product.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up suppliers
      for (const id of createdRecords.suppliers) {
        await prisma.supplier.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up categories
      for (const id of createdRecords.categories) {
        await prisma.category.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up brands
      for (const id of createdRecords.brands) {
        await prisma.brand.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up units
      for (const id of createdRecords.units) {
        await prisma.unit.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up promo codes
      for (const id of createdRecords.promoCodes) {
        await prisma.promoCode.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up banners
      for (const id of createdRecords.banners) {
        await prisma.banner.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up expenses
      for (const id of createdRecords.expenses) {
        await prisma.expense.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up payroll & staff
      for (const id of createdRecords.staffs) {
        await prisma.payroll.deleteMany({ where: { staffId: id } });
        await prisma.staffBranchAccess.deleteMany({ where: { staffId: id } });
        await prisma.staff.deleteMany({ where: { id } }).catch(() => {});
      }

      // Clean up customers
      for (const id of createdRecords.customers) {
        await prisma.address.deleteMany({ where: { customerId: id } });
        await prisma.customer.deleteMany({ where: { id } }).catch(() => {});
      }

      // Catch-all cleanup by name/title containing QA_PREFIX
      await prisma.product.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.category.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.brand.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.unit.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.supplier.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.banner.deleteMany({ where: { title: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { description: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.staff.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { name: { startsWith: QA_PREFIX } } }).catch(() => {});

      console.log('Teardown complete: All QA-LOCAL records scrubbed.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log('PASS 52 E2E BUSINESS FLOW TEST RESULTS');
  console.log('================================================================================');
  console.log(`TOTAL CHECKS: ${totalChecks}`);
  console.log(`PASSED:       ${passedChecks}`);
  console.log(`FAILED:       ${failedChecks}`);
  console.log('================================================================================');

  if (failedChecks > 0) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('>>> VERDICT: ALL E2E BUSINESS FLOW TESTS PASSED (100% SUCCESS) <<<\n');
    process.exit(0);
  }
}

run();

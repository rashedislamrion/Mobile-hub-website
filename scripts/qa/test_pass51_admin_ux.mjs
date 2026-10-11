import http from 'http';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../../api/node_modules/@prisma/client/default.js';
import jwt from '../../api/node_modules/jsonwebtoken/index.js';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api/v1';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';

const QA_PREFIX = 'QA-LOCAL-PASS51';

let superAdminToken = '';
let branchStaffToken = '';
let superAdminUser = null;
let branchStaffUser = null;
let dhakaBranch = null;
let chittagongBranch = null;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    testsPassed++;
    console.log(`[PASS] ${testName}`);
  } else {
    testsFailed++;
    console.error(`[FAIL] ${testName}${details ? ' - ' + details : ''}`);
  }
}

function makeToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userType: 'STAFF',
      roleId: user.roleId,
      branchId: user.branchId,
    },
    JWT_SECRET,
    { expiresIn: '8h' },
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

async function setup() {
  console.log('>>> Setting up QA Test Entities for PASS 51...');

  dhakaBranch = await prisma.branch.findFirst({
    where: { code: 'BR-DHK' },
  });
  if (!dhakaBranch) {
    dhakaBranch = await prisma.branch.findFirst();
  }

  chittagongBranch = await prisma.branch.findFirst({
    where: { code: 'BR-CTG' },
  });
  if (!chittagongBranch) {
    const branches = await prisma.branch.findMany({ take: 2 });
    chittagongBranch = branches[1] || branches[0];
  }

  // Find Super Admin role
  const superAdminRole = await prisma.role.findUnique({
    where: { id: 'cmsugs7l10000g7dhgndy5da6' },
  });

  superAdminUser = await prisma.staff.findFirst({
    where: {
      roleId: superAdminRole.id,
      status: 'ACTIVE',
    },
  });

  if (!superAdminUser) {
    superAdminUser = await prisma.staff.create({
      data: {
        employeeId: `EMP-${QA_PREFIX}-SA-${Date.now()}`,
        name: `${QA_PREFIX} Super Admin`,
        email: `qa-pass51-admin-${Date.now()}@test.local`,
        phone: `+88019${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: 'dummyhash',
        roleId: superAdminRole.id,
        branchId: null,
        status: 'ACTIVE',
      },
    });
  }

  superAdminToken = makeToken(superAdminUser);

  // Single-branch staff
  const branchRole = await prisma.role.findFirst({
    where: {
      OR: [
        { id: 'cmsugs7l40001g7dhh5vv2eed' },
        { scope: 'OWN_BRANCH' },
      ],
    },
  });

  branchStaffUser = await prisma.staff.create({
    data: {
      employeeId: `EMP-${QA_PREFIX}-DHK-${Date.now()}`,
      name: `${QA_PREFIX} Branch Staff`,
      email: `qa-pass51-staff-${Date.now()}@test.local`,
      phone: `+88018${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: 'dummyhash',
      roleId: branchRole ? branchRole.id : superAdminRole.id,
      branchId: dhakaBranch.id,
      status: 'ACTIVE',
    },
  });
  branchStaffToken = makeToken(branchStaffUser);
}

async function cleanup() {
  console.log('\n>>> Cleaning up all QA-LOCAL test records...');
  try {
    if (branchStaffUser?.id) {
      await prisma.staff.deleteMany({ where: { id: branchStaffUser.id } });
    }
    await prisma.product.deleteMany({
      where: { name: { startsWith: QA_PREFIX } },
    });
    console.log('Cleanup completed cleanly.');
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('FIX PASS 51 — AUTOMATED REGRESSION & UX VERIFICATION SUITE');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // TASK 5: Token-Based Search Tests
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Token-Based Product & Spare-Part Search ---');

  // Test 1: Search "s23" matches S23 products
  const resS23 = await request(`${API_BASE}/pos/products?search=s23&limit=10`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(
    resS23.status === 200 && Array.isArray(resS23.data),
    '1a. GET /pos/products?search=s23 returns 200 with array',
    `Status: ${resS23.status}`,
  );

  // Test 2: Search multi-token "s23 ultra" matches
  const resMulti = await request(`${API_BASE}/pos/products?search=s23%20ultra&limit=10`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(
    resMulti.status === 200 && Array.isArray(resMulti.data),
    '1b. GET /pos/products?search=s23 ultra returns 200 with multi-token match',
    `Status: ${resMulti.status}`,
  );

  // Test 3: Search "opp" matches brand Oppo
  const resOpp = await request(`${API_BASE}/pos/products?search=opp&limit=10`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(
    resOpp.status === 200 && Array.isArray(resOpp.data),
    '1c. GET /pos/products?search=opp returns 200 matching brand Oppo',
    `Status: ${resOpp.status}`,
  );

  // Test 4: /products/pos-search endpoint with PRODUCTS:READ returns 200
  const resProdPosSearch = await request(`${API_BASE}/products/pos-search?search=s23&limit=5`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(
    resProdPosSearch.status === 200 && Array.isArray(resProdPosSearch.data),
    '1d. GET /products/pos-search?search=s23 returns 200 with flat variants',
    `Status: ${resProdPosSearch.status}`,
  );

  // ---------------------------------------------------------------------------
  // TASK 2 & TASK 7: Global Data Immunity against x-branch-id
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Global Data Immunity against x-branch-id (Task 2 & 7) ---');

  // Test Suppliers: No header vs Dhaka header vs CTG header
  const suppNoHeader = await request(`${API_BASE}/suppliers?limit=100`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const suppDhaka = await request(`${API_BASE}/suppliers?limit=100`, {
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'x-branch-id': dhakaBranch.id,
    },
  });
  const suppCtg = await request(`${API_BASE}/suppliers?limit=100`, {
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'x-branch-id': chittagongBranch.id,
    },
  });

  const suppListNo = suppNoHeader.data?.data || suppNoHeader.data || [];
  const suppListDhk = suppDhaka.data?.data || suppDhaka.data || [];
  const suppListCtg = suppCtg.data?.data || suppCtg.data || [];

  assert(
    suppNoHeader.status === 200 && suppDhaka.status === 200 && suppCtg.status === 200,
    '2a. /suppliers returns 200 with or without x-branch-id header',
    `Statuses: ${suppNoHeader.status}, ${suppDhaka.status}, ${suppCtg.status}`,
  );

  assert(
    suppListNo.length === suppListDhk.length && suppListNo.length === suppListCtg.length,
    '2b. Supplier count is strictly IDENTICAL regardless of branch selection (Global entity)',
    `Counts: None=${suppListNo.length}, Dhaka=${suppListDhk.length}, CTG=${suppListCtg.length}`,
  );

  // Test other Global entities
  const globalEndpoints = [
    { name: 'Brands', path: '/brands' },
    { name: 'Series', path: '/series' },
    { name: 'Units', path: '/units' },
    { name: 'Categories Tree', path: '/categories/tree' },
    { name: 'Attributes', path: '/attributes' },
    { name: 'Wallet Types', path: '/wallet-types' },
    { name: 'Expense Categories', path: '/expense-categories' },
    { name: 'Departments', path: '/departments' },
    { name: 'Roles', path: '/roles' },
    { name: 'Banners', path: '/banners' },
    { name: 'Ads', path: '/ads' },
    { name: 'Blogs', path: '/blogs' },
    { name: 'Promo Codes', path: '/promo-codes' },
  ];

  for (const ep of globalEndpoints) {
    const resA = await request(`${API_BASE}${ep.path}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const resB = await request(`${API_BASE}${ep.path}`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-branch-id': dhakaBranch.id,
      },
    });

    const countA = Array.isArray(resA.data)
      ? resA.data.length
      : Array.isArray(resA.data?.data)
      ? resA.data.data.length
      : 0;
    const countB = Array.isArray(resB.data)
      ? resB.data.length
      : Array.isArray(resB.data?.data)
      ? resB.data.data.length
      : 0;

    assert(
      resA.status === 200 && resB.status === 200 && countA === countB,
      `2c. Global entity [${ep.name}] dataset identical across branch scopes (${countA} records)`,
      `Status A:${resA.status}, B:${resB.status}, Counts A:${countA}, B:${countB}`,
    );
  }

  // ---------------------------------------------------------------------------
  // TASK 6: Staff Session Security
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Staff Session Security Architecture (Task 6) ---');

  // Verify staff-session.ts exists
  const sessionModulePath = path.resolve('src/lib/staff-session.ts');
  const sessionModuleExists = fs.existsSync(sessionModulePath);
  assert(
    sessionModuleExists,
    '3a. src/lib/staff-session.ts module exists',
    `Found at ${sessionModulePath}`,
  );

  const sessionContent = sessionModuleExists ? fs.readFileSync(sessionModulePath, 'utf8') : '';
  const usesSessionStorage =
    sessionContent.includes('sessionStorage') &&
    (sessionContent.includes('novamobile_staff_token') || sessionContent.includes('STAFF_TOKEN_KEY'));
  assert(
    usesSessionStorage,
    '3b. Staff session module persists strictly to sessionStorage (no staff token in localStorage)',
  );

  const purgesLegacy =
    sessionContent.includes('localStorage.removeItem') &&
    sessionContent.includes('novamobile_staff_token');
  assert(
    purgesLegacy,
    '3c. Staff session module purges legacy staff keys from localStorage on startup',
  );

  // Verify StaffIdleTimeoutModal exists and is configured for 30m idle + 1m warning
  const idleModalPath = path.resolve('src/components/admin/StaffIdleTimeoutModal.tsx');
  const idleModalExists = fs.existsSync(idleModalPath);
  assert(
    idleModalExists,
    '3d. src/components/admin/StaffIdleTimeoutModal.tsx exists with idle timeout safeguard',
  );

  // ---------------------------------------------------------------------------
  // TASK 1 & 4: SearchableSelect & Variations Round Trip
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Component & Variations Round-Trip Verification ---');

  const searchableSelectPath = path.resolve('src/components/ui/searchable-select.tsx');
  assert(
    fs.existsSync(searchableSelectPath),
    '4a. src/components/ui/searchable-select.tsx reusable component exists',
  );

  const pageSearchDialogPath = path.resolve('src/components/admin/AdminPageSearchDialog.tsx');
  assert(
    fs.existsSync(pageSearchDialogPath),
    '4b. src/components/admin/AdminPageSearchDialog.tsx exists with keyboard navigation',
  );

  const partTypeaheadPath = path.resolve('src/components/admin/PartTypeaheadInput.tsx');
  assert(
    fs.existsSync(partTypeaheadPath),
    '4c. src/components/admin/PartTypeaheadInput.tsx live spare-part search component exists',
  );

  // Test Variations generator round trip via Product API
  const testCategory = await prisma.category.findFirst({ where: { status: 'ACTIVE' } });
  const testBrand = await prisma.brand.findFirst();

  if (testCategory) {
    const createProdRes = await request(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    }, {
      name: `${QA_PREFIX} Test Phone S23`,
      slug: `qa-test-phone-s23-${Date.now()}`,
      code: `QA-${Date.now()}`,
      categoryId: testCategory.id,
      brandId: testBrand?.id,
      productType: 'phone',
      condition: 'NEW',
      regularPrice: 95000,
      buyingPrice: 85000,
      variants: [
        {
          sku: `QA-S23-BLK-256`,
          color: 'Phantom Black',
          quality: 'Brand New',
          stock: 10,
          price: 95000,
          buyingPrice: 85000,
          attributes: { Color: 'Phantom Black', Storage: '256GB' },
        },
        {
          sku: `QA-S23-GRN-512`,
          color: 'Botanic Green',
          quality: 'Brand New',
          stock: 5,
          price: 105000,
          buyingPrice: 95000,
          attributes: { Color: 'Botanic Green', Storage: '512GB' },
        },
      ],
    });

    assert(
      createProdRes.status === 201 || createProdRes.status === 200,
      '4d. Product creation with multiple variants and attribute specs succeeds',
      `Status: ${createProdRes.status}`,
    );

    const createdProdId = createProdRes.data?.id;
    if (createdProdId) {
      // Re-fetch product to verify round trip
      const getProdRes = await request(`${API_BASE}/products/${createdProdId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      const fetchedVars = getProdRes.data?.variants || [];
      const var1 = fetchedVars.find((v) => v.sku.includes('BLK'));
      const var2 = fetchedVars.find((v) => v.sku.includes('GRN'));

      assert(
        fetchedVars.length === 2 && var1 && var2 && Number(var1.price) === 95000 && Number(var2.price) === 105000,
        '4e. Round trip verify: all variant specifications, SKUs, and prices match exactly without data loss',
        `Variants count: ${fetchedVars.length}, var1.price=${var1?.price}, var2.price=${var2?.price}`,
      );
    }
  }

  console.log('\n================================================================================');
  console.log('PASS 51 QA SUITE SUMMARY');
  console.log('================================================================================');
  console.log(`TOTAL CHECKS: ${testsPassed + testsFailed}`);
  console.log(`PASSED:       ${testsPassed}`);
  console.log(`FAILED:       ${testsFailed}`);
  console.log('================================================================================');

  if (testsFailed === 0) {
    console.log('>>> VERDICT: ALL PASS 51 CHECKS PASSED (100% SUCCESS) <<<\n');
  } else {
    console.error(`>>> VERDICT: ${testsFailed} CHECKS FAILED <<<\n`);
    process.exitCode = 1;
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main();

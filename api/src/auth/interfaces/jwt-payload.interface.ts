export class JwtPayload {
  sub: string; // userId (Staff.id or Customer.id)
  userType: 'STAFF' | 'CUSTOMER';
  roleId?: string; // only for STAFF (Customers have no role/permissions)
  roleName?: string; // denormalized for quick logging/debugging
  branchId?: string | null; // only for STAFF, for branch-scope checks
}

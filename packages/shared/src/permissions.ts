export const PERMISSIONS = [
  "products.read", "products.create", "products.update",
  "stock.read", "stock.adjust",
  "sales.read", "sales.create", "sales.discount", "sales.refund", "sales.cancel",
  "customers.read", "customers.manage",
  "suppliers.read", "suppliers.manage",
  "purchases.read", "purchases.manage",
  "expenses.read", "expenses.create", "expenses.update",
  "cash.manage", "cash.correct",
  "reports.read", "reports.financial.read",
  "members.manage", "settings.update", "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["owner", "manager", "cashier", "storekeeper"] as const;
export type Role = (typeof ROLES)[number];

const MANAGER: Permission[] = PERMISSIONS.filter(
  (p) => !["members.manage", "settings.update"].includes(p),
) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  manager: MANAGER,
  cashier: [
    "products.read", "stock.read", "sales.read", "sales.create",
    "customers.read", "customers.manage", "cash.manage",
  ],
  storekeeper: [
    "products.read", "products.create", "products.update",
    "stock.read", "stock.adjust", "suppliers.read", "purchases.read", "purchases.manage",
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

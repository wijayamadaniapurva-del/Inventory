import type { UserRole } from "@/lib/types";

/**
 * Who may open which page.
 *
 * The sidebar reads this to decide what to show, and every page reads
 * it again through requireAccess() — hiding a menu item is cosmetic,
 * someone who knows the URL can still type it.
 *
 * CS (customer service) is read-only by design: they answer "is this in
 * stock?" and nothing else. Stock values and prices are left out of
 * their view too, since that's purchasing information, not something
 * needed to answer a customer.
 */
export const ALL_ROLES: UserRole[] = ["owner", "spv", "warehouse_staff", "finance", "cs"];

const STAFF: UserRole[] = ["owner", "spv", "warehouse_staff", "finance"];

export const PAGE_ACCESS: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/stok", roles: [...STAFF, "cs"] },
  { prefix: "/stok/rekap-bulanan", roles: STAFF },
  { prefix: "/dashboard", roles: STAFF },
  { prefix: "/input", roles: ["warehouse_staff", "spv"] },
  { prefix: "/job-order", roles: STAFF },
  { prefix: "/audit-trail", roles: STAFF },
  { prefix: "/riwayat", roles: STAFF },
  { prefix: "/settings", roles: ["spv"] },
];

export function canAccess(role: UserRole, path: string): boolean {
  // Longest prefix wins, so /stok/rekap-bulanan follows /stok.
  const match = [...PAGE_ACCESS].sort((a, b) => b.prefix.length - a.prefix.length).find((p) => path.startsWith(p.prefix));
  return match ? match.roles.includes(role) : false;
}

/** Where a role lands after login, and where it gets sent if it opens a page it can't see. */
export function homePathFor(role: UserRole): string {
  return role === "cs" ? "/stok" : "/dashboard";
}

/** Roles that may change data. Everything else is read-only in the UI. */
export function canWrite(role: UserRole): boolean {
  return role !== "cs" && role !== "finance";
}

/** CS doesn't see prices or stock value anywhere. */
export function canSeeValues(role: UserRole): boolean {
  return role !== "cs";
}

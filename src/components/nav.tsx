"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

const LINKS: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["owner", "spv", "warehouse_staff", "finance"] },
  { href: "/input", label: "Input stok", roles: ["warehouse_staff", "spv"] },
  { href: "/job-order", label: "Job order & shipment", roles: ["owner", "spv"] },
  { href: "/riwayat", label: "Riwayat", roles: ["owner", "spv", "warehouse_staff", "finance"] },
  { href: "/settings/master-item", label: "Settings", roles: ["owner", "spv"] },
];

export function Nav({ role, fullName }: { role: UserRole; fullName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const visibleLinks = LINKS.filter((link) => link.roles.includes(role));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <nav className="flex flex-wrap gap-2">
        {visibleLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-md border border-accent-600 bg-accent-50 px-3 py-1.5 text-sm font-medium text-accent-700"
                  : "rounded-md border border-transparent px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{fullName ?? "Pengguna"} · {role}</span>
        <button onClick={handleSignOut} className="!px-2 !py-1 text-xs">
          Keluar
        </button>
      </div>
    </div>
  );
}

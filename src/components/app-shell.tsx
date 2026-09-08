"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardPlus,
  Boxes,
  Truck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import type { UserRole } from "@/lib/types";

const LINKS: { href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "spv", "warehouse_staff", "finance"] },
  { href: "/input", label: "Input stok", icon: ClipboardPlus, roles: ["warehouse_staff", "spv"] },
  { href: "/stok", label: "Stok", icon: Boxes, roles: ["owner", "spv", "warehouse_staff", "finance"] },
  { href: "/job-order", label: "Job order & shipment", icon: Truck, roles: ["owner", "spv", "warehouse_staff"] },
  { href: "/riwayat", label: "Riwayat", icon: History, roles: ["owner", "spv", "warehouse_staff", "finance"] },
  { href: "/settings/master-item", label: "Settings", icon: Settings, roles: ["owner", "spv"] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  spv: "SPV Warehouse & Produksi",
  warehouse_staff: "Warehouse Staff",
  finance: "Finance",
};

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function SidebarContent({ role, fullName, onNavigate }: { role: UserRole; fullName: string | null; onNavigate?: () => void }) {
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <Logo size={32} />
        <span className="text-sm font-semibold text-stone-900">PURVU Inventory</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {visibleLinks.map((link) => {
          const matchPrefix = link.href.startsWith("/settings") ? "/settings" : link.href;
          const active = pathname.startsWith(matchPrefix);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition " +
                (active ? "bg-accent-50 text-accent-700" : "text-stone-600 hover:bg-stone-100")
              }
            >
              <Icon size={17} strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-600">
            {initials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-800">{fullName ?? "Pengguna"}</p>
            <p className="truncate text-xs text-stone-400">{ROLE_LABEL[role]}</p>
          </div>
          <button onClick={handleSignOut} title="Keluar" className="!h-8 !w-8 !p-0 !border-0 text-stone-400 hover:text-stone-700">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  role,
  fullName,
  children,
}: {
  role: UserRole;
  fullName: string | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 md:flex">
      {/* Desktop persistent sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white md:block">
        <SidebarContent role={role} fullName={fullName} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-sm font-semibold text-stone-900">PURVU Inventory</span>
        </div>
        <button onClick={() => setDrawerOpen(true)} className="!h-8 !w-8 !p-0 !border-0">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-stone-900/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-lg">
            <div className="flex justify-end p-2">
              <button onClick={() => setDrawerOpen(false)} className="!h-8 !w-8 !p-0 !border-0">
                <X size={18} />
              </button>
            </div>
            <SidebarContent role={role} fullName={fullName} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

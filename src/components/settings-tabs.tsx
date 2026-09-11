"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/master-item", label: "Master item" },
  { href: "/settings/resep", label: "Resep (BOM)" },
  { href: "/settings/maklon", label: "Maklon" },
  { href: "/settings/safety-stock", label: "Safety Stock" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex gap-2 border-b border-stone-200 pb-3">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium " +
              (active ? "bg-accent-50 text-accent-700" : "text-stone-500 hover:bg-stone-100")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

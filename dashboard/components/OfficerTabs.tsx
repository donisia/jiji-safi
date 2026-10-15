"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Incident Dispatch", href: "/reports", icon: ClipboardList },
  { label: "Residents & Credits", href: "/credits", icon: Award },
];

export function OfficerTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex rounded-xl bg-slate-900/70 p-1 border border-slate-800 text-xs">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors",
              active ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

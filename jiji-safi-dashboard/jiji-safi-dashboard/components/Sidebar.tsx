"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Map, 
  TrendingUp, 
  ClipboardList, 
  Award, 
  ShieldAlert, 
  Leaf, 
  Building2 
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
    badge: "Live",
  },
  {
    label: "Waste Hotspots Map",
    href: "/map",
    icon: Map,
    badge: "GPS",
  },
  {
    label: "Trends & Charts",
    href: "/analytics",
    icon: TrendingUp,
    badge: "CO2e",
  },
  {
    label: "Incident Dispatch",
    href: "/reports",
    icon: ClipboardList,
  },
  {
    label: "Credits & Incentives",
    href: "/credits",
    icon: Award,
    badge: "Rewards",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950/70 backdrop-blur-xl flex flex-col justify-between hidden md:flex">
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
            Navigation
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                    active
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 transition-colors", active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold",
                        active
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Coverage Zones Summary */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 mb-2 font-semibold text-slate-300">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Monitored Corridor</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ngong • Ongata Rongai • Kiserian • Matasia • Kawangware • Karen • Kware
          </p>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-900/80 border border-emerald-500/20 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Leaf className="w-3.5 h-3.5" />
            <span>Carbon Accounting</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Real-time CO2e calculated from uncollected organic, plastic & burning waste.
          </p>
        </div>
      </div>
    </aside>
  );
}

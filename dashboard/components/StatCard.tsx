import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  variant?: "default" | "brand" | "warning" | "danger" | "info";
}

export function StatCard({
  title,
  value,
  subValue,
  change,
  isPositive,
  icon,
  variant = "default",
}: StatCardProps) {
  const borderVariants = {
    default: "border-slate-800 bg-slate-900/60 hover:border-slate-700",
    brand: "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50",
    warning: "border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50",
    danger: "border-rose-500/30 bg-rose-950/20 hover:border-rose-500/50",
    info: "border-sky-500/30 bg-sky-950/20 hover:border-sky-500/50",
  };

  const iconVariants = {
    default: "bg-slate-800 text-slate-300",
    brand: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    info: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 backdrop-blur-md transition-all duration-200 shadow-lg shadow-black/20",
        borderVariants[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {value}
            </span>
            {subValue && (
              <span className="text-xs text-slate-400 font-medium">
                {subValue}
              </span>
            )}
          </div>
        </div>
        <div className={cn("p-2.5 rounded-lg", iconVariants[variant])}>
          {icon}
        </div>
      </div>

      {change && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "font-medium",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {change}
          </span>
          <span className="text-slate-500">vs last period</span>
        </div>
      )}
    </div>
  );
}

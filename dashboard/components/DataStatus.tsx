"use client";

import React from "react";
import { USE_MOCK } from "@/lib/data";

// Small banner: tells you whether you are looking at live APEX data, demo data, or an error.
export function DataStatus({ error, loading }: { error: string | null; loading?: boolean }) {
  if (error)
    return (
      <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
        Can&apos;t load data from APEX: {error}. Check APEX_BASE_URL and that the REST module is published.
      </div>
    );
  if (USE_MOCK)
    return (
      <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
        Demo mode: showing generated sample data, not your database.
      </div>
    );
  if (loading) return <div className="mb-4 text-xs text-slate-400">Loading live data…</div>;
  return null;
}

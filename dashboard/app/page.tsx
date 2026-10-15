"use client";
import { useReports } from "@/lib/use-data";
import { DataStatus } from "@/components/DataStatus";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Report, ZONES } from "@/lib/data";
import { verifiedCreditsTotal } from "@/lib/credits";
import { StatCard } from "@/components/StatCard";
import { Trash2, Flame, CheckCircle2, Coins, MapPin, ArrowRight, BarChart3, Activity } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";

const HOTSPOT_THRESHOLD = 3; // open reports in a zone to mark it red
const DAY = 24 * 60 * 60 * 1000;

function delta(cur: number, prev: number) {
  const d = cur - prev;
  return { change: `${d >= 0 ? "+" : ""}${d} vs last wk`, up: d >= 0 };
}

function Empty({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-slate-500">{text}</div>
  );
}

export default function OverviewPage() {
  const { reports, setReports, loading, error } = useReports();


  const now = Date.now();
  const inRange = (ts: string, fromDays: number, toDays: number) => {
    const t = new Date(ts).getTime();
    return t >= now - fromDays * DAY && t < now - toDays * DAY;
  };

  const stats = useMemo(() => {
    const open = reports.filter((r) => r.status === "open");
    const openNew = open.filter((r) => inRange(r.ts, 7, 0)).length;
    const openNewPrev = open.filter((r) => inRange(r.ts, 14, 7)).length;
    const cleared = reports.filter((r) => r.status === "collected" && inRange(r.ts, 7, 0)).length;
    const clearedPrev = reports.filter((r) => r.status === "collected" && inRange(r.ts, 14, 7)).length;
    const cr = verifiedCreditsTotal(reports, now - 7 * DAY, now + DAY);
    const crPrev = verifiedCreditsTotal(reports, now - 14 * DAY, now - 7 * DAY);
    const crAll = verifiedCreditsTotal(reports);
    const zoneOpen = ZONES.map((z) => ({ zone: z.name, open: open.filter((r) => r.zone === z.name).length }))
      .sort((a, b) => b.open - a.open);
    const redZones = zoneOpen.filter((z) => z.open >= HOTSPOT_THRESHOLD);
    return { crAll, open: open.length, openNew, openNewPrev, cleared, clearedPrev, cr, crPrev, zoneOpen, redZones };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const daily = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * DAY);
      const key = d.toISOString().slice(0, 10);
      return {
        day: d.toLocaleDateString("en-KE", { weekday: "short" }),
        reports: reports.filter((r) => r.ts.slice(0, 10) === key).length,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);
  const weekTotal = daily.reduce((s, d) => s + d.reports, 0);

  const openD = delta(stats.openNew, stats.openNewPrev);
  const clearD = delta(stats.cleared, stats.clearedPrev);
  const crD = delta(stats.cr, stats.crPrev);

  return (
    <div className="flex flex-col gap-5 h-full">
      <DataStatus error={error} loading={loading} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Command Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ngong · Ongata Rongai · Kiserian · Matasia · resident reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports" className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            Dispatch queue <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/analytics" className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Analytics
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Open Reports" value={stats.open} subValue={`${stats.openNew} new this week`}
          change={openD.change} isPositive={!openD.up} icon={<Trash2 className="w-5 h-5" />} variant="warning" />
        <StatCard title="Cleared This Week" value={stats.cleared} subValue="last 7 days"
          change={clearD.change} isPositive={clearD.up} icon={<CheckCircle2 className="w-5 h-5" />} variant="brand" />
        <StatCard title="Red Zones" value={stats.redZones.length}
          subValue={stats.redZones.length ? stats.redZones.map((z) => z.zone).join(", ") : "No hotspots"}
          icon={<Flame className="w-5 h-5" />} variant="danger" />
        <StatCard title="Credits Issued (7d)" value={stats.cr} subValue={`${stats.crAll.toLocaleString()} all-time · verified reports`}
          change={crD.change} isPositive={crD.up} icon={<Coins className="w-5 h-5" />} variant="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Reports per day</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">{weekTotal} in last 7 days</span>
          </div>
          <div className="h-56">
            {weekTotal === 0 ? <Empty text="No reports in the last 7 days" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ccArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="reports" stroke="#10b981" strokeWidth={2} fill="url(#ccArea)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-bold text-white">Top zones by open reports</span>
            </div>
          </div>
          <div className="h-56">
            {stats.open === 0 ? <Empty text="No open reports. All zones clear" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.zoneOpen} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="zone" width={95} stroke="#94a3b8" fontSize={11} />
                  <Tooltip cursor={{ fill: "#1e293b" }} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="open" fill="#f43f5e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <Link href="/map" className="group rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><MapPin className="w-5 h-5" /></div>
          <div>
            <div className="text-sm font-bold text-white">Hotspot Map</div>
            <div className="text-xs text-slate-400">{stats.open} open pins across {ZONES.length} zones. Filter by status and zone</div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
      </Link>
    </div>
  );
}

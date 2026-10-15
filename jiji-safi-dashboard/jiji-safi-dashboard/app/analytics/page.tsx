"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  getMockReports, 
  Report, 
  ZONES, 
  groupByZone, 
  filterByPeriod, 
  groupByDay, 
  groupByWeek, 
  groupByMonth 
} from "@/lib/data";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { 
  TrendingUp, 
  Calendar, 
  Leaf, 
  BarChart3, 
  PieChart as PieIcon, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";

type Period = "week" | "month" | "year";

export default function AnalyticsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    setReports(getMockReports());
  }, []);

  // Filter reports by selected timeframe
  const periodReports = useMemo(() => {
    return filterByPeriod(reports, period);
  }, [reports, period]);

  // Aggregate time series data
  const timeSeriesData = useMemo(() => {
    if (period === "week") {
      return groupByDay(periodReports);
    } else if (period === "month") {
      // Group by 2-day or weekly chunks
      return groupByDay(periodReports);
    } else {
      return groupByMonth(periodReports);
    }
  }, [periodReports, period]);

  // Waste type composition
  const wasteTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    periodReports.forEach((r) => {
      counts[r.waste_type] = (counts[r.waste_type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [periodReports]);

  // Zone performance comparison (Open vs Collected vs CO2e)
  const zoneComparisonData = useMemo(() => {
    const map = groupByZone(periodReports);
    return ZONES.map((z) => {
      const s = map[z.name] || { open: 0, collected: 0, flagged: 0, co2e: 0 };
      const total = s.open + s.collected;
      const cleanRate = total > 0 ? Math.round((s.collected / total) * 100) : 100;
      return {
        zone: z.name,
        open: s.open,
        collected: s.collected,
        cleanRate,
        co2e: Math.round(s.co2e),
      };
    }).sort((a, b) => b.open - a.open);
  }, [periodReports]);

  // CO2e cumulative trend
  const co2eTrendData = useMemo(() => {
    let runningTotal = 0;
    return timeSeriesData.map((item) => {
      // Approximate 12kg avg CO2e per uncollected waste report
      const dailyCo2e = item.count * 12.8;
      runningTotal += dailyCo2e;
      return {
        date: item.date,
        daily: Math.round(dailyCo2e),
        cumulative: Math.round(runningTotal),
      };
    });
  }, [timeSeriesData]);

  const COLORS = [
    "#10b981", "#38bdf8", "#f59e0b", "#ef4444", 
    "#a855f7", "#ec4899", "#64748b", "#14b8a6"
  ];

  const totalPeriodReports = periodReports.length;
  const totalCollected = periodReports.filter((r) => r.status === "collected").length;
  const overallImprovement = totalPeriodReports
    ? Math.round((totalCollected / totalPeriodReports) * 100)
    : 0;
  const totalPeriodCo2e = periodReports
    .filter((r) => r.status === "open")
    .reduce((sum, r) => sum + r.co2e_kg, 0);

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Nairobi & Kajiado Waste Analytics & Carbon Impact
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-zone longitudinal trends, clearance improvement ratios, and environmental emissions
          </p>
        </div>

        {/* View Switcher: Weekly / Monthly / Yearly */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start md:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase">
            Horizon:
          </span>
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                period === p
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {p}ly View
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              Reports Ingested ({period}ly)
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {totalPeriodReports}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              Municipal Clearance Improvement
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-2">
              {overallImprovement}%
              <span className="text-xs text-slate-400 font-normal">
                ({totalCollected} collected)
              </span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              Carbon Emissions ({period}ly)
            </span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {totalPeriodCo2e.toFixed(1)}{" "}
              <span className="text-xs font-normal text-slate-400">kg CO2e</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Charts: Time Series Incident Volume & Zone Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident Volume Over Time */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Incident Reporting Velocity ({period}ly)
              </h2>
              <p className="text-xs text-slate-400">
                Incoming citizen and vendor reports over time
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
              Live Feed
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Reports Logged"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone Comparison: Open vs Attended */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Zone Performance Comparison
              </h2>
              <p className="text-xs text-slate-400">
                Open incidents vs cleared waste by monitored corridor
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              8 Sectors
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="zone" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} 
                />
                <Bar 
                  dataKey="open" 
                  name="Open Waste Piles" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="collected" 
                  name="Attended & Cleaned" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts: Waste Composition & Carbon Footprint */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waste Type Pie Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Waste Stream Classification
            </h2>
            <p className="text-xs text-slate-400">
              Categorized by Gemini Vision & NLP pipeline
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={wasteTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {wasteTypeData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Carbon Footprint / CO2e Curve */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-400" />
                Cumulative CO2e Carbon Equivalent Impact
              </h2>
              <p className="text-xs text-slate-400">
                Methane & carbon release from uncollected organic decomposing & open burnings
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Formula: Vol (kg) × IPCC Emission Factor
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={co2eTrendData}>
                <defs>
                  <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative CO2e (kg)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCo2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

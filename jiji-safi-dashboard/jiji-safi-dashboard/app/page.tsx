"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  getMockReports, 
  Report, 
  updateReportStatus, 
  ZONES, 
  groupByZone 
} from "@/lib/data";
import { StatCard } from "@/components/StatCard";
import { MapComponent } from "@/components/MapComponent";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Trash2, 
  Leaf, 
  Sparkles, 
  MapPin, 
  ArrowRight, 
  Truck, 
  TrendingUp, 
  Clock, 
  Filter,
  Check
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function OverviewPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "collected">("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [aiQuery, setAiQuery] = useState("Which zones need urgent pickup today?");
  const [aiResponse, setAiResponse] = useState(
    "Priority 1: Ngong Town Centre has 8 open biomass piles with 2 clogged stormwater culverts threatening flooding. Priority 2: Matasia Junction reports recurring plastic burning emitting an estimated 142 kg CO2e."
  );
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    setReports(getMockReports());
  }, []);

  const handleStatusChange = async (id: number, newStatus: "open" | "collected" | "flagged") => {
    await updateReportStatus(id, newStatus);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  const handleAiAsk = (prompt: string) => {
    setIsAiThinking(true);
    setAiQuery(prompt);
    setTimeout(() => {
      if (prompt.includes("CO2e") || prompt.includes("carbon")) {
        setAiResponse(
          "This week's uncollected waste represents 1,280 kg CO2e accumulated across Ngong-Rongai corridor. 62% stems from decomposing organic food scraps and informal burning."
        );
      } else if (prompt.includes("drain") || prompt.includes("rain")) {
        setAiResponse(
          "URGENT: 6 blocked storm drains flagged in Kawangware & Ongata Rongai. Clearing these before 17:00 will prevent backflow into vendor stalls."
        );
      } else {
        setAiResponse(
          "Ngong and Kiserian show the heaviest informal vendor waste accumulation today. Recommendation: Route compactor truck #03 along Magadi Road via Kiserian."
        );
      }
      setIsAiThinking(false);
    }, 600);
  };

  // Calculations
  const totalReports = reports.length;
  const openReports = reports.filter((r) => r.status === "open").length;
  const collectedReports = reports.filter((r) => r.status === "collected").length;
  const flaggedReports = reports.filter((r) => r.status === "flagged").length;
  const totalCo2e = reports
    .filter((r) => r.status === "open")
    .reduce((acc, curr) => acc + curr.co2e_kg, 0);
  const drainAlerts = reports.filter(
    (r) => r.drain_blocked && r.status === "open"
  ).length;

  // Filtered reports for map and list
  const displayReports = reports.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (selectedZone !== "all" && r.zone !== selectedZone) return false;
    return true;
  });

  const zoneBreakdown = groupByZone(reports);

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Nairobi SW & Kajiado Waste Command
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
              Live Ingest
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time informal vendor waste reports from WhatsApp bot, Telegram, & USSD *384#
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reports"
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-emerald-400" />
            Dispatch Queue ({openReports})
          </Link>
          <Link
            href="/map"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            Full GIS Map
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Open Waste Hotspots"
          value={openReports}
          subValue={`of ${totalReports} reports`}
          change="+12% today"
          isPositive={false}
          icon={<Trash2 className="w-5 h-5" />}
          variant="warning"
        />

        <StatCard
          title="Cleaned & Attended"
          value={collectedReports}
          subValue={`${totalReports ? Math.round((collectedReports / totalReports) * 100) : 0}% cleared`}
          change="+18% clearance rate"
          isPositive={true}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="brand"
        />

        <StatCard
          title="Uncollected Carbon Cost"
          value={`${(totalCo2e / 1000).toFixed(2)}t`}
          subValue={`${totalCo2e.toFixed(0)} kg CO2e`}
          change="Decomposition & burn"
          isPositive={false}
          icon={<Leaf className="w-5 h-5" />}
          variant="danger"
        />

        <StatCard
          title="Blocked Drain Crises"
          value={drainAlerts}
          subValue="Flash flood risk"
          change="Urgent dispatch"
          isPositive={false}
          icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
          variant="danger"
        />
      </div>

      {/* AI Analyst Copilot Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-4 md:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Safi Intelligence AI Analyst
              </span>
              <span className="text-[10px] text-emerald-400 ml-2 font-mono">
                [Grounded on Oracle Database Live Ingest]
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Which zones need urgent pickup?",
              "What's this week's estimated CO2e?",
              "Show blocked storm drains",
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleAiAsk(q)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors border border-slate-700/60"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
          {isAiThinking ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
              <span>Analysing municipal dataset across 8 wards...</span>
            </div>
          ) : (
            <p>
              <strong className="text-emerald-400 font-semibold font-mono">
                ANALYSIS:
              </strong>{" "}
              {aiResponse}
            </p>
          )}
        </div>
      </div>

      {/* Main Grid: Interactive Map (Left/Center) + Priority Dispatch (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map & Filters Column */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Geolocated Hotspots
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({displayReports.length} pins)
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
                {(["all", "open", "collected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      filterStatus === s
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Zone selector */}
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Zones</option>
                {ZONES.map((z) => (
                  <option key={z.name} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Leaflet Map */}
          <div className="h-[480px]">
            <MapComponent reports={displayReports} selectedZone={selectedZone} />
          </div>
        </div>

        {/* Priority Dispatch Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Action Queue
              </span>
            </div>
            <Link
              href="/reports"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {reports
              .filter((r) => r.status === "open")
              .slice(0, 7)
              .map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border transition-all ${
                    r.drain_blocked
                      ? "bg-rose-950/20 border-rose-500/30"
                      : r.waste_type === "burning"
                      ? "bg-amber-950/20 border-amber-500/30"
                      : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">
                          {r.zone}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            r.drain_blocked
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {r.waste_type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          • {r.volume}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                        {r.details}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-emerald-400 font-mono block">
                        +{r.co2e_kg} kg CO2e
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {formatDateTime(r.ts)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Via {r.source.toUpperCase()} ({r.reporter_name})
                    </span>

                    <button
                      onClick={() => handleStatusChange(r.id, "collected")}
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 text-[11px] font-semibold border border-emerald-500/30 transition-all flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Mark Collected
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Zone Hotspot Ranking Section */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Sector Waste Intensity & Clearance Performance
            </h2>
          </div>
          <Link
            href="/analytics"
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
          >
            Detailed Analytics <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {ZONES.map((z) => {
            const stats = zoneBreakdown[z.name] || {
              open: 0,
              collected: 0,
              flagged: 0,
              co2e: 0,
            };
            const total = stats.open + stats.collected;
            const rate = total ? Math.round((stats.collected / total) * 100) : 100;

            return (
              <div
                key={z.name}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-1 hover:border-slate-700 transition-colors"
              >
                <div className="text-xs font-bold text-white truncate" title={z.name}>
                  {z.name}
                </div>
                <div className="text-lg font-black text-amber-400">
                  {stats.open}
                  <span className="text-[10px] text-slate-500 font-normal"> open</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {rate}% cleared
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 mt-1">
                  <div
                    className="bg-emerald-500 h-1 rounded-full transition-all"
                    style={{ width: `${rate}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

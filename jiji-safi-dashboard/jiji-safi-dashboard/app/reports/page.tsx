"use client";

import React, { useState, useEffect } from "react";
import { 
  getMockReports, 
  Report, 
  updateReportStatus, 
  ZONES, 
  ReportStatus 
} from "@/lib/data";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Check, 
  Flag, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  ExternalLink, 
  Phone, 
  MapPin, 
  Calendar,
  CheckCircle2
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    setReports(getMockReports());
  }, []);

  const handleStatusChange = async (id: number, status: ReportStatus) => {
    await updateReportStatus(id, status);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport({ ...selectedReport, status });
    }
  };

  const filtered = reports.filter((r) => {
    if (zoneFilter !== "all" && r.zone !== zoneFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.waste_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.zone.toLowerCase().includes(q) ||
        r.details.toLowerCase().includes(q) ||
        r.reporter_name.toLowerCase().includes(q) ||
        r.reporter_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCsv = () => {
    const headers = [
      "ID",
      "Timestamp",
      "Zone",
      "Waste Type",
      "Volume",
      "Reporter",
      "Channel",
      "CO2e (kg)",
      "Status",
      "Details",
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.ts,
      r.zone,
      r.waste_type,
      r.volume,
      r.reporter_name,
      r.source,
      r.co2e_kg,
      r.status,
      `"${r.details.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jiji_safi_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            Municipal Waste Incident Dispatch Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit, verify, dispatch collection compactor trucks, and flag false/contradictory submissions
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Export Audit CSV
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search landmark, vendor, reporter phone..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Zone Selector */}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Zones</option>
            {ZONES.map((z) => (
              <option key={z.name} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open (Unattended)</option>
            <option value="collected">Collected / Cleaned</option>
            <option value="flagged">Flagged False / Spam</option>
          </select>

          {/* Type Selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="organic">Organic</option>
            <option value="plastic">Plastic</option>
            <option value="blocked drain">Blocked Drain</option>
            <option value="burning">Burning</option>
            <option value="missing dustbin">Missing Dustbin</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">ID & Time</th>
                <th className="p-3.5">Zone & Landmark</th>
                <th className="p-3.5">Classification</th>
                <th className="p-3.5">Volume & Burden</th>
                <th className="p-3.5">Channel / Reporter</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.slice(0, 50).map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    r.status === "flagged"
                      ? "opacity-60 bg-purple-950/10"
                      : r.drain_blocked && r.status === "open"
                      ? "bg-rose-950/20"
                      : ""
                  }`}
                >
                  <td className="p-3.5 font-mono text-slate-300">
                    <div className="font-bold text-white">#{r.id}</div>
                    <div className="text-[10px] text-slate-500">
                      {formatDateTime(r.ts)}
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-white flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {r.zone}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px]">
                      {r.details}
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                        r.drain_blocked
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : r.waste_type === "burning"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {r.drain_blocked && <AlertTriangle className="w-2.5 h-2.5" />}
                      {r.waste_type}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <div className="text-slate-300 capitalize">{r.volume}</div>
                    {r.co2e_kg > 0 ? (
                      <div className="text-emerald-400 font-mono text-[10px]">
                        {r.co2e_kg} kg CO2e
                      </div>
                    ) : (
                      <div className="text-slate-500 text-[10px]">—</div>
                    )}
                  </td>

                  <td className="p-3.5">
                    <div className="text-slate-200 font-medium">
                      {r.reporter_name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {r.source.toUpperCase()} • {r.reporter_id}
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.status === "collected"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : r.status === "flagged"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "open" ? (
                        <>
                          <button
                            onClick={() => handleStatusChange(r.id, "collected")}
                            title="Mark as Collected & Cleaned"
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(r.id, "flagged")}
                            title="Flag False Report or Spam"
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(r.id, "open")}
                          title="Re-open Incident"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs">
            No waste reports matching current filters.
          </div>
        )}

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {Math.min(filtered.length, 50)} of {filtered.length} matching incidents</span>
          <span className="font-mono text-[11px]">Synced with Oracle APEX Database</span>
        </div>
      </div>
    </div>
  );
}

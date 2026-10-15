"use client";
import { useReports } from "@/lib/use-data";
import { DataStatus } from "@/components/DataStatus";
import { maskPhone, shortName, PRIVACY_NOTE } from "@/lib/privacy";

import { OfficerTabs } from "@/components/OfficerTabs";
import React, { useState, useEffect } from "react";
import { 
  
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function ReportsPage() {
  const { reports, setReports, loading, error } = useReports();
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);


  const handleStatusChange = async (id: number, status: ReportStatus) => {
    await updateReportStatus(id, status);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport({ ...selectedReport, status });
    }
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  useEffect(() => setPage(1), [search, zoneFilter, statusFilter, typeFilter]);

  const filtered = reports.filter((r) => {
    if (zoneFilter !== "all" && r.zone !== zoneFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.waste_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.zone.toLowerCase().includes(q) ||
        r.waste_type.toLowerCase().includes(q) ||
        r.details.toLowerCase().includes(q) ||
        r.reporter_name.toLowerCase().includes(q) ||
        r.reporter_id.toLowerCase().includes(q) ||
        String(r.id).includes(q.replace(/^#/, ""))
      );
    }
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

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
      shortName(r.reporter_name),
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

  const statusPill = (st: string) =>
    st === "collected"
      ? "bg-emerald-500/20 text-emerald-300"
      : st === "flagged"
      ? "bg-purple-500/20 text-purple-300"
      : "bg-amber-500/20 text-amber-300";

  const actions = (r: Report) => (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {r.status === "open" ? (
        <>
          <button onClick={() => handleStatusChange(r.id, "collected")} title="Mark as Collected & Cleaned" className="p-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleStatusChange(r.id, "flagged")} title="Flag False Report or Spam" className="p-1 rounded-md bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors">
            <Flag className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <button onClick={() => handleStatusChange(r.id, "open")} title="Re-open Incident" className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <DataStatus error={error} loading={loading} />
      <OfficerTabs />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            Incident Dispatch
          </h1>
          <p className="text-xs text-slate-400">Verify, dispatch and flag resident reports · <span className="text-slate-500">{PRIVACY_NOTE}</span></p>
        </div>
        <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zone, waste type, reporter, #id..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500">
          <option value="all">All zones</option>
          {ZONES.map((z) => (
            <option key={z.name} value={z.name}>{z.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="collected">Collected</option>
          <option value="flagged">Flagged</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500">
          <option value="all">All types</option>
          <option value="organic">Organic</option>
          <option value="plastic">Plastic</option>
          <option value="blocked drain">Blocked Drain</option>
          <option value="burning">Burning</option>
          <option value="missing dustbin">Missing Dustbin</option>
        </select>
        {(search || zoneFilter !== "all" || statusFilter !== "all" || typeFilter !== "all") && (
          <button onClick={() => { setSearch(""); setZoneFilter("all"); setStatusFilter("all"); setTypeFilter("all"); }} className="px-2 py-1.5 text-slate-400 hover:text-white">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-500 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Zone</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Reporter</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {pageRows.map((r) => {
                const open = selectedReport?.id === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setSelectedReport(open ? null : r)}
                      className={`cursor-pointer whitespace-nowrap hover:bg-slate-800/40 transition-colors ${
                        r.status === "flagged" ? "opacity-60" : r.drain_blocked && r.status === "open" ? "bg-rose-950/20" : ""
                      } ${open ? "bg-slate-800/50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono font-bold text-white">
                        <span className="inline-flex items-center gap-1">
                          <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
                          #{r.id}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{formatDateTime(r.ts)}</td>
                      <td className="px-3 py-2 font-semibold text-white">{r.zone}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 capitalize ${r.drain_blocked ? "text-rose-300" : r.waste_type === "burning" ? "text-amber-300" : "text-slate-300"}`}>
                          {r.drain_blocked && <AlertTriangle className="w-3 h-3" />}
                          {r.waste_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{shortName(r.reporter_name)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusPill(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2">{actions(r)}</td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-950/60">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                            <div className="col-span-2 md:col-span-4 text-slate-200">{r.details}</div>
                            <div><span className="text-slate-500 block">Volume</span><span className="text-slate-200 capitalize">{r.volume}</span></div>
                            <div><span className="text-slate-500 block">Carbon</span><span className="text-emerald-400 font-mono">{r.co2e_kg > 0 ? `${r.co2e_kg} kg CO2e` : "—"}</span></div>
                            <div><span className="text-slate-500 block">Channel</span><span className="text-slate-200">{r.source.toUpperCase()}</span></div>
                            <div><span className="text-slate-500 block">Reporter ID</span><span className="text-slate-200 font-mono inline-flex items-center gap-1"><Phone className="w-3 h-3" />{maskPhone(r.reporter_id)}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    {reports.length === 0 ? "No reports yet." : "No reports match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>


        <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            {filtered.length === 0 ? "0" : `${start + 1}–${start + pageRows.length}`} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="px-2.5 py-1 rounded-md border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Previous
            </button>
            <span className="font-mono">{currentPage}/{pageCount}</span>
            <button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="px-2.5 py-1 rounded-md border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

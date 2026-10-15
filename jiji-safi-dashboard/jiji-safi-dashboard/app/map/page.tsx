"use client";

import React, { useState, useEffect } from "react";
import { 
  getMockReports, 
  Report, 
  updateReportStatus, 
  ZONES, 
  WasteType, 
  ReportStatus 
} from "@/lib/data";
import { MapComponent } from "@/components/MapComponent";
import { 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertOctagon, 
  MapPin, 
  X, 
  Check, 
  Flag, 
  Phone, 
  Calendar, 
  Flame, 
  Leaf, 
  Trash2 
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function MapPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Filters
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [drainOnly, setDrainOnly] = useState<boolean>(false);

  useEffect(() => {
    setReports(getMockReports());
  }, []);

  const handleUpdateStatus = async (id: number, status: ReportStatus) => {
    await updateReportStatus(id, status);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport({ ...selectedReport, status });
    }
  };

  // Filter logic
  const filteredReports = reports.filter((r) => {
    if (zoneFilter !== "all" && r.zone !== zoneFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.waste_type !== typeFilter) return false;
    if (drainOnly && !r.drain_blocked) return false;
    return true;
  });

  const openCount = filteredReports.filter((r) => r.status === "open").length;
  const collectedCount = filteredReports.filter((r) => r.status === "collected").length;
  const flaggedCount = filteredReports.filter((r) => r.status === "flagged").length;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      {/* Header & Quick stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            GIS Waste Hotspot Command & Inspection Map
          </h1>
          <p className="text-xs text-slate-400">
            Geolocated vendor dumping clusters, attended collection points, and drainage chokepoints
          </p>
        </div>

        {/* Status Counts */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
            {openCount} Open
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            {collectedCount} Attended
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
            {flaggedCount} Flagged
          </span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            Filters:
          </div>

          {/* Zone Selector */}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Zones ({ZONES.length})</option>
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
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open (Unattended)</option>
            <option value="collected">Collected (Attended)</option>
            <option value="flagged">Flagged / Contradictory</option>
          </select>

          {/* Waste Type Selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Waste Types</option>
            <option value="organic">Organic / Food Scraps</option>
            <option value="plastic">Plastic & Polythene</option>
            <option value="blocked drain">Blocked Drains</option>
            <option value="burning">Informal Burning</option>
            <option value="missing dustbin">Missing Dustbin</option>
            <option value="mixed">Mixed Waste</option>
          </select>

          {/* Drain Checkbox */}
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-slate-300">
            <input
              type="checkbox"
              checked={drainOnly}
              onChange={(e) => setDrainOnly(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span className="text-[11px] font-semibold text-rose-400">
              Storm Drain Risks Only
            </span>
          </label>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Showing {filteredReports.length} geolocated incidents
        </div>
      </div>

      {/* Main Map Viewport with Floating Details Drawer */}
      <div className="relative flex-1 rounded-xl overflow-hidden min-h-[480px]">
        <MapComponent
          reports={filteredReports}
          selectedZone={zoneFilter !== "all" ? zoneFilter : undefined}
          onSelectReport={(r) => setSelectedReport(r)}
        />

        {/* Selected Incident Drawer */}
        {selectedReport && (
          <div className="absolute top-4 left-4 z-[500] w-80 md:w-96 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-700 p-4 shadow-2xl text-slate-200 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    Incident #{selectedReport.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedReport.status === "collected"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : selectedReport.status === "flagged"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {selectedReport.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedReport.zone} Zone</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Waste Type:</span>
                <span className="font-semibold text-white capitalize">
                  {selectedReport.waste_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Volume:</span>
                <span className="font-semibold text-slate-200">
                  {selectedReport.volume}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CO2e Burden:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {selectedReport.co2e_kg} kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stormwater Status:</span>
                <span
                  className={
                    selectedReport.drain_blocked
                      ? "text-rose-400 font-bold"
                      : "text-emerald-400"
                  }
                >
                  {selectedReport.drain_blocked
                    ? "DRAIN BLOCKED (High Flood Hazard)"
                    : "Normal Drainage"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                Citizen / Vendor Report Note:
              </span>
              <p className="p-2.5 rounded-lg bg-slate-900/60 text-xs text-slate-200 italic border border-slate-800">
                "{selectedReport.details}"
              </p>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {selectedReport.reporter_name} ({selectedReport.reporter_id})
                </span>
                <span className="uppercase text-[10px] font-bold text-slate-400">
                  Via {selectedReport.source}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Calendar className="w-3 h-3" />
                {formatDateTime(selectedReport.ts)}
              </div>
            </div>

            {/* Authority Actions */}
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  handleUpdateStatus(
                    selectedReport.id,
                    selectedReport.status === "collected" ? "open" : "collected"
                  )
                }
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  selectedReport.status === "collected"
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {selectedReport.status === "collected"
                  ? "Re-open Incident"
                  : "Mark Attended / Clean"}
              </button>

              <button
                onClick={() =>
                  handleUpdateStatus(
                    selectedReport.id,
                    selectedReport.status === "flagged" ? "open" : "flagged"
                  )
                }
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  selectedReport.status === "flagged"
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30"
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {selectedReport.status === "flagged"
                  ? "Unflag Report"
                  : "Flag False Report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report, ZONES } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

// Custom Leaflet icon fix for Next.js bundler
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to center or zoom to selected zone
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 12, { duration: 1.5 });
  }, [center, map]);
  return null;
}

interface MapInnerProps {
  reports: Report[];
  selectedZone?: string;
  onSelectReport?: (r: Report) => void;
  center?: [number, number];
}

export default function MapInner({
  reports,
  selectedZone,
  onSelectReport,
  center = [-1.365, 36.70], // Centered between Karen, Ngong & Rongai
}: MapInnerProps) {
  // Determine color by status & type
  const getMarkerStyle = (r: Report) => {
    if (r.status === "flagged") {
      return { color: "#a855f7", fillColor: "#c084fc", fillOpacity: 0.8, radius: 8 };
    }
    if (r.status === "collected") {
      return { color: "#10b981", fillColor: "#34d399", fillOpacity: 0.85, radius: 8 };
    }
    // Open reports
    if (r.drain_blocked) {
      return { color: "#ef4444", fillColor: "#f87171", fillOpacity: 0.95, radius: 11 };
    }
    if (r.waste_type === "burning") {
      return { color: "#f97316", fillColor: "#fb923c", fillOpacity: 0.9, radius: 10 };
    }
    return { color: "#eab308", fillColor: "#fde047", fillOpacity: 0.85, radius: 8 };
  };

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController center={center} />

        {/* Free OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Zone Reference Landmarks */}
        {ZONES.map((z) => (
          <CircleMarker
            key={z.name}
            center={[z.lat, z.lon]}
            radius={22}
            pathOptions={{
              color: "#38bdf8",
              fillColor: "#0284c7",
              fillOpacity: 0.12,
              weight: 1,
              dashArray: "4, 6",
            }}
          >
            <Popup>
              <div className="text-xs font-sans">
                <span className="font-bold text-sky-400 text-sm">{z.name} Zone</span>
                <p className="text-slate-300 mt-1">
                  Active monitoring sector under Jiji Safi collection network.
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Incident Reports */}
        {reports.map((r) => {
          if (!r.lat || !r.lon) return null;
          const style = getMarkerStyle(r);

          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lon]}
              radius={style.radius}
              pathOptions={{
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSelectReport?.(r),
              }}
            >
              <Popup>
                <div className="p-1 space-y-1.5 text-xs font-sans text-slate-100 max-w-[220px]">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                    <span className="font-bold text-emerald-400">#{r.id} • {r.zone}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        r.status === "collected"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "flagged"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400">Waste Type:</span>{" "}
                    <span className="font-semibold text-white capitalize">{r.waste_type}</span>
                  </div>

                  <div>
                    <span className="text-slate-400">Volume:</span>{" "}
                    <span className="text-slate-200">{r.volume}</span>
                  </div>

                  {r.co2e_kg > 0 && (
                    <div className="text-emerald-400 font-mono text-[11px]">
                      Est. CO2e: {r.co2e_kg} kg
                    </div>
                  )}

                  <div className="text-[11px] text-slate-300 italic">
                    "{r.details}"
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                    <span>By: {r.reporter_name}</span>
                    <span>{formatDateTime(r.ts)}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-4 right-4 z-[400] p-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 shadow-xl space-y-1.5">
        <div className="font-bold text-white text-xs mb-1">Status Legend</div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30"></span>
          <span>Attended / Collected</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-500/30"></span>
          <span>Open Waste Incident</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30"></span>
          <span>Blocked Drain / Urgent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-400 ring-2 ring-purple-500/30"></span>
          <span>Contradictory / Flagged</span>
        </div>
      </div>
    </div>
  );
}

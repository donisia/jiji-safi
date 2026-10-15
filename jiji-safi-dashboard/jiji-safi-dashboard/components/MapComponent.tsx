"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Report } from "@/lib/data";

interface MapComponentProps {
  reports: Report[];
  selectedZone?: string;
  onSelectReport?: (r: Report) => void;
  center?: [number, number];
}

const DynamicMap = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[450px] rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
      <p className="text-xs font-mono">Initializing GIS Hotspot Mapping...</p>
    </div>
  ),
});

export function MapComponent(props: MapComponentProps) {
  return <DynamicMap {...props} />;
}

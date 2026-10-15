"use client";

import { useCallback, useEffect, useState } from "react";
import { Credit, Report, fetchCredits, fetchReports } from "@/lib/data";

// Loads from APEX (or mock data) and refreshes every `pollMs` so new WhatsApp
// reports show up without reloading the page.
function usePolled<T>(load: () => Promise<T[]>, pollMs: number) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await load());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Could not reach the database");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  return { items, setItems, loading, error, refresh };
}

export function useReports(pollMs = 30000) {
  const { items, setItems, ...rest } = usePolled<Report>(fetchReports, pollMs);
  return { reports: items, setReports: setItems, ...rest };
}

export function useCredits(pollMs = 0) {
  const { items, setItems, ...rest } = usePolled<Credit>(fetchCredits, pollMs);
  return { credits: items, setCredits: setItems, ...rest };
}

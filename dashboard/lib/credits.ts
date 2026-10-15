import type { Report } from "@/lib/data";

/** Credits are earned per verified action: each report an officer marks collected. */
export const POINTS_PER_VERIFIED = 10;

export interface ReporterCredits {
  reporter_id: string;
  name: string;
  count: number;
  total: number;
}

/** Collected reports, optionally limited to [fromMs, toMs). */
export function verifiedReports(reports: Report[], fromMs?: number, toMs?: number) {
  return reports.filter((r) => {
    if (r.status !== "collected") return false;
    const t = new Date(r.ts).getTime();
    if (fromMs !== undefined && t < fromMs) return false;
    if (toMs !== undefined && t >= toMs) return false;
    return true;
  });
}

/** Total credits earned from verified reports in the window (no manual bonuses). */
export function verifiedCreditsTotal(reports: Report[], fromMs?: number, toMs?: number) {
  return verifiedReports(reports, fromMs, toMs).length * POINTS_PER_VERIFIED;
}

/** Per-reporter leaderboard; bonus = officer-issued extra credits keyed by reporter_id. */
export function creditLeaderboard(reports: Report[], bonus: Record<string, number> = {}): ReporterCredits[] {
  const map: Record<string, ReporterCredits> = {};
  verifiedReports(reports).forEach((r) => {
    if (!map[r.reporter_id]) map[r.reporter_id] = { reporter_id: r.reporter_id, name: r.reporter_name, count: 0, total: 0 };
    map[r.reporter_id].count++;
  });
  return Object.values(map)
    .map((u) => ({ ...u, total: u.count * POINTS_PER_VERIFIED + (bonus[u.reporter_id] || 0) }))
    .sort((a, b) => b.total - a.total);
}

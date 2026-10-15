// ─────────────────────────────────────────────────────────────────────────────
// Jiji Safi Dashboard — Data Layer
// Replace APEX_BASE_URL with your real Oracle APEX REST URL and flip
// USE_MOCK to false when the DB is ready.
// ─────────────────────────────────────────────────────────────────────────────

// Set NEXT_PUBLIC_USE_MOCK=true in .env.local to demo with fake data.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
// The browser talks to our own Next.js routes (app/api/jiji/*), which forward
// to APEX server-side. That avoids CORS and keeps the APEX URL out of the browser.
const API = "/api/jiji";

// ── Types ────────────────────────────────────────────────────────────────────

export type WasteType =
  | "organic"
  | "plastic"
  | "mixed"
  | "blocked drain"
  | "burning"
  | "missing dustbin"
  | "General"
  | "Metal"
  | "clean";

export type ReportStatus = "open" | "collected" | "flagged";
export type ReportSource = "whatsapp" | "telegram" | "ussd";

export interface Report {
  id: number;
  ts: string;              // ISO timestamp
  source: ReportSource;
  reporter_id: string;     // phone or Telegram user_id
  reporter_name: string;
  zone: string;
  lat: number | null;
  lon: number | null;
  waste_type: WasteType;
  volume: string;          // "small bag" | "sack" | "pile" | "no bin" | "none"
  details: string;
  photo_url: string | null;
  drain_blocked: boolean;
  status: ReportStatus;
  co2e_kg: number;
}

export interface Credit {
  id: number;
  ts: string;
  reporter_id: string;
  reporter_name: string;
  zone: string;
  amount: number;
  reason: string;
}

export interface Zone {
  name: string;
  lat: number;
  lon: number;
}

// ── Zone catalogue (Ngong–Rongai corridor) ───────────────────────────────────

export const ZONES: Zone[] = [
  { name: "Ngong",          lat: -1.3620, lon: 36.6550 },
  { name: "Ongata Rongai",  lat: -1.3960, lon: 36.7590 },
  { name: "Kiserian",       lat: -1.4250, lon: 36.6860 },
  { name: "Matasia",        lat: -1.4170, lon: 36.7030 },
];

// ── CO2e factors (kg CO2e per kg waste, from analytics.py) ──────────────────

const KG: Record<string, number> = {
  "small bag": 5,
  sack: 25,
  pile: 80,
  "no bin": 0,
  none: 0,
};
const FACTORS: Record<string, number> = {
  organic: 0.8,
  plastic: 2.5,
  mixed: 1.5,
  burning: 3.0,
  "blocked drain": 1.0,
  "missing dustbin": 0,
  General: 1.0,
  Metal: 0.5,
  clean: 0,
};

export function calcCo2e(waste_type: string, volume: string): number {
  const kg = KG[volume] ?? 0;
  const factor = FACTORS[waste_type] ?? 0;
  return parseFloat((kg * factor).toFixed(2));
}

// ── Mock data generator ──────────────────────────────────────────────────────

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function jitter(base: number, spread = 0.005) {
  return base + (Math.random() - 0.5) * spread * 2;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const WASTE_TYPES: WasteType[] = [
  "organic", "plastic", "mixed", "blocked drain",
  "burning", "missing dustbin", "General", "Metal",
];
const VOLUMES = ["small bag", "sack", "pile"];
const SOURCES: ReportSource[] = ["whatsapp", "telegram", "ussd"];
const NAMES = [
  "Wanjiku M.", "Otieno K.", "Njeri A.", "Kamau J.", "Achieng S.",
  "Mwangi P.", "Odhiambo T.", "Wambui R.", "Kipchoge L.", "Atieno B.",
  "Maina G.", "Chebet F.", "Owino D.", "Wangari N.", "Kiprotich E.",
  "Adhiambo C.", "Njoroge H.", "Aketch I.", "Mutua W.", "Cherop V.",
];

function makeReporter(i: number) {
  return {
    id: `+2547${String(10000000 + i * 3731).slice(0, 8)}`,
    name: NAMES[i % NAMES.length],
  };
}

let _mockReports: Report[] | null = null;

export function getMockReports(): Report[] {
  if (_mockReports) return _mockReports;

  const reporters = Array.from({ length: 20 }, (_, i) => makeReporter(i));
  const reports: Report[] = [];
  let id = 1;

  // Generate 180 days of data
  for (let day = 180; day >= 0; day--) {
    const count = rndInt(2, 8);
    for (let j = 0; j < count; j++) {
      const zone = rnd(ZONES);
      const waste_type = rnd(WASTE_TYPES);
      const volume = waste_type === "missing dustbin" ? "no bin"
                   : waste_type === "blocked drain"   ? "pile"
                   : rnd(VOLUMES);
      const reporter = rnd(reporters);
      const status: ReportStatus =
        day > 14 ? (Math.random() > 0.3 ? "collected" : "open")
        : day > 3 ? (Math.random() > 0.6 ? "collected" : "open")
        : "open";

      reports.push({
        id: id++,
        ts: daysAgo(day),
        source: rnd(SOURCES),
        reporter_id: reporter.id,
        reporter_name: reporter.name,
        zone: zone.name,
        lat: jitter(zone.lat),
        lon: jitter(zone.lon),
        waste_type,
        volume,
        details: `${waste_type} waste reported near ${zone.name} town centre`,
        photo_url: null,
        drain_blocked: waste_type === "blocked drain",
        status,
        co2e_kg: calcCo2e(waste_type, volume),
      });
    }
  }

  // Add some flagged reports (contradictions/spam)
  for (let i = 0; i < 12; i++) {
    const zone = rnd(ZONES);
    const reporter = rnd(reporters);
    reports.push({
      id: id++,
      ts: daysAgo(rndInt(0, 30)),
      source: "whatsapp",
      reporter_id: reporter.id,
      reporter_name: reporter.name,
      zone: zone.name,
      lat: jitter(zone.lat),
      lon: jitter(zone.lon),
      waste_type: "General",
      volume: "pile",
      details: "Suspicious/contradictory report — area reportedly clean",
      photo_url: null,
      drain_blocked: false,
      status: "flagged",
      co2e_kg: 0,
    });
  }

  _mockReports = reports.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
  return _mockReports;
}

let _mockCredits: Credit[] | null = null;

export function getMockCredits(): Credit[] {
  if (_mockCredits) return _mockCredits;

  const credits: Credit[] = [];
  let id = 1;
  const reporters = Array.from({ length: 20 }, (_, i) => makeReporter(i));

  reporters.forEach((r, ri) => {
    const count = rndInt(1, 15);
    for (let i = 0; i < count; i++) {
      const zone = rnd(ZONES);
      credits.push({
        id: id++,
        ts: daysAgo(rndInt(0, 90)),
        reporter_id: r.id,
        reporter_name: r.name,
        zone: zone.name,
        amount: rnd([10, 10, 10, 20, 50]),
        reason: rnd([
          "3-day clean zone streak",
          "Accurate report verified",
          "Drain blockage prevented flooding",
          "First report in zone",
          "Monthly top reporter",
        ]),
      });
    }
  });

  _mockCredits = credits.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
  return _mockCredits;
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

export function filterByPeriod(reports: Report[], period: "week" | "month" | "year") {
  const cutoff = new Date();
  if (period === "week")  cutoff.setDate(cutoff.getDate() - 7);
  if (period === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  if (period === "year")  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return reports.filter((r) => new Date(r.ts) >= cutoff);
}

export function groupByZone(reports: Report[]) {
  const map: Record<string, { open: number; collected: number; flagged: number; co2e: number }> = {};
  ZONES.forEach((z) => { map[z.name] = { open: 0, collected: 0, flagged: 0, co2e: 0 }; });
  reports.forEach((r) => {
    if (!map[r.zone]) map[r.zone] = { open: 0, collected: 0, flagged: 0, co2e: 0 };
    map[r.zone][r.status]++;
    map[r.zone].co2e += r.co2e_kg;
  });
  return map;
}

export function groupByDay(reports: Report[]) {
  const map: Record<string, number> = {};
  reports.forEach((r) => {
    const day = r.ts.slice(0, 10);
    map[day] = (map[day] ?? 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function groupByWeek(reports: Report[]) {
  const map: Record<string, number> = {};
  reports.forEach((r) => {
    const d = new Date(r.ts);
    const week = `W${getWeek(d)} ${d.getFullYear()}`;
    map[week] = (map[week] ?? 0) + 1;
  });
  return Object.entries(map).map(([week, count]) => ({ date: week, count }));
}

function getWeek(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

export function groupByMonth(reports: Report[]) {
  const map: Record<string, number> = {};
  reports.forEach((r) => {
    const key = r.ts.slice(0, 7); // YYYY-MM
    map[key] = (map[key] ?? 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      date: new Date(month + "-01").toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
      count,
    }));
}

export function reporterLeaderboard(credits: Credit[]) {
  const map: Record<string, { name: string; total: number; count: number }> = {};
  credits.forEach((c) => {
    if (!map[c.reporter_id]) map[c.reporter_id] = { name: c.reporter_name, total: 0, count: 0 };
    map[c.reporter_id].total += c.amount;
    map[c.reporter_id].count++;
  });
  return Object.entries(map)
    .map(([id, v]) => ({ reporter_id: id, ...v }))
    .sort((a, b) => b.total - a.total);
}

// ── API service ──────────────────────────────────────────────────────────────

// Bot/APEX rows can arrive with nulls, numbers-as-strings, 0/1 flags etc.
function normalizeReport(raw: any): Report {
  return {
    id: Number(raw.id),
    ts: raw.ts ?? new Date().toISOString(),
    source: (raw.source ?? "whatsapp") as ReportSource,
    reporter_id: String(raw.reporter_id ?? ""),
    reporter_name: raw.reporter_name || "WhatsApp user",
    zone: raw.zone ?? "Not specified",
    lat: raw.lat == null ? null : Number(raw.lat),
    lon: raw.lon == null ? null : Number(raw.lon),
    waste_type: (raw.waste_type ?? "General") as WasteType,
    volume: raw.volume ?? "small bag",
    details: raw.details ?? "",
    photo_url: raw.photo_url || null,
    drain_blocked: raw.drain_blocked === true || Number(raw.drain_blocked) === 1,
    status: (raw.status ?? "open") as ReportStatus,
    co2e_kg: Number(raw.co2e_kg ?? 0),
  };
}

function normalizeCredit(raw: any): Credit {
  return {
    id: Number(raw.id),
    ts: raw.ts ?? new Date().toISOString(),
    reporter_id: String(raw.reporter_id ?? ""),
    reporter_name: raw.reporter_name || "WhatsApp user",
    zone: raw.zone ?? "",
    amount: Number(raw.amount ?? 0),
    reason: raw.reason ?? "",
  };
}

export async function fetchReports(): Promise<Report[]> {
  if (USE_MOCK) return getMockReports();
  const r = await fetch(`${API}/reports`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Reports request failed (${r.status})`);
  const json = await r.json();
  return ((json.items ?? json) as any[]).map(normalizeReport);
}

export async function fetchCredits(): Promise<Credit[]> {
  if (USE_MOCK) return getMockCredits();
  const r = await fetch(`${API}/credits`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Credits request failed (${r.status})`);
  const json = await r.json();
  return ((json.items ?? json) as any[]).map(normalizeCredit);
}

export async function updateReportStatus(id: number, status: ReportStatus): Promise<void> {
  if (USE_MOCK) {
    const r = getMockReports().find((x) => x.id === id);
    if (r) r.status = status;
    return;
  }
  const r = await fetch(`${API}/reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(`Status update failed (${r.status})`);
}

export async function createCredit(c: Omit<Credit, "id" | "ts">): Promise<void> {
  if (USE_MOCK) return;
  const r = await fetch(`${API}/credits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  if (!r.ok) throw new Error(`Credit save failed (${r.status})`);
}

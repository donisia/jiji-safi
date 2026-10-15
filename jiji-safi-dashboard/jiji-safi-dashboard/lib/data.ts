// ─────────────────────────────────────────────────────────────────────────────
// Jiji Safi Dashboard — Data Layer
// Replace APEX_BASE_URL with your real Oracle APEX REST URL and flip
// USE_MOCK to false when the DB is ready.
// ─────────────────────────────────────────────────────────────────────────────

export const USE_MOCK = true;
export const APEX_BASE_URL =
  process.env.NEXT_PUBLIC_APEX_URL ??
  "https://apex.oracle.com/pls/apex/WKSP_JIJISAFI";

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
  { name: "Ngong",          lat: -1.3601, lon: 36.6531 },
  { name: "Ongata Rongai",  lat: -1.3878, lon: 36.7498 },
  { name: "Kiserian",       lat: -1.4105, lon: 36.6833 },
  { name: "Matasia",        lat: -1.3932, lon: 36.6556 },
  { name: "Kawangware",     lat: -1.2769, lon: 36.7428 },
  { name: "Embulbul",       lat: -1.3500, lon: 36.6700 },
  { name: "Karen",          lat: -1.3167, lon: 36.7167 },
  { name: "Kware",          lat: -1.3800, lon: 36.7200 },
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

// ── API service (swap USE_MOCK → false for production) ───────────────────────

export async function fetchReports(): Promise<Report[]> {
  if (USE_MOCK) return getMockReports();
  const r = await fetch(`${APEX_BASE_URL}/reports/`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch reports");
  const json = await r.json();
  // APEX REST collections return { items: [...] }
  return (json.items ?? json) as Report[];
}

export async function fetchCredits(): Promise<Credit[]> {
  if (USE_MOCK) return getMockCredits();
  const r = await fetch(`${APEX_BASE_URL}/credits/`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch credits");
  const json = await r.json();
  return (json.items ?? json) as Credit[];
}

export async function updateReportStatus(id: number, status: ReportStatus): Promise<void> {
  if (USE_MOCK) {
    // Update mock in memory
    const reports = getMockReports();
    const r = reports.find((x) => x.id === id);
    if (r) r.status = status;
    return;
  }
  await fetch(`${APEX_BASE_URL}/reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

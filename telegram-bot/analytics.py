import csv
import io
from collections import defaultdict
from datetime import datetime

import db

KG = {"small bag": 5, "sack": 25, "pile": 80}
FACTORS = {"organic": 0.8, "plastic": 2.5, "mixed": 1.5, "burning": 3.0}


def co2e(report: dict):
    kg = KG.get(report["volume"], 0)
    factor = FACTORS.get(report["waste_type"], 0)
    return kg, factor, kg * factor


def _open_dirty(reports):
    return [r for r in reports if r["status"] == "open" and r["waste_type"] != "clean"]


def hotspots(days=7):
    reports = [r for r in db.reports_since(days) if r["waste_type"] != "clean"]
    if not reports:
        return "Hakuna reports bado. Be the first - tuma report!"
    by_zone = defaultdict(int)
    for r in reports:
        by_zone[r["zone"]] += 1
    lines = [f"Hotspots (last {days} days):"]
    for zone, n in sorted(by_zone.items(), key=lambda x: -x[1]):
        lines.append(f"{'#' * min(n, 15)} {zone}: {n} reports")
    return "\n".join(lines)


def need_pickup(limit=5):
    reports = _open_dirty(db.reports_since())
    if not reports:
        return "Safi! Hakuna zone inayohitaji pickup sasa hivi."
    today = db.now()
    zones = defaultdict(lambda: {"n": 0, "drain": 0, "oldest": today})
    for r in reports:
        z = zones[r["zone"]]
        z["n"] += 1
        if r["waste_type"] == "blocked drain" or r["drain_blocked"]:
            z["drain"] += 1
        ts = datetime.fromisoformat(r["ts"])
        if ts < z["oldest"]:
            z["oldest"] = ts
    ranked = []
    for name, z in zones.items():
        age_days = (today - z["oldest"]).days
        score = z["n"] + 3 * z["drain"] + age_days
        ranked.append((score, name, z, age_days))
    ranked.sort(key=lambda x: -x[0])
    lines = ["Zones zinazohitaji pickup (urgent first):"]
    for i, (score, name, z, age) in enumerate(ranked[:limit], 1):
        drain = f", {z['drain']} blocked drain" if z["drain"] else ""
        lines.append(f"{i}. {name} - {z['n']} reports{drain}, oldest {age}d (score {score})")
    return "\n".join(lines)


def missing_bins():
    reports = [
        r
        for r in db.reports_since()
        if r["waste_type"] == "missing dustbin" or r["volume"] == "no bin"
    ]
    if not reports:
        return "Hakuna zone iliyoripotiwa kukosa dustbin."
    by_zone = defaultdict(int)
    for r in reports:
        by_zone[r["zone"]] += 1
    lines = ["Zones bila dustbin:"]
    for zone, n in sorted(by_zone.items(), key=lambda x: -x[1]):
        lines.append(f"- {zone}: {n} reports")
    return "\n".join(lines)


def co2e_summary(days=7):
    reports = db.reports_since(days)
    total = 0.0
    breakdown = defaultdict(lambda: [0, 0.0])
    calc = []
    for r in reports:
        kg, factor, val = co2e(r)
        if val:
            total += val
            breakdown[r["waste_type"]][0] += kg
            breakdown[r["waste_type"]][1] += val
    if not breakdown:
        return f"Hakuna waste data ya CO2e (last {days} days).", 0.0
    lines = [f"CO2e estimate (last {days} days):"]
    for t, (kg, val) in breakdown.items():
        calc.append(f"- {t}: {kg} kg x {FACTORS[t]} = {val:.1f} kg CO2e")
    lines += calc
    lines.append(f"TOTAL: {total:.1f} kg CO2e")
    return "\n".join(lines), total


def build_report(days: int, label: str):
    reports = db.reports_since(days)
    start = (db.now().date()).fromordinal(db.now().date().toordinal() - days + 1)
    end = db.now().date()
    summary, total = co2e_summary(days)
    lines = [
        f"Safi Track - {label} Waste & CO2e Report - Nairobi CBD",
        f"Date range: {start} to {end}",
        f"Total reports: {len(reports)}",
        "",
        hotspots(days).replace(f"Hotspots (last {days} days):", "Top hotspots by zone:"),
        "",
        summary,
        "",
        need_pickup(),
        "",
        f"Clean verified zones: {len({r['zone'] for r in reports if r['waste_type'] == 'clean' and r['clean_zone']})}",
        "",
        missing_bins(),
    ]
    return "\n".join(lines), total


def reports_csv(days: int) -> str:
    reports = db.reports_since(days)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "timestamp", "user_id", "zone", "lat", "lon", "waste_type", "volume",
                "drain_blocked", "clean_zone", "status", "est_kg", "est_co2e_kg"])
    for r in reports:
        kg, _, val = co2e(r)
        w.writerow([r["id"], r["ts"], r["user_id"], r["zone"], r["lat"], r["lon"],
                    r["waste_type"], r["volume"], r["drain_blocked"], r["clean_zone"],
                    r["status"], kg, round(val, 2)])
    return buf.getvalue()

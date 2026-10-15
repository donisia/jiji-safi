import os
import sqlite3
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

NAIROBI = ZoneInfo("Africa/Nairobi")


def _path():
    return os.getenv("DB_PATH", "safitrack.db")


def conn():
    c = sqlite3.connect(_path())
    c.row_factory = sqlite3.Row
    return c


def now():
    return datetime.now(NAIROBI)


def init():
    with conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                username TEXT,
                lat REAL,
                lon REAL,
                zone TEXT NOT NULL,
                waste_type TEXT NOT NULL,
                volume TEXT NOT NULL,
                photo_url TEXT,
                drain_blocked INTEGER DEFAULT 0,
                clean_zone INTEGER DEFAULT 0,
                status TEXT DEFAULT 'open'
            );
            CREATE TABLE IF NOT EXISTS credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                username TEXT,
                zone TEXT NOT NULL,
                amount INTEGER NOT NULL
            );
            """
        )


def add_report(r: dict) -> int:
    with conn() as c:
        cur = c.execute(
            """INSERT INTO reports
            (ts,user_id,username,lat,lon,zone,waste_type,volume,photo_url,drain_blocked,clean_zone)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                now().isoformat(),
                r["user_id"],
                r.get("username"),
                r.get("lat"),
                r.get("lon"),
                r["zone"],
                r["waste_type"],
                r["volume"],
                r.get("photo_url"),
                1 if r.get("drain_blocked") else 0,
                1 if r.get("clean_zone") else 0,
            ),
        )
        return cur.lastrowid


def reports_since(days=None):
    with conn() as c:
        if days is None:
            rows = c.execute("SELECT * FROM reports ORDER BY ts").fetchall()
        else:
            cutoff = (now() - timedelta(days=days)).isoformat()
            rows = c.execute(
                "SELECT * FROM reports WHERE ts >= ? ORDER BY ts", (cutoff,)
            ).fetchall()
    return [dict(r) for r in rows]


def mark_collected(zone: str) -> int:
    with conn() as c:
        cur = c.execute(
            "UPDATE reports SET status='collected' WHERE status='open' AND lower(zone)=lower(?)",
            (zone,),
        )
        return cur.rowcount


def clean_dates(user_id: int, zone: str):
    with conn() as c:
        rows = c.execute(
            "SELECT ts FROM reports WHERE user_id=? AND lower(zone)=lower(?) AND waste_type='clean' AND clean_zone=1",
            (user_id, zone),
        ).fetchall()
    return sorted({datetime.fromisoformat(r["ts"]).date() for r in rows})


def last_credit_date(user_id: int, zone: str):
    with conn() as c:
        row = c.execute(
            "SELECT ts FROM credits WHERE user_id=? AND lower(zone)=lower(?) ORDER BY ts DESC LIMIT 1",
            (user_id, zone),
        ).fetchone()
    return datetime.fromisoformat(row["ts"]).date() if row else None


def add_credit(user_id, username, zone, amount=10):
    with conn() as c:
        c.execute(
            "INSERT INTO credits (ts,user_id,username,zone,amount) VALUES (?,?,?,?,?)",
            (now().isoformat(), user_id, username, zone, amount),
        )


def total_credits(user_id: int) -> int:
    with conn() as c:
        row = c.execute(
            "SELECT COALESCE(SUM(amount),0) AS t FROM credits WHERE user_id=?", (user_id,)
        ).fetchone()
    return row["t"]

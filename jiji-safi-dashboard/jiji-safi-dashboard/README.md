# Jiji Safi - Municipal Waste Command & Carbon Analytics Dashboard

Built for the Oracle Cloud / APEX Hackathon.

## Features
- **Live Ingest Feeds**: Integrates with WhatsApp (Gemini Vision AI bot), Telegram bot, and USSD.
- **Geolocated Hotspot Map**: Real-time Leaflet GIS mapping across the Ngong, Ongata Rongai, Kiserian, Matasia, Kawangware, Karen, and Kware informal vendor corridors.
- **Attended vs. Unattended Status Tracking**: Real-time status toggles (`open`, `collected`, `flagged`).
- **Carbon Accounting (CO2e)**: Quantifies greenhouse gas emissions (methane from organic decomposition, open burning emissions) calculated from waste type and volume using IPCC-aligned emission factors.
- **Dynamic Trend Views**: Switch seamlessly between **Weekly**, **Monthly**, and **Yearly** views with interactive Recharts area graphs, zone performance comparisons, and waste stream breakdowns.
- **Citizen Credits & Rewards**: Vendor leaderboard, 3-day clean streak rewards, monthly sector awards (e.g. Ksh 25,000 community dustbin fund), and anti-fraud contradiction verification.
- **Oracle APEX Integration**: Configured to connect directly to Oracle Autonomous Database (ATP/ADW) REST Enabled SQL or APEX REST Endpoints via `lib/data.ts`.

## Running the Dashboard
```bash
cd /home/mburu/jiji-safi-dashboard
npm start -- -p 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Oracle Database Table DDL (Run in Oracle APEX SQL Workshop)
```sql
CREATE TABLE reports (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR2(30),
    reporter_id VARCHAR2(50),
    reporter_name VARCHAR2(100),
    zone VARCHAR2(100),
    lat NUMBER(10, 6),
    lon NUMBER(10, 6),
    waste_type VARCHAR2(50),
    volume VARCHAR2(50),
    details VARCHAR2(4000),
    photo_url VARCHAR2(1000),
    drain_blocked NUMBER(1) DEFAULT 0,
    status VARCHAR2(20) DEFAULT 'open',
    co2e_kg NUMBER(10, 2)
);

CREATE TABLE credits (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reporter_id VARCHAR2(50),
    reporter_name VARCHAR2(100),
    zone VARCHAR2(100),
    amount NUMBER,
    reason VARCHAR2(255)
);
```

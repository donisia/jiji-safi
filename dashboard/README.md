# Jiji Safi / Safi Track: Waste Command Dashboard

Jiji Safi lets residents report waste problems: dumping, blocked drains, burning and missing dustbins. Authorities get a dashboard showing the status of each zone. It covers the Ngong area only: **Ngong, Ongata Rongai, Kiserian and Matasia**. It was built for the Oracle GreenTech Hackathon.

Officers can:
- see open and cleared reports on a map of the area
- dispatch and clear incidents
- track the CO2e impact
- award credits to residents whose reports are verified

## Stack
- Next.js 14.2.5 (App Router), React 18, TypeScript
- Tailwind CSS, lucide-react icons
- Recharts for analytics and react-leaflet for the map
- Oracle APEX / ORDS REST on Autonomous Database (planned data source)

## Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000 and log in with **officer / safi2026** (demo account).

To build for production, run `npx next build`, then `npm start`.

## Folder structure
```
app/            routes: / (overview + hero map), /map, /reports (incident dispatch),
                /credits, /analytics, /login, layout.tsx
components/     Navbar, Sidebar, OfficerTabs, MapComponent/MapInner (Leaflet), StatCard
lib/data.ts     types, zone list, mock data, fetchReports/fetchCredits (APEX REST)
lib/auth-context.tsx   demo login + route guard
lib/privacy.ts  phone/name masking
```

## Where Oracle fits
```
Resident ─► Telegram bot (Desktop\safi-track-telegram-bot)
         ─► WhatsApp bot (Desktop\jiji-safi-whatsapp-bot)
         ─► USSD (planned)
              │  POST /safi/report/
              ▼
   ORDS module /safi/ in APEX workspace greentech (WKSP_GREENTECH)
              ▼
   Autonomous Database tables: zones, reports, status_history, credits
              ▼
   Dashboard reads GET /safi/reports/ and GET /safi/credits/ via lib/data.ts
```
- Officers also get an **Oracle APEX app** built on the same tables.
- **Select AI** (planned) will let officers ask questions in plain English, for example "Which zone has the most open reports this week?"

## Current status (honest)
- **All pages run on mock data.** `lib/data.ts` has `USE_MOCK = true`, and `APEX_BASE_URL` still points to the old `WKSP_JIJISAFI` URL. Once the `/safi/` endpoints are live, change it to `https://apex.oracle.com/pls/apex/WKSP_GREENTECH/safi` and set `USE_MOCK = false`.
- Some pages still import `getMockReports()` and `getMockCredits()` directly. They need switching to `fetchReports()` and `fetchCredits()`.
- **The analytics figures are demo data.** The CO2e trend is a rough estimate of report count × 12.8 kg per day.
- The bots don't post to ORDS yet. The Telegram bot still writes to SQLite.
- The login is a demo only (one hard-coded officer account, with no real auth).

# Jiji Safi

**Report waste on WhatsApp. See it on a live map. Act on it.**

Jiji Safi lets residents of Ngong, Matasia, Kiserian and Ongata Rongai report illegal dumping through WhatsApp, in English or Kiswahili, by text, menu, photo, or voice-note prompts. Every report is saved in an Oracle APEX database and appears instantly on a municipal dashboard with a hotspot map, status tracking, carbon (CO2e) estimates and a citizen rewards board.

---

## How it fits together

```
 Citizen (WhatsApp)
        |
        v
   UltraMsg  ---webhook--->  ngrok  --->  BOT (Python / Flask, port 5000)
                                            |  - guided menu (EN / SW) + voice notes (ElevenLabs)
                                            |  - AI chat + photo reading (Gemini)
                                            |
                                            v   saves each report
                                   ORACLE APEX DATABASE  (tables REPORTS, CREDITS + REST)
                                            ^
                                            |   reads / updates (relayed by the bot)
                                            |
                              DASHBOARD (Next.js, port 3000)
                              overview - map - reports - analytics - credits
```

Why the dashboard goes through the bot: Oracle's free APEX hosting blocks ordinary scripts. The bot connects to Oracle the way Chrome does (`curl_cffi`), so it gets through. The dashboard asks the bot, and the bot asks APEX.

| Part | Where it runs | Address |
|---|---|---|
| Bot | Your laptop (`start.bat`) | http://localhost:5000 |
| Dashboard | Your laptop (`npm.cmd run dev`) | http://localhost:3000 |
| Database + REST | Oracle APEX (cloud) | https://oracleapex.com/ords/jijisafi |

---

## Folder map

```
jiji-safi/
  README.md               <- this file
  oracle/                 <- apex_*.sql (tables + REST modules) and SETUP.md
  whatsapp-bot/           <- app.py  texts.py  generate_voices.py  start.bat  .env.example  voices/
  telegram-bot/           <- Safi Track Telegram bot (SQLite, not yet wired to Oracle)
  dashboard/              <- Next.js dashboard: app/  components/  lib/  .env.local.example
```

The `oracle/apex_*.sql` files only need to be run once, and they have been. Ignore the older `apex_part2` and `apex_part3` files. Use only the `b` versions if you ever need to rebuild.

---

## Run it (every time): steps A to E

You need these installed once: **Python**, **Node.js**, **ngrok** (with `ngrok config add-authtoken YOUR_TOKEN` done once).

### A. Start the bot
1. Open `whatsapp-bot/` and double-click **`start.bat`**.
2. Two windows open (NGROK and FLASK BOT). **Leave both open.**
3. The launcher prints a line like `https://xxxx.ngrok-free.app/webhook` and copies it to your clipboard.

### B. Point WhatsApp at the bot
1. Log in to **UltraMsg** and open your instance, then **Settings**.
2. Paste the link from step A into **Webhook URL**.
3. Turn on **Webhook on received**, then save.

> The ngrok link **changes every time** you restart. Repeat step B after every restart.

### C. Start the dashboard
1. Open the folder `dashboard/`.
2. Click the address bar, type `powershell`, press Enter.
3. First time only: `npm.cmd install` (takes about 3 minutes).
4. Every time: `npm.cmd run dev`
5. Wait for **Ready**, then open **http://localhost:3000**.

> Always type `npm.cmd` (not `npm`). On this laptop PowerShell blocks plain `npm`.

### D. Test the whole chain
1. From a phone, WhatsApp the bot: `hi`, choose a language, choose **1 Report waste**, and follow the steps.
2. Dashboard: the new report appears within about 30 seconds (or refresh).
3. APEX: **SQL Workshop > SQL Commands**, run `SELECT * FROM reports ORDER BY id DESC` and the same row is there.

### E. Close down
Press `Ctrl+C` in each window, or just close them.

---

## What a citizen sees

1. Say hi, pick **English** or **Kiswahili**.
2. Menu: **1** Report waste, **2** Chat with Jiji (AI), **3** About, **4** Change language.
3. Report flow: waste type, area, landmark, photo (optional), confirm.
4. After every step the bot sends the text **and** a voice note for that step.
5. Sending a photo starts a report with the waste type read from the picture (Gemini vision).
6. Sending the word `menu` at any time returns to the main menu.

## What the dashboard shows

| Page | Purpose |
|---|---|
| Overview (Command Center) | Open / cleared-this-week / red zones / credits (7d) cards, 7-day report trend, open reports per zone |
| Map | Report pins across the corridor; click a pin to dispatch or flag |
| Reports | Full incident log, search and filter, CSV export, change status |
| Analytics | Weekly / monthly / yearly trends, waste mix, zone comparison |
| Credits | Reporter leaderboard and reward issuing |

The dashboard refreshes by itself every 30 seconds. A yellow banner means demo data is showing, and a red banner means it can't reach the database.

---

## Pitch-day checklist

**Before you leave home**
- [ ] Laptop charged and charger packed
- [ ] Phone hotspot ready as backup internet
- [ ] Run steps A, B and C once and confirm a WhatsApp test shows up on the dashboard
- [ ] Have the APEX tab open on `SQL Workshop > SQL Commands` with `SELECT * FROM reports ORDER BY id DESC` ready to show the live database
- [ ] Optional: remove your test row with `DELETE FROM reports WHERE message_id = 'test1'; COMMIT;`

**Suggested 3-minute demo**
1. Show the problem: dumping and blocked drains, with no easy way to report them.
2. On a phone, send a real report on WhatsApp (try one in Kiswahili and let the voice note play).
3. Switch to the dashboard: the report appears, with its map pin and CO2e estimate.
4. Mark it **collected** and show the status change.
5. Switch to APEX and run the SELECT: the same row is in the Oracle database.
6. Close on the Credits page: rewarding citizens for accurate reports.

**If something breaks on stage**
| Problem | Quick fix |
|---|---|
| WhatsApp message gets no reply | Restart `start.bat`, then redo step B (new ngrok link) |
| Dashboard shows a red banner | Check the FLASK BOT window is still open; refresh the page |
| No internet at the venue | Use your phone hotspot, then restart the bot and redo step B |
| Total failure | Open `dashboard/.env.local`, set `NEXT_PUBLIC_USE_MOCK=true`, restart the dashboard. It shows generated demo data (say so honestly) |

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `npm : ... running scripts is disabled` | Use `npm.cmd` instead of `npm` |
| `Access Denied` or timeout when calling `oracleapex.com` from PowerShell or curl | Oracle blocks plain scripts. This is expected. Python with `curl_cffi` works, and the bot already uses it. Browsers also work |
| Bot says `curl_cffi not installed` | `python -m pip install -r requirements.txt` |
| ngrok shows **Bad Gateway** | The bot isn't running on port 5000. Close old FLASK BOT windows and run `start.bat` again |
| Bot replies but the report isn't in APEX | Look in the FLASK BOT window for lines starting `[APEX]`. A report that couldn't be sent is queued in `pending_apex.json` and retried every minute |
| Dashboard empty | Check `http://127.0.0.1:5000/apex/jiji/reports` in a browser. It should show `{"items":[...` |
| Changed `.env.local` but nothing changed | Stop the dashboard (`Ctrl+C`) and run `npm.cmd run dev` again |
| No voice notes | Check `ELEVENLABS_API_KEY` in the bot `.env`. Text still works without it |

---

## Oracle workspace (env-switchable)

Everything points at the `jijisafi` APEX workspace (`https://oracleapex.com/ords/jijisafi`) **only through env vars**: `APEX_URL` in `whatsapp-bot/.env`
(the bot also relays the dashboard's `/apex/jiji/*` calls to the same root). To move to the `greentech` workspace, run the `oracle/` SQL there and change
`APEX_URL` to `https://oracleapex.com/ords/greentech/whatsapp/report`. No code change is needed. Note `app.py` still has an old `WKSP_JIJISAFI` fallback if `APEX_URL` is unset.

## Privacy

Reporter phone numbers and names are masked in the officer pages (`dashboard/lib/privacy.ts`). Credits are computed in one place (`dashboard/lib/credits.ts`: 10 per collected report) so the overview and credits page always agree.

## Configuration reference

**Bot `.env`** (in the bot folder)

| Key | What it is |
|---|---|
| `ULTRAMSG_INSTANCE`, `ULTRAMSG_TOKEN` | Your UltraMsg WhatsApp connection |
| `APEX_URL` | `https://oracleapex.com/ords/jijisafi/whatsapp/report` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI chat and photo reading |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Voice notes (blank = text only) |

**Dashboard `.env.local`** (in the dashboard folder)

| Key | Value |
|---|---|
| `APEX_BASE_URL` | `http://127.0.0.1:5000/apex` (the bot relays to APEX) |
| `NEXT_PUBLIC_USE_MOCK` | `false` for live data, `true` for demo data |

## Database and REST endpoints (Oracle APEX)

Tables: `REPORTS` (location, waste type, status, CO2e, photo, reporter) and `CREDITS`.

| Method | Path | Used by |
|---|---|---|
| POST | `/whatsapp/report` | Bot saves a report (adds map position and CO2e, ignores duplicates) |
| GET | `/jiji/reports` | Dashboard lists reports |
| PUT | `/jiji/reports/:id` | Dashboard sets `open`, `collected` or `flagged` |
| GET / POST | `/jiji/credits` | Dashboard reads and issues credits |

Report fields: `phone, waste_type, zone, details, photo_url, message_id`.

---

## Honest limitations (say these before a judge asks)

- **Public endpoints.** Anyone who has the APEX address could post reports or change statuses. Next step: API key or OAuth.
- **Dashboard login is a demo.** A single hard-coded officer account (`officer` / `safi2026`), checked in the browser only.
- **CO2e is an estimate.** The bot doesn't ask for volume yet, so each report is counted as a small bag (5 kg). Emission factors are IPCC-style approximations.
- **Hazard reports** are saved as General with `[HAZARD]` at the start of the details.
- **Photos.** UltraMsg photo links may expire. A production version would copy photos to permanent storage.
- **Runs on a laptop.** ngrok and a local Flask server are fine for a demo. Production needs a real server with a fixed address.
- **Older Next.js (14.2.5)** has a published security advisory. Upgrade before any public deployment.
- **Keys.** Reset the UltraMsg, Gemini and ElevenLabs keys after the event, since they were shared while building.

## Next steps

1. Installable phone app (PWA) for field teams
2. Collection-crew view with routes and "mark collected" from a phone
3. Ask for volume in the bot for better carbon figures
4. Secure the API and add real logins
5. USSD intake (Telegram bot exists in telegram-bot/, needs Oracle wiring), so people without smartphones can report too

---

*Built for the Oracle APEX hackathon. Stack: WhatsApp (UltraMsg), Python + Flask, Gemini, ElevenLabs, Oracle APEX / ORDS, Next.js, Leaflet, Recharts.*

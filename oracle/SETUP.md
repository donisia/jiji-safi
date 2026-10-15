# Jiji Safi: WhatsApp bot -> Oracle APEX -> Dashboard

WhatsApp -> UltraMsg -> bot (Flask) --POST--> APEX REST -> REPORTS table
Dashboard -> bot (/apex/jiji/*) --GET/PUT--> APEX      (bot relays, because Oracle blocks plain scripts)

## Database (done)
Tables REPORTS + CREDITS and REST modules `whatsapp` and `jiji` (see apex_*.sql).
Your REST root: https://oracleapex.com/ords/jijisafi

## Bot
1. Copy your own `.env` into the bot folder (it is NOT in this zip) and set:
   APEX_URL=https://oracleapex.com/ords/jijisafi/whatsapp/report
2. python -m pip install -r requirements.txt   (adds curl_cffi)
3. start.bat as before.

## Dashboard
copy .env.local.example .env.local
npm install
npm run dev      (bot must be running)
Set NEXT_PUBLIC_USE_MOCK=true for demo data.

## Known gaps
- REST endpoints are public; dashboard login accepts anything.
- CO2e uses a default volume (bot does not ask volume).
- Hazard reports are stored as General with "[HAZARD]" in details.

# Jiji Safi Reporting Bot

Before you start (one time): install Python, install ngrok, and run
`ngrok config add-authtoken YOUR_NGROK_TOKEN`.

## 3 steps

**Step 1:** Configure your keys in `.env` (UltraMsg token + Gemini key). To enable
Africa's Talking, also set:

```dotenv
AT_USERNAME=sandbox
AT_API_KEY=your_africas_talking_api_key
```

Use `AT_USERNAME=sandbox` for Africa's Talking sandbox. For a live account, set
your Africa's Talking username; the bot will use the production SMS endpoint
unless `AT_SMS_URL` is explicitly configured.

**Step 2:** Double click `start.bat`

**Step 3:** Copy the Ngrok URL + `/webhook` (the launcher shows it and copies it)
and paste it into UltraMsg -> Instance -> Settings -> Webhook URL.
Turn on "Webhook on received".

In the Africa's Talking dashboard, configure the USSD callback as
`https://YOUR_NGROK_URL/ussd` and the incoming SMS callback as
`https://YOUR_NGROK_URL/sms`.

The USSD menu displays its options on separate lines: `1. Report waste` and
`2. Missing dustbin`. Reports are saved locally before the callback responds;
the Oracle APEX request runs in the background so network delays do not hold
the USSD session open.

Keep the app and ngrok running. Live USSD/SMS requires an Africa's Talking service code/short code and a configured live account.

## What it does
- Gemini chats naturally in English / Swahili / Sheng and asks follow-up questions
- Gemini also reads photos people send and uses them in the report
- WhatsApp users can type "report" to open the numbered report menu: select waste or missing dustbin, then enter a location
- Saves each report to `reports.json` and POSTs it to Oracle APEX
- Africa's Talking USSD collects a waste type and location, or a missing-dustbin report
- Incoming SMS reports are saved to the same report store and Oracle APEX endpoint; replies use Africa's Talking SMS
- If Gemini is down or the key is missing, it falls back to the keyword bot

Change the model with GEMINI_MODEL in `.env` (default gemini-flash-latest).
Saved reports: `reports.json`, or http://localhost:5000/reports

For SMS, send a message such as `REPORT plastic Kencom` or `BIN Kencom`.
Include a known area/landmark (for example CBD, Kencom, Moi Avenue, or Ngong).
On WhatsApp, send `report` and follow the numbered prompts; USSD guides reporters
through the same waste/location fields.

## Oracle APEX payload (JSON)
phone, message, photo_url, waste_type, zone, details, message_id, reported_at

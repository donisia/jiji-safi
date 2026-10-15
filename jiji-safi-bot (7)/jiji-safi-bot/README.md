# Jiji Safi WhatsApp AI Bot (Gemini + ElevenLabs voice)

Before you start (one time): install Python, install ngrok, and run
`ngrok config add-authtoken YOUR_NGROK_TOKEN`.

## 3 steps
**Step 1:** Check your keys in `.env` (UltraMsg token, Gemini key, ElevenLabs key)
**Step 2:** Double click `start.bat` (first run also makes the voice notes, ~1 minute)
**Step 3:** Paste the Ngrok URL + `/webhook` into UltraMsg -> Instance -> Settings -> Webhook URL.
Turn on "Webhook on received".

## How a person uses it
1. Say hi -> pick English or Kiswahili
2. Main menu: 1 Report waste, 2 Chat with Jiji (AI), 3 About, 4 Change language
3. Report = menu steps: waste type -> area -> landmark -> photo (optional) -> confirm
4. After every step the bot sends the text AND a pre-recorded voice note for that step
5. Sending the word `menu` at any time goes back to the main menu (cancels a half-finished report)
6. Sending a photo from the menu starts a report with the waste type already filled in

## Voice notes
- Words live in `texts.py` (T = text, VOICE = what the voice says)
- `generate_voices.py` makes `voices/<lang>/<step>.mp3` with ElevenLabs. It skips files that exist.
  Changed a sentence? Run `python generate_voices.py --force`
- Pick a different voice with ELEVENLABS_VOICE_ID in `.env` (blank = default voice)
- If the key is blank the bot still works, text only

## Other
- Gemini chat/photo reading and the keyword fallback work as before
- Saved reports: `reports.json`, or http://localhost:5000/reports
- Oracle APEX payload: phone, message, photo_url, waste_type, zone, details, message_id, reported_at
  (dangerous-waste reports are saved as General with "[HAZARD]" at the start of details)

"""
Jiji Safi - WhatsApp waste reporting bot (AI version)
UltraMsg webhook -> Flask -> Gemini chats with the user -> saves reports
-> reports.json + Oracle APEX
"""
import base64
import json
import os
import re
import threading
from datetime import datetime

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE", "instance194298")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN", "")
APEX_URL = os.getenv(
    "APEX_URL", "https://apex.oracle.com/pls/apex/WKSP_JIJISAFI/whatsapp/report"
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")      # chats AND reads photos
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
AT_USERNAME = os.getenv("AT_USERNAME", "sandbox")
AT_API_KEY = os.getenv("AT_API_KEY", "")
AT_SMS_URL = os.getenv(
    "AT_SMS_URL",
    "https://api.sandbox.africastalking.com/version1/messaging"
    if AT_USERNAME == "sandbox"
    else "https://api.africastalking.com/version1/messaging",
)
REPORTS_FILE = "reports.json"

file_lock = threading.Lock()
chat_lock = threading.Lock()
inbound_lock = threading.Lock()
report_flow_lock = threading.Lock()
histories = {}        # phone -> list of {"role": "user"/"model", "content": text} (resets when app restarts)
last_photo = {}       # phone -> latest photo url + analysis (attached to the next report)
whatsapp_report_flows = {}  # phone -> current menu step and report selections
seen_ids = set()      # message ids already handled (UltraMsg can retry webhooks)
seen_inbound_ids = set()
MAX_HISTORY = 12      # how many recent messages the AI remembers per person

app = Flask(__name__)

MAIN_MENU_TEXT = "Jiji Safi:\n1. Report waste\n2. Missing dustbin"
WASTE_MENU_TEXT = "Select waste:\n1. Plastic\n2. Organic\n3. Metal\n4. General"
USSD_MAIN_MENU = f"CON {MAIN_MENU_TEXT}"
USSD_WASTE_MENU = f"CON {WASTE_MENU_TEXT}"
USSD_HELP_MENU = "CON 1. Report waste\n2. Missing dustbin\n3. Help"


# ---------------------------------------------------------------- CORS ----
@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


# ------------------------------------------------------ The AI's persona ---
SYSTEM_PROMPT = """You are Jiji, the friendly WhatsApp assistant for Jiji Safi, a community
project where people in Ngong, Matasia, Kiserian and Ongata Rongai (Kajiado/Nairobi area, Kenya)
report waste dumping so the team can follow up.

How you talk:
- You are chatting on WhatsApp. Keep replies short and warm, 1-3 sentences, like a helpful neighbour.
- Mirror the user's language: English, Kiswahili, or Sheng/mixed. If they switch, you switch.
- Plain text only. No markdown, no bullet lists. At most one emoji, and only when it fits.
- Never invent facts, phone numbers, or promises (like exact cleanup times). If you don't know, say so.
- You can chat normally (greetings, thanks, questions about recycling, waste sorting, what Jiji Safi does).
  If someone goes way off topic, answer briefly and gently steer back.

Your main job, taking waste reports:
- When someone reports dumping, you need two things: what kind of waste and where (zone or landmark).
- If the location is missing or too vague, ask ONE short follow-up question. Don't interrogate.
- Once you know the waste type and some location, confirm the report in a friendly way and thank them.
- Log each incident only once. If they are just adding to a report you already logged, don't log it again.
- If it sounds dangerous (medical waste, chemicals, fire, someone hurt), tell them to stay away from it
  and not touch it, and still log the report.

Photos:
- Sometimes a message starts with [The user sent a photo. Vision analysis: {...}]. That is what an image
  model saw in their photo. Treat it as what the photo shows, never read the brackets or JSON out loud.
- Acknowledge the photo naturally ("Asante for the photo, I can see..."). Use its waste type and any
  location clues. If the location is still unclear, ask for it. If the photo doesn't show waste
  (shows_waste is false), say so kindly and ask them to resend a clearer one.
- If the analysis says hazard is high, follow the danger rule above.

Waste types you can log: Plastic, Organic, Metal, General.

ALWAYS answer with ONLY a JSON object, nothing before or after it, in this exact shape:
{"reply": "<what you send on WhatsApp>",
 "report": null}
or, only on the turn where the report is complete and should be logged:
{"reply": "<what you send on WhatsApp>",
 "report": {"waste_type": "Plastic|Organic|Metal|General",
            "zone": "<zone or area name, or Not specified>",
            "details": "<short summary incl. landmark, in English>"}}"""


# ------------------------------------------------ Fallback classification --
# Used only if the AI is unavailable, so reports are never lost.
WASTE_KEYWORDS = [
    ("Plastic", ["plastic", "plastiki", "bottle", "chupa", "polythene", "nylon", "mfuko"]),
    ("Organic", ["food", "organic", "chakula", "mboga", "matunda", "vegetable", "fruit", "taka za jikoni"]),
    ("Metal", ["metal", "chuma", "bati", "scrap", "can ", "cans", "tin "]),
]
ZONES = [
    "Ongata Rongai", "Nairobi CBD", "Tom Mboya Street", "Mfangano Street",
    "Ronald Ngala", "Kenyatta Avenue", "River Road", "Accra Road",
    "Moi Avenue", "Gikomba", "Kencom", "Archives", "OTC", "CBD",
    "Ngong", "Matasia", "Kiserian", "Rongai", "Embulbul", "Kware", "Karen",
]


def classify_waste(text):
    t = text.lower() + " "
    for waste_type, words in WASTE_KEYWORDS:
        if any(w in t for w in words):
            return waste_type
    return "General"


def extract_zone(text):
    t = text.lower()
    for z in ZONES:
        if z.lower() in t:
            return z
    return "Not specified"


# ------------------------------------------------------------- Storage ----
def save_local(report):
    with file_lock:
        data = []
        if os.path.exists(REPORTS_FILE):
            try:
                with open(REPORTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = []
        data.append(report)
        with open(REPORTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


def send_to_apex(report):
    try:
        r = requests.post(APEX_URL, json=report, timeout=15)
        print(f"[APEX] status={r.status_code} body={r.text[:200]}")
        return r.ok
    except requests.RequestException as e:
        print(f"[APEX] FAILED: {e}")
        return False


def send_whatsapp(to, body):
    if not ULTRAMSG_TOKEN:
        print("[UltraMsg] No token set in .env - reply skipped")
        return False
    url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
    try:
        r = requests.post(
            url, data={"token": ULTRAMSG_TOKEN, "to": to, "body": body}, timeout=15
        )
        print(f"[UltraMsg] reply status={r.status_code} body={r.text[:200]}")
        return r.ok
    except requests.RequestException as e:
        print(f"[UltraMsg] FAILED: {e}")
        return False


def send_sms(to, body):
    if not AT_API_KEY:
        print("[Africa's Talking] AT_API_KEY is not set - SMS reply skipped")
        return False
    try:
        r = requests.post(
            AT_SMS_URL,
            headers={"apiKey": AT_API_KEY, "Accept": "application/json"},
            data={"username": AT_USERNAME, "to": to, "message": body},
            timeout=15,
        )
        print(f"[Africa's Talking SMS] status={r.status_code} body={r.text[:200]}")
        return r.ok
    except requests.RequestException as e:
        print(f"[Africa's Talking SMS] FAILED: {e}")
        return False


def record_report(
    phone, message, waste_type, zone, details, message_id, photo_url="",
    async_apex=False,
):
    record = {
        "phone": phone,
        "message": message,
        "photo_url": photo_url,
        "waste_type": waste_type or "General",
        "zone": zone or "Not specified",
        "details": details or message,
        "message_id": message_id,
        "reported_at": datetime.now().isoformat(timespec="seconds"),
    }
    print(f"[REPORT] {record['waste_type']} | {record['zone']} | {record['details']}")
    save_local(record)
    if async_apex:
        threading.Thread(target=send_to_apex, args=(record,), daemon=True).start()
    else:
        send_to_apex(record)
    return record


def claim_inbound_id(message_id):
    if not message_id:
        return True
    with inbound_lock:
        if message_id in seen_inbound_ids:
            return False
        seen_inbound_ids.add(message_id)
        if len(seen_inbound_ids) > 5000:
            seen_inbound_ids.clear()
            seen_inbound_ids.add(message_id)
        return True


def release_inbound_id(message_id):
    if message_id:
        with inbound_lock:
            seen_inbound_ids.discard(message_id)


def extract_report_location(text):
    zone = extract_zone(text)
    if zone != "Not specified":
        return zone
    match = re.search(r"\b(?:at|in|near|around)\s+(.+)$", text, re.IGNORECASE)
    if match:
        return match.group(1).strip(" .,!;:")
    match = re.match(
        r"^(?:report\s+)?(?:plastic|plastiki|organic|food|metal|chuma|general|taka|bin|dustbin|pipa)\s+(.+)$",
        text.strip(),
        re.IGNORECASE,
    )
    if match:
        location = re.sub(r"^(?:at|in|near|around)\s+", "", match.group(1), flags=re.IGNORECASE)
        return location.strip(" .,!;:")
    return ""


# ------------------------------------------------------------------ AI ----
def gemini_post(payload):
    """Call the Gemini API (AI Studio endpoint, key sent in the X-goog-api-key header)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    headers = {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}
    r = requests.post(url, headers=headers, json=payload, timeout=40)
    if not r.ok:
        print(f"[GEMINI] HTTP {r.status_code}: {r.text[:600]}")  # shows the real reason
    r.raise_for_status()
    return r.json()


def parse_ai_json(text):
    """Pull the JSON object out of the model's answer, even if it adds fences."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return {"reply": text.strip(), "report": None}
    try:
        obj = json.loads(text[start : end + 1])
        return {"reply": str(obj.get("reply", "")).strip(), "report": obj.get("report")}
    except json.JSONDecodeError:
        return {"reply": text.strip(), "report": None}


def ask_ai(phone, user_text):
    """Send the conversation so far to Gemini. Returns {"reply", "report"}."""
    with chat_lock:
        history = histories.setdefault(phone, [])
        history.append({"role": "user", "content": user_text})
        del history[:-MAX_HISTORY]
        while history and history[0]["role"] != "user":  # must start with user
            history.pop(0)
        contents = [
            {"role": m["role"], "parts": [{"text": m["content"]}]} for m in history
        ]

    data = gemini_post({
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 8192},
    })
    parts = data["candidates"][0]["content"].get("parts", [])
    raw = "".join(p.get("text", "") for p in parts)
    print(f"[AI] raw answer: {raw[:300]!r} finish={data['candidates'][0].get('finishReason')}")
    result = parse_ai_json(raw)
    if not result["reply"]:
        raise ValueError("AI returned an empty reply")

    with chat_lock:
        histories[phone].append({"role": "model", "content": raw})
    return result


def fallback_answer(user_text, details=None):
    """Simple keyword bot, used when the AI can't be reached."""
    waste_type, zone = classify_waste(user_text), extract_zone(user_text)
    return {
        "reply": f"Asante! Report received: {waste_type} in {zone}. Jiji Safi team notified!",
        "report": {"waste_type": waste_type, "zone": zone, "details": details or user_text},
    }


# ------------------------------------------------------- Gemini vision ----
VISION_PROMPT = """You help a community waste-reporting service in Kenya. Look at this photo.
Reply with ONLY a JSON object in this shape:
{"shows_waste": true or false,
 "waste_type": "Plastic" or "Organic" or "Metal" or "General" or "None",
 "description": "one or two plain sentences on what you see",
 "hazard": "none" or "low" or "high" followed by a short reason,
 "location_clues": "visible landmarks, signs, shop names, or 'none'"}"""


def analyze_photo(media_url):
    """Download the WhatsApp photo and ask Gemini what it shows. Returns dict or None."""
    if not GEMINI_API_KEY:
        print("[VISION] No GEMINI_API_KEY in .env - photo not analysed")
        return None
    try:
        img = requests.get(media_url, timeout=30)
        img.raise_for_status()
        if len(img.content) > 15 * 1024 * 1024:
            print("[VISION] image too big, skipped")
            return None
        mime = img.headers.get("Content-Type", "image/jpeg").split(";")[0]
        if not mime.startswith("image/"):
            mime = "image/jpeg"

        data = gemini_post({
            "contents": [{
                "parts": [
                    {"text": VISION_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": base64.b64encode(img.content).decode()}},
                ]
            }],
            "generationConfig": {"responseMimeType": "application/json"},
        })
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        start, end = text.find("{"), text.rfind("}")
        result = json.loads(text[start : end + 1])
        print(f"[VISION] {result}")
        return result
    except Exception as e:
        print(f"[VISION] FAILED: {e}")
        return None


# ------------------------------------------------------ Message handling ---
def process_whatsapp_report_menu(sender, phone, body, msg_id):
    """Run the WhatsApp report menu when the user starts or continues a report."""
    choice = body.strip()
    lowered = choice.lower()
    reply = None

    with report_flow_lock:
        flow = whatsapp_report_flows.get(phone)
        if lowered in ("menu", "start") or (
            flow is None and re.search(r"\b(?:report|reporting)\b", lowered)
        ):
            whatsapp_report_flows[phone] = {"step": "main"}
            reply = f"{MAIN_MENU_TEXT}\nReply 1 or 2."
        elif flow is None:
            return False
        elif lowered in ("menu", "start"):
            flow.clear()
            flow["step"] = "main"
            reply = f"{MAIN_MENU_TEXT}\nReply 1 or 2."
        elif flow["step"] == "main":
            if choice == "1":
                flow["step"] = "waste"
                reply = f"{WASTE_MENU_TEXT}\nReply 1, 2, 3, or 4."
            elif choice == "2":
                flow.update(step="location", waste_type="General", missing_bin=True)
                reply = "Enter the area or landmark where a dustbin is needed:"
            else:
                reply = f"Invalid choice.\n{MAIN_MENU_TEXT}\nReply 1 or 2."
        elif flow["step"] == "waste":
            types = {"1": "Plastic", "2": "Organic", "3": "Metal", "4": "General"}
            waste_type = types.get(choice)
            if waste_type:
                flow.update(step="location", waste_type=waste_type, missing_bin=False)
                reply = "Enter the area or landmark where the waste was found:"
            else:
                reply = f"Invalid choice.\n{WASTE_MENU_TEXT}\nReply 1, 2, 3, or 4."
        else:
            location = choice.strip()
            if not location or len(location) > 120:
                reply = "Please enter a location under 120 characters:"
            else:
                missing_bin = flow["missing_bin"]
                waste_type = flow["waste_type"]
                details = (
                    f"Missing dustbin coverage at {location}"
                    if missing_bin
                    else f"Waste reported at {location}"
                )
                try:
                    record_report(
                        phone=phone,
                        message=f"WhatsApp report at {location}",
                        waste_type=waste_type,
                        zone=location,
                        details=details,
                        message_id=f"whatsapp:{msg_id}" if msg_id else (
                            f"whatsapp:{phone}:{datetime.now().isoformat(timespec='seconds')}"
                        ),
                    )
                    whatsapp_report_flows.pop(phone, None)
                    reply = (
                        f"Asante! Dustbin coverage report received for {location}."
                        if missing_bin
                        else f"Asante! {waste_type} report received for {location}."
                    )
                except Exception as e:
                    print(f"[WhatsApp menu] Failed to save report: {e}")
                    reply = "We could not save your report. Please try sending the location again."

    send_whatsapp(sender, reply)
    return True


def handle_message(sender, body, msg_id, media_url=""):
    """Runs in a background thread so the webhook can answer UltraMsg instantly."""
    try:
        phone = sender.replace("@c.us", "")
        print(f"[IN ] {phone}: {body or '(photo)'}")

        if not media_url and process_whatsapp_report_menu(sender, phone, body, msg_id):
            return

        # If they sent a photo, let Gemini look at it first
        original = body
        user_text = body
        analysis = None
        if media_url:
            analysis = analyze_photo(media_url)
            if analysis:
                last_photo[phone] = {"url": media_url, "analysis": analysis}
                user_text = (
                    "[The user sent a photo. Vision analysis: "
                    + json.dumps(analysis, ensure_ascii=False)
                    + f"] Caption: {body or '(none)'}"
                )
            else:
                user_text = f"[The user sent a photo but it could not be analysed.] Caption: {body or '(none)'}"
        body = user_text

        if GEMINI_API_KEY:
            try:
                result = ask_ai(phone, body)
            except Exception as e:
                print(f"[AI] FAILED, using fallback: {e}")
                result = fallback_answer(body, original or (analysis or {}).get("description"))
        else:
            print("[AI] No GEMINI_API_KEY in .env - using keyword fallback")
            result = fallback_answer(body, original or (analysis or {}).get("description"))

        report = result.get("report")
        if isinstance(report, dict):
            record_report(
                phone=phone,
                message=original or "(photo)",
                waste_type=report.get("waste_type"),
                zone=report.get("zone"),
                details=report.get("details") or original or "(photo)",
                message_id=msg_id,
                photo_url=(last_photo.get(phone) or {}).get("url", ""),
            )
            last_photo.pop(phone, None)

        print(f"[OUT] {phone}: {result['reply']}")
        send_whatsapp(sender, result["reply"])
    except Exception as e:
        print(f"[ERROR] handle_message: {e}")


# ------------------------------------------------------------- Webhook ----
def parse_payload(payload):
    """Handle both {"data": {...}} and flat {...} shapes."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    sender = data.get("from") or payload.get("from") or ""
    body = data.get("body") or payload.get("body") or ""
    msg_id = data.get("id") or payload.get("id") or ""
    from_me = bool(data.get("fromMe") or payload.get("fromMe"))
    msg_type = data.get("type") or payload.get("type") or "chat"
    media = data.get("media") or payload.get("media") or ""
    return sender, body, msg_id, from_me, msg_type, media


@app.route("/webhook", methods=["POST", "OPTIONS"])
def webhook():
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        payload = request.get_json(force=True, silent=True) or {}
        print(f"\n[WEBHOOK] {json.dumps(payload, ensure_ascii=False)[:400]}")

        event = payload.get("event_type", "message_received")
        sender, body, msg_id, from_me, msg_type, media = parse_payload(payload)

        if from_me or event not in ("message_received", "") or not sender:
            return jsonify(status="ignored"), 200
        if sender.endswith("@g.us"):
            return jsonify(status="ignored"), 200

        # Skip duplicates (webhook retries)
        if msg_id:
            if msg_id in seen_ids:
                return jsonify(status="duplicate"), 200
            seen_ids.add(msg_id)
            if len(seen_ids) > 2000:
                seen_ids.clear()

        is_photo = msg_type == "image" and bool(media)

        # Voice notes, videos etc: we only read text and photos
        if not is_photo and (msg_type != "chat" or not body.strip()):
            threading.Thread(
                target=send_whatsapp,
                args=(sender, "Asante! Sijaweza kusikiliza voice note/video bado. Tafadhali niandikie wapi na ni taka gani, au nitumie picha. / Please type what and where, or send a photo."),
                daemon=True,
            ).start()
            return jsonify(status="unsupported"), 200

        threading.Thread(
            target=handle_message,
            args=(sender, body, msg_id, media if is_photo else ""),
            daemon=True,
        ).start()
        return jsonify(status="ok"), 200

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify(status="error", detail=str(e)), 200


@app.route("/ussd", methods=["POST"])
@app.route("/webhook/ussd", methods=["POST"])
def ussd():
    """Africa's Talking USSD callback; prompts users through a short report flow."""
    payload = request.get_json(silent=True) or request.form
    session_id = str(payload.get("sessionId", "")).strip()
    phone = str(payload.get("phoneNumber", "")).strip()
    text = str(payload.get("text", "")).strip()
    if not session_id or not phone:
        return (
            "END We could not start your report. Please try again.",
            200,
            {"Content-Type": "text/plain"},
        )

    with inbound_lock:
        if f"ussd:{session_id}" in seen_inbound_ids:
            return "END This report has already been received. Asante!", 200, {"Content-Type": "text/plain"}

    fields = [part.strip() for part in text.split("*")] if text else []
    if not fields:
        response = USSD_MAIN_MENU
    elif fields[0] == "1" and len(fields) == 1:
        response = USSD_WASTE_MENU
    elif fields[0] == "1" and len(fields) == 2:
        types = {"1": "Plastic", "2": "Organic", "3": "Metal", "4": "General"}
        if fields[1] not in types:
            response = f"CON Invalid choice. {USSD_WASTE_MENU[4:]}"
        else:
            response = "CON Enter the area or landmark where the waste was found:"
    elif fields[0] == "1" and len(fields) >= 3:
        types = {"1": "Plastic", "2": "Organic", "3": "Metal", "4": "General"}
        location = "*".join(fields[2:]).strip()
        if fields[1] not in types:
            response = f"CON Invalid waste type.\n{USSD_WASTE_MENU[4:]}"
        elif not location:
            response = "CON Location is required. Enter the area or landmark where the waste was found:"
        elif len(location) > 120:
            response = "CON Location is too long. Enter a location under 120 characters:"
        else:
            message_id = f"ussd:{session_id}"
            if not claim_inbound_id(message_id):
                response = "END This report has already been received. Asante!"
            else:
                try:
                    record_report(
                        phone, f"USSD waste report at {location}", types[fields[1]],
                        location, f"Waste reported at {location}", message_id,
                        async_apex=True,
                    )
                    response = f"END Asante! {types[fields[1]]} report received for {location}."
                except Exception as e:
                    release_inbound_id(message_id)
                    print(f"[USSD] Failed to save report: {e}")
                    response = "END We could not save your report. Please try again."
    elif fields[0] == "2" and len(fields) == 1:
        response = "CON Enter the area or landmark where a dustbin is needed:"
    elif fields[0] == "2" and len(fields) >= 2:
        location = "*".join(fields[1:]).strip()
        if not location:
            response = "CON Location is required. Enter the area or landmark where a dustbin is needed:"
        elif len(location) > 120:
            response = "CON Location is too long. Enter a location under 120 characters:"
        else:
            message_id = f"ussd:{session_id}"
            if not claim_inbound_id(message_id):
                response = "END This report has already been received. Asante!"
            else:
                try:
                    record_report(
                        phone, f"USSD missing dustbin report at {location}", "General",
                        location, f"Missing dustbin coverage at {location}", message_id,
                        async_apex=True,
                    )
                    response = f"END Asante! Dustbin coverage report received for {location}."
                except Exception as e:
                    release_inbound_id(message_id)
                    print(f"[USSD] Failed to save report: {e}")
                    response = "END We could not save your report. Please try again."
    elif fields[0] == "3":
        response = USSD_HELP_MENU
    else:
        response = USSD_MAIN_MENU
    return response, 200, {"Content-Type": "text/plain"}


@app.route("/sms", methods=["POST"])
@app.route("/webhook/sms", methods=["POST"])
def sms_webhook():
    """Africa's Talking incoming SMS callback."""
    payload = request.get_json(silent=True) or request.form
    phone = str(payload.get("from", "")).strip()
    body = str(payload.get("text", "")).strip()
    message_id = str(payload.get("id", "")).strip()
    if not phone or not body:
        return jsonify(status="ignored", reason="missing sender or message"), 200

    dedupe_id = f"sms:{message_id}" if message_id else ""
    if not claim_inbound_id(dedupe_id):
        return jsonify(status="duplicate"), 200

    lowered = body.lower()
    is_bin_report = bool(re.search(r"\b(?:dustbins?|bins?|pipa|dustbin coverage)\b", lowered))
    location = extract_report_location(body)
    if not location:
        reply = (
            "Please include a location. Send 'REPORT plastic Kencom' for waste, "
            "or 'BIN Kencom' if a dustbin is needed."
        )
        send_sms(phone, reply)
        release_inbound_id(dedupe_id)
        return jsonify(status="location_required"), 200

    waste_type = "General" if is_bin_report else classify_waste(body)
    details = (
        f"Missing dustbin coverage at {location}"
        if is_bin_report
        else body
    )
    try:
        record_report(
            phone=phone,
            message=body,
            waste_type=waste_type,
            zone=location,
            details=details,
            message_id=dedupe_id or f"sms:{phone}:{datetime.now().isoformat(timespec='seconds')}",
        )
    except Exception as e:
        release_inbound_id(dedupe_id)
        print(f"[SMS] Failed to save report: {e}")
        send_sms(phone, "We could not save your report. Please try again.")
        return jsonify(status="error"), 200

    if is_bin_report:
        reply = f"Asante! Dustbin coverage report received for {location}."
    else:
        reply = f"Asante! {waste_type} report received for {location}."
    send_sms(phone, reply)
    return jsonify(status="received"), 200


# --------------------------------------------------------- Helper pages ---
@app.route("/", methods=["GET", "POST", "OPTIONS"])
def home():
    # If the webhook URL in UltraMsg was pasted without /webhook, still work
    if request.method in ("POST", "OPTIONS"):
        return webhook()
    return "Jiji Safi AI bot is running. Webhook: POST /webhook"


@app.route("/reports", methods=["GET"])
def reports():
    if not os.path.exists(REPORTS_FILE):
        return jsonify([])
    with open(REPORTS_FILE, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


if __name__ == "__main__":
    print(f"Jiji Safi AI bot starting on http://localhost:5000 (model: {GEMINI_MODEL})")
    print("Africa's Talking callback URLs:")
    print("  USSD: http://localhost:5000/ussd")
    print("  SMS:  http://localhost:5000/sms")
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set - keyword-only mode, photos not analysed")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)

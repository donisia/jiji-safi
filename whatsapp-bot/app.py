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
from collections import defaultdict
from datetime import datetime

import requests
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

from texts import LABELS, T, ZONES as MENU_ZONES

load_dotenv()

ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE", "")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN", "")
APEX_URL = os.getenv(
    "APEX_URL", "https://apex.oracle.com/pls/apex/WKSP_JIJISAFI/whatsapp/report"
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")      # chats AND reads photos
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
REPORTS_FILE = "reports.json"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VOICES_DIR = os.path.join(BASE_DIR, "voices")
PUBLIC_URL = os.getenv("PUBLIC_URL", "").strip().rstrip("/")   # optional; otherwise read from ngrok
VOICE_ENDPOINT = os.getenv("VOICE_ENDPOINT", "audio").strip() or "audio"   # "audio" (mp3) or "voice" (voice-note style)

# Oracle's free APEX hosting blocks plain script traffic (requests/curl/Node).
# curl_cffi copies Chrome's connection style, which gets through.
try:
    from curl_cffi import requests as apex_http
    APEX_KW = {"impersonate": "chrome"}
except ImportError:                      # still works if it is not installed (may be blocked by Oracle)
    apex_http = requests
    APEX_KW = {}
    print("[APEX] curl_cffi not installed - run: python -m pip install curl_cffi")

# Root of your APEX REST address, e.g. https://oracleapex.com/ords/jijisafi
APEX_ROOT = os.getenv("APEX_ROOT", "").strip().rstrip("/") or (
    APEX_URL.rsplit("/whatsapp/report", 1)[0] if APEX_URL.endswith("/whatsapp/report") else APEX_URL
)

file_lock = threading.Lock()
chat_lock = threading.Lock()
histories = {}        # phone -> list of {"role": "user"/"model", "content": text} (resets when app restarts)
last_photo = {}       # phone -> latest photo url + analysis (attached to the next report)
seen_ids = set()      # message ids already handled (UltraMsg can retry webhooks)
MAX_HISTORY = 12      # how many recent messages the AI remembers per person
sessions = {}         # phone -> {"lang", "state", "draft"}  (menu position, resets when app restarts)
phone_locks = defaultdict(threading.Lock)   # one message at a time per person, keeps the steps in order

app = Flask(__name__)


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

If the user would rather use the guided menu for reporting, tell them to send the word menu.

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
ZONES = ["Ongata Rongai", "Ngong", "Matasia", "Kiserian", "Rongai", "Embulbul", "Kware", "Karen"]


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


PENDING_FILE = os.path.join(BASE_DIR, "pending_apex.json")   # reports APEX has not accepted yet
pending_lock = threading.Lock()


def _post_apex(report):
    """Returns "ok", "retry" (network/server problem) or "drop" (APEX rejected it, retrying won't help)."""
    try:
        r = apex_http.post(APEX_URL, json=report, timeout=20, **APEX_KW)
        print(f"[APEX] status={r.status_code} body={r.text[:200]}")
        if r.status_code < 400:
            return "ok"
        return "retry" if r.status_code >= 500 or r.status_code in (408, 429) else "drop"
    except Exception as e:
        print(f"[APEX] FAILED: {e}")
        return "retry"


def _read_pending():
    try:
        with open(PENDING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return []


def _write_pending(items):
    with open(PENDING_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def send_to_apex(report):
    """Send a report to APEX. If APEX is down, keep it in pending_apex.json and retry later."""
    result = _post_apex(report)
    if result == "retry":
        with pending_lock:
            items = _read_pending()
            items.append(report)
            _write_pending(items)
        print("[APEX] queued for retry")
    return result == "ok"


def retry_pending_loop(every=60):
    """Background thread: re-send queued reports. APEX ignores duplicates (same message_id)."""
    import time
    while True:
        time.sleep(every)
        with pending_lock:
            items = _read_pending()
            if not items:
                continue
            keep = []
            for rep in items:
                if _post_apex(rep) == "retry":
                    keep.append(rep)
            if len(keep) != len(items):
                print(f"[APEX] retry: sent {len(items) - len(keep)}, still waiting {len(keep)}")
            _write_pending(keep)


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


# ------------------------------------------------------------ Voice notes ---
_public_cache = {"url": ""}


def public_base_url():
    """Public https address of this bot (UltraMsg downloads the voice mp3 from it)."""
    if PUBLIC_URL:
        return PUBLIC_URL
    if _public_cache["url"]:
        return _public_cache["url"]
    try:
        tunnels = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=3).json().get("tunnels", [])
        for t in tunnels:
            if str(t.get("public_url", "")).startswith("https"):
                _public_cache["url"] = t["public_url"].rstrip("/")
                return _public_cache["url"]
    except Exception as e:
        print(f"[VOICE] could not read ngrok URL: {e}")
    return ""


def send_voice(to, lang, key):
    """Send the pre-recorded voice note for this step. Silently skipped if the mp3 doesn't exist."""
    path = os.path.join(VOICES_DIR, lang, f"{key}.mp3")
    if not ULTRAMSG_TOKEN or not os.path.exists(path):
        return False
    url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/{VOICE_ENDPOINT}"
    base = public_base_url()

    def post(audio):
        r = requests.post(url, data={"token": ULTRAMSG_TOKEN, "to": to, "audio": audio}, timeout=30)
        failed = (not r.ok) or '"error"' in r.text[:200]
        print(f"[VOICE] {lang}/{key} status={r.status_code} body={r.text[:150]}")
        return not failed

    try:
        if base and post(f"{base}/voice/{lang}/{key}.mp3"):
            return True
        # fallback: send the file itself (base64) if the link route didn't work
        with open(path, "rb") as f:
            return post(base64.b64encode(f.read()).decode())
    except Exception as e:
        print(f"[VOICE] FAILED {lang}/{key}: {e}")
        return False


@app.route("/voice/<lang>/<name>", methods=["GET"])
def serve_voice(lang, name):
    if lang not in ("en", "sw", "common") or not re.fullmatch(r"[a-z_]+\.mp3", name):
        abort(404)
    return send_from_directory(os.path.join(VOICES_DIR, lang), name, mimetype="audio/mpeg")


# ------------------------------------------------------- Guided menu flow ---
FLOW_STATES = ("type", "zone", "zone_other", "landmark", "photo", "confirm")
CANCEL_WORDS = {"menu", "cancel", "ghairi", "stop", "start", "anza"}
GREETINGS = {"hi", "hello", "hey", "habari", "mambo", "jambo", "niaje", "sasa", "hallo", "hii", "good morning", "good afternoon"}
SKIP_WORDS = {"0", "skip", "ruka"}
LANG_CHOICES = {"1": "en", "english": "en", "en": "en", "kiingereza": "en", "2": "sw", "kiswahili": "sw", "swahili": "sw", "sw": "sw"}
PHOTO_TYPES = ("Plastic", "Organic", "Metal", "General")
WASTE_BY_NUMBER = {1: "Plastic", 2: "Organic", 3: "Metal", 4: "General", 5: "Hazard"}


def new_session():
    return {"lang": None, "state": "new", "draft": {}}


def match_waste(text):
    """Waste type if the text clearly names one (e.g. 'plastiki'), else None."""
    t = text.lower() + " "
    for waste_type, words in WASTE_KEYWORDS:
        if any(w in t for w in words):
            return waste_type
    return None


def choice_number(low):
    return int(low) if low.isdigit() and len(low) <= 2 else None


def render(s, key):
    lang = s["lang"] or "en"
    text = T[lang][key]
    if key == "confirm":
        d = s["draft"]
        text = text.format(
            waste=LABELS[lang][d.get("waste_type", "General")],
            zone=d.get("zone", "-"),
            landmark=d.get("landmark") or T[lang]["none"],
            photo=T[lang]["yes"] if d.get("photo_url") else T[lang]["no"],
        )
    return text


def say(sender, s, key, voice=True, voice_key=None):
    """Send the text for a step, then (right after it) the pre-recorded voice note for that step."""
    send_whatsapp(sender, render(s, key))
    if voice:
        vk = voice_key or key
        send_voice(sender, "common" if (vk == "language" or not s["lang"]) else s["lang"], vk)


def goto(sender, s, state, voice=True):
    s["state"] = state
    key = {"new": "language", "lang": "language"}.get(state, state)
    say(sender, s, key, voice)


def finish_report(sender, phone, s, msg_id):
    d = s["draft"]
    hazard = d.get("waste_type") == "Hazard"
    details = d.get("landmark") or ""
    if d.get("analysis", {}).get("description"):
        details = (details + " | photo: " + d["analysis"]["description"]).strip(" |")
    if hazard:
        details = ("[HAZARD] " + details).strip()
    record = {
        "phone": phone,
        "message": "(menu report)",
        "photo_url": d.get("photo_url", ""),
        "waste_type": "General" if hazard else d.get("waste_type", "General"),
        "zone": d.get("zone") or "Not specified",
        "details": details or "(no extra details)",
        "message_id": msg_id,
        "reported_at": datetime.now().isoformat(timespec="seconds"),
    }
    print(f"[REPORT] {record['waste_type']} | {record['zone']} | {record['details']}")
    save_local(record)
    send_to_apex(record)
    s["draft"] = {}
    s["state"] = "menu"
    say(sender, s, "done_hazard" if hazard else "done")


def attach_photo(s, media_url):
    """Look at a photo with Gemini and store it on the draft. Returns the analysis (or None)."""
    analysis = analyze_photo(media_url)
    d = s["draft"]
    d["photo_url"] = media_url
    if analysis:
        d["analysis"] = analysis
    return analysis


def on_photo(sender, phone, s, body, msg_id, media_url):
    if s["lang"] is None:
        return goto(sender, s, "lang")
    if s["state"] == "chat":                      # free chat: the AI handles the photo
        return ai_turn(sender, phone, body, msg_id, media_url)

    analysis = attach_photo(s, media_url)
    if analysis and analysis.get("shows_waste") is False:
        s["draft"].pop("photo_url", None)
        s["draft"].pop("analysis", None)
        return say(sender, s, "not_waste", voice=False)

    wt = (analysis or {}).get("waste_type")
    if s["state"] == "photo":                     # this was the photo step
        return goto(sender, s, "confirm")
    if s["state"] not in FLOW_STATES:             # photo sent from the menu: start a report from it
        s["draft"] = {k: v for k, v in s["draft"].items() if k in ("photo_url", "analysis")}
        if wt in PHOTO_TYPES:
            s["draft"]["waste_type"] = wt
            return goto(sender, s, "zone")
        return goto(sender, s, "type")
    if s["state"] == "type" and wt in PHOTO_TYPES:
        s["draft"]["waste_type"] = wt
        return goto(sender, s, "zone")
    return say(sender, s, s["state"], voice=False)   # photo saved, repeat the question


def route(sender, phone, body, msg_id, media_url):
    s = sessions.setdefault(phone, new_session())
    text = (body or "").strip()
    low = text.lower().strip(" .!?)(")

    if media_url:
        return on_photo(sender, phone, s, body, msg_id, media_url)

    # ---- language ----
    if s["lang"] is None or s["state"] == "lang":
        choice = LANG_CHOICES.get(low) if s["state"] == "lang" else None
        if not choice:
            return goto(sender, s, "lang")
        s["lang"] = choice
        return goto(sender, s, "menu")

    # ---- words that work anywhere ----
    if low in CANCEL_WORDS:
        s["draft"] = {}
        return goto(sender, s, "menu")
    if low in ("language", "lugha", "lang"):
        return goto(sender, s, "lang")

    state = s["state"]
    n = choice_number(low)

    if state not in FLOW_STATES and state != "chat":
        if low in GREETINGS or state == "new":
            return goto(sender, s, "menu")
        if n == 1:
            s["draft"] = {}
            return goto(sender, s, "type")
        if n == 2:
            return goto(sender, s, "chat")
        if n == 3:
            s["state"] = "menu"
            return say(sender, s, "about")
        if n == 4:
            return goto(sender, s, "lang")
        say(sender, s, "invalid", voice=False)
        return send_whatsapp(sender, render(s, "menu"))

    if state == "chat":
        return ai_turn(sender, phone, body, msg_id, "")

    d = s["draft"]
    if state == "type":
        wt = WASTE_BY_NUMBER.get(n) if n else match_waste(low)
        if not wt:
            return say(sender, s, "invalid", voice=False)
        d["waste_type"] = wt
        return goto(sender, s, "zone")

    if state == "zone":
        if n and 1 <= n <= len(MENU_ZONES):
            d["zone"] = MENU_ZONES[n - 1]
            return goto(sender, s, "landmark")
        if n == 5:
            return goto(sender, s, "zone_other")
        z = extract_zone(text)
        if z != "Not specified":
            d["zone"] = z
            return goto(sender, s, "landmark")
        return say(sender, s, "invalid", voice=False)

    if state == "zone_other":
        if not text:
            return say(sender, s, "invalid", voice=False)
        d["zone"] = text[:60].title()
        return goto(sender, s, "landmark")

    if state == "landmark":
        d["landmark"] = "" if low in SKIP_WORDS else text[:200]
        if d.get("photo_url"):                    # photo already sent earlier, no need to ask again
            return goto(sender, s, "confirm")
        return goto(sender, s, "photo")

    if state == "photo":
        if low in SKIP_WORDS:
            return goto(sender, s, "confirm")
        return say(sender, s, "invalid", voice=False)

    if state == "confirm":
        if n == 1 or low in ("yes", "ndiyo", "send", "tuma", "ok"):
            return finish_report(sender, phone, s, msg_id)
        if n == 2 or low in ("no", "hapana"):
            s["draft"] = {}
            s["state"] = "menu"
            return say(sender, s, "cancelled")
        return say(sender, s, "invalid", voice=False)


# ------------------------------------------------------ AI chat (option 2) ---
def ai_turn(sender, phone, body, msg_id, media_url=""):
    """Free conversation with Gemini. It can still log a report by itself."""
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
        record = {
            "phone": phone,
            "message": original or "(photo)",
            "photo_url": (last_photo.get(phone) or {}).get("url", ""),
            "waste_type": report.get("waste_type") or "General",
            "zone": report.get("zone") or "Not specified",
            "details": report.get("details") or original or "(photo)",
            "message_id": msg_id,
            "reported_at": datetime.now().isoformat(timespec="seconds"),
        }
        last_photo.pop(phone, None)
        print(f"[REPORT] {record['waste_type']} | {record['zone']} | {record['details']}")
        save_local(record)
        send_to_apex(record)

    print(f"[OUT] {phone}: {result['reply']}")
    send_whatsapp(sender, result["reply"])


# ------------------------------------------------------ Message handling ---
def handle_message(sender, body, msg_id, media_url=""):
    """Runs in a background thread so the webhook can answer UltraMsg instantly."""
    try:
        phone = sender.replace("@c.us", "")
        print(f"[IN ] {phone}: {body or '(photo)'}")
        with phone_locks[phone]:
            route(sender, phone, body, msg_id, media_url)
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



# ------------------------------------------- Relay for the dashboard -------
# The dashboard asks the bot, the bot asks APEX (so Oracle sees a Chrome-style client).
RELAY_OK = re.compile(r"^(reports|reports/\d+|credits)$")


@app.route("/apex/jiji/<path:sub>", methods=["GET", "PUT", "POST"])
def apex_relay(sub):
    if not RELAY_OK.fullmatch(sub):
        abort(404)
    url = f"{APEX_ROOT}/jiji/{sub}"
    try:
        if request.method == "GET":
            r = apex_http.get(url, timeout=25, **APEX_KW)
        else:
            r = apex_http.request(request.method, url, data=request.get_data(),
                                  headers={"Content-Type": "application/json"}, timeout=25, **APEX_KW)
        return (r.content, r.status_code, {"Content-Type": r.headers.get("content-type", "application/json")})
    except Exception as e:
        print(f"[RELAY] FAILED {request.method} {url}: {e}")
        return jsonify(error="APEX unreachable", detail=str(e)), 502


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
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set - keyword-only mode, photos not analysed")
    threading.Thread(target=retry_pending_loop, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)

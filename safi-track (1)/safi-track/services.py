import json
import math
import os
import re
import smtplib
from email.message import EmailMessage

import requests

ZONES = {
    "Kencom": (-1.2864, 36.8244),
    "Tom Mboya Street": (-1.2845, 36.8255),
    "Moi Avenue": (-1.2870, 36.8230),
    "Kimathi Street": (-1.2845, 36.8235),
    "River Road": (-1.2833, 36.8305),
    "Country Bus": (-1.2815, 36.8330),
    "Railway Station": (-1.2905, 36.8280),
    "Muthurwa": (-1.2905, 36.8335),
    "Gikomba": (-1.2840, 36.8420),
    "GPO / Kenyatta Avenue": (-1.2835, 36.8190),
}

WASTE_TYPES = ["organic", "plastic", "mixed", "blocked drain", "burning", "missing dustbin", "clean"]
VOLUMES = ["small bag", "sack", "pile", "blocked drain", "no bin", "none"]

_IMPLIED_VOLUME = {"blocked drain": "blocked drain", "missing dustbin": "no bin", "clean": "none"}


def nearest_zone(lat, lon, max_km=1.5):
    best, best_d = None, 1e9
    for name, (zl, zn) in ZONES.items():
        d = math.hypot((lat - zl) * 111, (lon - zn) * 111 * math.cos(math.radians(lat)))
        if d < best_d:
            best, best_d = name, d
    return best if best_d <= max_km else "Nairobi CBD (other)"


def match_zone(text):
    t = text.lower()
    for name in ZONES:
        if name.lower() in t:
            return name
    aliases = {"bus station": "Country Bus", "railways": "Railway Station", "gpo": "GPO / Kenyatta Avenue",
               "kenyatta": "GPO / Kenyatta Avenue", "tom mboya": "Tom Mboya Street", "moi ave": "Moi Avenue"}
    for k, v in aliases.items():
        if k in t:
            return v
    return None


def normalize(draft: dict):
    wt = draft.get("waste_type")
    if wt in _IMPLIED_VOLUME and not draft.get("volume"):
        draft["volume"] = _IMPLIED_VOLUME[wt]
    if wt == "blocked drain":
        draft["drain_blocked"] = True
    return draft


# ---------- Gemini ----------
def _gemini():
    from google import genai

    key = os.getenv("GEMINI_API_KEY")
    return genai.Client(api_key=key) if key else None


def _model():
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _json_from(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    return json.loads(m.group(0)) if m else {}


def gemini_vision(image_bytes: bytes, mime="image/jpeg") -> dict:
    client = _gemini()
    if not client:
        return {}
    from google.genai import types

    prompt = (
        "You analyse street photos from Nairobi CBD for a waste-reporting system. "
        f"Return ONLY JSON with keys: waste_type (one of {WASTE_TYPES}), volume (one of {VOLUMES}), "
        "drain_blocked (true/false), burning (true/false), missing_bin (true/false), "
        "clean_zone (true if the street is clean, else false), stall_context (short text)."
    )
    try:
        resp = client.models.generate_content(
            model=_model(),
            contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), prompt],
        )
        return _json_from(resp.text)
    except Exception as e:  # noqa: BLE001
        print("Gemini vision error:", e)
        return {}


def extract_report(text: str) -> dict:
    """Pull zone / waste_type / volume out of free text (English, Swahili, Sheng)."""
    out = {}
    zone = match_zone(text)
    if zone:
        out["zone"] = zone
    client = _gemini()
    if client:
        prompt = (
            "Extract a waste report from this message (English/Swahili/Sheng). Return ONLY JSON with keys "
            f"zone (string or null), waste_type (one of {WASTE_TYPES} or null), volume (one of {VOLUMES} or null). "
            f"Message: {text}"
        )
        try:
            resp = client.models.generate_content(model=_model(), contents=prompt)
            data = _json_from(resp.text)
            for k in ("zone", "waste_type", "volume"):
                if data.get(k) and not out.get(k):
                    out[k] = data[k]
        except Exception as e:  # noqa: BLE001
            print("Gemini text error:", e)
    # keyword fallback
    t = text.lower()
    if not out.get("waste_type"):
        for kw, wt in [("mahindi", "organic"), ("mboga", "organic"), ("husk", "organic"), ("organic", "organic"),
                       ("plastic", "plastic"), ("chupa", "plastic"), ("nylon", "plastic"), ("burn", "burning"),
                       ("choma", "burning"), ("drain", "blocked drain"), ("mtaro", "blocked drain"),
                       ("no bin", "missing dustbin"), ("dustbin", "missing dustbin"), ("mixed", "mixed"),
                       ("clean", "clean"), ("safi", "clean")]:
            if kw in t:
                out["waste_type"] = wt
                break
    if not out.get("volume"):
        for kw, v in [("small bag", "small bag"), ("bag", "small bag"), ("sack", "sack"), ("gunia", "sack"),
                      ("pile", "pile"), ("rundo", "pile"), ("lundo", "pile")]:
            if kw in t:
                out["volume"] = v
                break
    if out.get("waste_type") not in WASTE_TYPES:
        out.pop("waste_type", None)
    if out.get("volume") not in VOLUMES:
        out.pop("volume", None)
    return out


# ---------- ElevenLabs ----------
def stt(audio_bytes: bytes) -> str:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        return ""
    try:
        r = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": key},
            files={"file": ("voice.ogg", audio_bytes, "audio/ogg")},
            data={"model_id": "scribe_v1"},
            timeout=60,
        )
        r.raise_for_status()
        return r.json().get("text", "")
    except Exception as e:  # noqa: BLE001
        print("ElevenLabs STT error:", e)
        return ""


def tts(text: str):
    key, voice = os.getenv("ELEVENLABS_API_KEY"), os.getenv("ELEVENLABS_VOICE_ID")
    if not key or not voice:
        return None
    try:
        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            json={"text": text, "model_id": "eleven_multilingual_v2"},
            timeout=60,
        )
        r.raise_for_status()
        return r.content
    except Exception as e:  # noqa: BLE001
        print("ElevenLabs TTS error:", e)
        return None


# ---------- Email ----------
def send_email(subject: str, body: str, csv_text: str, filename="safi_track_reports.csv"):
    user, pwd, to = os.getenv("GMAIL_ADDRESS"), os.getenv("GMAIL_APP_PASSWORD"), os.getenv("ADMIN_EMAIL")
    if not (user and pwd and to):
        raise RuntimeError("Set GMAIL_ADDRESS, GMAIL_APP_PASSWORD and ADMIN_EMAIL in .env")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = user, to, subject
    msg.set_content(body)
    msg.add_attachment(csv_text.encode(), maintype="text", subtype="csv", filename=filename)
    with smtplib.SMTP("smtp.gmail.com", 587) as s:
        s.starttls()
        s.login(user, pwd)
        s.send_message(msg)
    return to

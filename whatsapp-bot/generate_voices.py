"""
Makes the pre-recorded voice notes (one mp3 per step, per language) with ElevenLabs.
Run once - start.bat does it for you the first time. Files go in voices/<lang>/<step>.mp3
Existing files are skipped, so it costs nothing to run again.   Use --force to redo them all.
"""
import os
import sys

import requests
from dotenv import load_dotenv

from texts import VOICE

load_dotenv()
KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "").strip() or "21m00Tcm4TlvDq8ikWAM"
MODEL = os.getenv("ELEVENLABS_MODEL", "").strip() or "eleven_multilingual_v2"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices")


def main():
    force = "--force" in sys.argv
    if not KEY:
        print("No ELEVENLABS_API_KEY in .env - skipping voice notes (the bot still works, text only).")
        return
    made = skipped = failed = 0
    for lang, clips in VOICE.items():
        os.makedirs(os.path.join(OUT, lang), exist_ok=True)
        for name, text in clips.items():
            path = os.path.join(OUT, lang, f"{name}.mp3")
            if os.path.exists(path) and not force:
                skipped += 1
                continue
            try:
                r = requests.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128",
                    headers={"xi-api-key": KEY, "Content-Type": "application/json"},
                    json={"text": text, "model_id": MODEL},
                    timeout=90,
                )
                if not r.ok:
                    print(f"  FAILED {lang}/{name}: HTTP {r.status_code} {r.text[:200]}")
                    failed += 1
                    continue
                with open(path, "wb") as f:
                    f.write(r.content)
                print(f"  made   {lang}/{name}.mp3")
                made += 1
            except requests.RequestException as e:
                print(f"  FAILED {lang}/{name}: {e}")
                failed += 1
    print(f"Done. made={made} skipped={skipped} failed={failed}  (voice={VOICE_ID}, model={MODEL})")


if __name__ == "__main__":
    main()

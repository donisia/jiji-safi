import asyncio
import io
import logging
import os

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (Application, CommandHandler, ContextTypes, MessageHandler, filters)

load_dotenv()

import analytics  # noqa: E402
import db  # noqa: E402
import services  # noqa: E402

logging.basicConfig(level=logging.INFO)

START = "Jiji Safi? Safi Track hapa! Report waste na location/zone + type + photo. Voice pia sawa."
ZONE_LIST = ", ".join(services.ZONES)


def is_admin(user_id: int) -> bool:
    ids = [i.strip() for i in os.getenv("ADMIN_IDS", "").split(",") if i.strip()]
    return not ids or str(user_id) in ids


async def reply(update: Update, text: str, as_voice: bool = False):
    await update.message.reply_text(text)
    if as_voice:
        audio = await asyncio.to_thread(services.tts, text)
        if audio:
            await update.message.reply_audio(io.BytesIO(audio), filename="safi.mp3")


# ---------- report intake ----------
async def process(update: Update, context: ContextTypes.DEFAULT_TYPE, voice=False):
    d = context.user_data.setdefault("draft", {})
    if voice:
        d["voice"] = True
    services.normalize(d)
    as_voice = d.get("voice", False)

    if not (d.get("zone") or (d.get("lat") is not None)):
        return await reply(update, "Uko wapi? Tuma location ya Telegram (📎 > Location) au andika zone/landmark. "
                                   f"Zones: {ZONE_LIST}", as_voice)
    if not d.get("waste_type"):
        return await reply(update, "Ni taka gani? organic (mahindi/mboga), plastic, mixed, blocked drain, "
                                   "burning, missing dustbin - au 'clean' kama ni safi.", as_voice)
    if not d.get("volume"):
        return await reply(update, "Ni kiasi gani? small bag, sack, au pile?", as_voice)

    if d.get("lat") is not None and not d.get("zone"):
        d["zone"] = services.nearest_zone(d["lat"], d["lon"])

    u = update.effective_user
    db.add_report({
        "user_id": u.id, "username": u.username, "lat": d.get("lat"), "lon": d.get("lon"),
        "zone": d["zone"], "waste_type": d["waste_type"], "volume": d["volume"],
        "photo_url": d.get("photo_url"), "drain_blocked": d.get("drain_blocked"),
        "clean_zone": d.get("clean_zone") or d["waste_type"] == "clean",
    })
    msg = f"Safi! Report logged for {d['zone']} - {d['waste_type']} - {d['volume']}. Asante!"
    context.user_data["draft"] = {}

    if d["waste_type"] == "clean" and d.get("photo_url") is not None:
        msg += "\n" + check_credit(u, d["zone"])
    await reply(update, msg, as_voice)


def check_credit(user, zone) -> str:
    from datetime import timedelta
    dates = set(db.clean_dates(user.id, zone))
    today = db.now().date()
    streak = [today - timedelta(days=i) for i in range(3)]
    if not all(day in dates for day in streak):
        return f"Clean report imeingia ({len(dates)} day(s)). Weka safi siku 3 mfululizo upate credits!"
    last = db.last_credit_date(user.id, zone)
    if last and last >= streak[-1]:
        return "Umeshapata credits za streak hii. Endelea kuweka safi!"
    db.add_credit(user.id, user.username, zone, 10)
    return f"Clean zone verified! +10 Safi Credits for {user.first_name}. Total: {db.total_credits(user.id)}"


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = await asyncio.to_thread(services.extract_report, update.message.text)
    d = context.user_data.setdefault("draft", {})
    for k, v in data.items():
        d[k] = v
    await process(update, context)


async def on_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    loc = update.message.location
    d = context.user_data.setdefault("draft", {})
    d["lat"], d["lon"] = loc.latitude, loc.longitude
    d["zone"] = services.nearest_zone(loc.latitude, loc.longitude)
    await process(update, context)


async def on_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo = update.message.photo[-1]
    f = await photo.get_file()
    data = bytes(await f.download_as_bytearray())
    d = context.user_data.setdefault("draft", {})
    d["photo_url"] = f.file_path or photo.file_id
    v = await asyncio.to_thread(services.gemini_vision, data)
    if v:
        wt = v.get("waste_type")
        if v.get("burning"):
            wt = "burning"
        elif v.get("drain_blocked"):
            wt = wt if wt in services.WASTE_TYPES else "blocked drain"
        elif v.get("missing_bin") and not wt:
            wt = "missing dustbin"
        if wt in services.WASTE_TYPES:
            d["waste_type"] = wt
        if v.get("volume") in services.VOLUMES:
            d["volume"] = v["volume"]
        d["drain_blocked"] = bool(v.get("drain_blocked"))
        d["clean_zone"] = bool(v.get("clean_zone"))
        await update.message.reply_text(
            f"Vision: {v.get('waste_type', '?')} detected, Volume: {v.get('volume', '?')}, "
            f"Drain blocked: {'Yes' if v.get('drain_blocked') else 'No'}, "
            f"Clean zone: {'Yes' if v.get('clean_zone') else 'No'}")
    if update.message.caption:
        extra = await asyncio.to_thread(services.extract_report, update.message.caption)
        for k, val in extra.items():
            if k in ("zone",) or not d.get(k):
                d[k] = val
    await process(update, context)


async def on_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    f = await update.message.voice.get_file()
    audio = bytes(await f.download_as_bytearray())
    text = await asyncio.to_thread(services.stt, audio)
    if not text:
        return await update.message.reply_text(
            "Sijaelewa voice note (ElevenLabs haijawekwa?). Andika report tafadhali.")
    await update.message.reply_text(f"Nimesikia: {text}")
    data = await asyncio.to_thread(services.extract_report, text)
    d = context.user_data.setdefault("draft", {})
    d.update(data)
    await process(update, context, voice=True)


# ---------- commands ----------
async def cmd_start(update, context):
    await update.message.reply_text(START)


async def cmd_report(update, context):
    context.user_data["draft"] = {}
    await update.message.reply_text(
        "Sawa, tuanze report.\n1) Tuma location au andika zone\n2) Aina ya taka (organic/plastic/mixed/"
        "blocked drain/burning/missing dustbin)\n3) Kiasi (small bag/sack/pile)\n4) Photo (optional lakini bora)\n"
        "Unaweza tuma kila kitu kwa ujumbe mmoja, au voice note.")


async def cmd_hotspots(update, context):
    await update.message.reply_text(analytics.hotspots())


async def cmd_co2e(update, context):
    await update.message.reply_text(analytics.co2e_summary(7)[0])


async def cmd_needpickup(update, context):
    await update.message.reply_text(analytics.need_pickup())


async def cmd_missingbins(update, context):
    await update.message.reply_text(analytics.missing_bins())


async def cmd_collected(update, context):
    if not is_admin(update.effective_user.id):
        return await update.message.reply_text("Admin only.")
    zone = " ".join(context.args)
    if not zone:
        return await update.message.reply_text("Tumia: /collected <zone>")
    n = db.mark_collected(zone)
    await update.message.reply_text(f"{n} reports za {zone} zimewekwa collected.")


async def _send_report(update, days, label):
    if not is_admin(update.effective_user.id):
        return await update.message.reply_text("Admin only.")
    body, total = analytics.build_report(days, label)
    csv_text = analytics.reports_csv(days)
    try:
        to = await asyncio.to_thread(
            services.send_email, f"Safi Track - {label} Waste & CO2e Report - Nairobi CBD", body, csv_text)
    except Exception as e:  # noqa: BLE001
        return await update.message.reply_text(f"Email haikutumwa: {e}")
    await update.message.reply_text(f"Report sent to {to} - Total CO2e: {total:.1f} kg")


async def cmd_daily(update, context):
    await _send_report(update, 1, "Daily")


async def cmd_weekly(update, context):
    await _send_report(update, 7, "Weekly")


def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN missing in .env")
    db.init()
    app = Application.builder().token(token).build()
    for name, fn in [("start", cmd_start), ("report", cmd_report), ("hotspots", cmd_hotspots),
                     ("co2e", cmd_co2e), ("needpickup", cmd_needpickup), ("missingbins", cmd_missingbins),
                     ("collected", cmd_collected), ("dailyreport", cmd_daily), ("weeklyreport", cmd_weekly)]:
        app.add_handler(CommandHandler(name, fn))
    app.add_handler(MessageHandler(filters.PHOTO, on_photo))
    app.add_handler(MessageHandler(filters.VOICE, on_voice))
    app.add_handler(MessageHandler(filters.LOCATION, on_location))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    print("Safi Track bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
